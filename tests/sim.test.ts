import { describe, it, expect } from 'vitest';
import { Game, EXTRACTION_COST, RAID_DURATION, sellPrice } from '../src/sim';
import { ITEMS, WEAPONS } from '../src/content';
import { hasLineOfSight, makeWorld, pointBlocked, wallDistance, type World } from '../src/map';

const advance = (game: Game, seconds: number) => {
  for (let i = 0; i < Math.ceil(seconds * 60); i++) game.tick(1 / 60);
};
const start = (seed = 431) => {
  const game = new Game();
  expect(game.deploy(seed)).toBe(true);
  return game;
};
const atEdge = (game: Game) => {
  const edge = game.world.extractions[0]!;
  game.state.player.x = edge.x;
  game.state.player.z = edge.z;
  return edge;
};

describe('raid economy and transaction boundaries', () => {
  it('requires strictly more than $200 of carried cash and spends it exactly once', () => {
    const game = start(),
      bank = game.profile.bank;
    game.state.player.cash = EXTRACTION_COST;
    expect(game.callExtraction()).toBe(false);
    expect(game.state.player.cash).toBe(200);
    game.state.player.cash = 201;
    expect(game.callExtraction()).toBe(true);
    expect(game.state.player.cash).toBe(1);
    expect(game.profile.bank).toBe(bank);
    expect(game.callExtraction()).toBe(false);
    expect(game.state.player.cash).toBe(1);
    expect(game.state.extraction?.arrivalRemaining).toBe(35);
  });
  it('secures only extracted cash, equipment and notes, without duplicate claims', () => {
    const game = start(),
      bank = game.profile.bank,
      loot = game.state.loot.find((l) => l.id === 'insertion-cache')!;
    game.state.player.x = loot.x;
    game.state.player.z = loot.z;
    expect(game.interact(loot.id)).toBe(true);
    expect(game.profile.lore).not.toContain('note_evac');
    expect(game.profile.bank).toBe(bank);
    expect(game.interact(loot.id)).toBe(false);
    expect(game.state.player.cash).toBe(95);
    atEdge(game);
    advance(game, 7.2);
    expect(game.state.mode).toBe('extracted');
    expect(game.profile.bank).toBe(bank + 95);
    expect(game.profile.lore).toContain('note_evac');
    expect(game.profile.stash.filter((id) => id === 'm4')).toHaveLength(1);
    expect(game.extract()).toBe(false);
    const restored = Game.restore(game.serialize());
    expect(restored.extract()).toBe(false);
    expect(restored.profile.bank).toBe(bank + 95);
  });
  it('cannot use extract or returnToHideout to bypass the countdown', () => {
    const game = start();
    expect(game.extract()).toBe(false);
    expect(game.returnToHideout()).toBe(false);
    atEdge(game);
    advance(game, 3);
    expect(game.extract()).toBe(false);
    game.state.player.z -= 20;
    advance(game, 0.1);
    expect(game.state.extraction).toBeNull();
    atEdge(game);
    advance(game, 5);
    expect(game.state.mode).toBe('raid');
    advance(game, 2.2);
    expect(game.state.mode).toBe('extracted');
  });
  it('called transport waits for arrival and resets boarding when the player leaves', () => {
    const game = start();
    game.state.player.x = -224;
    game.state.player.z = 224;
    game.state.player.cash = 201;
    game.callExtraction();
    const e = game.state.extraction!;
    game.state.player.x = e.x;
    game.state.player.z = e.z;
    advance(game, 34);
    expect(game.state.mode).toBe('raid');
    expect(e.arrivalRemaining).toBeGreaterThan(0);
    advance(game, 4);
    expect(e.holdRemaining).toBeGreaterThan(4);
    game.state.player.x = e.x + 20;
    advance(game, 0.1);
    expect(e.holdRemaining).toBe(8);
    game.state.player.x = e.x;
    advance(game, 8.2);
    expect(game.state.mode).toBe('extracted');
    expect(game.profile.bank).toBe(651);
  });
  it('loses only the deployed kit on a failed raid and always offers the emergency sidearm', () => {
    const game = new Game();
    game.buy('mp5');
    const bank = game.profile.bank;
    game.deploy(431);
    expect(game.profile.stash).not.toContain('m4');
    game.state.player.cash = 550;
    game.state.player.backpack.push('gold', 'note_signal');
    game.state.elapsed = RAID_DURATION - 0.01;
    advance(game, 0.1);
    expect(game.state.mode).toBe('dead');
    expect(game.profile.bank).toBe(bank);
    expect(game.profile.stash).toContain('mp5');
    expect(game.profile.stash).not.toContain('m4');
    expect(game.profile.stash).not.toContain('gold');
    expect(game.profile.lore).toEqual([]);
    expect(game.returnToHideout()).toBe(true);
    expect(game.state.player.weaponId).toBe('m9');
    expect(game.deploy(431)).toBe(true);
    expect(game.state.player.ammo).toBe(15);
  });
  it('supports stash trading and persistent, paid roguelite upgrades', () => {
    const game = new Game(),
      bank = game.profile.bank;
    expect(game.buy('extended_mag')).toBe(true);
    expect(game.profile.bank).toBe(bank - ITEMS.extended_mag!.value);
    expect(game.modify('magazine', 'extended_mag')).toBe(true);
    expect(game.weaponStats().magazine).toBe(45);
    expect(game.weaponStats().reloadTime).toBeGreaterThan(WEAPONS.m4!.reloadTime);
    expect(game.modify('optic', 'extended_mag')).toBe(false);
    expect(game.sell('extended_mag')).toBe(true);
    expect(game.profile.equipped.mods.magazine).toBeNull();
    expect(game.profile.bank).toBe(bank - 170 + sellPrice('extended_mag'));
    expect(game.upgrade('endurance')).toBe(true);
    expect(game.maxStamina()).toBe(120);
    expect(Game.restore(game.serialize()).maxStamina()).toBe(120);
    expect(game.buy('note_evac')).toBe(false);
  });
});

