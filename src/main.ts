import './style.css';
import { Game, buyPrice, sellPrice } from './sim';
import { ITEMS, NOTES, UPGRADES, type ModSlot } from './content';
import { GameScene, STATIONS } from './scene';
import { FieldAudio } from './audio';
import * as T from 'three';
const SAVE_KEY = 'deadwire.save.v1';
const app = document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML = `<canvas id="world" aria-label="DEADWIRE 3D game world"></canvas><div class="vignette"></div><div id="loading"><div class="wordmark">DEAD<span>WIRE</span><i> / </i></div><p id="loading-text">Establishing connection…</p><div class="loading-line"></div></div><div id="menu"></div><div id="hud"></div><div id="toast" role="status"></div><div id="damage"></div>`;
const canvas = document.querySelector<HTMLCanvasElement>('#world')!,
  menuEl = document.querySelector<HTMLDivElement>('#menu')!,
  hud = document.querySelector<HTMLDivElement>('#hud')!,
  toastEl = document.querySelector<HTMLDivElement>('#toast')!;
let game = new Game(),
  saveWarning = '';
try {
  const saved = localStorage.getItem(SAVE_KEY);
  if (saved) game = Game.restore(saved);
} catch {
  saveWarning = 'Saved data could not be read. A new local operator is ready.';
}
let view: GameScene;
let menu = true,
  tab = game.state.mode === 'raid' ? 'pause' : 'home',
  selectedNote = '',
  loaded = false,
  ads = false,
  firing = false,
  lastEvent = game.state.nextEventId - 1,
  lastMode = game.state.mode,
  lastSave = 0,
  lastHUD = 0;
const keys = new Set<string>(),
  audio = new FieldAudio();
let toastTimer = 0,
  tabRestore = 'home',
  sensitivity = 0.0022;
const escape = (s: string) =>
  s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
const money = (n: number) => '$' + Math.floor(n).toLocaleString();
const time = (n: number) =>
  `${Math.floor(n / 60)
    .toString()
    .padStart(2, '0')}:${Math.floor(n % 60)
    .toString()
    .padStart(2, '0')}`;
const button = (label: string, action: string, cls = '', disabled = false, extra = '') =>
  `<button class="${cls}" data-action="${action}" ${disabled ? 'disabled' : ''} ${extra}>${label}</button>`;
