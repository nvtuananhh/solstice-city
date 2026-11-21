// Static data for Solstice City. No gameplay code here — just the world bible.

export const CITY = {
  half: 300,          // city extends -300..300 on x and z
  block: 60,          // street grid spacing
  roadW: 11,          // road width
  walkW: 3,           // sidewalk width
};

export const DISTRICTS = [
  { name: 'Mirror Flats',   x0: 120, z0: -300, x1: 300, z1: -60,  tint: 0x8f9bb0 },
  { name: 'Helios Gate',    x0: -60, z0: -300, x1: 120, z1: -120, tint: 0xc9a86a },
  { name: 'Old Pump Town',  x0: -300, z0: -300, x1: -60, z1: -120, tint: 0x9a7a5a },
  { name: 'Cactus Row',     x0: -300, z0: -120, x1: -60, z1: 60,  tint: 0xb05a7a },
  { name: 'The Foundry',    x0: -300, z0: 60,   x1: -60, z1: 300,  tint: 0x6a6a72 },
  { name: 'University Mesa',x0: -60, z0: -120, x1: 120, z1: 60,   tint: 0x7a9a6a },
  { name: 'Dune Palms',     x0: 120, z0: -60,  x1: 300, z1: 120,  tint: 0xd8b06a },
  { name: "Truckers' Rest", x0: -60, z0: 60,   x1: 120, z1: 300,  tint: 0x8a7a9a },
  { name: 'Solar Heights',  x0: 120, z0: 120,  x1: 300, z1: 300,  tint: 0xe8d27a },
  { name: 'The Salt Pan',   x0: -60, z0: 120,  x1: 120, z1: 180,  tint: 0xe8e2d0 },
];

export function districtAt(x, z) {
  for (let i = 0; i < DISTRICTS.length; i++) {
    const d = DISTRICTS[i];
    if (x >= d.x0 && x < d.x1 && z >= d.z0 && z < d.z1) return i;
  }
  return 0;
}

export const SHOP_NAMES = [
  'Sol Fried Chicken', 'Mirage Tacos', 'Dune Mart', 'Cactus Cola Bar',
  'Helios Hardware', 'Sand Dollar Pawn', 'Palm Court Motel', 'Vapor Trail',
  'Sunspray Wash', 'The Rusty Spigot', 'Neon Cactus', 'Gila Records',
  'Mesa Books', 'Coyote Coffee', 'Panel & Sons', 'Salt Pan Bakery',
];

export const CAR_TYPES = {
  pickup:  { name: 'Dune Pickup',  top: 34, accel: 15, grip: 2.6, color: 0xc96a1e, len: 4.6, wid: 2.0 },
  sedan:   { name: 'Sol Sedan',    top: 36, accel: 14, grip: 2.8, color: 0x3a6ab0, len: 4.4, wid: 1.9 },
  hatch:   { name: 'Mesa Hatch',   top: 32, accel: 13, grip: 3.0, color: 0x9ab03a, len: 3.8, wid: 1.8 },
  van:     { name: 'Haul Van',     top: 28, accel: 10, grip: 2.2, color: 0xd8d8d8, len: 5.2, wid: 2.1 },
  taxi:    { name: 'Sun Cab',      top: 34, accel: 13, grip: 2.7, color: 0xe8c81e, len: 4.3, wid: 1.9 },
  sports:  { name: 'Vesper GT',    top: 48, accel: 22, grip: 3.4, color: 0xb02030, len: 4.5, wid: 2.0 },
  truck:   { name: 'Foundry Rig',  top: 26, accel: 9,  grip: 2.0, color: 0x5a5a62, len: 6.0, wid: 2.3 },
  police:  { name: 'Patrol Interceptor', top: 42, accel: 20, grip: 3.2, color: 0x20242a, len: 4.6, wid: 2.0 },
};

export const WEAPONS = [
  { key: 'fists', name: 'Fists',  dmg: 12, range: 2.2, rate: 0.45, ammo: Infinity, auto: false },
  { key: 'bat',   name: 'Bat',    dmg: 22, range: 2.8, rate: 0.55, ammo: Infinity, auto: false },
  { key: 'pistol',name: 'Pistol', dmg: 26, range: 55,  rate: 0.30, ammo: 60,       auto: false },
  { key: 'smg',   name: 'SMG',    dmg: 15, range: 45,  rate: 0.09, ammo: 120,      auto: true },
];

export const RADIO = [
  { name: 'K-SOL Desert Rock', notes: [0, 0, 3, 5, 7, 5, 3, 0, 10, 7, 5, 3], bpm: 132, wave: 'sawtooth', base: 110 },
  { name: 'Cactus FM Latin',   notes: [0, 4, 7, 9, 7, 4, 2, 4, 7, 12, 9, 7], bpm: 104, wave: 'triangle', base: 130 },
  { name: 'Talk Radio 88',     notes: [0, 0, 0, 7, 0, 0, 5, 0, 0, 0, 3, 0],  bpm: 90,  wave: 'square',   base: 98 },
];

export const UPGRADES = [
  { key: 'repair', name: 'Repair (full)', price: 120, desc: 'Fix all damage' },
  { key: 'engine', name: 'Engine Stage',  price: 450, desc: '+18% top speed, per stage (max 3)' },
  { key: 'brakes', name: 'Brakes Stage',  price: 300, desc: '+25% braking, per stage (max 3)' },
  { key: 'nitro',  name: 'Nitro Kit',     price: 600, desc: 'Shift = nitro boost' },
  { key: 'paint',  name: 'Repaint',       price: 80,  desc: 'Fresh coat, new colour' },
];

// Landmark positions (world coordinates, shared by city, missions, shots).
// All sit on mid-block points (odd multiples of 30) so no building lands on
// a road — roads run on multiples of 60.
export const LANDMARKS = {
  garage:      { x: -150, z: 150, label: "Theo's Auto" },
  safehouse:   { x: -90,  z: 150, label: 'Safehouse' },
  tower:       { x: 30,   z: -150, label: 'Helios Tower' },
  mirrorField: { x: 210,  z: -150, label: 'Mirror Field' },
  waterTower:  { x: -210, z: -30, label: 'Water Tower' },
  chopShop:    { x: -210, z: 210, label: 'Chop Shop' },
  truckYard:   { x: 30,   z: 270, label: 'Truck Yard' },
  foundry:     { x: -270, z: 210, label: 'Foundry Tunnels' },
  rooftop:     { x: 30,   z: -30, label: 'Mesa Court Rooftop' },
  store:       { x: -150, z: 30,  label: 'Dune Mart' },
  plaza:       { x: 30,   z: 30,  label: 'Helios Plaza' },
};
