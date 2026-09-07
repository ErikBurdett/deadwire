export type ItemKind = 'weapon' | 'armor' | 'mod' | 'valuable' | 'note' | 'medkit' | 'ammo';
export type ModSlot = 'optic' | 'muzzle' | 'magazine';
export interface Item {
  id: string;
  name: string;
  kind: ItemKind;
  value: number;
  description: string;
  asset: string;
  slot?: ModSlot;
}
export interface WeaponStats {
  damage: number;
  fireInterval: number;
  magazine: number;
  reloadTime: number;
  range: number;
  spread: number;
}
export const STARTER_WEAPON = 'm9';
export const WEAPONS: Record<string, WeaponStats> = {
  m9: { damage: 26, fireInterval: 0.24, magazine: 15, reloadTime: 1.65, range: 90, spread: 0.008 },
  m4: { damage: 31, fireInterval: 0.105, magazine: 30, reloadTime: 2.2, range: 180, spread: 0.006 },
  ak74: {
    damage: 38,
    fireInterval: 0.145,
    magazine: 30,
    reloadTime: 2.65,
    range: 170,
    spread: 0.009,
  },
  mp5: { damage: 23, fireInterval: 0.08, magazine: 30, reloadTime: 1.9, range: 100, spread: 0.011 },
  marksman: {
    damage: 74,
    fireInterval: 0.58,
    magazine: 10,
    reloadTime: 2.8,
    range: 260,
    spread: 0.002,
  },
};
const entries: Item[] = [
  {
    id: 'm9',
    name: 'M9 Sidearm',
    kind: 'weapon',
    value: 0,
    description: 'Your emergency sidearm. Always available if a raid goes wrong.',
    asset: 'rifle',
  },
  {
    id: 'm4',
    name: 'M4 Patrol Rifle',
    kind: 'weapon',
    value: 350,
    description: 'A controllable 5.56 mm rifle for the exclusion zone.',
    asset: 'rifle',
  },
  {
    id: 'ak74',
    name: 'AK-74 Service Rifle',
    kind: 'weapon',
    value: 420,
    description: 'Hard-hitting rifle recovered from the occupying garrison.',
    asset: 'rifle',
  },
  {
    id: 'mp5',
    name: 'MP5 Compact',
    kind: 'weapon',
    value: 300,
    description: 'Fast handling and high rate of fire. Best inside compounds.',
    asset: 'rifle',
  },
  {
    id: 'marksman',
    name: 'SR-25 Marksman',
    kind: 'weapon',
    value: 700,
    description: 'Precision semi-automatic rifle for exposed approaches.',
    asset: 'rifle',
  },
  {
    id: 'light_armor',
    name: 'Scout Plate Carrier',
    kind: 'armor',
    value: 180,
    description: 'Adds 65 armor to your next deployment.',
    asset: 'locker',
  },
  {
    id: 'heavy_armor',
    name: 'Assault Plate Carrier',
    kind: 'armor',
    value: 340,
    description: 'Adds 110 armor to your next deployment.',
    asset: 'locker',
  },
  {
    id: 'red_dot',
    name: 'Reflex Sight',
    kind: 'mod',
    slot: 'optic',
    value: 140,
    description: 'Clean sight picture. Reduces shot spread by 45%.',
    asset: 'rifle',
  },
  {
    id: 'scope',
    name: '4× Recon Optic',
    kind: 'mod',
    slot: 'optic',
    value: 250,
    description: 'Reduces spread by 72% and increases effective range by 30%.',
    asset: 'rifle',
  },
  {
    id: 'suppressor',
    name: 'Field Suppressor',
    kind: 'mod',
    slot: 'muzzle',
    value: 220,
    description: 'Reduces the radius at which patrols hear your shots from 85 m to 24 m.',
    asset: 'rifle',
  },
  {
    id: 'compensator',
    name: 'Muzzle Brake',
    kind: 'mod',
    slot: 'muzzle',
    value: 140,
    description: 'Cuts spread by 25% and improves follow-up fire by 8%.',
    asset: 'rifle',
  },
  {
    id: 'extended_mag',
    name: 'Extended Magazine',
    kind: 'mod',
    slot: 'magazine',
    value: 170,
    description: 'Adds 50% magazine capacity at the cost of 15% slower reloads.',
    asset: 'rifle',
  },
  {
    id: 'medkit',
    name: 'Trauma Kit',
    kind: 'medkit',
    value: 65,
    description: 'Restore 60 health. Press H while deployed.',
    asset: 'medkit',
  },
  {
    id: 'ammo',
    name: 'Sealed Ammunition',
    kind: 'ammo',
    value: 35,
    description: 'Adds 60 reserve rounds when picked up in the field.',
    asset: 'crate',
  },
  {
    id: 'circuit',
    name: 'Encrypted Circuit Board',
    kind: 'valuable',
    value: 110,
    description: 'A control board from the station communications array.',
    asset: 'crate',
  },
  {
    id: 'watch',
    name: 'Officer’s Watch',
    kind: 'valuable',
    value: 90,
    description: 'A engraved military timepiece. The hands stopped at 03:17.',
    asset: 'crate',
  },
  {
    id: 'gold',
    name: 'Reserve Gold',
    kind: 'valuable',
    value: 280,
    description: 'Government bullion diverted through the harbor before the quarantine.',
    asset: 'crate',
  },
  {
    id: 'filter',
    name: 'Industrial Filter',
    kind: 'valuable',
    value: 55,
    description: 'A sealed replacement filter. Clean air has a price outside the cordon.',
    asset: 'crate',
  },
  {
    id: 'intel',
    name: 'Encrypted Drive',
    kind: 'valuable',
    value: 190,
    description: 'Recovered surveillance data. Buyers in the safe zone ask no questions.',
    asset: 'crate',
  },
];
export const NOTES: Record<string, { title: string; text: string }> = {
  note_evac: {
    title: 'Last Ferry',
    text: '17 OCT — The ferry left half empty. Major Sokol ordered the civilians held at the checkpoint until the inspection team arrived. No inspection team ever came. I can still hear them calling from the quay. — Harbor duty log, page 41',
  },
  note_signal: {
    title: 'Dead Air',
    text: 'Every night at 03:17, the relay transmits the same eleven seconds. Three numbers, a breath, and my own voice telling me to run. The array was disconnected last Tuesday. — Engineer Voss',
  },
  note_convoy: {
    title: 'The Missing Convoy',
    text: 'Convoy Six never reached the northern road. Their transponders all stopped at the clinic, but the road cameras show the trucks continuing east. Command says this is a clerical error. Command has begun burning the originals.',
  },
  note_quarantine: {
    title: 'Protocol Ash',
    text: 'RESTRICTED: All outgoing biological samples are to be marked as industrial coolant. All personnel with exposure above threshold will report to the east gate. No return transport is authorized. This order supersedes civilian evacuation directives.',
  },
  note_soldier: {
    title: 'Unsent Letter',
    text: 'Mira, they said another three days. They keep saying another three days. We have enough food but nobody sleeps. The lights inside the empty apartments turn on one floor at a time. Tell Lev I have his blue truck. I will bring it home.',
  },
  note_money: {
    title: 'Cargo Manifest 09',
    text: 'Nineteen pallets of medical supplies entered the port. Eighteen pallets of gold left it. The nineteenth pallet was opened at Customs and every man in that room was reassigned before morning. The captain’s signature is not his handwriting.',
  },
  note_power: {
    title: 'Grid Restart',
    text: 'DO NOT RECONNECT SECTOR C. The meters read a negative load. We are not supplying power to the underground annex. Something underneath is supplying power to us. — Red grease pencil on the substation door',
  },
  note_origin: {
    title: 'Before the Fence',
    text: 'There used to be a market beside the fuel depot. My mother sold apricots there, and the refinery workers would buy them on their way home. If you are reading this, leave a stone beside the little blue gate. Someone should remember we lived here.',
  },
};
for (const [id, note] of Object.entries(NOTES))
  entries.push({
    id,
    name: note.title,
    kind: 'note',
    value: 0,
    description: note.text,
    asset: 'crate',
  });
export const ITEMS: Record<string, Item> = Object.fromEntries(
  entries.map((item) => [item.id, item]),
);
export const UPGRADES: Record<
  string,
  { id: string; name: string; description: string; baseCost: number; maxLevel: number }
> = {
  endurance: {
    id: 'endurance',
    name: 'Field Conditioning',
    description: '+20 maximum stamina per level.',
    baseCost: 280,
    maxLevel: 3,
  },
  pack: {
    id: 'pack',
    name: 'Expanded Storage Rig',
    description: '+4 carried item slots per level.',
    baseCost: 320,
    maxLevel: 3,
  },
  vitality: {
    id: 'vitality',
    name: 'Medical Station',
    description: '+15 maximum health per level.',
    baseCost: 400,
    maxLevel: 3,
  },
  ammo: {
    id: 'ammo',
    name: 'Ammunition Bench',
    description: '+30 deployment reserve rounds per level.',
    baseCost: 240,
    maxLevel: 3,
  },
};
