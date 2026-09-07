import { test, expect, type Page } from '@playwright/test';
import type { Profile, RaidState } from '../src/sim';
import type { Point, World } from '../src/map';

type Snapshot = {
  state: RaidState;
  profile: Profile;
  world: World;
  performance: Record<string, number>;
  graphics: {
    quality: 'auto' | 'low' | 'high';
    effectiveQuality: 'low' | 'high';
    softwareRenderer: boolean;
    renderer: string;
    renderWidth: number;
    renderHeight: number;
    shadows: boolean;
    pointLightSlots: number;
    environmentLighting: boolean;
  };
};
const browserErrors = new WeakMap<Page, string[]>();

// The game exposes copies for inspection. Every action below uses the actual UI,
// keyboard or mouse; no test mutates game state, storage, RNG, or the game clock.
async function snapshot(page: Page): Promise<Snapshot> {
  return page.evaluate(() => (window as unknown as { __deadwire: Snapshot }).__deadwire);
}

async function holdKeys(page: Page, keys: string[], milliseconds: number) {
  try {
    for (const key of keys) await page.keyboard.down(key);
    await page.waitForTimeout(milliseconds);
  } finally {
    for (const key of keys) await page.keyboard.up(key);
  }
}

function blocked(world: World, point: Point, radius = 0.7) {
  return (
    Math.abs(point.x) > world.bounds - 2 - radius ||
    Math.abs(point.z) > world.bounds - 2 - radius ||
    world.colliders.some(
      (c) =>
        Math.abs(point.x - c.x) < c.w / 2 + radius && Math.abs(point.z - c.z) < c.d / 2 + radius,
    )
  );
}

function clearSegment(world: World, start: Point, end: Point) {
  const steps = Math.ceil(Math.hypot(end.x - start.x, end.z - start.z) / 0.25);
  for (let i = 1; i <= steps; i++) {
    if (
      blocked(world, {
        x: start.x + ((end.x - start.x) * i) / steps,
        z: start.z + ((end.z - start.z) * i) / steps,
      })
    )
      return false;
  }
  return true;
}

function walkingRoute(view: Snapshot, target: Point): Point[] {
  const start = view.state.player;
  if (clearSegment(view.world, start, target)) return [target];
  // Plan around observed collision boxes, then execute the route using WASD.
  // This reads the same world a map UI can inspect; it does not teleport actors.
  const key = (p: Point) => `${p.x},${p.z}`;
  const initial = { x: Math.round(start.x / 2) * 2, z: Math.round(start.z / 2) * 2 };
  const queue: Point[] = [initial],
    previous = new Map<string, Point | null>([[key(initial), null]]);
  let end: Point | undefined;
  for (let head = 0; head < queue.length && head < 80_000; head++) {
    const point = queue[head]!;
    if (Math.hypot(point.x - target.x, point.z - target.z) < 1.9) {
      end = point;
      break;
    }
    for (const [dx, dz] of [
      [2, 0],
      [-2, 0],
      [0, 2],
      [0, -2],
    ]) {
      const next = { x: point.x + dx!, z: point.z + dz! };
      if (
        previous.has(key(next)) ||
        blocked(view.world, next) ||
        !clearSegment(view.world, point, next)
      )
        continue;
      previous.set(key(next), point);
      queue.push(next);
    }
  }
  if (!end)
    throw new Error(`No walking route from ${start.x},${start.z} to ${target.x},${target.z}`);
  const reverse: Point[] = [];
  for (let point: Point | null = end; point; point = previous.get(key(point)) ?? null)
    reverse.push(point);
  const path = reverse.reverse(),
    simplified: Point[] = [];
  let from: Point = start;
  for (let index = 0; index < path.length;) {
    let next = path.length - 1;
    while (next > index && !clearSegment(view.world, from, path[next]!)) next--;
    simplified.push(path[next]!);
    from = path[next]!;
    index = next + 1;
  }
  return simplified;
}

