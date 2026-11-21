// Renderer: Three.js scene, sky + sun + lights, third-person camera, day
// cycle (noon -> amber dusk), objective beacon, headlight glow at dusk.
// Camera motion is driven by sim state only — no wall-clock input.
const THREE = window.THREE;

export class Renderer {
  constructor(canvas) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87b8e8);
    this.scene.fog = new THREE.Fog(0xd8b06a, 180, 520);
    this.camera = new THREE.PerspectiveCamera(62, 1, 0.1, 1200);
    this.sun = new THREE.DirectionalLight(0xfff2d8, 1.35);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.camera.left = -90; this.sun.shadow.camera.right = 90;
    this.sun.shadow.camera.top = 90; this.sun.shadow.camera.bottom = -90;
    this.sun.shadow.camera.far = 400;
    this.scene.add(this.sun);
    this.ambient = new THREE.AmbientLight(0xffe8c8, 0.55);
    this.scene.add(this.ambient);
    // Sky dome: big gradient sphere (backside) + sun disc + a few clouds are
    // city props; the dome colour shifts with the time of day.
    const skyGeo = new THREE.SphereGeometry(800, 16, 12);
    this.skyMat = new THREE.MeshBasicMaterial({
      color: 0x87b8e8, side: THREE.BackSide, fog: false,
    });
    this.sky = new THREE.Mesh(skyGeo, this.skyMat);
    this.scene.add(this.sky);
    this.sunDisc = new THREE.Mesh(new THREE.SphereGeometry(18, 16, 12),
      new THREE.MeshBasicMaterial({ color: 0xfff2b0, fog: false }));
    this.scene.add(this.sunDisc);
    // Objective beacon: a tall glowing column + ring at the target.
    const beaconMat = new THREE.MeshBasicMaterial({ color: 0xffc83c, transparent: true, opacity: 0.45 });
    this.beacon = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 60, 12, 1, true), beaconMat);
    this.beacon.visible = false;
    this.scene.add(this.beacon);
    this.beaconRing = new THREE.Mesh(new THREE.TorusGeometry(3, 0.35, 8, 24),
      new THREE.MeshBasicMaterial({ color: 0xffc83c }));
    this.beaconRing.rotation.x = Math.PI / 2;
    this.beaconRing.visible = false;
    this.scene.add(this.beaconRing);
    this._resize();
    window.addEventListener('resize', () => this._resize());
  }

  _resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  setQuality(q) {
    this.renderer.shadowMap.enabled = q === 'high';
    this.renderer.setPixelRatio(q === 'high' ? Math.min(window.devicePixelRatio || 1, 2) : 1);
  }

  // Time of day: clockMin 720 = noon, 1050 = dusk (17:30). Returns a 0..1 dusk factor.
  duskFactor(clockMin) {
    return Math.max(0, Math.min(1, (clockMin - 960) / 90));
  }

  update(dt, g) {
    const dusk = this.duskFactor(g.clockMin);
    // Sun swings west and lowers; light warms to amber at dusk.
    const sunAngle = Math.PI * (0.5 + (g.clockMin - 720) / 720);
    const sunH = Math.max(0.12, Math.sin(sunAngle));
    this.sun.position.set(Math.cos(sunAngle) * 180, sunH * 220, -80);
    this.sun.target.position.set(0, 0, 0);
    this.sun.target.updateMatrixWorld();
    const dayCol = new THREE.Color(0xfff2d8);
    const duskCol = new THREE.Color(0xff9a4a);
    this.sun.color.copy(dayCol).lerp(duskCol, dusk);
    this.sun.intensity = 1.35 - dusk * 0.45;
    this.ambient.intensity = 0.55 - dusk * 0.18;
    this.skyMat.color.setHex(0x87b8e8).lerp(new THREE.Color(0xe88a4a), dusk);
    this.scene.fog.color.setHex(0xd8b06a).lerp(new THREE.Color(0xc07840), dusk);
    this.sunDisc.position.set(Math.cos(sunAngle) * 700, sunH * 700, -300);
    this.sunDisc.material.color.setHex(0xfff2b0).lerp(new THREE.Color(0xff7a2a), dusk);
    // Follow the player with the shadow camera.
    this.sun.position.x += g.player.x; this.sun.position.z += g.player.z;
    this.sun.target.position.set(g.player.x, 0, g.player.z);
    // Beacon at the objective.
    const obj = g.missions.objective();
    if (obj.x !== undefined && obj.x !== null) {
      const y = obj.y || 0;
      this.beacon.visible = true;
      this.beaconRing.visible = true;
      this.beacon.position.set(obj.x, y + 30, obj.z);
      this.beaconRing.position.set(obj.x, y + 0.4 + Math.sin(g.simTime * 2) * 0.3, obj.z);
      const s = 1 + Math.sin(g.simTime * 3) * 0.12;
      this.beaconRing.scale.set(s, s, 1);
    } else {
      this.beacon.visible = false;
      this.beaconRing.visible = false;
    }
  }

  // Third-person camera: behind the player (or car), mouse orbit, collision-free
  // by pulling in when a building is between camera and player (cheap: clamp).
  // A shot mode may pin the camera with g.shotCam {pos, look}.
  updateCamera(g) {
    if (g.shotCam) {
      this.camera.position.set(g.shotCam.pos[0], g.shotCam.pos[1], g.shotCam.pos[2]);
      this.camera.lookAt(g.shotCam.look[0], g.shotCam.look[1], g.shotCam.look[2]);
      this.sky.position.set(this.camera.position.x, 0, this.camera.position.z);
      return;
    }
    const p = g.player;
    const yaw = g.camYaw, pitch = g.camPitch;
    const inCar = !!g.playerCar;
    const dist = inCar ? 13 : 8.5;
    const height = inCar ? 4.5 : 3.2;
    const tx = p.x, tz = p.z, ty = (p.onRoof ? 14 : 0) + 1.6;
    const cx = tx - Math.cos(yaw) * Math.cos(pitch) * dist;
    const cz = tz + Math.sin(yaw) * Math.cos(pitch) * dist;
    const cy = ty + Math.sin(pitch) * dist + height * 0.4;
    this.camera.position.set(cx, Math.max(cy, 1.2), cz);
    this.camera.lookAt(tx, ty, tz);
    this.sky.position.set(this.camera.position.x, 0, this.camera.position.z);
    this.sunDisc.position.y = Math.max(this.sunDisc.position.y, 40);
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }
}
