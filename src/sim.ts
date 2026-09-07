import {
  ITEMS,
  NOTES,
  STARTER_WEAPON,
  UPGRADES,
  WEAPONS,
  type ModSlot,
  type WeaponStats,
} from './content';
import {
  hasLineOfSight,
  makeWorld,
  pointBlocked,
  wallDistance,
  type Point,
  type World,
} from './map';

export type Mode = 'hideout' | 'raid' | 'dead' | 'extracted';
export type Mods = Record<ModSlot, string | null>;
export interface Profile {
  bank: number;
  stash: string[];
  equipped: { weaponId: string; armorId: string | null; mods: Mods };
  upgrades: Record<string, number>;
  lore: string[];
  raids: number;
  extractions: number;
  kills: number;
}
export interface Player extends Point {
  y: number;
  yaw: number;
  pitch: number;
  health: number;
  armor: number;
  stamina: number;
  ammo: number;
  reserve: number;
  medkits: number;
  cash: number;
  backpack: string[];
  weaponId: string;
  mods: Mods;
  crouching: boolean;
  reloadRemaining: number;
  healCooldown: number;
  fireCooldown: number;
  verticalVelocity: number;
  grounded: boolean;
}
export interface Enemy extends Point {
  id: string;
  y: number;
  yaw: number;
  health: number;
  mode: 'patrol' | 'investigate' | 'combat' | 'search' | 'dead';
  patrol: Point[];
  patrolIndex: number;
  target: Point;
  lastSeen: number;
  shotTimer: number;
  awareness: number;
  weaponId: string;
  lootId: string | null;
  strafe: number;
  stuck: number;
}
export interface Loot extends Point {
  id: string;
  contents: string[];
  cash: number;
  collected: boolean;
  label: string;
  kind: 'crate' | 'corpse';
}
export interface Extraction extends Point {
  id: string;
  name: string;
  radius: number;
  remaining: number;
  called: boolean;
  arrivalRemaining: number;
  holdRemaining: number;
}
export interface GameEvent {
  id: number;
  kind: string;
  text: string;
  time: number;
  x?: number;
  y?: number;
  z?: number;
  targetX?: number;
  targetY?: number;
  targetZ?: number;
}
export interface RaidSummary {
  success: boolean;
  cash: number;
  items: string[];
  notes: string[];
  kills: number;
  duration: number;
  reason: string;
}
export interface RaidState {
  mode: Mode;
  seed: number;
  elapsed: number;
  remaining: number;
  player: Player;
  enemies: Enemy[];
  loot: Loot[];
  extraction: Extraction | null;
  events: GameEvent[];
  kills: number;
  shotsFired: number;
  carriedKit: string[];
  summary: RaidSummary | null;
  rng: number;
  stepRemainder: number;
  nextEventId: number;
}
export interface Input {
  forward?: number;
  strafe?: number;
  sprint?: boolean;
  crouch?: boolean;
  jump?: boolean;
  yaw?: number;
  pitch?: number;
}
export interface ShotResult {
  hit: boolean;
  enemyId?: string;
  position: { x: number; y: number; z: number };
}
export const RAID_DURATION = 22 * 60;
export const EXTRACTION_COST = 200;
export const SAVE_VERSION = 1;
const STEP = 1 / 60;
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const emptyMods = (): Mods => ({ optic: null, muzzle: null, magazine: null });
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.z - b.z);
const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
const finite = (n: number | undefined, fallback = 0) =>
  typeof n === 'number' && Number.isFinite(n) ? n : fallback;
export const buyPrice = (id: string): number => ITEMS[id]?.value ?? 0;
export const sellPrice = (id: string): number => Math.floor((ITEMS[id]?.value ?? 0) * 0.6);
export function newProfile(): Profile {
  return {
    bank: 650,
    stash: ['m4', 'light_armor', 'red_dot', 'medkit', 'medkit', 'medkit'],
    equipped: {
      weaponId: 'm4',
      armorId: 'light_armor',
      mods: { optic: 'red_dot', muzzle: null, magazine: null },
    },
    upgrades: { endurance: 0, pack: 0, vitality: 0, ammo: 0 },
    lore: [],
    raids: 0,
    extractions: 0,
    kills: 0,
  };
}
function initialState(): RaidState {
  return {
    mode: 'hideout',
    seed: 1,
    elapsed: 0,
    remaining: RAID_DURATION,
    player: {
      x: 0,
      y: 1.7,
      z: 3,
      yaw: 0,
      pitch: 0,
      health: 100,
      armor: 65,
      stamina: 100,
      ammo: 30,
      reserve: 120,
      medkits: 3,
      cash: 0,
      backpack: [],
      weaponId: 'm4',
      mods: emptyMods(),
      crouching: false,
      reloadRemaining: 0,
      healCooldown: 0,
      fireCooldown: 0,
      verticalVelocity: 0,
      grounded: true,
    },
    enemies: [],
    loot: [],
    extraction: null,
    events: [],
    kills: 0,
    shotsFired: 0,
    carriedKit: [],
    summary: null,
    rng: 1,
    stepRemainder: 0,
    nextEventId: 1,
  };
}

