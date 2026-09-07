import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import type { Game, GameEvent } from './sim';
import { randomSource } from './map';
const ASSETS = [
  'rifle',
  'soldier',
  'crate',
  'container',
  'barrel',
  'barrier',
  'truck',
  'workbench',
  'locker',
  'radio',
  'medkit',
  'backpack',
  'generator',
];
export const STATIONS = [
  { id: 'loadout', label: 'Equipment lockers', x: -7, z: -2 },
  { id: 'weapons', label: 'Weapon workbench', x: 0, z: -5 },
  { id: 'supply', label: 'Supply exchange', x: 7, z: -3 },
  { id: 'deploy', label: 'Operations board', x: 6.5, z: 4 },
  { id: 'upgrades', label: 'Hideout facilities', x: -7, z: 4 },
];
export class GameScene {
  renderer: T.WebGLRenderer;
  scene = new T.Scene();
  camera = new T.PerspectiveCamera(72, 1, 0.04, 700);
  env = new T.Group();
  dynamic = new T.Group();
  weaponRoot = new T.Group();
  weaponScene = new T.Scene();
  assets = new Map<string, T.Group>();
  enemies = new Map<string, T.Group>();
  loot = new Map<string, T.Group>();
  light = new T.DirectionalLight(0xffdfb1, 3.2);
  target = new T.Object3D();
  marker = new T.Group();
  helicopter = new T.Group();
  private materials = new Map<string, T.MeshStandardMaterial>();
  private batches = new Map<T.Material, T.BufferGeometry[]>();
  private lastMode = '';
  private tracers: { line: T.Line; life: number }[] = [];
  private recoil = 0;
  private walk = 0;
  private flash: T.Mesh;
  private envObjects: { obj: T.Object3D; x: number; z: number }[] = [];
  private groundTex: T.CanvasTexture;
  fps = 0;
  frameMs = 0;
  drawCalls = 0;
  triangles = 0;
  private frameAccum = 0;
  private frames = 0;
  private time = 0;
  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new T.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6));
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = T.PCFSoftShadowMap;
    this.renderer.outputColorSpace = T.SRGBColorSpace;
    this.renderer.toneMapping = T.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    const pmrem = new T.PMREMGenerator(this.renderer),
      room = new RoomEnvironment();
    this.scene.environment = pmrem.fromScene(room, 0.04).texture;
    this.scene.environmentIntensity = 0.3;
    room.dispose();
    pmrem.dispose();
    this.scene.add(this.env, this.dynamic, this.light, this.target);
    this.light.target = this.target;
    this.light.castShadow = true;
    Object.assign(this.light.shadow.camera, {
      left: -55,
      right: 55,
      top: 55,
      bottom: -55,
      near: 0.5,
      far: 210,
    });
    this.light.shadow.mapSize.set(2048, 2048);
    this.light.shadow.bias = -0.00025;
    this.light.shadow.normalBias = 0.045;
    this.scene.add(new T.HemisphereLight(0xb2cad2, 0x6e6650, 1.35));
    this.weaponScene.add(new T.HemisphereLight(0xc6d5db, 0x756a53, 2.8));
    const wl = new T.DirectionalLight(0xffd6a6, 3);
    wl.position.set(-2, 4, 1);
    this.weaponScene.add(wl, this.weaponRoot);
    this.flash = new T.Mesh(
      new T.ConeGeometry(0.04, 0.24, 7),
      new T.MeshBasicMaterial({
        color: 0xffd792,
        transparent: true,
        opacity: 0.8,
        depthTest: false,
      }),
    );
    this.flash.rotation.x = -Math.PI / 2;
    this.flash.position.set(0.18, -0.16, -1.02);
    this.flash.visible = false;
    this.weaponRoot.add(this.flash);
    this.groundTex = this.texture('ground');
    addEventListener('resize', () => {
      this.camera.aspect = innerWidth / innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(innerWidth, innerHeight);
    });
  }
  async load(progress: (s: string) => void) {
    const loader = new GLTFLoader();
    let loaded = 0;
    await Promise.all(
      ASSETS.map(async (id) => {
        const gltf = await loader.loadAsync(`/assets/${id}.glb`);
        gltf.scene.traverse((o) => {
          if (o instanceof T.Mesh) {
            o.castShadow = true;
            o.receiveShadow = true;
          }
        });
        this.assets.set(id, gltf.scene);
        progress(`Loading field equipment · ${++loaded}/${ASSETS.length}`);
      }),
    );
    this.setWeapon();
  }
  asset(id: string, x = 0, y = 0, z = 0, rotation = 0, scale = 1, parent: T.Object3D = this.env) {
    const obj = (this.assets.get(id) ?? this.assets.get('crate'))!.clone(true);
    obj.position.set(x, y, z);
    obj.rotation.y = rotation;
    obj.scale.setScalar(scale);
    parent.add(obj);
    return obj;
  }
  private texture(type: string) {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 256;
    const ctx = cv.getContext('2d')!,
      rand = randomSource(91),
      d = ctx.createImageData(256, 256);
    for (let i = 0; i < d.data.length; i += 4) {
      const a = rand() * 26;
      d.data[i] = 98 + a;
      d.data[i + 1] = 99 + a;
      d.data[i + 2] = 86 + a;
      d.data[i + 3] = 255;
    }
    ctx.putImageData(d, 0, 0);
    ctx.globalAlpha = 0.13;
    for (let i = 0; i < 140; i++) {
      ctx.strokeStyle = rand() > 0.5 ? '#171e1b' : '#ccd0b9';
      ctx.beginPath();
      const x = rand() * 256,
        y = rand() * 256;
      ctx.moveTo(x, y);
      ctx.lineTo(x + rand() * 70, y + rand() * 5);
      ctx.stroke();
    }
    const t = new T.CanvasTexture(cv);
    t.wrapS = t.wrapT = T.RepeatWrapping;
    t.repeat.set(type === 'ground' ? 100 : 1, type === 'ground' ? 100 : 1);
    t.colorSpace = T.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  }
  private mat(color: number, roughness = 0.9, metalness = 0, emissive = 0) {
    const key = [color, roughness, metalness, emissive].join('-');
    if (!this.materials.has(key))
      this.materials.set(
        key,
        new T.MeshStandardMaterial({
          color,
          roughness,
          metalness,
          emissive,
          emissiveIntensity: emissive ? 2.5 : 0,
        }),
      );
    return this.materials.get(key)!;
  }
  private shape(
    geo: T.BufferGeometry,
    x: number,
    y: number,
    z: number,
    mat: T.Material,
    rot: T.Euler = new T.Euler(),
  ) {
    geo.applyMatrix4(
      new T.Matrix4().compose(
        new T.Vector3(x, y, z),
        new T.Quaternion().setFromEuler(rot),
        new T.Vector3(1, 1, 1),
      ),
    );
    const list = this.batches.get(mat) ?? [];
    list.push(geo);
    this.batches.set(mat, list);
  }
  private box(
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    color: number,
    metal = 0,
  ) {
    this.shape(new T.BoxGeometry(w, h, d), x, y, z, this.mat(color, 0.85, metal));
  }
  private cylinder(
    x: number,
    y: number,
    z: number,
    r: number,
    h: number,
    color: number,
    segments = 16,
  ) {
    this.shape(new T.CylinderGeometry(r, r, h, segments), x, y, z, this.mat(color, 0.65, 0.3));
  }
  private flush() {
    for (const [mat, geos] of this.batches) {
      const merged = mergeGeometries(geos, false);
      if (merged) {
        const mesh = new T.Mesh(merged, mat);
        mesh.receiveShadow = true;
        mesh.castShadow = true;
        this.env.add(mesh);
      }
      geos.forEach((g) => g.dispose());
    }
    this.batches.clear();
  }
  private clear() {
    const shared = new Set<T.BufferGeometry>();
    for (const a of this.assets.values())
      a.traverse((n) => {
        if (n instanceof T.Mesh) shared.add(n.geometry);
      });
    this.env.traverse((o) => {
      if (o instanceof T.Mesh && !shared.has(o.geometry)) o.geometry.dispose();
    });
    this.env.clear();
    this.dynamic.clear();
    this.enemies.clear();
    this.loot.clear();
    this.envObjects = [];
    this.tracers.forEach((t) => {
      t.line.geometry.dispose();
      (t.line.material as T.Material).dispose();
    });
    this.tracers = [];
    this.marker = new T.Group();
    this.helicopter = new T.Group();
  }
  private sign(
    text: string,
    x: number,
    y: number,
    z: number,
    width: number,
    height: number,
    color = '#d5d8c5',
    background = '#202b28',
    rot = 0,
  ) {
    const cv = document.createElement('canvas');
    cv.width = 1024;
    cv.height = 256;
    const ctx = cv.getContext('2d')!;
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, 1024, 256);
    ctx.strokeStyle = color;
    ctx.lineWidth = 7;
    ctx.strokeRect(12, 12, 1000, 232);
    ctx.fillStyle = color;
    ctx.font = 'bold 92px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 512, 133, 960);
    const tex = new T.CanvasTexture(cv);
    tex.colorSpace = T.SRGBColorSpace;
    const plane = new T.Mesh(
      new T.PlaneGeometry(width, height),
      new T.MeshStandardMaterial({ map: tex, roughness: 0.8, side: T.DoubleSide }),
    );
    plane.position.set(x, y, z);
    plane.rotation.y = rot;
    this.env.add(plane);
    return plane;
  }
  setWeapon() {
    const old = this.weaponRoot.getObjectByName('view-weapon');
    if (old) this.weaponRoot.remove(old);
    const rifle = this.asset('rifle', 0.21, -0.27, -0.52, 0, 0.8, this.weaponRoot);
    rifle.name = 'view-weapon';
  }
  private attachments(game: Game) {
    this.weaponRoot.getObjectByName('view-weapon')?.traverse((o) => {
      if (o.name === 'optic') o.visible = !!game.state.player.mods.optic;
      if (o.name === 'suppressor') o.visible = game.state.player.mods.muzzle === 'suppressor';
    });
  }
  buildHideout() {
    this.clear();
    this.lastMode = 'hideout';
    this.scene.background = new T.Color(0x12191b);
    this.scene.fog = new T.FogExp2(0x151c1e, 0.018);
    this.scene.environmentIntensity = 0.45;
    this.light.intensity = 1.1;
    this.light.position.set(2, 14, 7);
    this.target.position.set(0, 0, 0);
    this.box(0, -0.15, 0, 20, 0.3, 17, 0x414643);
    this.box(0, 2.8, -8.5, 20, 5.8, 0.45, 0x414847);
    this.box(-10, 2.8, 0, 0.4, 5.8, 17, 0x343e3e);
    this.box(10, 2.8, 0, 0.4, 5.8, 17, 0x343e3e);
    this.box(0, 5.7, 0, 20, 0.25, 17, 0x1d2527);
    for (let z = -7; z <= 8; z += 3) {
      this.box(0, 5.35, z, 20, 0.36, 0.23, 0x242c2b, 0.5);
      this.box(-9.75, 2.7, z, 0.38, 5.4, 0.4, 0x272f2d);
      this.box(9.75, 2.7, z, 0.38, 5.4, 0.4, 0x272f2d);
    }
    for (let x = -8; x < 10; x += 2) this.box(x, 0.005, 0, 0.035, 0.01, 16, 0x595e55);
    for (let z = -7; z < 9; z += 2) this.box(0, 0.006, z, 19, 0.01, 0.035, 0x595e55);
    this.asset('workbench', 0, 0, -5.9, Math.PI, 1.7);
    this.asset('rifle', -0.5, 1.17, -5.6, 0.9, 1);
    this.asset('radio', 1.6, 1.2, -5.7, 0, 1.2);
    for (let i = 0; i < 4; i++) this.asset('locker', -8.8, 0, -5 + i * 1.15, Math.PI / 2, 1.3);
    this.asset('soldier', -6.5, 0, -2, 0.55, 1.07);
    this.asset('backpack', -5.1, 0.12, -3, 0, 1.4);
    this.asset('truck', 5.8, 0, -3, -0.3);
    this.asset('generator', -7, 0, 5, 1.4, 1.4);
    this.asset('crate', 6, 0, 4, 0, 1.6);
    this.asset('medkit', 5.8, 1.1, 4, 0, 1.5);
    for (let i = 0; i < 6; i++)
      this.asset(i % 2 ? 'barrel' : 'crate', -3 + i * 1.6, 0, -7.3, 0, 0.85);
    this.sign('DEADWIRE / FIELD OPERATIONS', 0, 4.4, -8.24, 9, 1.2);
    this.sign('01 / ARMORY', -8.2, 3.4, -5, 3, 0.7, '#bdc8b5', '#263431', Math.PI / 2);
    this.sign('CHECK YOUR KIT. COME HOME.', 0, 2.8, -8.24, 5, 0.75, '#a7b197');
    this.sign('BLACKWATER / SECTOR 09', 6.8, 2.7, 4.3, 3.2, 2, '#a2bb9b', '#273934', -0.8);
    for (const [x, z, color] of [
      [-4, -3, 0xffc175],
      [5, 0, 0xabc8c0],
      [-7, 5, 0xcc9e6d],
    ]) {
      const l = new T.PointLight(color, 45, 14, 2);
      l.position.set(x, 4.5, z);
      this.env.add(l);
      this.shape(
        new T.BoxGeometry(1.7, 0.06, 0.2),
        x,
        4.9,
        z,
        this.mat(0xffdb99, 0.5, 0, 0xffb057),
      );
    }
    this.flush();
  }
  buildRaid(game: Game) {
    this.clear();
    this.lastMode = 'raid';
    const w = game.world,
      rnd = randomSource(w.seed + 700);
    this.scene.background = new T.Color(0xa6b3b4);
    this.scene.fog = new T.FogExp2(0xa6b3b4, 0.0048);
    this.scene.environmentIntensity = 0.48;
    this.light.intensity = 3;
    const ground = new T.Mesh(
      new T.PlaneGeometry(1400, 1400),
      new T.MeshStandardMaterial({ map: this.groundTex, color: 0x9c9d89, roughness: 1 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.env.add(ground);
    for (const [x, z, wid, dep] of [
      [-90, 0, 12, 480],
      [95, 0, 14, 480],
      [0, 115, 480, 13],
      [0, -150, 480, 12],
      [0, -38, 440, 10],
    ]) {
      this.box(x, 0.012, z, wid + 0.8, 0.018, dep + 0.8, 0x737568);
      this.box(x, 0.024, z, wid, 0.018, dep, 0x4c5351);
      if (dep > wid) {
        for (let zz = -230; zz < 230; zz += 13) this.box(x, 0.041, zz, 0.2, 0.012, 5, 0xb9b6a0);
      } else
        for (let xx = -230; xx < 230; xx += 13) this.box(xx, 0.041, z, 5, 0.012, 0.2, 0xb9b6a0);
    }
    for (const b of w.buildings) {
      const col = b.kind === 'clinic' ? 0x899289 : b.kind === 'office' ? 0x777c73 : 0x66726f;
      for (const wall of w.colliders.filter((c) => c.id.startsWith(b.id + '-')))
        this.box(wall.x, b.h / 2, wall.z, wall.w, b.h, wall.d, col);
      this.box(b.x, b.h - 0.15, b.z, b.w + 1, 0.3, b.d + 1, 0x444d4a, 0.35);
      this.box(b.x, 0.06, b.z, b.w, 0.12, b.d, 0x757971);
      this.box(b.x, b.h - 0.5, b.z + b.d / 2, 4, 1, 0.56, col);
      for (let xx = b.x - b.w / 2 + 1; xx < b.x + b.w / 2; xx += 4) {
        this.box(xx, b.h / 2, b.z - b.d / 2 - 0.31, 0.17, b.h, 0.1, 0x4b5652);
        if (Math.abs(xx - b.x) > 3) {
          this.box(xx, 2.9, b.z + b.d / 2 + 0.31, 2, 1.3, 0.045, 0x273c3c, 0.25);
          this.box(xx, 2.9, b.z + b.d / 2 + 0.34, 0.06, 1.3, 0.04, 0x777e76);
        }
      }
      this.sign(
        b.kind === 'clinic'
          ? 'QUARANTINE / MEDICAL'
          : b.kind === 'office'
            ? 'GARRISON / CONTROL'
            : 'RESTRICTED / LOGISTICS',
        b.x,
        b.h - 1.5,
        b.z + b.d / 2 + 0.35,
        Math.min(b.w - 2, 11),
        1.15,
        '#c5cbb7',
        '#344642',
      );
      this.asset('workbench', b.x + b.w / 2 - 3, 0, b.z - b.d / 2 + 2, Math.PI, 1.5);
      this.asset('locker', b.x - b.w / 2 + 1, 0, b.z - b.d / 2 + 1, 0, 1.4);
      const lamp = new T.PointLight(0xffd194, 11, 13, 2);
      lamp.position.set(b.x, 3.5, b.z);
      this.env.add(lamp);
    }
    for (const p of w.props) {
      if (p.asset === 'antenna') {
        this.tower(p.x, p.z);
        continue;
      }
      const obj = this.asset(p.asset, p.x, 0, p.z, p.rotation, p.asset === 'barrier' ? 1.5 : 1);
      this.envObjects.push({ obj, x: p.x, z: p.z });
    }
    for (const [x, z, r] of [
      [-83, -177, 0.2],
      [-67, -181, -0.2],
      [158, 145, 1.8],
      [-120, 102, 1.7],
      [65, 13, -0.7],
    ]) {
      const obj = this.asset('truck', x, 0, z, r);
      this.envObjects.push({ obj, x, z });
    }
    for (const [x, z] of [
      [-6, -15],
      [46, 0],
      [63, -43],
    ]) {
      this.cylinder(x, 5, z, 7, 10, 0x91988d, 24);
      this.cylinder(x, 10.2, z, 7.15, 0.5, 0x616d66, 24);
      for (let y = 2; y < 10; y += 2.5) this.cylinder(x, y, z, 7.06, 0.11, 0x4d5e55, 24);
    }
    for (let i = 0; i < 3; i++) {
      this.cylinder(31 + i * 9, 17, -96, 1.5, 34, 0x867f6b);
      for (let y = 6; y < 34; y += 9) this.cylinder(31 + i * 9, y, -96, 1.52, 3, 0x715147);
    }
    this.shape(
      new T.CylinderGeometry(0.5, 0.5, 85, 12),
      26,
      5,
      -17,
      this.mat(0x8b8070, 0.7, 0.5),
      new T.Euler(0, 0, Math.PI / 2),
    );
    for (let i = 0; i < 5; i++) this.box(-10 + i * 18, 2.5, -17, 0.7, 5, 0.8, 0x5b6760);
    const water = new T.Mesh(
      new T.PlaneGeometry(550, 1100),
      new T.MeshStandardMaterial({ color: 0x406568, roughness: 0.23, metalness: 0.5 }),
    );
    water.rotation.x = -Math.PI / 2;
    water.position.set(518, -0.12, 0);
    this.env.add(water);
    for (const z of [96, 161]) {
      this.box(254, 0.22, z, 63, 0.6, 17, 0x70796d);
      this.box(204, 14, z, 1.3, 28, 1.3, 0x665e3a);
      this.box(222, 27, z, 39, 1, 1, 0x8f8452);
      this.box(238, 17, z, 0.08, 20, 0.08, 0x333f3b);
    }
    for (let i = 0; i < 270; i++) {
      const x = (rnd() - 0.5) * 650,
        z = (rnd() - 0.5) * 650;
      if ((Math.abs(x) < 220 && Math.abs(z) < 220) || x > 230) continue;
      const h = 7 + rnd() * 13;
      this.cylinder(x, h / 2, z, 0.3, h, 0x555744, 6);
      this.shape(
        new T.ConeGeometry(3 + rnd() * 3, h * 0.7, 7),
        x,
        h * 0.7,
        z,
        this.mat(i % 2 ? 0x465b49 : 0x53624c),
      );
    }
    for (let i = 0; i < 60; i++) {
      const a = rnd() * 6.28,
        x = Math.cos(a) * (360 + rnd() * 110),
        z = Math.sin(a) * (360 + rnd() * 110);
      if (x > 250) continue;
      const geo = new T.IcosahedronGeometry(24 + rnd() * 50, 1);
      geo.scale(1, 0.45 + rnd() * 0.4, 1);
      this.shape(geo, x, 0, z, this.mat(0x7b8271));
    }
    for (let x = -236; x < 239; x += 12)
      for (const z of [-237, 237]) {
        if (w.extractions.some((e) => Math.hypot(e.x - x, e.z - z) < 30)) continue;
        this.box(x, 1.3, z, 0.1, 2.6, 0.1, 0x485549);
        this.box(x + 6, 1.15, z, 12, 0.04, 0.04, 0x637065);
        this.box(x + 6, 2.35, z, 12, 0.035, 0.035, 0x637065);
      }
    for (const e of w.extractions) {
      const ring = new T.Mesh(
        new T.RingGeometry(e.radius - 0.2, e.radius, 64),
        new T.MeshBasicMaterial({
          color: 0x9db68d,
          transparent: true,
          opacity: 0.65,
          side: T.DoubleSide,
        }),
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(e.x, 0.09, e.z);
      this.env.add(ring);
      this.sign(`EXFIL / ${e.id.toUpperCase()}`, e.x, 2.5, e.z + 5, 4, 1, '#bad7a4', '#29413d');
      const smoke = new T.Mesh(
        new T.CylinderGeometry(0.8, 0.24, 6, 10, 1, true),
        new T.MeshBasicMaterial({
          color: 0xb3cf93,
          transparent: true,
          opacity: 0.12,
          side: T.DoubleSide,
          depthWrite: false,
        }),
      );
      smoke.position.set(e.x, 3, e.z);
      this.env.add(smoke);
    }
    this.flush();
    this.dynamic.add(this.marker, this.helicopter);
    const ring = new T.Mesh(
      new T.RingGeometry(8.7, 9, 48),
      new T.MeshBasicMaterial({ color: 0xe4bc73, side: T.DoubleSide }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.1;
    this.marker.add(ring);
    this.makeHelicopter();
    for (const e of game.state.enemies) {
      const obj = this.asset('soldier', e.x, 0, e.z, e.yaw, 1, this.dynamic);
      this.enemies.set(e.id, obj);
    }
    for (const l of game.state.loot)
      if (l.kind !== 'corpse') {
        const obj = this.asset('crate', l.x, 0, l.z, 0, 0.85, this.dynamic);
        const beacon = new T.Mesh(
          new T.OctahedronGeometry(0.085),
          new T.MeshBasicMaterial({ color: 0xd8c18d }),
        );
        beacon.position.y = 1.05;
        obj.add(beacon);
        this.loot.set(l.id, obj);
      }
  }
  private tower(x: number, z: number) {
    for (const a of [-1, 1])
      for (const b of [-1, 1]) this.box(x + a, 9, z + b, 0.2, 18, 0.2, 0x65746d);
    for (let y = 2; y < 19; y += 3) {
      this.box(x, y, z, 2.5, 0.15, 2.5, 0x526359);
      this.shape(
        new T.BoxGeometry(0.1, 3.4, 0.1),
        x + 1,
        y - 1.5,
        z,
        this.mat(0x6b7b71),
        new T.Euler(0.55, 0, 0),
      );
    }
    this.cylinder(x, 20, z, 0.09, 6, 0x59675f);
    this.shape(new T.SphereGeometry(1.3, 12, 8), x, 15, z - 1, this.mat(0xc8c7b3));
  }
  private makeHelicopter() {
    const mat = this.mat(0x26372e, 0.55, 0.6),
      body = new T.Mesh(new T.SphereGeometry(1, 16, 10), mat);
    body.scale.set(1.8, 1.6, 4);
    this.helicopter.add(body);
    const glass = new T.Mesh(new T.SphereGeometry(1, 12, 8), this.mat(0x506c70, 0.2, 0.6));
    glass.position.set(0, 0.25, -2.8);
    glass.scale.set(1.6, 1.1, 1.3);
    this.helicopter.add(glass);
    const tail = new T.Mesh(new T.CylinderGeometry(0.2, 0.7, 7, 8), mat);
    tail.rotation.x = Math.PI / 2;
    tail.position.set(0, 0.5, 6);
    this.helicopter.add(tail);
    const rotor = new T.Group();
    rotor.name = 'rotor';
    rotor.position.y = 2.2;
    for (let i = 0; i < 2; i++) {
      const blade = new T.Mesh(new T.BoxGeometry(14, 0.06, 0.22), mat);
      blade.rotation.y = (i * Math.PI) / 2;
      rotor.add(blade);
    }
    this.helicopter.add(rotor);
    for (const x of [-1.8, 1.8]) {
      const skid = new T.Mesh(new T.BoxGeometry(0.15, 0.2, 6), mat);
      skid.position.set(x, -1.8, 0);
      this.helicopter.add(skid);
    }
  }
  event(e: GameEvent) {
    if (
      (e.kind === 'shot' || e.kind === 'enemyShot') &&
      e.x !== undefined &&
      e.targetX !== undefined
    ) {
      const geo = new T.BufferGeometry().setFromPoints([
          new T.Vector3(e.x, e.y ?? 1.5, e.z),
          new T.Vector3(e.targetX, e.targetY, e.targetZ),
        ]),
        line = new T.Line(
          geo,
          new T.LineBasicMaterial({
            color: e.kind === 'shot' ? 0xffe9b1 : 0xeb9d66,
            transparent: true,
            opacity: 0.6,
          }),
        );
      this.dynamic.add(line);
      this.tracers.push({ line, life: 0.07 });
      if (e.kind === 'shot') this.recoil = 0.08;
    }
  }
  render(game: Game, dt: number, menu: boolean, tab: string, ads: boolean, moving: boolean) {
    const start = performance.now();
    this.time += dt;
    const raid =
      game.state.mode === 'raid' || game.state.mode === 'dead' || game.state.mode === 'extracted';
    if ((raid ? 'raid' : 'hideout') !== this.lastMode) {
      if (raid) this.buildRaid(game);
      else this.buildHideout();
    }
    const p = game.state.player;
    this.walk += moving ? dt * (p.crouching ? 7 : 11) : 0;
    if (menu && !raid) {
      const views: Record<string, number[]> = {
        home: [7.8, 3.1, 8, -1, 1.5, -3],
        loadout: [-2.6, 2.25, 3.5, -7, 1.3, -2],
        weapons: [3.1, 2.8, -1, 0, 1.05, -5.6],
        supply: [0.5, 3.5, 4.7, 5.8, 1, -3],
        upgrades: [-0.5, 3.2, 8, -6, 1, 3],
        archive: [6, 3, 7, -1, 2, -4],
        deploy: [6, 3, 7, -1, 2, -4],
      };
      const v = views[tab] ?? views.home;
      this.camera.position.lerp(
        new T.Vector3(v[0] + Math.sin(this.time * 0.07) * 0.15, v[1], v[2]),
        Math.min(1, dt * 3),
      );
      this.camera.lookAt(v[3], v[4], v[5]);
    } else {
      this.camera.position.set(
        p.x,
        p.y + (moving ? Math.sin(this.walk) * 0.028 : Math.sin(this.time * 1.4) * 0.007),
        p.z,
      );
      this.camera.rotation.order = 'YXZ';
      this.camera.rotation.set(p.pitch + this.recoil * 0.18, p.yaw, 0);
    }
    const fov = ads && !menu ? (p.mods.optic === 'scope' ? 28 : 49) : 72;
    this.camera.fov += (fov - this.camera.fov) * Math.min(dt * 12, 1);
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
    if (raid) {
      this.light.position.set(p.x - 35, 85, p.z + 35);
      this.target.position.set(p.x, 0, p.z);
      for (const e of game.state.enemies) {
        const obj = this.enemies.get(e.id);
        if (!obj) continue;
        obj.visible = Math.hypot(e.x - p.x, e.z - p.z) < 165;
        obj.position.set(e.x, e.mode === 'dead' ? 0.25 : 0, e.z);
        obj.rotation.set(e.mode === 'dead' ? -Math.PI / 2 : 0, e.yaw, 0);
        if (e.mode !== 'dead') {
          const swing = Math.sin(this.time * (e.mode === 'combat' ? 9 : 5.5) + e.id.length) * 0.32;
          for (const [name, mult] of [
            ['leg_l', 1],
            ['leg_r', -1],
            ['arm_l', -0.3],
            ['arm_r', 0.3],
          ] as const) {
            const part = obj.getObjectByName(name);
            if (part) part.rotation.x = swing * mult;
          }
        }
      }
      for (const l of game.state.loot) {
        const o = this.loot.get(l.id);
        if (o) o.visible = !l.collected && Math.hypot(l.x - p.x, l.z - p.z) < 130;
      }
      for (const o of this.envObjects) o.obj.visible = Math.hypot(o.x - p.x, o.z - p.z) < 205;
      const ex = game.state.extraction;
      this.marker.visible = !!ex?.called;
      this.helicopter.visible = !!ex?.called;
      if (ex?.called) {
        this.marker.position.set(ex.x, 0, ex.z);
        this.helicopter.position.set(
          ex.x + Math.max(0, ex.arrivalRemaining - 8) * 5,
          ex.arrivalRemaining > 0 ? 9 + ex.arrivalRemaining * 0.8 : 4.4,
          ex.z,
        );
        this.helicopter.getObjectByName('rotor')!.rotation.y += dt * 38;
      }
    }
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const t = this.tracers[i];
      t.life -= dt;
      if (t.life <= 0) {
        this.dynamic.remove(t.line);
        t.line.geometry.dispose();
        (t.line.material as T.Material).dispose();
        this.tracers.splice(i, 1);
      }
    }
    this.renderer.autoClear = true;
    this.renderer.render(this.scene, this.camera);
    this.drawCalls = this.renderer.info.render.calls;
    this.triangles = this.renderer.info.render.triangles;
    if (!menu && game.state.mode === 'raid') {
      this.attachments(game);
      this.recoil *= Math.exp(-dt * 17);
      this.weaponRoot.position.set(
        ads ? -0.17 : 0,
        p.reloadRemaining ? -0.12 * Math.sin(p.reloadRemaining * 2) : 0,
        this.recoil,
      );
      this.weaponRoot.rotation.x = p.reloadRemaining ? -0.3 * Math.sin(p.reloadRemaining * 2) : 0;
      this.weaponRoot.position.y += moving ? Math.cos(this.walk) * 0.008 : 0;
      this.flash.visible = this.recoil > 0.035;
      const viewCam = new T.PerspectiveCamera(this.camera.fov, this.camera.aspect, 0.01, 10);
      this.renderer.autoClear = false;
      this.renderer.clearDepth();
      this.renderer.render(this.weaponScene, viewCam);
    }
    this.frameAccum += dt;
    this.frames++;
    if (this.frameAccum > 0.5) {
      this.fps = Math.round(this.frames / this.frameAccum);
      this.frameAccum = 0;
      this.frames = 0;
    }
    this.frameMs = performance.now() - start;
  }
}
