export interface Point {
  x: number;
  z: number;
}
export interface Collider extends Point {
  id: string;
  w: number;
  d: number;
  h: number;
  kind: string;
}
export interface Building extends Collider {}
export interface Prop extends Point {
  id: string;
  rotation: number;
  asset: string;
}
export interface POI extends Point {
  id: string;
  name: string;
  radius: number;
}
export interface ExtractionPoint extends Point {
  id: string;
  name: string;
  radius: number;
}
export interface World {
  seed: number;
  bounds: number;
  pois: POI[];
  colliders: Collider[];
  buildings: Building[];
  props: Prop[];
  extractions: ExtractionPoint[];
  spawn: Point;
}
export function randomSource(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const POIS: POI[] = [
  { id: 'insertion', name: 'South Cordon', x: -170, z: 176, radius: 38 },
  { id: 'customs', name: 'Customs Terminal', x: -90, z: 80, radius: 44 },
  { id: 'harbor', name: 'Blackwater Docks', x: 150, z: 110, radius: 54 },
  { id: 'relay', name: 'Relay Station', x: 124, z: -119, radius: 42 },
  { id: 'refinery', name: 'Ash Refinery', x: 20, z: -36, radius: 60 },
  { id: 'clinic', name: 'Quarantine Clinic', x: -143, z: -75, radius: 43 },
  { id: 'convoy', name: 'Abandoned Convoy', x: -73, z: -167, radius: 36 },
  { id: 'depot', name: 'Rail Depot', x: 105, z: 7, radius: 45 },
];
export function makeWorld(seed: number): World {
  const rnd = randomSource(seed ^ 0x5151),
    buildings: Building[] = [],
    colliders: Collider[] = [],
    props: Prop[] = [];
  const addBuilding = (
    id: string,
    x: number,
    z: number,
    w: number,
    d: number,
    h: number,
    kind = 'warehouse',
  ) => {
    buildings.push({ id, x, z, w, d, h, kind });
    const thick = 0.55,
      door = 4;
    colliders.push(
      { id: `${id}-west`, x: x - w / 2, z, w: thick, d, h, kind: 'wall' },
      { id: `${id}-east`, x: x + w / 2, z, w: thick, d, h, kind: 'wall' },
      { id: `${id}-back`, x, z: z - d / 2, w, d: thick, h, kind: 'wall' },
    );
    for (const side of [-1, 1])
      colliders.push({
        id: `${id}-front-${side}`,
        x: x + (side * (w + door)) / 4,
        z: z + d / 2,
        w: (w - door) / 2,
        d: thick,
        h,
        kind: 'wall',
      });
  };
  addBuilding('safe-customs', -90, 80, 26, 20, 8);
  addBuilding('customs-office', -120, 48, 18, 15, 6, 'office');
  addBuilding('customs-annex', -60, 57, 16, 12, 5, 'office');
  addBuilding('dock-warehouse', 155, 109, 38, 24, 9);
  addBuilding('dock-security', 116, 150, 17, 15, 5, 'office');
  addBuilding('relay-control', 123, -120, 24, 18, 6, 'office');
  addBuilding('relay-generator', 153, -139, 15, 12, 5);
  addBuilding('refinery-workshop', 20, -30, 30, 22, 9);
  addBuilding('refinery-office', -19, -64, 19, 16, 7, 'office');
  addBuilding('refinery-pump', 47, -80, 21, 14, 6);
  addBuilding('clinic-main', -145, -78, 32, 22, 7, 'clinic');
  addBuilding('clinic-store', -178, -48, 15, 13, 5, 'clinic');
  addBuilding('rail-storage', 100, 3, 29, 19, 8);
  addBuilding('rail-office', 139, -28, 16, 14, 5, 'office');
  addBuilding('cordon-shed', -176, 168, 18, 13, 5);
  const addProp = (asset: string, x: number, z: number, rotation = 0) => {
    const id = `prop-${props.length}`;
    props.push({ id, asset, x, z, rotation });
    const shape: Record<string, [number, number, number]> = {
      container: [12, 2.5, 2.6],
      barrel: [1.05, 1.05, 1.4],
      barrier: [3.8, 0.8, 1.15],
      crate: [1.6, 1.4, 1.3],
      antenna: [2.4, 2.4, 18],
    };
    const dims = shape[asset];
    if (dims) {
      const swap = Math.abs(Math.sin(rotation)) > 0.5;
      colliders.push({
        id,
        x,
        z,
        w: swap ? dims[1] : dims[0],
        d: swap ? dims[0] : dims[1],
        h: dims[2],
        kind: asset,
      });
    }
  };
  for (let row = 0; row < 3; row++)
    for (let col = 0; col < 5; col++) addProp('container', 126 + col * 18, 61 + row * 11, 0);
  for (let row = 0; row < 2; row++)
    for (let col = 0; col < 4; col++) addProp('container', 72 + col * 19, 35 + row * 13, 0);
  for (const poi of POIS) {
    for (let i = 0; i < 6; i++) {
      const angle = rnd() * Math.PI * 2,
        rad = poi.radius * (0.68 + rnd() * 0.3),
        x = poi.x + Math.cos(angle) * rad,
        z = poi.z + Math.sin(angle) * rad;
      if (
        Math.abs(x) < 224 &&
        Math.abs(z) < 220 &&
        !colliders.some((c) => Math.abs(c.x - x) < c.w / 2 + 3 && Math.abs(c.z - z) < c.d / 2 + 3)
      )
        addProp(
          i % 3 === 0 ? 'barrier' : i % 3 === 1 ? 'barrel' : 'crate',
          x,
          z,
          rnd() > 0.5 ? Math.PI / 2 : 0,
        );
    }
  }
  addProp('antenna', 123, -151);
  for (let i = 0; i < 5; i++) addProp('barrier', -150 + i * 9, 211, 0);
  for (let i = 0; i < 5; i++) addProp('container', -107 + i * 18, -170, Math.PI / 2);
  // These landmarks are drawn directly by the renderer, rather than world.props.
  // Include their full footprint in both movement and ballistic collision.
  for (const [i, [x, z]] of [
    [-6, -15],
    [46, 0],
    [63, -43],
  ].entries())
    colliders.push({ id: `refinery-tank-${i}`, x: x!, z: z!, w: 14, d: 14, h: 10.5, kind: 'tank' });
  for (const [i, [x, z, rotation]] of [
    [-83, -177, 0.2],
    [-67, -181, -0.2],
    [158, 145, 1.8],
    [-120, 102, 1.7],
    [65, 13, -0.7],
  ].entries()) {
    const cos = Math.abs(Math.cos(rotation!)),
      sin = Math.abs(Math.sin(rotation!));
    colliders.push({
      id: `parked-truck-${i}`,
      x: x!,
      z: z!,
      w: 2.45 * cos + 6 * sin,
      d: 2.45 * sin + 6 * cos,
      h: 2.6,
      kind: 'truck',
    });
  }
  for (let i = 0; i < 3; i++)
    colliders.push({
      id: `refinery-stack-${i}`,
      x: 31 + i * 9,
      z: -96,
      w: 3,
      d: 3,
      h: 34,
      kind: 'stack',
    });
  for (let i = 0; i < 5; i++)
    colliders.push({
      id: `pipe-support-${i}`,
      x: -10 + i * 18,
      z: -17,
      w: 0.7,
      d: 0.8,
      h: 5,
      kind: 'support',
    });
  const spawn = { x: -194 + (rnd() - 0.5) * 14, z: 192 + (rnd() - 0.5) * 8 };
  return {
    seed,
    bounds: 240,
    pois: POIS.map((p) => ({ ...p })),
    buildings,
    colliders,
    props,
    spawn,
    extractions: [
      { id: 'south', name: 'South Drainage Gate', x: -209, z: 220, radius: 8 },
      { id: 'north', name: 'North Service Road', x: -60, z: -219, radius: 9 },
      { id: 'east', name: 'Coast Guard Pier', x: 219, z: 155, radius: 9 },
    ],
  };
}
export function pointBlocked(world: World, x: number, z: number, radius = 0.38): boolean {
  return (
    Math.abs(x) > world.bounds - radius - 2 ||
    Math.abs(z) > world.bounds - radius - 2 ||
    world.colliders.some(
      (c) => Math.abs(x - c.x) < c.w / 2 + radius && Math.abs(z - c.z) < c.d / 2 + radius,
    )
  );
}
/** Distance along a normalized ray to the first opaque surface. */
export function wallDistance(
  world: World,
  origin: { x: number; y: number; z: number },
  direction: { x: number; y: number; z: number },
  maxDistance: number,
): number {
  let nearest = maxDistance;
  for (const c of world.colliders) {
    let near = 0,
      far = nearest;
    const o = [origin.x, origin.y, origin.z],
      v = [direction.x, direction.y, direction.z],
      low = [c.x - c.w / 2, 0, c.z - c.d / 2],
      high = [c.x + c.w / 2, c.h, c.z + c.d / 2];
    for (let axis = 0; axis < 3; axis++) {
      if (Math.abs(v[axis]!) < 1e-9) {
        if (o[axis]! < low[axis]! || o[axis]! > high[axis]!) {
          far = -1;
          break;
        }
      } else {
        let a = (low[axis]! - o[axis]!) / v[axis]!,
          b = (high[axis]! - o[axis]!) / v[axis]!;
        if (a > b) [a, b] = [b, a];
        near = Math.max(near, a);
        far = Math.min(far, b);
        if (near > far) break;
      }
    }
    if (far >= near && near < nearest) nearest = Math.max(0, near);
  }
  return nearest;
}
export function hasLineOfSight(
  world: World,
  a: { x: number; y?: number; z: number },
  b: { x: number; y?: number; z: number },
): boolean {
  const origin = { x: a.x, y: a.y ?? 1.45, z: a.z },
    dx = b.x - a.x,
    dy = (b.y ?? 1.45) - origin.y,
    dz = b.z - a.z,
    len = Math.hypot(dx, dy, dz);
  return (
    len < 1e-6 ||
    wallDistance(world, origin, { x: dx / len, y: dy / len, z: dz / len }, len) >= len - 0.01
  );
}
