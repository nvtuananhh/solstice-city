// Sky, sun, lighting and the day cycle. The clock advances only from sim time,
// so the light at a given sim step is fully deterministic. Noon is blinding
// white-gold; dusk turns amber and switches the streetlights on; the Helios
// Tower beacon sweeps at dusk.

export class Sky {
  constructor(scene, city) {
    this.scene = scene;
    this.city = city;
    this.sun = new THREE.DirectionalLight(0xfff2cc, 1.15);
    this.sun.position.set(120, 180, 60);
    scene.add(this.sun);
    this.hemi = new THREE.HemisphereLight(0xbfd9ff, 0xd9b36c, 0.75);
    scene.add(this.hemi);
    this.ambient = new THREE.AmbientLight(0xffffff, 0.25);
    scene.add(this.ambient);
    // sky dome: big sphere with a vertex-coloured gradient shader (no textures)
    const geo = new THREE.SphereGeometry(900, 16, 10);
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: { top: { value: new THREE.Color(0x3f7ad9) }, mid: { value: new THREE.Color(0xf7d9a0) }, bot: { value: new THREE.Color(0xd9b36c) } },
      vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'uniform vec3 top; uniform vec3 mid; uniform vec3 bot; varying vec3 vP; void main(){ float h = normalize(vP).y; vec3 c = h > 0.12 ? mix(mid, top, smoothstep(0.12, 0.65, h)) : mix(bot, mid, smoothstep(-0.08, 0.12, h)); gl_FragColor = vec4(c, 1.0); }',
    });
    this.dome = new THREE.Mesh(geo, mat);
    scene.add(this.dome);
    // sun disc + a few clouds
    this.sunDisc = new THREE.Mesh(new THREE.CircleGeometry(26, 24),
      new THREE.MeshBasicMaterial({ color: 0xfff6d8, fog: false }));
    this.sunDisc.position.set(420, 320, -500);
    this.sunDisc.lookAt(0, 0, 0);
    scene.add(this.sunDisc);
    this.clouds = [];
    const cloudMat = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 });
    for (let i = 0; i < 10; i++) {
      const g = new THREE.Group();
      for (let j = 0; j < 3; j++) {
        const s = new THREE.Mesh(new THREE.SphereGeometry(9 + j * 3, 8, 6), cloudMat);
        s.scale.y = 0.45; s.position.set(j * 10 - 10, j * 1.5, 0);
        g.add(s);
      }
      g.position.set(-500 + i * 110, 150 + (i % 3) * 22, -420 + (i % 4) * 160);
      scene.add(g);
      this.clouds.push(g);
    }
    scene.fog = new THREE.Fog(0xe8cf9a, 320, 950);
  }

  // clockHours: 0-24. Returns a 0..1 dusk factor.
  update(clockHours, simTime) {
    const t = clockHours;
    // sun elevation: noon high, dusk low
    const dayFrac = (t - 6) / 14; // 6:00 -> 0, 20:00 -> 1
    const elev = Math.sin(Math.max(0, Math.min(1, dayFrac)) * Math.PI);
    const dusk = Math.max(0, Math.min(1, (t - 17.5) / 2));
    const night = Math.max(0, Math.min(1, (t - 19.5) / 1.5));
    const warm = 1 - dusk * 0.7;
    this.sun.intensity = 1.15 * (0.25 + 0.75 * elev) * (1 - night * 0.6);
    this.sun.color.setRGB(1.0, 0.92 * warm + 0.08, 0.75 * warm + 0.1);
    this.sun.position.set(420 - dayFrac * 700, 60 + elev * 220, 120);
    this.hemi.intensity = 0.75 * (1 - night * 0.5);
    this.ambient.intensity = 0.25 * (1 - night * 0.4);
    const top = this.dome.material.uniforms.top.value;
    const mid = this.dome.material.uniforms.mid.value;
    top.setRGB(0.25 + 0.35 * (1 - dusk), 0.48 * (1 - dusk * 0.6), 0.85 * (1 - dusk * 0.75));
    mid.setRGB(0.97, 0.85 - dusk * 0.35, 0.63 - dusk * 0.3);
    this.scene.fog.color.setRGB(0.91 - dusk * 0.25, 0.81 - dusk * 0.3, 0.60 - dusk * 0.25);
    this.scene.fog.near = 320 - dusk * 80;
    // streetlights on at dusk
    const lampOn = dusk > 0.25;
    for (const m of this.city.lampMats) m.color.setHex(lampOn ? 0xffe9a8 : 0x554422);
    // beacon sweeps at dusk: rotate around the tower top
    if (this.city.beacon) {
      const a = simTime * 0.9;
      this.city.beacon.position.set(Math.cos(a) * 3, 146, -360 + Math.sin(a) * 3);
      this.city.beacon.material.color.setHex(dusk > 0.1 ? 0xff5a3c : 0xffd23f);
    }
    // clouds drift slowly with sim time (deterministic)
    for (let i = 0; i < this.clouds.length; i++) {
      this.clouds[i].position.x = -500 + i * 110 + ((simTime * (2 + i * 0.3)) % 1000);
      if (this.clouds[i].position.x > 520) this.clouds[i].position.x -= 1040;
    }
    // dust devils spin with sim time
    for (let i = 0; i < this.city.dustDevils.length; i++) {
      const dd = this.city.dustDevils[i];
      dd.rotation.y = simTime * (0.6 + i * 0.2);
      dd.position.x += Math.sin(simTime * 0.3 + i * 2) * 0.02;
    }
    return dusk;
  }
}