async function walkTo(page: Page, target: Point, tolerance = 1.1) {
  const path = walkingRoute(await snapshot(page), target);
  const deadline = Date.now() + 75_000;
  for (let index = 0; index < path.length; index++) {
    const point = path[index]!;
    const allowedDistance = index === path.length - 1 ? tolerance : 0.65;
    let stagnant = 0;
    while (Date.now() < deadline) {
      const before = (await snapshot(page)).state;
      expect(before.mode).toBe('raid');
      const p = before.player,
        dx = point.x - p.x,
        dz = point.z - p.z,
        distance = Math.hypot(dx, dz);
      if (distance <= allowedDistance) break;
      const forward = -Math.sin(p.yaw) * dx - Math.cos(p.yaw) * dz;
      const strafe = Math.cos(p.yaw) * dx - Math.sin(p.yaw) * dz;
      const largest = Math.max(Math.abs(forward), Math.abs(strafe));
      const keys: string[] = [];
      if (Math.abs(forward) > largest * 0.32) keys.push(forward > 0 ? 'KeyW' : 'KeyS');
      if (Math.abs(strafe) > largest * 0.32) keys.push(strafe > 0 ? 'KeyD' : 'KeyA');
      await holdKeys(page, keys, Math.min(220, Math.max(50, (distance / 4.2) * 600)));
      const after = (await snapshot(page)).state.player;
      stagnant = Math.hypot(after.x - p.x, after.z - p.z) < 0.015 ? stagnant + 1 : 0;
      if (stagnant > 24)
        throw new Error(`Movement stalled at ${after.x},${after.z} toward ${point.x},${point.z}`);
    }
    if (Date.now() >= deadline) throw new Error('Timed out walking with real keyboard input.');
  }
}

test.beforeEach(async ({ page, baseURL }) => {
  const errors: string[] = [];
  browserErrors.set(page, errors);
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('response', (response) => {
    if (response.status() >= 400 && new URL(response.url()).origin === new URL(baseURL!).origin)
      errors.push(`${response.status()} ${response.url()}`);
  });
  await page.goto('/');
  await page.waitForFunction(() => '__deadwire' in window);
  await expect(page.getByRole('button', { name: /Deploy to Blackwater/ })).toBeVisible();
  const auto = (await snapshot(page)).graphics;
  expect(auto.quality).toBe('auto');
  expect(auto.effectiveQuality).toBe(auto.softwareRenderer ? 'low' : 'high');
  await page.locator('[data-action="settings"]').click();
  await page.getByLabel('Graphics quality', { exact: true }).selectOption('low');
  const low = (await snapshot(page)).graphics;
  expect(low).toMatchObject({
    quality: 'low',
    effectiveQuality: 'low',
    shadows: false,
    pointLightSlots: 0,
    environmentLighting: false,
  });
  expect(low.renderWidth).toBe(640);
  expect(low.renderHeight).toBe(400);
  expect(
    await page.locator('#world').evaluate((canvas) => ({
      width: (canvas as HTMLCanvasElement).width,
      height: (canvas as HTMLCanvasElement).height,
    })),
  ).toEqual({ width: 640, height: 400 });
  await page.locator('nav [data-tab="home"]').click();
});

test.afterEach(async ({ page }, info) => {
  const errors = browserErrors.get(page) ?? [];
  await info.attach('browser-errors.json', {
    body: JSON.stringify(errors, null, 2),
    contentType: 'application/json',
  });
  const observed = await snapshot(page);
  await info.attach('graphics-observations.json', {
    body: JSON.stringify(
      { graphics: observed.graphics, performance: observed.performance },
      null,
      2,
    ),
    contentType: 'application/json',
  });
  expect(
    errors,
    'The actual browser should have no script, asset-loading, or renderer errors.',
  ).toEqual([]);
});