describe('combat, collision and active garrison AI', () => {
  it('blocks eye-level line of sight and bullets but permits sight over low cover', () => {
    const world: World = {
      ...makeWorld(1),
      colliders: [{ id: 'wall', x: 0, z: 0, w: 1, d: 8, h: 3, kind: 'wall' }],
    };
    expect(hasLineOfSight(world, { x: -4, z: 0 }, { x: 4, z: 0 })).toBe(false);
    expect(wallDistance(world, { x: -4, y: 1.5, z: 0 }, { x: 1, y: 0, z: 0 }, 20)).toBeCloseTo(3.5);
    expect(hasLineOfSight(world, { x: -4, z: 0, y: 4 }, { x: 4, z: 0, y: 4 })).toBe(true);
    world.colliders[0]!.h = 0.9;
    expect(hasLineOfSight(world, { x: -4, z: 0 }, { x: 4, z: 0 })).toBe(true);
  });
  it('keeps movement outside walls and allows the actual warehouse doorway', () => {
    const game = start(),
      building = game.world.buildings[0]!,
      p = game.state.player;
    p.x = building.x - building.w / 2 - 1;
    p.z = building.z;
    p.yaw = -Math.PI / 2;
    for (let i = 0; i < 60; i++) game.tick(1 / 60, { forward: 1 });
    expect(p.x).toBeLessThan(building.x - building.w / 2 - 0.5);
    expect(pointBlocked(game.world, p.x, p.z)).toBe(false);
    p.x = building.x;
    p.z = building.z + building.d / 2 + 2;
    p.yaw = 0;
    for (let i = 0; i < 60; i++) game.tick(1 / 60, { forward: 1 });
    expect(p.z).toBeLessThan(building.z + building.d / 2);
  });
  it('gives visual tanks, rotated trucks and refinery structures matching collision', () => {
    const game = start(),
      world = game.world;
    const tanks = world.colliders.filter((c) => c.kind === 'tank'),
      trucks = world.colliders.filter((c) => c.kind === 'truck');
    expect(tanks).toHaveLength(3);
    expect(trucks).toHaveLength(5);
    for (const solid of [...tanks, ...trucks]) {
      expect(pointBlocked(world, solid.x, solid.z)).toBe(true);
      expect(
        hasLineOfSight(
          world,
          { x: solid.x - solid.w, z: solid.z },
          { x: solid.x + solid.w, z: solid.z },
        ),
      ).toBe(false);
    }
    const rotated = world.colliders.find((c) => c.id === 'parked-truck-2')!;
    expect(rotated.w).toBeCloseTo(2.45 * Math.abs(Math.cos(1.8)) + 6 * Math.abs(Math.sin(1.8)));
    expect(rotated.d).toBeCloseTo(2.45 * Math.abs(Math.sin(1.8)) + 6 * Math.abs(Math.cos(1.8)));
    expect(world.colliders.filter((c) => c.kind === 'stack')).toHaveLength(3);
    for (const seed of [1, 44, 431, 821, 9001]) {
      const seeded = start(seed);
      expect(pointBlocked(seeded.world, seeded.state.player.x, seeded.state.player.z)).toBe(false);
      for (const loot of seeded.state.loot)
        expect(pointBlocked(seeded.world, loot.x, loot.z, 0.6), `${seed}:${loot.id}`).toBe(false);
      for (const guard of seeded.state.enemies)
        expect(pointBlocked(seeded.world, guard.x, guard.z, 0.4), `${seed}:${guard.id}`).toBe(
          false,
        );
    }
  });
  it('prevents loot previews and collection through walls or outside pickup range', () => {
    const game = start(),
      loot = game.state.loot[0]!,
      p = game.state.player;
    loot.x = -220;
    loot.z = 20;
    p.x = -222;
    p.z = 20;
    game.world.colliders.push({
      id: 'loot-cover',
      x: -221,
      z: 20,
      w: 0.5,
      d: 5,
      h: 4,
      kind: 'wall',
    });
    expect(game.nearbyLoot().some((entry) => entry.id === loot.id)).toBe(false);
    expect(game.interact(loot.id)).toBe(false);
    expect(loot.collected).toBe(false);
    expect(p.cash).toBe(0);
    game.world.colliders.pop();
    p.x = -224;
    expect(game.nearbyLoot().some((entry) => entry.id === loot.id)).toBe(false);
    expect(game.interact(loot.id)).toBe(false);
    p.x = -222;
    expect(game.nearbyLoot().some((entry) => entry.id === loot.id)).toBe(true);
    expect(game.interact(loot.id)).toBe(true);
    expect(p.cash).toBe(95);
  });
  it('advances real patrols and makes them investigate audible gunshots', () => {
    const game = start(),
      positions = game.state.enemies.map((e) => ({ x: e.x, z: e.z }));
    advance(game, 2);
    expect(
      game.state.enemies.filter(
        (e, i) => Math.hypot(e.x - positions[i]!.x, e.z - positions[i]!.z) > 1,
      ),
    ).toHaveLength(game.state.enemies.length);
    const enemy = game.state.enemies[0]!,
      p = game.state.player;
    p.x = enemy.x + 30;
    p.z = enemy.z + 30;
    game.shoot({ x: 0, y: 1, z: 0 });
    expect(game.state.enemies.some((e) => e.mode === 'investigate')).toBe(true);
  });
  it('prevents both player and enemy shots through the same opaque wall', () => {
    const game = start(),
      enemy = game.state.enemies[0]!,
      p = game.state.player;
    // Small canonical combat fixture with a full-height wall; all other patrols remain active.
    p.x = -210;
    p.z = 40;
    enemy.x = -200;
    enemy.z = 40;
    enemy.mode = 'combat';
    enemy.lastSeen = game.state.elapsed;
    enemy.target = { x: p.x, z: p.z };
    enemy.yaw = Math.PI / 2;
    game.world.colliders.push({
      id: 'combat-cover',
      x: -205,
      z: 40,
      w: 1,
      d: 20,
      h: 4,
      kind: 'wall',
    });
    const health = p.health,
      armor = p.armor;
    expect(game.shoot({ x: 1, y: 0, z: 0 })?.hit).toBe(false);
    expect(enemy.health).toBe(100);
    advance(game, 2);
    expect(p.health).toBe(health);
    expect(p.armor).toBe(armor);
    p.z = 54;
    enemy.z = 54;
    enemy.x = -200;
    enemy.mode = 'combat';
    enemy.lastSeen = game.state.elapsed;
    advance(game, 6);
    expect(p.health + p.armor).toBeLessThan(health + armor);
  });
  it('makes killed soldiers lootable and does not generate their loot twice', () => {
    const game = start(),
      e = game.state.enemies[0]!,
      p = game.state.player;
    p.x = -215;
    p.z = 30;
    e.x = -215;
    e.z = 22;
    e.health = 30;
    const shot = game.shoot({ x: 0, y: -0.05, z: -1 });
    expect(shot?.hit).toBe(true);
    expect(e.mode).toBe('dead');
    expect(game.state.kills).toBe(1);
    const corpse = game.state.loot.find((l) => l.id === e.lootId)!;
    p.x = corpse.x;
    p.z = corpse.z;
    expect(game.interact(corpse.id)).toBe(true);
    expect(p.backpack).toContain(e.weaponId);
    expect(game.interact(corpse.id)).toBe(false);
    expect(game.state.loot.filter((l) => l.id === e.lootId)).toHaveLength(1);
  });
  it('reloads from actual reserves and a trauma kit consumes one charge', () => {
    const game = start(),
      p = game.state.player;
    game.shoot({ x: 0, y: 1, z: 0 });
    const reserve = p.reserve;
    expect(game.reload()).toBe(true);
    expect(game.shoot({ x: 0, y: 1, z: 0 })).toBeNull();
    advance(game, 2.3);
    expect(p.ammo).toBe(game.weaponStats().magazine);
    expect(p.reserve).toBe(reserve - 1);
    p.health = 25;
    const kits = p.medkits;
    expect(game.heal()).toBe(true);
    expect(p.health).toBe(85);
    expect(p.medkits).toBe(kits - 1);
    expect(game.heal()).toBe(false);
  });
});

