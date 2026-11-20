// SOLSTICE CITY — tuning, districts, jobs, weapons, cars. All numbers chosen by
// me for this build; nothing here is copied from another game.

export const CFG = {
  seedDefault: 1,
  step: 1 / 60,
  roadSpacing: 80,
  roadHalf: 7,
  roadMin: -280,
  roadMax: 280,
  cityHalf: 340,
  walkSpeed: 6.5,
  sprintMult: 1.6,
  jumpVel: 8.5,
  gravity: 24,
  playerRadius: 0.7,
  playerHealth: 100,
  startCash: 120,
  startPos: { x: -200, z: 200 }, // road intersection, clear of buildings
  clockStart: 12.0, // hours
  clockRate: 1 / 150, // game hours per real second (a full day ~ 10 min)
  duskStart: 17.5,
  nightStart: 19.5,
  shardCount: 25,
  trafficCars: 24,
  pedestrians: 40,
  saveKey: 'solstice-city-save-v1',
};

export const DISTRICTS = [
  { name: 'Mirror Flats', x0: 300, x1: 900, z0: -900, z1: 900 },
  { name: 'Helios Gate', x0: -90, x1: 90, z0: -420, z1: -280 },
  { name: 'Old Pump Town', x0: -340, x1: -90, z0: -340, z1: -90 },
  { name: 'Cactus Row', x0: -90, x1: 90, z0: -90, z1: 90 },
  { name: 'The Foundry', x0: 90, x1: 340, z0: -340, z1: -90 },
  { name: 'University Mesa', x0: -340, x1: -90, z0: 90, z1: 340 },
  { name: 'Dune Palms', x0: 90, x1: 340, z0: 90, z1: 340 },
  { name: "Truckers' Rest", x0: 90, x1: 340, z0: -90, z1: 90 },
  { name: 'Solar Heights', x0: -90, x1: 90, z0: 90, z1: 340 },
  { name: 'The Salt Pan', x0: -900, x1: -340, z0: -900, z1: 900 },
];

export const LANDMARKS = {
  garage: { x: -240, z: 200, name: "Theo's Auto" },
  waterTower: { x: 120, z: 200, name: 'Water Tower' },
  chopShop: { x: 240, z: -200, name: 'Chop Shop' },
  truckYard: { x: 240, z: 200, name: 'Truck Yard' },
  safehouse: { x: -240, z: -200, name: 'Safehouse' },
  store: { x: 40, z: 40, name: 'Corner Store' },
  rooftop: { x: 120, z: -120, name: 'Rooftop' },
  tower: { x: 0, z: -360, name: 'Helios Tower' },
  mirrorField: { x: 420, z: 0, name: 'Heliostat Sea' },
  hospital: { x: -120, z: -240, name: 'Clinic' },
  policeStation: { x: -200, z: -40, name: 'Precinct 7' },
};