test('hideout equipment, weapon modifications, facilities and responsive menus persist', async ({
  page,
}) => {
  const initial = await snapshot(page);
  expect(initial.profile.bank).toBe(650);
  await page.locator('[data-tab="supply"]').click();
  await expect(page.locator('[data-action="buy"][data-id="marksman"]')).toBeDisabled();
  await page.locator('[data-action="buy"][data-id="suppressor"]').click();
  expect((await snapshot(page)).profile.bank).toBe(430);

  await page.locator('[data-tab="weapons"]').click();
  await page.getByLabel('muzzle modification').selectOption('suppressor');
  expect((await snapshot(page)).profile.equipped.mods.muzzle).toBe('suppressor');
  await page.screenshot({ path: 'docs/qa/weapon-workbench.png', fullPage: true });

  await page.locator('[data-tab="loadout"]').click();
  await page.locator('[data-action="equip"][data-id="m9"]').click();
  expect((await snapshot(page)).profile.equipped.weaponId).toBe('m9');
  await page.locator('[data-action="equip"][data-id="m4"]').click();
  expect((await snapshot(page)).profile.equipped.weaponId).toBe('m4');
  await page.locator('[data-tab="upgrades"]').click();
  await page.locator('[data-action="upgrade"][data-id="ammo"]').click();
  const upgraded = await snapshot(page);
  expect(upgraded.profile.bank).toBe(190);
  expect(upgraded.profile.upgrades.ammo).toBe(1);
  expect(upgraded.state.player.reserve).toBe(150);
  await page.locator('[data-tab="archive"]').click();
  await expect(page.getByText('No documents recovered', { exact: true })).toBeVisible();

  await page.locator('nav [data-tab="home"]').click();
  await page.screenshot({ path: 'docs/qa/hideout-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 900, height: 700 });
  await expect(page.locator('[data-action="deploy"]')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'docs/qa/hideout-narrow.png', fullPage: true });
  await page.setViewportSize({ width: 1280, height: 800 });

  await page.getByRole('button', { name: /Walk the hideout/ }).click();
  await expect(page.locator('#menu')).toBeHidden();
  const start = (await snapshot(page)).state.player;
  await holdKeys(page, ['KeyW'], 650);
  const moved = (await snapshot(page)).state.player;
  expect(Math.hypot(moved.x - start.x, moved.z - start.z)).toBeGreaterThan(0.3);
  await holdKeys(page, ['ArrowRight'], 300);
  expect((await snapshot(page)).state.player.yaw).toBeLessThan(moved.yaw);
  await page.screenshot({ path: 'docs/qa/hideout-walk.png', fullPage: true });
  await page.keyboard.press('Tab');
  await expect(page.locator('[data-action="deploy"]')).toBeVisible();
  const profile = (await snapshot(page)).profile;
  await page.reload();
  await expect(page.locator('[data-action="deploy"]')).toBeVisible();
  expect((await snapshot(page)).profile).toEqual(profile);
  expect((await snapshot(page)).graphics.quality).toBe('low');
});

test('a real raid supports loot, combat controls, exact paused reload and edge extraction', async ({
  page,
}, info) => {
  await page.getByRole('button', { name: /Deploy to Blackwater/ }).click();
  await expect(page.locator('#menu')).toBeHidden();
  await expect.poll(async () => (await snapshot(page)).state.mode).toBe('raid');
  const initial = await snapshot(page),
    starter = initial.state.loot.find((loot) => loot.id === 'insertion-cache')!;
  expect(initial.state.enemies.length).toBe(30);
  expect(initial.state.loot.length).toBe(57);
  await page.screenshot({ path: 'docs/qa/blackwater-deployment.png', fullPage: true });
  await walkTo(page, starter);
  await expect(page.locator('.interact')).toContainText('Abandoned responder');
  await page.keyboard.press('KeyE');
  await expect.poll(async () => (await snapshot(page)).state.player.cash).toBe(95);
  const looted = await snapshot(page);
  expect(looted.state.player.backpack).toContain('note_evac');
  expect(looted.state.player.reserve).toBe(180);
  expect(looted.profile.lore).toEqual([]);
  expect(
    looted.state.enemies.some(
      (enemy, index) =>
        Math.hypot(
          enemy.x - initial.state.enemies[index]!.x,
          enemy.z - initial.state.enemies[index]!.z,
        ) > 0.2,
    ),
  ).toBe(true);

  await page.keyboard.press('KeyM');
  await expect(page.getByRole('img', { name: 'Blackwater tactical map' })).toBeVisible();
  await expect(page.getByText('FREE EDGE EXTRACTION', { exact: false })).toBeVisible();
  await page.screenshot({ path: 'docs/qa/tactical-map.png', fullPage: true });
  await page.keyboard.press('KeyI');
  await expect(page.getByText('Last Ferry', { exact: true })).toBeVisible();
  await page.locator('[data-action="read"][data-id="note_evac"]').click();
  await expect(page.locator('.document')).toContainText('The ferry left half empty');
  await page.screenshot({ path: 'docs/qa/field-inventory.png', fullPage: true });
  await page.keyboard.press('Tab');
  await expect.poll(async () => page.evaluate(() => document.pointerLockElement?.id)).toBe('world');
  const beforeFire = (await snapshot(page)).state;
  await page.mouse.down({ button: 'left' });
  await page.waitForTimeout(250);
  await page.mouse.up({ button: 'left' });
  await expect
    .poll(async () => (await snapshot(page)).state.shotsFired)
    .toBeGreaterThan(beforeFire.shotsFired);
  const fired = (await snapshot(page)).state.player;
  expect(fired.ammo).toBeLessThan(beforeFire.player.ammo);
  await page.keyboard.press('KeyR');
  await expect
    .poll(async () => (await snapshot(page)).state.player.reloadRemaining)
    .toBeGreaterThan(0);
  await expect
    .poll(async () => (await snapshot(page)).state.player.ammo, { timeout: 30_000 })
    .toBe(30);
  expect((await snapshot(page)).state.player.reserve).toBe(fired.reserve - (30 - fired.ammo));

  await page.keyboard.press('Tab');
  await expect(page.locator('[data-action="call"]')).toBeDisabled();
  const paused = await snapshot(page);
  await page.waitForTimeout(300);
  expect((await snapshot(page)).state).toEqual(paused.state);
  await page.reload();
  await expect(page.locator('[data-action="resume"]')).toBeVisible();
  const restored = await snapshot(page);
  expect(restored.state).toEqual(paused.state);
  expect(restored.profile).toEqual(paused.profile);
  expect(restored.graphics.quality).toBe('low');
  await page.locator('[data-action="resume"]').click();

  const exit = restored.world.extractions.find((point) => point.id === 'south')!;
  expect({ x: exit.x, z: exit.z }).toEqual({ x: -209, z: 220 });
  await walkTo(page, exit, 2);
  await expect
    .poll(async () => (await snapshot(page)).state.mode, { timeout: 40_000 })
    .toBe('extracted');
  const extracted = await snapshot(page);
  expect(extracted.state.summary?.success).toBe(true);
  expect(extracted.profile.bank).toBe(745);
  expect(extracted.profile.lore).toContain('note_evac');
  expect(extracted.profile.stash).toContain('m4');
  expect(extracted.profile.extractions).toBe(1);
  await page.screenshot({ path: 'docs/qa/extraction-success.png', fullPage: true });
  await info.attach('renderer-observations.json', {
    body: JSON.stringify(extracted.performance, null, 2),
    contentType: 'application/json',
  });
  await page.locator('[data-action="return"]').click();
  await page.locator('[data-tab="archive"]').click();
  await expect(page.locator('.document')).toContainText('Last Ferry');
  await expect(page.locator('.document')).toContainText('The ferry left half empty');
});

test('earned field cash unlocks menu extraction and the call charges exactly $200', async ({
  page,
}) => {
  test.setTimeout(180_000);
  await page.locator('[data-action="deploy"]').click();
  await expect(page.locator('#menu')).toBeHidden();
  let view = await snapshot(page);
  await walkTo(
    page,
    view.state.loot.find((loot) => loot.id === 'insertion-cache')!,
  );
  await page.keyboard.press('KeyE');
  await expect.poll(async () => (await snapshot(page)).state.player.cash).toBe(95);
  await page.keyboard.press('Tab');
  await expect(
    page.getByRole('button', { name: 'Call extraction · $200', exact: true }),
  ).toBeDisabled();
  await page.locator('[data-action="resume"]').click();

  for (let visits = 0; visits < 7; visits++) {
    view = await snapshot(page);
    if (view.state.player.cash > 200) break;
    const candidates = view.state.loot.filter(
      (loot) => loot.id.startsWith('cache-0-') && !loot.collected && loot.cash > 0,
    );
    candidates.sort(
      (a, b) =>
        Math.hypot(a.x - view.state.player.x, a.z - view.state.player.z) -
        Math.hypot(b.x - view.state.player.x, b.z - view.state.player.z),
    );
    expect(candidates.length).toBeGreaterThan(0);
    const before = view.state.player.cash;
    await walkTo(page, candidates[0]!);
    await page.keyboard.press('KeyE');
    await expect.poll(async () => (await snapshot(page)).state.player.cash).toBeGreaterThan(before);
  }
  const earned = (await snapshot(page)).state.player.cash;
  expect(earned).toBeGreaterThan(200);
  await page.keyboard.press('Tab');
  await expect(page.locator('[data-action="call"]')).toBeEnabled();
  await page.locator('[data-action="call"]').click();
  await expect.poll(async () => (await snapshot(page)).state.extraction?.called).toBe(true);
  const called = await snapshot(page);
  expect(called.state.player.cash).toBe(earned - 200);
  expect(called.state.extraction?.arrivalRemaining).toBeGreaterThan(0);
  await expect(page.locator('.extraction-hud')).toContainText('AIRCRAFT INBOUND');
  await page.screenshot({ path: 'docs/qa/called-extraction.png', fullPage: true });
  await page.keyboard.press('Tab');
  await expect(page.locator('[data-action="call"]')).toBeDisabled();
});