describe('seeded worlds and exact saved continuation', () => {
  it('provides a large connected insertion and at least forty caches with named regions', () => {
    const game = start();
    expect(game.world.bounds).toBe(240);
    expect(game.state.loot.length).toBeGreaterThanOrEqual(40);
    expect(game.world.pois.length).toBe(8);
    expect(game.world.extractions.length).toBe(3);
    expect(pointBlocked(game.world, game.state.player.x, game.state.player.z)).toBe(false);
    for (const exit of game.world.extractions)
      expect(pointBlocked(game.world, exit.x, exit.z, exit.radius)).toBe(false);
    expect(
      game.state.enemies.every(
        (e) => Math.hypot(e.x - game.state.player.x, e.z - game.state.player.z) > 60,
      ),
    ).toBe(true);
  });
  it('restores an active raid, random state, consumed loot and deterministic combat', () => {
    const original = start(821);
    for (let frame = 0; frame < 220; frame++) {
      original.tick(0.016, {
        forward: frame < 120 ? 1 : 0,
        strafe: frame > 120 ? 0.4 : 0,
        yaw: 0.15,
      });
      if (frame % 14 === 0) original.shoot({ x: 0, y: 0.1, z: -1 });
    }
    const resumed = Game.restore(original.serialize());
    expect(resumed.serialize()).toBe(original.serialize());
    expect(resumed.world).toEqual(original.world);
    for (let frame = 0; frame < 360; frame++) {
      const input = {
        forward: 0.5,
        strafe: frame < 150 ? 0.5 : -0.5,
        yaw: 0.2,
        sprint: frame > 220,
      };
      original.tick(1 / 60, input);
      resumed.tick(1 / 60, input);
      if (frame % 20 === 0) {
        expect(resumed.shoot({ x: 0, y: 0, z: -1 })).toEqual(original.shoot({ x: 0, y: 0, z: -1 }));
      }
    }
    expect(resumed.serialize()).toBe(original.serialize());
  });
  it('seeds the same patrol and loot layout and rejects malformed saves', () => {
    const first = start(44),
      second = start(44),
      third = start(45);
    expect(first.serialize()).toBe(second.serialize());
    expect(first.world).not.toEqual(third.world);
    expect(() => Game.restore('{}')).toThrow();
    expect(() => Game.restore('{"version":99}')).toThrow();
    expect(() => Game.restore('not json')).toThrow();
  });
  it('rejects corrupted nested saves before they can reach rendering, inventory or AI updates', () => {
    const game = start();
    const corruptions: Array<(save: any) => void> = [
      (save) => {
        save.profile.equipped.mods = null;
      },
      (save) => {
        save.profile.upgrades.vitality = -1;
      },
      (save) => {
        save.profile.lore = ['gold'];
      },
      (save) => {
        save.state.enemies[0].patrol = null;
      },
      (save) => {
        save.state.enemies[0].patrolIndex = 999;
      },
      (save) => {
        save.state.loot[0].contents = 'gold';
      },
      (save) => {
        save.state.loot[0].collected = true;
      },
      (save) => {
        save.state.player.backpack = ['__proto__'];
      },
      (save) => {
        save.state.player.mods.optic = 'extended_mag';
      },
      (save) => {
        save.state.player.ammo = -1;
      },
      (save) => {
        save.state.rng = null;
      },
      (save) => {
        save.state.events[0].id = save.state.nextEventId;
      },
      (save) => {
        save.state.enemies[1].id = save.state.enemies[0].id;
      },
      (save) => {
        save.state.extraction = { id: 'broken' };
      },
    ];
    for (const corrupt of corruptions) {
      const saved = JSON.parse(game.serialize());
      corrupt(saved);
      expect(() => Game.restore(JSON.stringify(saved))).toThrow();
    }
    const loaded = Game.restore(game.serialize());
    expect(loaded.serialize()).toBe(game.serialize());
    expect(() => loaded.tick(1 / 60)).not.toThrow();
  });
});