function toast(text: string) {
  toastEl.textContent = text;
  toastEl.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toastEl.classList.remove('visible'), 4200);
}
function save() {
  try {
    localStorage.setItem(SAVE_KEY, game.serialize());
  } catch {
    toast('Local save unavailable. Keep this window open to retain this session.');
  }
}
function tabButton(id: string, label: string, index: string) {
  return `<button data-tab="${id}" class="nav-item ${tab === id ? 'active' : ''}"><span>${index}</span>${label}<b>↗</b></button>`;
}
function equipped(id: string) {
  const eq = game.profile.equipped;
  return eq.weaponId === id || eq.armorId === id || Object.values(eq.mods).includes(id);
}
function itemCard(id: string, mode: 'stash' | 'shop' | 'pack') {
  const item = ITEMS[id];
  if (!item) return '';
  const count = (mode === 'pack' ? game.state.player.backpack : game.profile.stash).filter(
    (x) => x === id,
  ).length;
  const actions =
    mode === 'shop'
      ? button(
          `Buy · ${money(buyPrice(id))}`,
          'buy',
          'small',
          game.profile.bank < buyPrice(id),
          `data-id="${id}"`,
        )
      : mode === 'stash'
        ? `${['weapon', 'armor', 'mod'].includes(item.kind) ? button(equipped(id) ? 'Equipped' : 'Equip', 'equip', 'small', equipped(id), `data-id="${id}"`) : ''}${sellPrice(id) > 0 ? button(`Sell · ${money(sellPrice(id))}`, 'sell', 'small quiet', false, `data-id="${id}"`) : ''}`
        : item.kind === 'note'
          ? button('Read document', 'read', 'small', false, `data-id="${id}"`)
          : '';
  return `<article class="item-card"><div class="item-symbol ${item.kind}">${item.kind === 'weapon' ? '⌁' : item.kind === 'armor' ? '⬡' : item.kind === 'note' ? '▤' : item.kind === 'mod' ? '⊕' : '◇'}</div><div class="item-copy"><div class="eyebrow">${item.kind}${count > 1 ? ' · ×' + count : ''}</div><h3>${escape(item.name)}</h3><p>${escape(item.description)}</p><div class="item-actions">${actions}</div></div></article>`;
}
function kitSummary() {
  const p = game.profile,
    e = p.equipped;
  return `<div class="kit-summary"><div><span>PRIMARY WEAPON</span><strong>${ITEMS[e.weaponId].name}</strong></div><div><span>PROTECTION</span><strong>${e.armorId ? ITEMS[e.armorId].name : 'Unarmored'}</strong></div><div><span>FIELD SUPPLIES</span><strong>${Math.min(3, p.stash.filter((x) => x === 'medkit').length)} trauma kits · ${120 + (p.upgrades.ammo ?? 0) * 30} rounds</strong></div></div>`;
}
function header() {
  return `<header><button class="brand" data-tab="home">DEAD<span>WIRE</span><i> / </i></button><div class="header-center"><span class="live-dot"></span>${game.state.mode === 'hideout' ? 'SAFEHOUSE / CONNECTION SECURE' : 'OPERATION BLACKWATER'}</div><div class="funds"><span>RESERVE</span><strong id="bank">${money(game.profile.bank)}</strong><span class="operator">OPERATOR 01 <i>▰</i></span></div></header>`;
}
function renderMenu() {
  if (!loaded) return;
  menuEl.hidden = !menu;
  hud.hidden = menu;
  if (!menu) {
    menuEl.innerHTML = '';
    return;
  }
  const mode = game.state.mode;
  if (mode === 'dead' || mode === 'extracted') {
    const s = game.state.summary!;
    menuEl.innerHTML = `${header()}<main class="result"><div class="eyebrow">OPERATION BLACKWATER / AFTER ACTION REPORT</div><h1>${s.success ? 'YOU MADE IT<br><em>HOME.</em>' : 'SIGNAL<br><em class="red">LOST.</em>'}</h1><p>${escape(s.reason)}</p><div class="result-stats"><div><span>SECURED CASH</span><b>${money(s.cash)}</b></div><div><span>RECOVERED ITEMS</span><b>${s.items.length + s.notes.length}</b></div><div><span>HOSTILES DOWN</span><b>${s.kills}</b></div><div><span>TIME IN FIELD</span><b>${time(s.duration)}</b></div></div>${s.notes.length ? `<p>${s.notes.length} document${s.notes.length === 1 ? '' : 's'} added to your intel archive.</p>` : ''}${button('Return to hideout →', 'return', 'primary')}</main>`;
    return;
  }
  if (mode === 'raid') {
    renderRaidMenu();
    return;
  }
  const nav = `<aside class="sidebar"><div class="eyebrow">FORWARD OPERATING BASE</div><h2>The hideout<span>SECTOR 00 / OFF THE GRID</span></h2><nav>${tabButton('home', 'Operations', '01')}${tabButton('loadout', 'Loadout', '02')}${tabButton('weapons', 'Weapons', '03')}${tabButton('supply', 'Supply', '04')}${tabButton('upgrades', 'Facilities', '05')}${tabButton('archive', 'Intel archive', '06')}</nav><div class="sidebar-bottom"><span class="live-dot"></span> ALL SYSTEMS NOMINAL<p>Whatever you bring back,<br>you get to keep.</p>${button('Walk the hideout ↗', 'walk', 'outline')}</div></aside>`;
  let content = '';
  if (tab === 'home' || tab === 'deploy') {
    content = `<section class="home-copy"><div class="eyebrow">PRIVATE MILITARY OPERATIONS / 09</div><h1>GO IN.<br>GET OUT.<br><em>GET PAID.</em></h1><p>Beyond the cordon, everything has a price.<br>Find what’s worth keeping. Make it home alive.</p><div class="stats-strip"><div><b>${game.profile.extractions.toString().padStart(2, '0')}</b><span>EXTRACTIONS</span></div><div><b>${game.profile.kills.toString().padStart(2, '0')}</b><span>HOSTILES DOWN</span></div><div><b>${game.profile.lore.length.toString().padStart(2, '0')}<small> / 08</small></b><span>INTEL RECOVERED</span></div></div></section><section class="mission-panel"><div class="mission-top"><span class="eyebrow">AVAILABLE DEPLOYMENT</span><span class="threat">● ELEVATED THREAT</span></div><div class="map-preview">${mapSVG(false, true)}<span class="sector-tag">09 / EXCLUSION ZONE</span></div><div class="mission-body"><div class="eyebrow">COASTAL INDUSTRIAL DISTRICT</div><h2>BLACKWATER</h2><p>A silent harbor. An occupied refinery.<br>Find out what they left behind.</p><div class="mission-meta"><span>◷ 22 MINUTES</span><span>◇ 8 LOCATIONS</span><span>↗ 3 EXFIL ROUTES</span></div>${kitSummary()}${button('Deploy to Blackwater →', 'deploy', 'primary')}<span class="risk-note">Equipment carried into a raid is lost on death.</span></div></section>`;
  } else if (tab === 'loadout') {
    const ids = [...new Set(['m9', ...game.profile.stash])];
    content = `<section class="panel wide"><div class="eyebrow">02 / OPERATOR EQUIPMENT</div><h1>READY FOR<br><em>ANYTHING.</em></h1><p class="lead">Equip your next deployment. Recovered gear stays here until you take it out.</p>${kitSummary()}<div class="panel-title">YOUR STASH <span>${game.profile.stash.length} ITEMS</span></div><div class="item-grid">${ids.map((id) => itemCard(id, 'stash')).join('')}</div></section>`;
  } else if (tab === 'weapons') {
    const stats = game.weaponStats();
    content = `<section class="panel"><div class="eyebrow">03 / WEAPON WORKBENCH</div><h1>BUILD YOUR<br><em>ADVANTAGE.</em></h1><h2>${ITEMS[game.profile.equipped.weaponId].name}</h2><div class="weapon-stats"><div><b>${stats.damage}</b><span>DAMAGE</span></div><div><b>${stats.magazine}</b><span>MAGAZINE</span></div><div><b>${Math.round(stats.range)} m</b><span>RANGE</span></div><div><b>${stats.reloadTime.toFixed(1)} s</b><span>RELOAD</span></div></div>${(
      ['optic', 'muzzle', 'magazine'] as ModSlot[]
    )
      .map(
        (slot) =>
          `<div class="mod-row"><div class="eyebrow">${slot.toUpperCase()}</div><select aria-label="${slot} modification" data-slot="${slot}"><option value="">Standard / none</option>${Object.values(
            ITEMS,
          )
            .filter((i) => i.slot === slot && game.profile.stash.includes(i.id))
            .map(
              (i) =>
                `<option value="${i.id}" ${game.profile.equipped.mods[slot] === i.id ? 'selected' : ''}>${i.name}</option>`,
            )
            .join(
              '',
            )}</select><p>${game.profile.equipped.mods[slot] ? ITEMS[game.profile.equipped.mods[slot]!].description : 'Visit Supply to acquire compatible attachments.'}</p></div>`,
      )
      .join(
        '',
      )}<p class="subtle">Attachments affect accuracy, sound, range, and reload speed in the field.</p></section>`;
  } else if (tab === 'supply') {
    content = `<section class="panel wide"><div class="eyebrow">04 / QUARTERMASTER</div><h1>THE COST OF<br><em>COMING HOME.</em></h1><p class="lead">Spend secured cash on equipment. Sell recovered valuables from your Loadout.</p><div class="item-grid">${Object.values(
      ITEMS,
    )
      .filter((i) => i.value > 0 && !['valuable', 'note'].includes(i.kind))
      .map((i) => itemCard(i.id, 'shop'))
      .join('')}</div></section>`;
  } else if (tab === 'upgrades') {
    content = `<section class="panel"><div class="eyebrow">05 / HIDEOUT FACILITIES</div><h1>BETTER<br><em>EVERY RUN.</em></h1><p class="lead">Permanent improvements. These stay with you, even when a deployment goes wrong.</p>${Object.values(
      UPGRADES,
    )
      .map((u) => {
        const level = game.profile.upgrades[u.id] ?? 0,
          cost = u.baseCost * (level + 1);
        return `<article class="upgrade"><div class="eyebrow">LEVEL ${level} / ${u.maxLevel}</div><h3>${u.name}</h3><p>${u.description}</p><div class="level-bar">${Array.from({ length: u.maxLevel }, (_, i) => `<i class="${i < level ? 'filled' : ''}"></i>`).join('')}</div>${button(level === u.maxLevel ? 'Fully upgraded' : `Upgrade · ${money(cost)}`, 'upgrade', 'outline', level === u.maxLevel || game.profile.bank < cost, `data-id="${u.id}"`)}</article>`;
      })
      .join('')}</section>`;
  } else if (tab === 'archive') {
    content = `<section class="panel"><div class="eyebrow">06 / RECOVERED INTELLIGENCE</div><h1>NOTHING<br><em>STAYS BURIED.</em></h1><p class="lead">Documents only enter the archive after a successful extraction.</p>${game.profile.lore.length ? game.profile.lore.map((id) => `<article class="document"><span class="eyebrow">DECLASSIFIED / ${id.toUpperCase().replace('NOTE_', '')}</span><h3>${NOTES[id].title}</h3><p>${escape(NOTES[id].text)}</p></article>`).join('') : `<div class="empty-state"><span>▤</span><h3>No documents recovered</h3><p>Search caches across Blackwater and extract with the notes you find. The harbor has a story to tell.</p></div>`}</section>`;
  }
  menuEl.innerHTML = `${header()}${nav}<main class="menu-content ${tab === 'home' || tab === 'deploy' ? 'home-layout' : ''}">${content}</main><footer><span>DEADWIRE <b> / </b> LOCAL OPERATIONS</span><span>WASD MOVE <b>·</b> MOUSE LOOK <b>·</b> E INTERACT <b>·</b> TAB MENU</span>${button('Controls & settings', 'settings', 'text-button')}</footer>`;
  if (tab === 'settings') renderSettings();
}
function mapSVG(live: boolean, mini = false) {
  const w = game.world,
    p = game.state.player;
  const paths = `<path d="M150 0V480 M335 0V480 M0 355H480 M0 90H480 M20 202H460" fill="none" stroke="#748072" stroke-width="7" opacity=".35"/>`;
  return `<svg class="tactical-svg" viewBox="0 0 480 480" role="img" aria-label="Blackwater tactical map"><defs><pattern id="grid${mini ? 'm' : 'l'}" width="48" height="48" patternUnits="userSpaceOnUse"><path d="M48 0H0V48" fill="none" stroke="#667e68" stroke-width=".5" opacity=".25"/></pattern></defs><rect width="480" height="480" fill="#273630"/><path d="M428 0L455 64 430 170 450 240 428 335 450 420 432 480H480V0Z" fill="#385657"/><rect width="480" height="480" fill="url(#grid${mini ? 'm' : 'l'})"/>${paths}${w.buildings.map((b) => `<rect x="${b.x + 240 - b.w / 2}" y="${b.z + 240 - b.d / 2}" width="${b.w}" height="${b.d}" fill="#a4ad93" opacity=".65"/>`).join('')}${w.pois
    .filter((o) => o.id !== 'insertion')
    .map(
      (o, i) =>
        `<g><circle cx="${o.x + 240}" cy="${o.z + 240}" r="${mini ? 6 : 4}" fill="#bac89b"/>${!mini ? `<text x="${o.x + 248}" y="${o.z + 238}" fill="#d2d8c2" font-size="9" font-family="monospace">${i + 1}. ${o.name.toUpperCase()}</text>` : ''}</g>`,
    )
    .join(
      '',
    )}${w.extractions.map((e) => `<g><circle cx="${e.x + 240}" cy="${e.z + 240}" r="10" fill="none" stroke="#bed88b"/><text x="${e.x + 240}" y="${e.z + 244}" fill="#d7edb0" text-anchor="middle" font-size="11">↗</text></g>`).join('')}${live ? `<g transform="translate(${p.x + 240} ${p.z + 240}) rotate(${(-p.yaw * 180) / Math.PI})"><circle r="12" fill="#e6b96a" opacity=".2"/><path d="M0 -7L5 6 0 3 -5 6Z" fill="#f3c785"/></g>${game.state.extraction?.called ? `<circle cx="${game.state.extraction.x + 240}" cy="${game.state.extraction.z + 240}" r="11" fill="none" stroke="#edb05e" stroke-dasharray="3 2"/>` : ''}` : `<circle cx="48" cy="432" r="7" fill="#d3b578"/>`}<text x="18" y="27" fill="#c8d2b6" font-family="monospace" font-size="12">N ↑</text></svg>`;
}
function renderRaidMenu() {
  const p = game.state.player;
  let body = '';
  if (tab === 'map') {
    body = `<div class="raid-map">${mapSVG(true)}</div><div class="map-legend"><span>▲ YOUR POSITION</span><span>↗ FREE EDGE EXTRACTION</span><span>◇ GARRISON COMPOUND</span></div><p>Extraction begins automatically when you enter an edge zone. Stay inside for 7 seconds. A called aircraft requires 35 seconds to arrive, then 8 seconds to board.</p>`;
  } else if (tab === 'inventory') {
    body = `<div class="panel-title">FIELD BACKPACK <span>${p.backpack.length} / ${game.backpackCapacity()} SLOTS</span></div><p>Carried cash: <strong>${money(p.cash)}</strong> · Trauma kits: ${p.medkits}. Loot is secured only after extraction.</p><div class="item-grid">${[...new Set(p.backpack)].map((id) => itemCard(id, 'pack')).join('') || '<div class="empty-state"><h3>Your pack is empty</h3><p>Search marked supply cases and fallen soldiers with E.</p></div>'}</div>${selectedNote && NOTES[selectedNote] ? `<article class="document"><h3>${NOTES[selectedNote].title}</h3><p>${NOTES[selectedNote].text}</p></article>` : ''}`;
  } else if (tab === 'settings') {
    body = settingsHTML();
  } else {
    body = `<div class="eyebrow">OPERATION IN PROGRESS</div><h1>KEEP YOUR<br><em>WAY OUT.</em></h1><p>The harbor is occupied. Search cases and fallen soldiers for cash, equipment, and documents. Extract to bring them home.</p><div class="pause-stats"><div><span>TIME REMAINING</span><b>${time(game.state.remaining)}</b></div><div><span>CARRIED CASH</span><b>${money(p.cash)}</b></div><div><span>HOSTILES DOWN</span><b>${game.state.kills}</b></div></div>${button('Call extraction · $200', 'call', 'primary', p.cash <= 200 || !!game.state.extraction?.called)}<p class="subtle">Requires more than $200 in carried cash. Payment draws nearby patrols to your pickup point.</p>${game.state.extraction ? `<p class="gold">${game.state.extraction.name} · ${time(game.state.extraction.remaining)} remaining</p>` : ''}`;
  }
  menuEl.innerHTML = `${header()}<main class="raid-menu"><div class="raid-tabs"><button data-tab="pause" class="${tab === 'pause' ? 'active' : ''}">Operation</button><button data-tab="map" class="${tab === 'map' ? 'active' : ''}">Tactical map</button><button data-tab="inventory" class="${tab === 'inventory' ? 'active' : ''}">Backpack</button><button data-tab="settings" class="${tab === 'settings' ? 'active' : ''}">Settings</button>${button('Resume operation →', 'resume', 'outline')}</div><div class="raid-body">${body}</div><div class="pause-label">LOCAL SOLO OPERATION PAUSED · PROGRESS SAVED</div></main>`;
}
function settingsHTML() {
  return `<h2>Field controls</h2><div class="controls-grid">${[
    ['W A S D', 'Move'],
    ['MOUSE', 'Look'],
    ['LMB / RMB', 'Fire / aim'],
    ['SHIFT', 'Sprint'],
    ['C / CTRL', 'Crouch'],
    ['SPACE', 'Jump'],
    ['E', 'Search / interact'],
    ['R', 'Reload'],
    ['H', 'Use trauma kit'],
    ['M', 'Tactical map'],
    ['I', 'Backpack'],
    ['TAB / ESC', 'Menu / pause'],
    ['ARROW KEYS', 'Alternative look'],
  ]
    .map(([k, v]) => `<div><kbd>${k}</kbd><span>${v}</span></div>`)
    .join(
      '',
    )}</div><label class="setting">Mouse sensitivity <input id="sensitivity" type="range" min="0.0005" max="0.005" step="0.0001" value="${sensitivity}"></label><label class="setting">Audio volume <input id="volume" type="range" min="0" max="1" step="0.05" value="${audio.volume}"></label><p class="subtle">Single-player prototype. Menus pause the raid. Progress saves locally in this browser; closing during a raid resumes that same raid.</p>`;
}
function renderSettings() {
  menuEl.querySelector('main')!.innerHTML = `<section class="panel">${settingsHTML()}</section>`;
}
async function play() {
  menu = false;
  ads = false;
  keys.clear();
  renderMenu();
  audio.start();
  try {
    await canvas.requestPointerLock();
  } catch {
    toast('Click the game to capture the mouse. Arrow keys also control your view.');
  }
}
function openMenu(next = 'pause') {
  menu = true;
  tab = next;
  firing = false;
  ads = false;
  keys.clear();
  document.exitPointerLock();
  save();
  renderMenu();
}
menuEl.addEventListener('click', (event) => {
  const b = (event.target as HTMLElement).closest<HTMLButtonElement>('button');
  if (!b || b.disabled) return;
  audio.start();
  if (b.dataset.tab) {
    tab = b.dataset.tab;
    selectedNote = '';
    renderMenu();
    return;
  }
  const id = b.dataset.id ?? '';
  let ok = true;
  switch (b.dataset.action) {
    case 'deploy':
      ok = game.deploy(crypto.getRandomValues(new Uint32Array(1))[0] >>> 0);
      if (ok) {
        lastEvent = 0;
        lastMode = 'raid';
        view.buildRaid(game);
        save();
        void play();
        toast('Blackwater / Infil complete. Search the supply case ahead with E.');
      }
      break;
    case 'walk':
      game.state.player.x = 0;
      game.state.player.z = 3;
      game.state.player.yaw = 0;
      game.state.player.pitch = 0;
      void play();
      break;
    case 'resume':
      void play();
      break;
    case 'return':
      game.returnToHideout();
      tab = 'home';
      lastEvent = 0;
      renderMenu();
      save();
      break;
    case 'buy':
      ok = game.buy(id);
      if (ok) toast(`${ITEMS[id].name} added to stash.`);
      break;
    case 'sell':
      ok = game.sell(id);
      break;
    case 'equip':
      ok = game.equip(id);
      break;
    case 'upgrade':
      ok = game.upgrade(id);
      if (ok) toast('Facility upgraded. Permanent bonus active.');
      break;
    case 'call':
      ok = game.callExtraction();
      if (ok) {
        save();
        void play();
      }
      break;
    case 'read':
      selectedNote = id;
      break;
    case 'settings':
      tab = 'settings';
      break;
  }
  if (!ok) toast('Unable to complete that action with the current equipment or funds.');
  if (menu) renderMenu();
  save();
});
menuEl.addEventListener('change', (e) => {
  const target = e.target as HTMLInputElement | HTMLSelectElement;
  if (target.dataset.slot) {
    game.modify(target.dataset.slot as ModSlot, target.value || null);
    save();
    renderMenu();
  }
  if (target.id === 'volume') audio.volume = Number(target.value);
  if (target.id === 'sensitivity') sensitivity = Number(target.value);
});
canvas.addEventListener('click', () => {
  if (loaded && !menu && document.pointerLockElement !== canvas) void play();
});
addEventListener('contextmenu', (e) => {
  if (!menu) e.preventDefault();
});
addEventListener('mousedown', (e) => {
  if (menu || document.pointerLockElement !== canvas) return;
  if (e.button === 0) firing = true;
  if (e.button === 2) ads = true;
});
addEventListener('mouseup', (e) => {
  if (e.button === 0) firing = false;
  if (e.button === 2) ads = false;
});
addEventListener('mousemove', (e) => {
  if (document.pointerLockElement === canvas && !menu) {
    game.state.player.yaw -= e.movementX * sensitivity;
    game.state.player.pitch = Math.max(
      -1.42,
      Math.min(1.42, game.state.player.pitch - e.movementY * sensitivity),
    );
  }
});
addEventListener('keydown', (e) => {
  if (!loaded || e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement)
    return;
  if (['Tab', 'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code))
    e.preventDefault();
  if (e.repeat && ['Tab', 'KeyM', 'KeyI', 'KeyE', 'Escape'].includes(e.code)) return;
  if (e.code === 'Tab' || e.code === 'Escape') {
    if (game.state.mode === 'dead' || game.state.mode === 'extracted') return;
    if (menu) void play();
    else openMenu(game.state.mode === 'raid' ? 'pause' : 'home');
    return;
  }
  if (e.code === 'KeyM' && game.state.mode === 'raid') {
    if (menu && tab === 'map') void play();
    else openMenu('map');
    return;
  }
  if (e.code === 'KeyI' && game.state.mode === 'raid') {
    if (menu && tab === 'inventory') void play();
    else openMenu('inventory');
    return;
  }
  if (menu) return;
  keys.add(e.code);
  if (e.code === 'KeyR') game.reload();
  if (e.code === 'KeyH') {
    if (!game.heal()) toast('No trauma kit needed or available.');
  }
  if (e.code === 'KeyE') {
    if (game.state.mode === 'raid') {
      const near = game.nearbyLoot()[0];
      if (near) {
        game.interact(near.id);
        save();
      }
    } else {
      const s = nearestStation();
      if (s) openMenu(s.id);
    }
  }
});
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('blur', () => {
  if (loaded && !menu && game.state.mode !== 'dead' && game.state.mode !== 'extracted')
    openMenu(game.state.mode === 'raid' ? 'pause' : 'home');
});
document.addEventListener('pointerlockchange', () => {
  if (!document.pointerLockElement) {
    firing = false;
    ads = false;
  }
});
addEventListener('beforeunload', save);
function nearestStation() {
  const p = game.state.player;
  return STATIONS.filter((s) => Math.hypot(p.x - s.x, p.z - s.z) < 3).sort(
    (a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z),
  )[0];
}
function updateHUD() {
  const s = game.state,
    p = s.player,
    raid = s.mode === 'raid';
  const near = raid ? game.nearbyLoot()[0] : nearestStation();
  const heading = ((((-p.yaw * 180) / Math.PI) % 360) + 360) % 360,
    cardinal = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(heading / 45) % 8];
  const nearest = game.world.pois.reduce((a, b) =>
    Math.hypot(a.x - p.x, a.z - p.z) < Math.hypot(b.x - p.x, b.z - p.z) ? a : b,
  );
  hud.innerHTML = `<div class="hud-top"><div class="hud-operation"><span class="live-dot"></span>${raid ? 'BLACKWATER / ' + nearest.name.toUpperCase() : 'SAFEHOUSE / OFF THE GRID'}<small>${raid ? 'OPERATION ACTIVE' : 'WEAPONS SAFE'}</small></div><div class="compass"><span>│ · · │ · · │</span><b>${cardinal} <em>${Math.round(heading).toString().padStart(3, '0')}°</em></b><span>│ · · │ · · │</span></div><div class="raid-time"><span>${raid ? 'TIME TO LOCKDOWN' : 'LOCAL OPERATIONS'}</span><b>${raid ? time(s.remaining) : 'SECURE'}</b></div></div><div class="crosshair ${ads ? 'aiming' : ''}"><i></i><i></i><i></i><i></i></div>${near ? `<div class="interact"><kbd>E</kbd><div><strong>${'label' in near ? escape(near.label) : ''}</strong><span>${raid ? 'Search and collect' : 'Open station'}</span></div></div>` : ''}${s.extraction && raid ? `<div class="extraction-hud"><span class="live-dot"></span><div><strong>${s.extraction.arrivalRemaining > 0 ? 'AIRCRAFT INBOUND' : 'EXTRACTION ZONE'}</strong><p>${s.extraction.arrivalRemaining > 0 ? 'Reach the pickup marker.' : Math.hypot(s.extraction.x - p.x, s.extraction.z - p.z) <= s.extraction.radius ? 'Hold position.' : 'Move to the pickup marker.'}</p></div><b>${time(s.extraction.remaining)}</b></div>` : ''}<div class="hud-bottom"><div class="health-panel"><div class="operator-label"><b>01</b><span>OPERATOR<br><strong>${p.crouching ? 'CROUCHED' : keys.has('ShiftLeft') ? 'SPRINTING' : 'ACTIVE'}</strong></span></div><div class="vitals"><div><span>HEALTH</span><b>${Math.ceil(p.health)}</b></div><div class="meter"><i style="width:${(p.health / game.maxHealth()) * 100}%"></i></div><div class="armor-meter"><i style="width:${Math.min(p.armor / 110, 1) * 100}%"></i></div><div class="stamina-meter"><i style="width:${(p.stamina / game.maxStamina()) * 100}%"></i></div></div></div><div class="hud-hints"><kbd>E</kbd> INTERACT <kbd>M</kbd> MAP <kbd>TAB</kbd> MENU</div>${raid ? `<div class="ammo-panel"><div class="carried"><span>CARRIED ${money(p.cash)}</span><span>◇ ${p.backpack.length}/${game.backpackCapacity()} <span class="med">✚ ${p.medkits}</span></span></div><div class="weapon-name">${ITEMS[p.weaponId].name.toUpperCase()}</div><div class="ammo">${p.reloadRemaining > 0 ? '<span class="reloading">RELOADING</span>' : `<strong>${p.ammo.toString().padStart(2, '0')}</strong>`}<span>/ ${p.reserve}</span><i>${ads ? 'ADS' : 'AUTO'}</i></div></div>` : ''}</div>${document.pointerLockElement !== canvas ? '<button class="capture" data-action="capture">Click to enter · Mouse look</button>' : ''}`;
}
Object.defineProperty(window, '__deadwire', {
  get: () => ({
    state: structuredClone(game.state),
    profile: structuredClone(game.profile),
    world: structuredClone(game.world),
    performance: {
      fps: view?.fps,
      frameMs: view?.frameMs,
      drawCalls: view?.drawCalls,
      triangles: view?.triangles,
    },
    ready: loaded,
  }),
});
hud.addEventListener('click', (e) => {
  if ((e.target as HTMLElement).closest('[data-action="capture"]')) void play();
});
async function boot() {
  try {
    view = new GameScene(canvas);
    await view.load((s) => {
      document.querySelector('#loading-text')!.textContent = s;
    });
    loaded = true;
    document.querySelector('#loading')!.remove();
    if (game.state.mode === 'hideout') {
      view.buildHideout();
      view.camera.position.set(7.8, 3.1, 8);
    } else view.buildRaid(game);
    renderMenu();
    if (saveWarning) toast(saveWarning);
    let last = performance.now();
    function frame(now: number) {
      requestAnimationFrame(frame);
      const dt = Math.min((now - last) / 1000, 0.08);
      last = now;
      let moving = false;
      if (!menu && (game.state.mode === 'raid' || game.state.mode === 'hideout')) {
        const p = game.state.player;
        p.yaw += ((keys.has('ArrowLeft') ? 1 : 0) - (keys.has('ArrowRight') ? 1 : 0)) * dt * 1.6;
        p.pitch = Math.max(
          -1.42,
          Math.min(
            1.42,
            p.pitch + ((keys.has('ArrowUp') ? 1 : 0) - (keys.has('ArrowDown') ? 1 : 0)) * dt,
          ),
        );
        const forward = (keys.has('KeyW') ? 1 : 0) - (keys.has('KeyS') ? 1 : 0),
          strafe = (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0),
          sprint = keys.has('ShiftLeft'),
          crouch = keys.has('KeyC') || keys.has('ControlLeft');
        moving = !!(forward || strafe);
        if (game.state.mode === 'raid')
          game.tick(dt, {
            forward,
            strafe,
            sprint,
            crouch,
            jump: keys.has('Space'),
            yaw: p.yaw,
            pitch: p.pitch,
          });
        else {
          const speed = dt * (sprint ? 5 : 3),
            norm = Math.max(1, Math.hypot(forward, strafe));
          p.x = Math.max(
            -9,
            Math.min(
              9,
              p.x + ((-Math.sin(p.yaw) * forward + Math.cos(p.yaw) * strafe) * speed) / norm,
            ),
          );
          p.z = Math.max(
            -7.8,
            Math.min(
              7.7,
              p.z + ((-Math.cos(p.yaw) * forward - Math.sin(p.yaw) * strafe) * speed) / norm,
            ),
          );
          p.y = crouch ? 1.1 : 1.7;
        }
        if (firing && game.state.mode === 'raid')
          game.shoot(
            new T.Vector3(
              -Math.sin(p.yaw) * Math.cos(p.pitch),
              Math.sin(p.pitch),
              -Math.cos(p.yaw) * Math.cos(p.pitch),
            ),
          );
        if (moving) audio.step(now / 1000, sprint);
      }
      for (const event of game.state.events) {
        if (event.id <= lastEvent) continue;
        lastEvent = event.id;
        view.event(event);
        audio.event(event.kind, game.state.player.mods.muzzle === 'suppressor');
        if (event.text && !['hit', 'damage', 'reloadStart'].includes(event.kind)) toast(event.text);
        if (event.kind === 'damage') {
          const d = document.querySelector<HTMLDivElement>('#damage')!;
          d.style.opacity = '.65';
          setTimeout(() => (d.style.opacity = '0'), 250);
        }
        if (event.kind === 'hit') {
          hud.classList.add('hit');
          setTimeout(() => hud.classList.remove('hit'), 120);
        }
      }
      if (lastMode !== game.state.mode) {
        lastMode = game.state.mode;
        if (['dead', 'extracted'].includes(lastMode)) openMenu('result');
        save();
      }
      view.render(game, dt, menu, tab, ads, moving);
      if (now - lastHUD > 100) {
        if (!menu) updateHUD();
        lastHUD = now;
      }
      if (now - lastSave > 4000) {
        save();
        lastSave = now;
      }
    }
    requestAnimationFrame(frame);
  } catch (error) {
    console.error(error);
    document.querySelector('#loading-text')!.textContent =
      `Could not initialize the game: ${String(error)}. Ensure assets are published and WebGL is enabled.`;
  }
}
void boot();