// Step types: goto (on foot or any), drive (must be in a car), steal (steal a
// parked car), lose (drop wanted to 0), combat (defeat N enemies), survive
// (stay alive N seconds while wanted >= level), deliver (reach marker in car).
export const JOBS = [
  {
    id: 1, name: 'First Light', payout: 500, respect: 10,
    briefing: 'Theo is waiting at the garage. Learn the ropes, then drive the pickup out to the solar field.',
    steps: [
      { type: 'goto', x: -240, z: 200, r: 9, text: 'Meet Theo at the garage' },
      { type: 'drive', x: 420, z: 0, r: 16, text: 'Drive the pickup to the Heliostat Sea' },
    ],
  },
  {
    id: 2, name: 'Hotwire', payout: 900, respect: 15,
    briefing: 'Vesper needs a clean sedan. Steal the parked car by the chop shop, lose the tail, deliver it.',
    steps: [
      { type: 'steal', x: 240, z: -200, r: 14, text: 'Steal the parked sedan' },
      { type: 'lose', text: 'Lose the police (wanted 0)' },
      { type: 'drive', x: 240, z: -200, r: 12, text: 'Deliver the car to the chop shop' },
    ],
  },
  {
    id: 3, name: 'The Drop', payout: 1200, respect: 20,
    briefing: 'A package waits under the water tower. Grab it on foot, then run the Cactus Row gauntlet by car.',
    steps: [
      { type: 'goto', x: 120, z: 200, r: 8, text: 'Pick up the package under the water tower' },
      { type: 'drive', x: -240, z: -200, r: 12, text: 'Escape to the safehouse' },
    ],
  },
  {
    id: 4, name: 'Clean Plates', payout: 1000, respect: 15,
    briefing: 'Swap the plates at the garage while patrols circle. Stay out of sight — 2 stars means trouble.',
    steps: [
      { type: 'goto', x: -240, z: 200, r: 9, text: 'Reach the garage on foot, unseen' },
      { type: 'survive', seconds: 20, wanted: 0, text: 'Lay low at the garage (20s)' },
    ],
  },
  {
    id: 5, name: 'Dust Run', payout: 1800, respect: 25,
    briefing: 'A getaway car, a 3-star tail, and a city full of roadblocks. Thread them.',
    steps: [
      { type: 'drive', x: 240, z: 200, r: 14, text: 'Drive the getaway car to the truck yard' },
      { type: 'survive', seconds: 25, wanted: 3, text: 'Survive the 3-star chase (25s)' },
    ],
  },
  {
    id: 6, name: 'The Witness', payout: 2200, respect: 30,
    briefing: 'A witness is pinned on the rooftop above Cactus Row. Clear the crew, then get her out.',
    steps: [
      { type: 'goto', x: 120, z: -120, r: 10, text: 'Reach the rooftop' },
      { type: 'combat', count: 4, x: 120, z: -120, text: 'Defeat the rival crew (4)' },
      { type: 'goto', x: -240, z: -200, r: 12, text: 'Escort the witness to the safehouse' },
    ],
  },
  {
    id: 7, name: 'Air Support', payout: 2800, respect: 35,
    briefing: 'Four stars and a helicopter over the Foundry. Lose the bird in the foundry tunnels.',
    steps: [
      { type: 'survive', seconds: 30, wanted: 4, text: 'Outrun the helicopter (30s)' },
      { type: 'drive', x: 200, z: -280, r: 16, text: 'Vanish into the foundry tunnels' },
    ],
  },
  {
    id: 8, name: 'Double Cross', payout: 3500, respect: 40,
    briefing: 'The truck yard is an ambush. Take the score, fight out, and run.',
    steps: [
      { type: 'combat', count: 5, x: 240, z: 200, text: 'Fight through the ambush (5)' },
      { type: 'drive', x: -240, z: 200, r: 12, text: 'Escape with the score to the garage' },
    ],
  },
  {
    id: 9, name: 'The Last Light', payout: 8000, respect: 60,
    briefing: 'The Helios Tower vault, five stars, helicopter and roadblocks — then a mirror-field escape at dusk.',
    steps: [
      { type: 'goto', x: 0, z: -360, r: 18, text: 'Reach the Helios Tower vault' },
      { type: 'combat', count: 6, x: 0, z: -360, text: 'Hold the vault against the crew (6)' },
      { type: 'drive', x: 420, z: 0, r: 18, text: 'Escape through the Heliostat Sea at dusk' },
    ],
  },
];

export const WEAPONS = [
  { name: 'Fists', key: '1', damage: 12, range: 2.2, rate: 0.45, ammo: Infinity, auto: false },
  { name: 'Bat', key: '2', damage: 30, range: 2.6, rate: 0.6, ammo: Infinity, auto: false },
  { name: 'Pistol', key: '3', damage: 34, range: 60, rate: 0.28, ammo: 24, auto: false },
  { name: 'SMG', key: '4', damage: 16, range: 48, rate: 0.09, ammo: 90, auto: true },
];

export const CAR_TYPES = {
  pickup: { name: 'Pickup', topSpeed: 34, accel: 16, steer: 1.9, color: 0xb8642a, length: 4.6, width: 2.0 },
  sedan: { name: 'Sedan', topSpeed: 38, accel: 18, steer: 2.1, color: 0x3a6ea5, length: 4.4, width: 1.9 },
  coupe: { name: 'Coupe', topSpeed: 46, accel: 22, steer: 2.4, color: 0xc22e4a, length: 4.2, width: 1.9 },
  truck: { name: 'Truck', topSpeed: 28, accel: 12, steer: 1.5, color: 0x8a8f96, length: 5.6, width: 2.3 },
  police: { name: 'Interceptor', topSpeed: 44, accel: 24, steer: 2.5, color: 0x1c1e24, length: 4.5, width: 2.0 },
  taxi: { name: 'Taxi', topSpeed: 36, accel: 17, steer: 2.0, color: 0xe8b400, length: 4.4, width: 1.9 },
};

export const PRICES = {
  repair: 100, repaint: 50, engine: 800, brakes: 300, nitro: 400,
  healthPack: 50, pistolAmmo: 30, smgAmmo: 60, bat: 150,
};

export const SHOP_NAMES = [
  'Solstice Tacos', 'Mirage Motors', 'Cactus Liquor', 'Dune Donuts', 'Helios Pawn',
  'Mesa Books', 'Sunset Nails', 'Pumpjack Cafe', 'Vesper Antiques', 'Sandbar Bar',
  'Coyote Phones', 'Oasis Laundry', 'Mirage Motel', 'Turbo Tires', 'Golden Hour Gym',
];
