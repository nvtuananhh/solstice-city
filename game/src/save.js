// Save / load via localStorage. Stores mission progress, cash, respect,
// standing, owned cars, position and Mira state. Versioned so an old save
// never crashes a newer build.
const KEY = 'solstice-city.save.v1';

export function saveGame(state) {
  try {
    const data = {
      v: 1,
      cash: state.cash,
      respect: state.respect,
      jobIndex: state.jobIndex,
      jobDone: state.jobDone,
      standing: state.standing,
      miraRecruited: state.miraRecruited,
      player: { x: state.player.x, z: state.player.z, health: state.player.health },
      ownedCars: state.ownedCars,
      upgrades: state.upgrades,
      shards: state.shards,
      day: state.day,
      clockMin: state.clockMin,
    };
    localStorage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch (e) { return false; }
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.v !== 1) return null;
    return data;
  } catch (e) { return null; }
}

export function clearSave() {
  try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ }
}