/** Pure canonical game rules. Rendering, input binding and storage are adapters. */
export class Game {
  profile: Profile;
  state: RaidState;
  world: World;
  constructor(profile?: Profile) {
    this.profile = profile ? clone(profile) : newProfile();
    this.state = initialState();
    this.world = makeWorld(1);
    this.syncHideout();
  }
  private random(): number {
    this.state.rng = (this.state.rng + 0x6d2b79f5) >>> 0;
    let t = this.state.rng;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  private emit(kind: string, text: string, position?: Partial<GameEvent>): void {
    this.state.events.push({
      id: this.state.nextEventId++,
      kind,
      text,
      time: this.state.elapsed,
      ...position,
    });
    if (this.state.events.length > 80) this.state.events.splice(0, this.state.events.length - 80);
  }
  maxHealth(): number {
    return 100 + 15 * (this.profile.upgrades.vitality ?? 0);
  }
  maxStamina(): number {
    return 100 + 20 * (this.profile.upgrades.endurance ?? 0);
  }
  backpackCapacity(): number {
    return 12 + 4 * (this.profile.upgrades.pack ?? 0);
  }
  weaponStats(): WeaponStats {
    const p = this.state.player,
      stats = { ...(WEAPONS[p.weaponId] ?? WEAPONS[STARTER_WEAPON]!) };
    if (p.mods.optic === 'red_dot') stats.spread *= 0.55;
    if (p.mods.optic === 'scope') {
      stats.spread *= 0.28;
      stats.range *= 1.3;
    }
    if (p.mods.muzzle === 'compensator') {
      stats.spread *= 0.75;
      stats.fireInterval *= 0.92;
    }
    if (p.mods.magazine === 'extended_mag') {
      stats.magazine = Math.round(stats.magazine * 1.5);
      stats.reloadTime *= 1.15;
    }
    return stats;
  }
  private syncHideout(): void {
    const p = this.state.player,
      e = this.profile.equipped;
    p.weaponId = e.weaponId;
    p.mods = clone(e.mods);
    p.health = this.maxHealth();
    p.stamina = this.maxStamina();
    p.armor = e.armorId === 'heavy_armor' ? 110 : e.armorId ? 65 : 0;
    p.ammo = this.weaponStats().magazine;
    p.reserve =
      120 + 30 * (this.profile.upgrades.ammo ?? 0) + (this.profile.stash.includes('ammo') ? 60 : 0);
    p.medkits = Math.min(3, this.profile.stash.filter((id) => id === 'medkit').length);
  }
  private removeStash(id: string): boolean {
    const i = this.profile.stash.indexOf(id);
    if (i < 0) return false;
    this.profile.stash.splice(i, 1);
    return true;
  }
  private repairEquipped(): void {
    const e = this.profile.equipped;
    if (e.weaponId !== STARTER_WEAPON && !this.profile.stash.includes(e.weaponId))
      e.weaponId = STARTER_WEAPON;
    if (e.armorId && !this.profile.stash.includes(e.armorId)) e.armorId = null;
    for (const slot of ['optic', 'muzzle', 'magazine'] as ModSlot[])
      if (e.mods[slot] && !this.profile.stash.includes(e.mods[slot]!)) e.mods[slot] = null;
  }
  deploy(seed = Date.now()): boolean {
    if (this.state.mode !== 'hideout') return false;
    this.repairEquipped();
    this.state = initialState();
    this.state.mode = 'raid';
    this.state.seed = seed >>> 0;
    this.state.rng = (seed ^ 0xbada55) >>> 0;
    this.world = makeWorld(this.state.seed);
    this.syncHideout();
    const p = this.state.player;
    p.x = this.world.spawn.x;
    p.z = this.world.spawn.z;
    p.yaw = 0.38;
    p.mods = clone(this.profile.equipped.mods);
    const kit = [
      this.profile.equipped.weaponId,
      this.profile.equipped.armorId,
      ...Object.values(this.profile.equipped.mods),
    ].filter((id): id is string => !!id && id !== STARTER_WEAPON);
    for (const id of kit) if (this.removeStash(id)) this.state.carriedKit.push(id);
    for (let i = 0; i < p.medkits; i++) this.removeStash('medkit');
    this.removeStash('ammo');
    this.profile.raids++;
    this.generateLoot();
    this.generateEnemies();
    this.emit(
      'deploy',
      'Entered Blackwater exclusion zone. Recover supplies and reach an extraction.',
    );
    return true;
  }
  private openPoint(x: number, z: number, radius = 0.6): Point {
    if (!pointBlocked(this.world, x, z, radius)) return { x, z };
    for (let ring = 1; ring < 36; ring++)
      for (let i = 0; i < 16; i++) {
        const a = (i * Math.PI) / 8,
          px = x + Math.cos(a) * ring * 1.5,
          pz = z + Math.sin(a) * ring * 1.5;
        if (!pointBlocked(this.world, px, pz, radius)) return { x: px, z: pz };
      }
    return { ...this.world.spawn };
  }
  private generateLoot(): void {
    const common = ['filter', 'watch', 'circuit', 'medkit', 'ammo', 'intel'],
      rare = [
        'm4',
        'ak74',
        'mp5',
        'marksman',
        'heavy_armor',
        'light_armor',
        'suppressor',
        'scope',
        'extended_mag',
        'compensator',
        'gold',
      ];
    const noteIds = Object.keys(NOTES);
    for (let pi = 0; pi < this.world.pois.length; pi++) {
      const poi = this.world.pois[pi]!;
      for (let i = 0; i < 7; i++) {
        const a = this.random() * Math.PI * 2,
          r = 6 + this.random() * poi.radius * 0.72;
        const pos =
          i === 0
            ? this.openPoint(poi.x, poi.z, 1.2)
            : this.openPoint(poi.x + Math.cos(a) * r, poi.z + Math.sin(a) * r, 1.2);
        const contents = [common[Math.floor(this.random() * common.length)]!];
        if (i === 0) contents.push(noteIds[pi % noteIds.length]!);
        if (i === 2 || this.random() < 0.28)
          contents.push(rare[Math.floor(this.random() * rare.length)]!);
        this.state.loot.push({
          id: `cache-${pi}-${i}`,
          ...pos,
          contents,
          cash: 25 + Math.floor(this.random() * 106),
          collected: false,
          label: i === 0 ? `${poi.name} document cache` : 'Supply cache',
          kind: 'crate',
        });
      }
    }
    this.state.loot.unshift({
      id: 'insertion-cache',
      x: this.world.spawn.x + 2,
      z: this.world.spawn.z - 4,
      contents: ['ammo', 'medkit', 'note_evac'],
      cash: 95,
      collected: false,
      label: 'Abandoned responder’s supplies',
      kind: 'crate',
    });
  }
  private generateEnemies(): void {
    // The insertion itself is quiet; progressively denser squads hold the compounds.
    for (let pi = 1; pi < this.world.pois.length; pi++) {
      const poi = this.world.pois[pi]!,
        count = pi === 4 ? 6 : 4;
      for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2 + this.random() * 0.5,
          rad = poi.radius * (0.55 + this.random() * 0.32),
          start = this.openPoint(poi.x + Math.cos(angle) * rad, poi.z + Math.sin(angle) * rad);
        const patrol = [
          start,
          this.openPoint(
            start.x + Math.cos(angle + 1.4) * 16,
            start.z + Math.sin(angle + 1.4) * 16,
          ),
          this.openPoint(
            start.x + Math.cos(angle - 1.1) * 23,
            start.z + Math.sin(angle - 1.1) * 23,
          ),
        ];
        this.state.enemies.push({
          id: `guard-${pi}-${i}`,
          ...start,
          y: 0,
          yaw: angle,
          health: 100,
          mode: 'patrol',
          patrol,
          patrolIndex: 1,
          target: { ...start },
          lastSeen: -100,
          shotTimer: 0.5 + this.random(),
          awareness: 0,
          weaponId: this.random() < 0.3 ? 'ak74' : 'm4',
          lootId: null,
          strafe: this.random() < 0.5 ? -1 : 1,
          stuck: 0,
        });
      }
    }
  }
  tick(dt: number, input: Input = {}): void {
    if (this.state.mode !== 'raid') return;
    // Ignore invalid clocks and cap only pathological suspension; persist the fractional step.
    const elapsed = clamp(finite(dt), 0, 0.25),
      p = this.state.player;
    if (input.yaw !== undefined) p.yaw = finite(input.yaw, p.yaw);
    if (input.pitch !== undefined) p.pitch = clamp(finite(input.pitch, p.pitch), -1.48, 1.48);
    this.state.stepRemainder += elapsed;
    let jump = !!input.jump;
    while (this.state.stepRemainder + 1e-10 >= STEP && this.state.mode === 'raid') {
      this.state.stepRemainder = Math.max(0, this.state.stepRemainder - STEP);
      this.step(STEP, { ...input, jump });
      jump = false;
    }
  }
  private step(dt: number, input: Input): void {
    const s = this.state,
      p = s.player;
    s.elapsed += dt;
    s.remaining = Math.max(0, RAID_DURATION - s.elapsed);
    if (s.remaining <= 0) {
      this.die('The quarantine sweep overran your position.');
      return;
    }
    p.fireCooldown = Math.max(0, p.fireCooldown - dt);
    p.healCooldown = Math.max(0, p.healCooldown - dt);
    if (p.reloadRemaining > 0) {
      p.reloadRemaining = Math.max(0, p.reloadRemaining - dt);
      if (p.reloadRemaining === 0) {
        const amount = Math.min(this.weaponStats().magazine - p.ammo, p.reserve);
        p.ammo += amount;
        p.reserve -= amount;
        this.emit('reload', 'Magazine loaded.');
      }
    }
    p.crouching = !!input.crouch;
    let forward = clamp(finite(input.forward), -1, 1),
      strafe = clamp(finite(input.strafe), -1, 1);
    const inputLength = Math.hypot(forward, strafe);
    if (inputLength > 1) {
      forward /= inputLength;
      strafe /= inputLength;
    }
    const sprint = !!input.sprint && !p.crouching && p.stamina > 1 && inputLength > 0,
      speed = p.crouching ? 2.0 : sprint ? 7.4 : 4.2;
    p.stamina = clamp(p.stamina + (sprint ? -22 : 16) * dt, 0, this.maxStamina());
    const dx = (-Math.sin(p.yaw) * forward + Math.cos(p.yaw) * strafe) * speed * dt,
      dz = (-Math.cos(p.yaw) * forward - Math.sin(p.yaw) * strafe) * speed * dt;
    this.move(p, dx, dz, 0.38);
    if (input.jump && p.grounded && !p.crouching && p.stamina >= 12) {
      p.verticalVelocity = 5;
      p.grounded = false;
      p.stamina -= 12;
    }
    const eye = p.crouching ? 1.05 : 1.7;
    if (!p.grounded) {
      p.verticalVelocity -= 13 * dt;
      p.y += p.verticalVelocity * dt;
      if (p.y <= eye) {
        p.y = eye;
        p.verticalVelocity = 0;
        p.grounded = true;
      }
    } else p.y = eye;
    for (const enemy of s.enemies)
      if (enemy.mode !== 'dead') {
        this.updateEnemy(enemy, dt, sprint && inputLength > 0);
        if (s.mode !== 'raid') return;
      }
    this.updateExtraction(dt);
  }
  private move(actor: Point, dx: number, dz: number, radius: number): void {
    if (!pointBlocked(this.world, actor.x + dx, actor.z, radius)) actor.x += dx;
    if (!pointBlocked(this.world, actor.x, actor.z + dz, radius)) actor.z += dz;
  }
  private steer(enemy: Enemy, target: Point, speed: number, dt: number): void {
    const dx = target.x - enemy.x,
      dz = target.z - enemy.z,
      d = Math.hypot(dx, dz);
    if (d < 0.3) return;
    const step = Math.min(speed * dt, d),
      nx = dx / d,
      nz = dz / d,
      before = { x: enemy.x, z: enemy.z };
    this.move(enemy, nx * step, nz * step, 0.4);
    if (distance(before, enemy) < step * 0.15) {
      // Local avoidance picks the clearer tangent, then commits long enough to round a corner.
      enemy.stuck += dt;
      const turn = enemy.strafe;
      this.move(enemy, -nz * step * turn, nx * step * turn, 0.4);
      if (enemy.stuck > 2.5) {
        enemy.strafe *= -1;
        enemy.stuck = 0;
        if (enemy.mode === 'patrol')
          enemy.patrolIndex = (enemy.patrolIndex + 1) % enemy.patrol.length;
      }
    } else enemy.stuck = Math.max(0, enemy.stuck - dt);
    enemy.yaw = Math.atan2(-dx, -dz);
  }
  private updateEnemy(e: Enemy, dt: number, sprinting: boolean): void {
    const p = this.state.player,
      d = distance(e, p),
      dx = p.x - e.x,
      dz = p.z - e.z;
    const facing = d < 0.001 ? 1 : (-Math.sin(e.yaw) * dx - Math.cos(e.yaw) * dz) / d;
    const visualRange = p.crouching ? 49 : 78;
    const sees =
      d < visualRange &&
      (facing > -0.12 || d < 16 || e.mode === 'combat') &&
      hasLineOfSight(this.world, { x: e.x, z: e.z, y: 1.5 }, p);
    e.shotTimer = Math.max(0, e.shotTimer - dt);
    if (sees) {
      e.awareness = Math.min(1, e.awareness + dt * (d < 22 ? 3 : 1.65));
      if (e.awareness >= 0.65) {
        if (e.mode !== 'combat')
          this.emit('alert', 'Hostile patrol has spotted you.', { x: e.x, z: e.z });
        e.mode = 'combat';
        e.target = { x: p.x, z: p.z };
        e.lastSeen = this.state.elapsed;
      }
    } else e.awareness = Math.max(0, e.awareness - dt * 0.5);
    if (sprinting && d < 20 && e.mode === 'patrol') {
      e.mode = 'investigate';
      e.target = { x: p.x, z: p.z };
      e.lastSeen = this.state.elapsed;
    }
    if (e.mode === 'combat') {
      if (!sees && this.state.elapsed - e.lastSeen > 4) {
        e.mode = 'search';
        e.awareness = 0.3;
      }
      if (sees) {
        e.yaw = Math.atan2(-dx, -dz);
        if (d > 32) this.steer(e, p, 2.9, dt);
        else if (d > 8) {
          const inv = 1 / Math.max(d, 0.01);
          this.move(e, -dz * inv * 1.2 * e.strafe * dt, dx * inv * 1.2 * e.strafe * dt, 0.4);
        }
        if (e.shotTimer <= 0) {
          e.shotTimer = 0.6 + this.random() * 0.65;
          // Recheck after movement, so neither strafing nor chasing can fire through a corner.
          if (hasLineOfSight(this.world, { x: e.x, y: 1.45, z: e.z }, p)) {
            this.emit('enemyShot', '', {
              x: e.x,
              y: 1.45,
              z: e.z,
              targetX: p.x,
              targetY: p.y - 0.18,
              targetZ: p.z,
            });
            const accuracy = clamp(
              0.8 - d * 0.007 - (p.crouching ? 0.1 : 0) - (sprinting ? 0.12 : 0),
              0.12,
              0.85,
            );
            if (this.random() < accuracy) this.damagePlayer(9 + Math.floor(this.random() * 7));
          }
        }
      } else this.steer(e, e.target, 3.0, dt);
    } else if (e.mode === 'investigate' || e.mode === 'search') {
      this.steer(e, e.target, e.mode === 'search' ? 2.5 : 2.3, dt);
      if (distance(e, e.target) < 2) {
        e.yaw += dt * 0.65;
        if (this.state.elapsed - e.lastSeen > 10) {
          e.mode = 'patrol';
          e.awareness = 0;
        }
      }
      if (this.state.elapsed - e.lastSeen > 23) {
        e.mode = 'patrol';
        e.awareness = 0;
      }
    } else if (e.mode === 'patrol') {
      const destination = e.patrol[e.patrolIndex]!;
      this.steer(e, destination, 1.55, dt);
      if (distance(e, destination) < 1.3) e.patrolIndex = (e.patrolIndex + 1) % e.patrol.length;
    }
  }
  private damagePlayer(amount: number): void {
    const p = this.state.player,
      absorbed = Math.min(p.armor, amount * 0.8);
    p.armor -= absorbed;
    p.health = Math.max(0, p.health - (amount - absorbed));
    this.emit('damage', `Hit for ${Math.round(amount - absorbed)} damage.`);
    if (p.health <= 0) this.die('Killed in action. Your carried equipment was lost.');
  }
  shoot(direction: { x: number; y: number; z: number }): ShotResult | null {
    const s = this.state,
      p = s.player;
    if (s.mode !== 'raid' || p.fireCooldown > 0 || p.reloadRemaining > 0) return null;
    if (p.ammo <= 0) {
      this.emit('empty', 'Magazine empty. Press R to reload.');
      p.fireCooldown = 0.3;
      return null;
    }
    const len = Math.hypot(direction.x, direction.y, direction.z);
    if (!Number.isFinite(len) || len < 0.001) return null;
    const stats = this.weaponStats(),
      spread = stats.spread * (p.crouching ? 0.65 : 1),
      dx = direction.x / len + (this.random() - 0.5) * spread,
      dy = direction.y / len + (this.random() - 0.5) * spread,
      dz = direction.z / len + (this.random() - 0.5) * spread,
      normal = Math.hypot(dx, dy, dz),
      dir = { x: dx / normal, y: dy / normal, z: dz / normal };
    p.ammo--;
    p.fireCooldown = stats.fireInterval;
    s.shotsFired++;
    let hitDistance = wallDistance(this.world, p, dir, stats.range),
      victim: Enemy | undefined;
    for (const e of s.enemies) {
      if (e.mode === 'dead') continue;
      // Ray/ellipsoid intersection, with a visible human silhouette and a separate head multiplier.
      const ox = (p.x - e.x) / 0.44,
        oy = (p.y - 0.94) / 0.94,
        oz = (p.z - e.z) / 0.44,
        vx = dir.x / 0.44,
        vy = dir.y / 0.94,
        vz = dir.z / 0.44;
      const a = vx * vx + vy * vy + vz * vz,
        b = 2 * (ox * vx + oy * vy + oz * vz),
        c = ox * ox + oy * oy + oz * oz - 1,
        disc = b * b - 4 * a * c;
      if (disc < 0) continue;
      const t = (-b - Math.sqrt(disc)) / (2 * a);
      if (t > 0 && t < hitDistance) {
        hitDistance = t;
        victim = e;
      }
    }
    const position = {
      x: p.x + dir.x * hitDistance,
      y: p.y + dir.y * hitDistance,
      z: p.z + dir.z * hitDistance,
    };
    this.emit('shot', '', {
      x: p.x,
      y: p.y,
      z: p.z,
      targetX: position.x,
      targetY: position.y,
      targetZ: position.z,
    });
    const audible = p.mods.muzzle === 'suppressor' ? 24 : 85;
    for (const e of s.enemies)
      if (e.mode !== 'dead' && e.mode !== 'combat' && distance(e, p) < audible) {
        e.mode = 'investigate';
        e.target = { x: p.x, z: p.z };
        e.lastSeen = s.elapsed;
      }
    if (victim) {
      const headshot = position.y > 1.5,
        damage = stats.damage * (headshot ? 2 : 1);
      victim.health = Math.max(0, victim.health - damage);
      victim.target = { x: p.x, z: p.z };
      victim.lastSeen = s.elapsed;
      victim.awareness = 1;
      victim.mode = 'combat';
      this.emit('hit', headshot ? 'Headshot.' : 'Target hit.', { x: victim.x, z: victim.z });
      if (victim.health <= 0) this.killEnemy(victim);
    }
    return { hit: !!victim, enemyId: victim?.id, position };
  }
  private killEnemy(e: Enemy): void {
    e.mode = 'dead';
    e.health = 0;
    this.state.kills++;
    e.lootId = `body-${e.id}`;
    const contents = [e.weaponId, 'ammo'];
    if (this.random() < 0.4) contents.push('medkit');
    if (this.random() < 0.22) contents.push('light_armor');
    if (this.random() < 0.15) contents.push('note_soldier');
    this.state.loot.push({
      id: e.lootId,
      x: e.x,
      z: e.z,
      contents,
      cash: 35 + Math.floor(this.random() * 101),
      collected: false,
      label: 'Fallen garrison soldier',
      kind: 'corpse',
    });
    this.emit('kill', 'Hostile eliminated. Search the body for equipment.', { x: e.x, z: e.z });
  }
  reload(): boolean {
    const p = this.state.player;
    if (
      this.state.mode !== 'raid' ||
      p.reloadRemaining > 0 ||
      p.ammo >= this.weaponStats().magazine ||
      p.reserve <= 0
    )
      return false;
    p.reloadRemaining = this.weaponStats().reloadTime;
    this.emit('reloadStart', 'Reloading…');
    return true;
  }
  heal(): boolean {
    const p = this.state.player;
    if (
      this.state.mode !== 'raid' ||
      p.medkits <= 0 ||
      p.health >= this.maxHealth() ||
      p.healCooldown > 0
    )
      return false;
    p.medkits--;
    p.health = Math.min(this.maxHealth(), p.health + 60);
    p.healCooldown = 3;
    this.emit('heal', 'Trauma kit applied. +60 health.');
    return true;
  }
  nearbyLoot(range = 3): Loot[] {
    return this.state.loot
      .filter(
        (l) =>
          !l.collected &&
          distance(l, this.state.player) <= range &&
          hasLineOfSight(this.world, this.state.player, { ...l, y: 0.85 }),
      )
      .sort((a, b) => distance(a, this.state.player) - distance(b, this.state.player));
  }
  nearbyExtraction(): import('./map').ExtractionPoint | undefined {
    return this.world.extractions.find((e) => distance(e, this.state.player) <= e.radius);
  }
  interact(id: string): boolean {
    if (this.state.mode !== 'raid') return false;
    const loot = this.state.loot.find((l) => l.id === id);
    if (
      !loot ||
      loot.collected ||
      distance(loot, this.state.player) > 3.4 ||
      !hasLineOfSight(this.world, this.state.player, { ...loot, y: 0.85 })
    )
      return false;
    const p = this.state.player;
    let taken = 0;
    const cash = loot.cash;
    p.cash += cash;
    loot.cash = 0;
    const remainder: string[] = [];
    for (const itemId of loot.contents) {
      const item = ITEMS[itemId];
      if (!item) continue;
      if (item.kind === 'ammo') {
        p.reserve += 60;
        taken++;
      } else if (item.kind === 'medkit' && p.medkits < 5) {
        p.medkits++;
        taken++;
      } else if (p.backpack.length < this.backpackCapacity()) {
        p.backpack.push(itemId);
        taken++;
      } else remainder.push(itemId);
    }
    loot.contents = remainder;
    loot.collected = remainder.length === 0;
    if (cash || taken)
      this.emit(
        'loot',
        `Recovered ${cash ? '$' + cash + ' and ' : ''}${taken} item${taken === 1 ? '' : 's'}.${remainder.length ? ' Backpack full; some items remain.' : ''}`,
      );
    else this.emit('full', 'Backpack full. Extract to secure your gear.');
    return cash > 0 || taken > 0;
  }
  callExtraction(): boolean {
    const p = this.state.player;
    if (this.state.mode !== 'raid' || p.cash <= EXTRACTION_COST || this.state.extraction?.called)
      return false;
    // Pick an outdoor landing marker near the operator, excluding entire building footprints.
    let pickup: Point | undefined;
    for (let ring = 0; ring < 12 && !pickup; ring++)
      for (let i = 0; i < 12 && !pickup; i++) {
        const a = (i * Math.PI) / 6,
          x = p.x + Math.cos(a) * (8 + ring * 4),
          z = p.z + Math.sin(a) * (8 + ring * 4);
        if (
          !pointBlocked(this.world, x, z, 5) &&
          !this.world.buildings.some(
            (b) => Math.abs(b.x - x) < b.w / 2 + 7 && Math.abs(b.z - z) < b.d / 2 + 7,
          )
        )
          pickup = { x, z };
      }
    if (!pickup) {
      this.emit('extractionBlocked', 'No clear landing area nearby. Move into the open.');
      return false;
    }
    p.cash -= EXTRACTION_COST;
    this.state.extraction = {
      id: 'called',
      name: 'Contractor extraction',
      ...pickup,
      radius: 10,
      remaining: 43,
      called: true,
      arrivalRemaining: 35,
      holdRemaining: 8,
    };
    for (const e of this.state.enemies)
      if (e.mode !== 'dead' && distance(e, pickup) < 125) {
        e.target = { ...pickup };
        e.lastSeen = this.state.elapsed;
        e.mode = 'investigate';
      }
    this.emit(
      'extractionCalled',
      'Extraction paid: $200. Aircraft inbound in 35 seconds. Reach the green smoke and defend the landing zone.',
      pickup,
    );
    return true;
  }
  private updateExtraction(dt: number): void {
    const s = this.state,
      p = s.player;
    if (!s.extraction) {
      const point = this.nearbyExtraction();
      if (point) {
        s.extraction = {
          ...point,
          remaining: 7,
          called: false,
          arrivalRemaining: 0,
          holdRemaining: 7,
        };
        this.emit('extractionStart', `Extracting at ${point.name}. Hold position for 7 seconds.`);
      }
    }
    const e = s.extraction;
    if (!e) return;
    if (e.called && e.arrivalRemaining > 0) {
      e.arrivalRemaining = Math.max(0, e.arrivalRemaining - dt);
      e.remaining = e.arrivalRemaining + e.holdRemaining;
      if (e.arrivalRemaining === 0)
        this.emit(
          'extractionArrived',
          'Transport on station. Hold inside green smoke for 8 seconds.',
        );
      return;
    }
    if (distance(e, p) <= e.radius) {
      e.holdRemaining = Math.max(0, e.holdRemaining - dt);
      e.remaining = e.holdRemaining;
      if (e.holdRemaining < 1e-8) {
        e.holdRemaining = 0;
        e.remaining = 0;
        this.extract();
      }
    } else if (e.called) {
      e.holdRemaining = 8;
      e.remaining = 8;
    } else {
      s.extraction = null;
      this.emit('extractionCancelled', 'You left the extraction area.');
    }
  }
  extract(): boolean {
    const s = this.state,
      p = s.player,
      e = s.extraction;
    if (s.mode !== 'raid' || !e || e.remaining > 1e-8 || distance(e, p) > e.radius) return false;
    const notes = p.backpack.filter((id) => ITEMS[id]?.kind === 'note'),
      items = p.backpack.filter((id) => ITEMS[id]?.kind !== 'note');
    for (const note of notes) if (!this.profile.lore.includes(note)) this.profile.lore.push(note);
    this.profile.bank += p.cash;
    this.profile.stash.push(
      ...items,
      ...s.carriedKit.filter((id) => ITEMS[id]?.kind !== 'armor' || p.armor > 0),
    );
    for (let i = 0; i < p.medkits; i++) this.profile.stash.push('medkit');
    this.profile.extractions++;
    this.profile.kills += s.kills;
    s.summary = {
      success: true,
      cash: p.cash,
      items: [...items],
      notes: [...notes],
      kills: s.kills,
      duration: s.elapsed,
      reason: 'Extraction successful. Your recovered supplies are secured in the hideout.',
    };
    s.mode = 'extracted';
    s.carriedKit = [];
    p.backpack = [];
    p.cash = 0;
    this.repairEquipped();
    this.emit('extracted', 'Extraction complete. Cash, recovered gear and documents secured.');
    return true;
  }
  private die(reason: string): void {
    const s = this.state;
    if (s.mode !== 'raid') return;
    s.summary = {
      success: false,
      cash: 0,
      items: [],
      notes: [],
      kills: s.kills,
      duration: s.elapsed,
      reason,
    };
    s.mode = 'dead';
    s.player.health = 0;
    s.player.cash = 0;
    s.player.backpack = [];
    s.carriedKit = [];
    this.profile.kills += s.kills;
    this.repairEquipped();
    this.emit('death', reason);
  }
  returnToHideout(): boolean {
    if (this.state.mode !== 'dead' && this.state.mode !== 'extracted') return false;
    const summary = this.state.summary;
    this.state = initialState();
    this.state.summary = summary;
    this.state.player.x = 0;
    this.state.player.z = 3;
    this.syncHideout();
    return true;
  }
  equip(itemId: string): boolean {
    if (this.state.mode !== 'hideout') return false;
    const item = ITEMS[itemId];
    if (!item || (!this.profile.stash.includes(itemId) && itemId !== STARTER_WEAPON)) return false;
    if (item.kind === 'weapon') this.profile.equipped.weaponId = itemId;
    else if (item.kind === 'armor') this.profile.equipped.armorId = itemId;
    else if (item.kind === 'mod' && item.slot) return this.modify(item.slot, itemId);
    else return false;
    this.syncHideout();
    return true;
  }
  buy(itemId: string): boolean {
    const item = ITEMS[itemId],
      price = buyPrice(itemId);
    if (
      this.state.mode !== 'hideout' ||
      !item ||
      price <= 0 ||
      item.kind === 'note' ||
      item.kind === 'valuable' ||
      this.profile.bank < price
    )
      return false;
    this.profile.bank -= price;
    this.profile.stash.push(itemId);
    this.syncHideout();
    return true;
  }
  sell(itemId: string): boolean {
    if (this.state.mode !== 'hideout' || sellPrice(itemId) <= 0 || !this.removeStash(itemId))
      return false;
    this.profile.bank += sellPrice(itemId);
    this.repairEquipped();
    this.syncHideout();
    return true;
  }
  modify(slot: ModSlot, modId: string | null): boolean {
    if (this.state.mode !== 'hideout' || !['optic', 'muzzle', 'magazine'].includes(slot))
      return false;
    if (modId !== null && (!this.profile.stash.includes(modId) || ITEMS[modId]?.slot !== slot))
      return false;
    this.profile.equipped.mods[slot] = modId;
    this.syncHideout();
    return true;
  }
  upgrade(id: string): boolean {
    const definition = UPGRADES[id],
      level = this.profile.upgrades[id] ?? 0;
    if (this.state.mode !== 'hideout' || !definition || level >= definition.maxLevel) return false;
    const cost = definition.baseCost * (level + 1);
    if (this.profile.bank < cost) return false;
    this.profile.bank -= cost;
    this.profile.upgrades[id] = level + 1;
    this.syncHideout();
    return true;
  }
  serialize(): string {
    return JSON.stringify({ version: SAVE_VERSION, profile: this.profile, state: this.state });
  }
  static restore(serialized: string): Game {
    const saved: unknown = JSON.parse(serialized);
    if (!saved || typeof saved !== 'object') throw new Error('Invalid DEADWIRE save.');
    const data = saved as { version?: number; profile?: Profile; state?: RaidState };
    if (data.version !== SAVE_VERSION || !data.profile || !data.state)
      throw new Error('Unsupported DEADWIRE save version.');
    const p = data.profile,
      s = data.state;
    const record = (v: unknown): v is Record<string, unknown> =>
      !!v && typeof v === 'object' && !Array.isArray(v);
    const number = (v: unknown, min = -Number.MAX_VALUE, max = Number.MAX_VALUE): boolean =>
      typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
    const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): boolean =>
      number(v, min, max) && Number.isSafeInteger(v);
    const item = (v: unknown): boolean => typeof v === 'string' && Object.hasOwn(ITEMS, v);
    const weapon = (v: unknown): boolean => typeof v === 'string' && Object.hasOwn(WEAPONS, v);
    const note = (v: unknown): boolean => typeof v === 'string' && Object.hasOwn(NOTES, v);
    const list = (v: unknown, predicate: (entry: unknown) => boolean): boolean =>
      Array.isArray(v) && v.every(predicate);
    const text = (v: unknown): boolean => typeof v === 'string';
    const point = (v: unknown): boolean =>
      record(v) && number(v.x, -240, 240) && number(v.z, -240, 240);
    const mods = (v: unknown): boolean =>
      record(v) &&
      (['optic', 'muzzle', 'magazine'] as const).every(
        (slot) => v[slot] === null || (item(v[slot]) && ITEMS[v[slot] as string]!.slot === slot),
      );
    const equipped = (v: unknown): boolean =>
      record(v) &&
      weapon(v.weaponId) &&
      (v.armorId === null || (item(v.armorId) && ITEMS[v.armorId as string]!.kind === 'armor')) &&
      mods(v.mods);
    const summary = (v: unknown): boolean =>
      v === null ||
      (record(v) &&
        typeof v.success === 'boolean' &&
        integer(v.cash) &&
        list(v.items, item) &&
        list(v.notes, note) &&
        integer(v.kills) &&
        number(v.duration, 0, RAID_DURATION + STEP) &&
        text(v.reason));
    const event = (v: unknown): boolean =>
      record(v) &&
      integer(v.id, 1) &&
      text(v.kind) &&
      text(v.text) &&
      number(v.time, 0, RAID_DURATION + STEP) &&
      ['x', 'y', 'z', 'targetX', 'targetY', 'targetZ'].every(
        (key) => v[key] === undefined || number(v[key]),
      );
    const enemy = (v: unknown): boolean =>
      record(v) &&
      text(v.id) &&
      point(v) &&
      number(v.y) &&
      number(v.yaw) &&
      number(v.health, 0, 100) &&
      ['patrol', 'investigate', 'combat', 'search', 'dead'].includes(v.mode as string) &&
      list(v.patrol, point) &&
      (v.patrol as unknown[]).length > 0 &&
      integer(v.patrolIndex, 0, (v.patrol as unknown[]).length - 1) &&
      point(v.target) &&
      number(v.lastSeen) &&
      number(v.shotTimer, 0) &&
      number(v.awareness, 0, 1) &&
      weapon(v.weaponId) &&
      (v.lootId === null || text(v.lootId)) &&
      (v.strafe === 1 || v.strafe === -1) &&
      number(v.stuck, 0) &&
      (v.mode === 'dead') === (v.health === 0);
    const loot = (v: unknown): boolean =>
      record(v) &&
      text(v.id) &&
      point(v) &&
      list(v.contents, item) &&
      integer(v.cash) &&
      typeof v.collected === 'boolean' &&
      text(v.label) &&
      ['crate', 'corpse'].includes(v.kind as string) &&
      (!v.collected || ((v.contents as unknown[]).length === 0 && v.cash === 0));
    const extraction = (v: unknown): boolean =>
      v === null ||
      (record(v) &&
        text(v.id) &&
        text(v.name) &&
        point(v) &&
        number(v.radius, 0.1, 30) &&
        number(v.remaining, 0, 60) &&
        typeof v.called === 'boolean' &&
        number(v.arrivalRemaining, 0, 35) &&
        number(v.holdRemaining, 0, 8));
    const player = (v: unknown): boolean =>
      record(v) &&
      point(v) &&
      number(v.y, 0, 8) &&
      number(v.yaw) &&
      number(v.pitch, -1.48, 1.48) &&
      number(v.health, 0, 145) &&
      number(v.armor, 0, 110) &&
      number(v.stamina, 0, 160) &&
      integer(v.ammo, 0, 100) &&
      integer(v.reserve) &&
      integer(v.medkits, 0, 5) &&
      integer(v.cash) &&
      list(v.backpack, item) &&
      weapon(v.weaponId) &&
      mods(v.mods) &&
      typeof v.crouching === 'boolean' &&
      number(v.reloadRemaining, 0, 10) &&
      number(v.healCooldown, 0, 3) &&
      number(v.fireCooldown, 0, 1) &&
      number(v.verticalVelocity) &&
      typeof v.grounded === 'boolean';
    if (
      !record(p) ||
      !integer(p.bank) ||
      !list(p.stash, item) ||
      !list(p.lore, note) ||
      !equipped(p.equipped) ||
      !record(p.upgrades) ||
      !Object.entries(UPGRADES).every(([id, upgrade]) =>
        integer(p.upgrades[id], 0, upgrade.maxLevel),
      ) ||
      !integer(p.raids) ||
      !integer(p.extractions, 0, p.raids) ||
      !integer(p.kills)
    )
      throw new Error('Corrupt DEADWIRE profile.');
    if (
      !record(s) ||
      !['hideout', 'raid', 'dead', 'extracted'].includes(s.mode) ||
      !integer(s.seed, 0, 0xffffffff) ||
      !integer(s.rng, 0, 0xffffffff) ||
      !number(s.elapsed, 0, RAID_DURATION + STEP) ||
      !number(s.remaining, 0, RAID_DURATION) ||
      !number(s.stepRemainder, 0, 0.25) ||
      !integer(s.nextEventId, 1) ||
      !player(s.player) ||
      !list(s.enemies, enemy) ||
      !list(s.loot, loot) ||
      !list(s.events, event) ||
      !list(s.carriedKit, item) ||
      !integer(s.kills) ||
      !integer(s.shotsFired) ||
      !extraction(s.extraction) ||
      !summary(s.summary)
    )
      throw new Error('Corrupt DEADWIRE raid state.');
    if (
      new Set(s.enemies.map((e) => e.id)).size !== s.enemies.length ||
      new Set(s.loot.map((l) => l.id)).size !== s.loot.length ||
      ((s.mode === 'dead' || s.mode === 'extracted') && s.carriedKit.length > 0) ||
      s.events.some((e) => e.id >= s.nextEventId)
    )
      throw new Error('Inconsistent DEADWIRE save.');
    const game = new Game(p);
    game.state = clone(s);
    game.world = makeWorld(s.seed);
    return game;
  }
}
