// Twin 3D — ЖК 20 этажей в духе BIM: каркас + фасад + стояки ОВ/ВК/ЭО/вент, смета по этажам.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

let MOCK = null;
const OBJ = localStorage.getItem('twin_obj') || 'gk';
let FLOORS = 20, FH = 3.1, W = 34, D = 20;
let GEO = null, OD = null, EST = [], TASKS = [], EQ = [], NETS = {}, ROOMS = [];
const state = { water: true, heat: true, power: true, vent: true, struct: true, dense: true, xray: false, floor: 20, section: false, night: false, apt: null };
const denseMeshes = [];
const APT_COLORS = { A: 0x38bdf8, B: 0xa78bfa, C: 0x34d399, D: 0xfbbf24 };
let sectionGroup = null;
const facadeMeshes = [];
let hemi = null;
const lampLights = [];
const groups = {};
const pickables = [];
const flows = [];
const floorMeshes = [];

const container = document.getElementById('scene');
const Q = new URLSearchParams(location.search);
const HQ = Q.get('hq') === '1';
const renderer = new THREE.WebGLRenderer({ antialias: HQ, powerPreference: 'low-power' });
renderer.setPixelRatio(1);
renderer.shadowMap.enabled = HQ;
container.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x070d1a);
scene.fog = new THREE.Fog(0x070d1a, 180, 420);

const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1200);
camera.position.set(70, 62, 88);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 26, 0);
controls.maxPolarAngle = Math.PI / 2.05;
controls.autoRotate = false;
controls.autoRotateSpeed = 0.45;
controls.addEventListener('start', () => { controls.autoRotate = false; });
document.addEventListener('visibilitychange', () => { controls.autoRotate = false; tickOn = !document.hidden; });
let tickOn = true;

hemi = new THREE.HemisphereLight(0x93c5fd, 0x0f172a, 1.0);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffffff, 1.7);
sun.position.set(80, 120, 40);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -90, right: 90, top: 120, bottom: -40 });
scene.add(sun);

function resize() {
  const w = container.clientWidth, h = container.clientHeight;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(container);

let FLOORS = 20, FH = 3.1, H = 62, W = 34, D = 20;

function ground() {
  const g = new THREE.Mesh(new THREE.PlaneGeometry(500, 500),
    new THREE.MeshStandardMaterial({ color: 0x0b1526, roughness: 1 }));
  g.rotation.x = -Math.PI / 2; g.receiveShadow = true; scene.add(g);
  const grid = new THREE.GridHelper(300, 60, 0x1e3a5f, 0x13233f);
  grid.position.y = 0.02; scene.add(grid);
  // фонари по периметру (головы светятся ночью)
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.8 });
  const headMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, emissive: 0xffd27a, emissiveIntensity: 0.15 });
  window.__lampHeads = [];
  for (const [lx, lz] of [[-52, 30], [52, 30], [-52, -30], [52, -30], [0, 34], [0, -34]]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.25, 7, 8), poleMat);
    pole.position.set(lx, 3.5, lz); scene.add(pole);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.6, 10, 10), headMat.clone());
    head.position.set(lx, 7.2, lz); scene.add(head);
    window.__lampHeads.push(head);
    const pl = new THREE.PointLight(0xffc873, 0, 60);
    pl.position.set(lx, 7, lz); pl.visible = false; scene.add(pl);
    lampLights.push(pl);
  }
}

function riser(x, z, r, color, net) {
  const geo = new THREE.CylinderGeometry(r, r, H, 12);
  const mat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.5, roughness: 0.4 });
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, H / 2 + 4, z);
  m.castShadow = true;
  m.userData = { type: 'net', net };
  groups[net].add(m); pickables.push(m);
  for (let i = 0; i < 3; i++) {
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.32, 8, 8), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 }));
    groups[net].add(dot);
    flows.push({ dot, x, z, t: Math.random(), speed: 0.05 + Math.random() * 0.04 });
  }
}

function buildTower() {
  for (const k of ['water', 'heat', 'power', 'vent', 'struct', 'facade']) {
    groups[k] = new THREE.Group(); scene.add(groups[k]);
  }
  ground(); buildSite();

  // паркинг -1 (полупрозрачный)
  const park = new THREE.Mesh(new THREE.BoxGeometry(W + 14, 3.4, D + 14),
    new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 1, transparent: true, opacity: 0.85 }));
  park.position.y = -1.7; park.receiveShadow = true; scene.add(park);

  // стилобат 2 этажа
  const stylo = new THREE.Mesh(new THREE.BoxGeometry(W + 8, 7, D + 8),
    new THREE.MeshStandardMaterial({ color: 0x39465c, roughness: 0.9 }));
  stylo.position.y = 3.5; stylo.castShadow = stylo.receiveShadow = true;
  stylo.userData = { type: 'floor', n: 0, name: 'Стилобат (коммерция)' };
  scene.add(stylo); pickables.push(stylo); floorMeshes.push(stylo);

  const concMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.9 });
  const colGeo = new THREE.BoxGeometry(0.7, FH, 0.7);
  const cols = new THREE.InstancedMesh(colGeo, new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.9 }), FLOORS * 12);
  const dummy = new THREE.Object3D();
  let ci = 0;
  const slabGeo = new THREE.BoxGeometry(W, 0.45, D);
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x9fd8f5, roughness: 0.12, metalness: 0.45, transparent: true, opacity: 0.68 });
  const slabEdge = new THREE.EdgesGeometry(slabGeo);

  for (let f = 1; f <= FLOORS; f++) {
    const y = 7 + (f - 1) * FH;
    // плита
    const slab = new THREE.Mesh(slabGeo, concMat.clone());
    slab.position.y = y; slab.castShadow = slab.receiveShadow = true;
    slab.userData = { type: 'floor', n: f };
    groups.struct.add(slab); pickables.push(slab); floorMeshes.push(slab);
    const edge = new THREE.LineSegments(slabEdge, new THREE.LineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.35 }));
    edge.position.y = y; groups.struct.add(edge);
    // пилоны по периметру
    for (let ix = 0; ix < 4; ix++) for (let iz = 0; iz < 3; iz++) {
      dummy.position.set(-W / 2 + 1 + ix * (W - 2) / 3, y + FH / 2, -D / 2 + 1 + iz * (D - 2) / 2);
      dummy.updateMatrix(); cols.setMatrixAt(ci++, dummy.matrix);
    }
    // фасад: стекло + балконы через этаж
    const gl = new THREE.Mesh(new THREE.BoxGeometry(W + 0.3, FH - 0.5, D + 0.3), glassMat);
    gl.position.y = y + FH / 2;
    gl.userData = { type: 'floor', n: f };
    groups.facade.add(gl); pickables.push(gl); floorMeshes.push(gl); facadeMeshes.push(gl);
    if (f % 2 === 0) {
      const balc = new THREE.Mesh(new THREE.BoxGeometry(6, 0.25, 2.2),
        new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.8 }));
      balc.position.set(-8, y + 0.4, D / 2 + 1.2); balc.castShadow = true;
      groups.facade.add(balc);
      const rail = new THREE.Mesh(new THREE.BoxGeometry(6, 1, 0.12),
        new THREE.MeshStandardMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.5 }));
      rail.position.set(-8, y + 1, D / 2 + 2.2); groups.facade.add(rail);
    }
  }
  cols.count = ci; cols.castShadow = true; groups.struct.add(cols);

  // ядро (лифты/лестница) на всю высоту
  const core = new THREE.Mesh(new THREE.BoxGeometry(8, H, 6),
    new THREE.MeshStandardMaterial({ color: 0x9aa7bd, roughness: 0.95 }));
  core.position.set(8, H / 2 + 7, -2); core.castShadow = true;
  core.userData = { type: 'floor', n: -1, name: 'Ядро (лифты)' };
  groups.struct.add(core); pickables.push(core);

  // парапет + кровля с оборудованием (как на референсе: синие AHU, оранжевые трассы)
  const parap = new THREE.Mesh(new THREE.BoxGeometry(W + 0.6, 1.2, D + 0.6),
    new THREE.MeshStandardMaterial({ color: 0x475569 }));
  parap.position.y = 7 + H + 0.6; groups.struct.add(parap);
  const ahu = new THREE.Mesh(new THREE.BoxGeometry(8, 2.6, 3.4),
    new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.6 }));
  ahu.position.set(-8, 7 + H + 2, -4); ahu.castShadow = true;
  ahu.userData = { type: 'net', net: 'vent' };
  groups.vent.add(ahu); pickables.push(ahu);
  const ahu2 = ahu.clone(); ahu2.position.x = 2; groups.vent.add(ahu2); pickables.push(ahu2);
  const chill = new THREE.Mesh(new THREE.BoxGeometry(5, 2, 4),
    new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.6 }));
  chill.position.set(10, 7 + H + 1.8, 3); chill.castShadow = true;
  chill.userData = { type: 'net', net: 'heat' };
  groups.heat.add(chill); pickables.push(chill);

  // стояки в шахте — тоньше, как в BIM (были огромные)
  riser(4.5, -2, 0.30, 0xe879f9, 'vent');
  riser(5.4, -2, 0.24, 0xfacc15, 'power');
  riser(6.3, -2, 0.27, 0xfb7185, 'heat');
  riser(7.2, -2, 0.24, 0x38bdf8, 'water');
  riser(4.5, 0.2, 0.22, 0x22d3ee, 'water');
  riser(5.4, 0.2, 0.22, 0xf97316, 'heat');

  // поквартирная разводка: тонкие ветки от шахты по каждому этажу, как в BIM
  const branch = (net, color, y, z, r) => {
    const g = new THREE.CylinderGeometry(r, r, W - 3, 8);
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.55, roughness: 0.5 }));
    m.rotation.z = Math.PI / 2;
    m.position.set(0, y, z);
    m.userData = { type: 'net', net };
    groups[net].add(m); pickables.push(m);
  };
  for (let f = 1; f <= FLOORS; f++) {
    const y = 7 + (f - 1) * FH + 2.35; // под потолком
    branch('water', 0x38bdf8, y, 1.1, 0.10);
    branch('heat', 0xfb7185, y - 0.3, 1.7, 0.10);
    branch('power', 0xfacc15, y - 0.55, 2.2, 0.07);
    if (f % 5 === 1) branch('vent', 0xe879f9, y + 0.35, -3.5, 0.13); // вент-разводка на 4 этажах для читаемости
    if (f % 4 === 1) denseFloor(y); // плотный BIM-слой через 5 этажей
  }

function denseFloor(y) {
  const put = (geo, color, net, x, yy, z, ry) => {
    const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.5, roughness: 0.5 }));
    m.position.set(x, yy, z);
    if (ry) m.rotation.y = ry;
    m.userData = { type: 'net', net };
    groups[net].add(m); pickables.push(m); denseMeshes.push(m);
    return m;
  };
  // кабельный лоток (желтый) + крышка
  put(new THREE.BoxGeometry(W - 2, 0.12, 1.1), 0xfacc15, 'power', 0, y - 0.75, 3.4);
  for (let i = 0; i < 6; i++) put(new THREE.BoxGeometry(0.12, 0.12, 1.1), 0xfacc15, 'power', -W / 2 + 2 + i * 5.6, y - 0.68, 3.4);
  // два параллельных воздуховода (циан/белый)
  put(new THREE.BoxGeometry(W - 4, 0.5, 0.8), 0x22d3ee, 'vent', 0, y + 0.15, -4.5);
  put(new THREE.BoxGeometry(W - 6, 0.4, 0.6), 0xe2e8f0, 'vent', 1, y + 0.1, -5.6);
  // опуски к квартирам: 4 пары вода/тепло
  for (const dx of [-12, -4, 4, 12]) {
    put(new THREE.CylinderGeometry(0.07, 0.07, 2.3, 6), 0x38bdf8, 'water', dx, y - 1.2, 1.1);
    put(new THREE.CylinderGeometry(0.07, 0.07, 2.3, 6), 0xfb7185, 'heat', dx + 0.35, y - 1.2, 1.7);
  }
  // подвесы трассы
  for (let i = 0; i < 5; i++) put(new THREE.CylinderGeometry(0.04, 0.04, 1.1, 6), 0x94a3b8, 'vent', -W / 2 + 4 + i * 6.5, y + 0.9, -4.5);
}
  const intro = (z, y, c, net) => {
    const curve = new THREE.CatmullRomCurve3(
      [new THREE.Vector3(-60, 0.4, z), new THREE.Vector3(-25, 1.1, z), new THREE.Vector3(-W / 2 - 4, y, z * 0.25)]);
    const m = new THREE.Mesh(new THREE.TubeGeometry(curve, 32, 0.4, 8),
      new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.4 }));
    m.userData = { type: 'net', net }; groups[net].add(m); pickables.push(m);
  };
  intro(14, 2.2, 0x38bdf8, 'water');
  intro(20, 2.6, 0xfb7185, 'heat');
  intro(-24, 3.0, 0xfacc15, 'power');
}

function floorCalc(n) {
  const b = MOCK.floorBase;
  const k = n === 0 ? 2.4 : 1 + (n > 14 ? 0.06 : 0); // верхние этажи дороже
  const fmt = (v, u) => `${(v * k).toFixed(v > 200 ? 0 : 1)} ${u}`;
  return { concrete: fmt(b.concrete, 'м³'), rebar: fmt(b.rebar, 'т'), facade: fmt(b.facade, 'м²'),
    pipes: fmt(b.pipes, 'м'), cable: fmt(b.cable, 'м'),
    cost: '₸ ' + Math.round(b.cost * k / 1e6) + ' млн' };
}

function buildSection(n) {
  if (sectionGroup) {
    scene.remove(sectionGroup);
    for (let i = pickables.length - 1; i >= 0; i--) {
      if (pickables[i].userData && pickables[i].userData.type === 'apt') pickables.splice(i, 1);
    }
  }
  sectionGroup = new THREE.Group();
  if (n <= 0 || !state.section) { scene.add(sectionGroup); syncSection(); return; }
  const y = 7 + (n - 1) * FH;
  const wallMat = new THREE.MeshStandardMaterial({ color: 0xe8edf3, roughness: 0.9 });
  const wall = (w, h, d, x, z, apt) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat.clone());
    m.position.set(x, y + h / 2 + 0.25, z);
    m.castShadow = true;
    m.userData = { type: 'apt', floor: n, apt };
    sectionGroup.add(m); pickables.push(m);
  };
  // 4 помещения: перегородки + цветные подложки пола (масштаб под ширину)
  const unit = W / 4;
  const cols = [-1.5 * unit, -0.5 * unit, 0.5 * unit, 1.5 * unit];
  ROOMS.forEach((a, i) => {
    const cx = cols[i];
    const patch = new THREE.Mesh(new THREE.BoxGeometry(unit - 1, 0.12, D - 3),
      new THREE.MeshStandardMaterial({ color: APT_COLORS[a.id], transparent: true, opacity: 0.35, roughness: 1 }));
    patch.position.set(cx, y + 0.32, 0);
    patch.userData = { type: 'apt', floor: n, apt: a.id };
    sectionGroup.add(patch); pickables.push(patch);
    // межквартирные стены
    if (i > 0) wall(0.25, FH - 0.6, D - 2, cx - unit / 2, 0, a.id);
    // комната/кухня внутри
    wall(2.6, FH - 0.6, 0.22, cx + 0.3, -2, a.id);
    wall(0.22, FH - 0.6, 3.4, cx - 0.8, 2.6, a.id);
    // кровать + диван + кухня (условная мебель)
    const bed = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.7, 3.2),
      new THREE.MeshStandardMaterial({ color: 0x64748b }));
    bed.position.set(cx - 1.8, y + 0.6, -D / 2 + 2); sectionGroup.add(bed);
    const sofa = new THREE.Mesh(new THREE.BoxGeometry(3, 0.8, 1.2),
      new THREE.MeshStandardMaterial({ color: 0x475569 }));
    sofa.position.set(cx + 1, y + 0.65, D / 2 - 1.5); sectionGroup.add(sofa);
    const kit = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1, 1),
      new THREE.MeshStandardMaterial({ color: 0x94a3b8 }));
    kit.position.set(cx + 0.4, y + 0.75, -D / 2 + 0.8); sectionGroup.add(kit);
  });
  // входной холл у ядра
  wall(0.25, FH - 0.6, 6, -0.5, -2, 'HALL');
  scene.add(sectionGroup);
  syncSection();
}

function syncSection() {
  const n = state.floor;
  floorMeshes.forEach(m => {
    const fn = m.userData.n;
    if (typeof fn !== 'number' || fn <= 0) return;
    let vis = true;
    if (state.section && fn > n) vis = false; // разрез: верх снят
    if (groups.facade.children.includes(m)) vis = vis && !state.xray;
    else vis = vis && state.struct;
    m.visible = vis;
  });
  if (sectionGroup) sectionGroup.visible = state.section && n > 0;
}

function setNight(on) {
  state.night = on;
  document.getElementById('night').checked = on;
  document.body.style.background = on ? '#020617' : '#070d1a';
  scene.background.set(on ? 0x020617 : 0x070d1a);
  scene.fog.color.set(on ? 0x020617 : 0x070d1a);
  hemi.intensity = on ? 0.25 : 1.0;
  sun.intensity = on ? 0.15 : 1.7;
  sun.color.set(on ? 0x93c5fd : 0xffffff);
  facadeMeshes.forEach(m => {
    m.material.emissive = m.material.emissive || new THREE.Color(0);
    m.material.emissive.setHex(on ? 0xffc873 : 0x000000);
    m.material.emissiveIntensity = on ? 0.55 : 0;
  });
  (window.__lampHeads || []).forEach(h => { h.material.emissiveIntensity = on ? 2.2 : 0.15; });
  lampLights.forEach(l => { l.intensity = on ? 220 : 0; l.visible = on; });
}

function showApt(floor, id) {
  const r = ROOMS.find(x => x.id === id);
  if (!r) return;
  state.apt = id;
  let head;
  if (GEO.billQ && r.price) {
    const k = 1 + (floor > 14 ? 0.12 : 0) + floor * 0.004;
    const price = Math.round(r.price * k / 100000) / 10;
    head = `<b>Квартира ${r.id} · ${r.rooms} · эт ${floor}</b> — ${r.area} м² · ₸ ${price} млн · <b>${r.status}</b><br/>` +
      `🧾 Квитанция (MOCK): тепло ₸ ${Math.round(r.area * 310).toLocaleString('ru')} · вода ₸ ${Math.round(r.area * 95).toLocaleString('ru')} · свет ₸ ${Math.round(r.area * 210).toLocaleString('ru')} · сверка: утечек нет<br/>`;
  } else {
    head = `<b>${r.label} · эт ${floor}</b> — ${r.area} м² · <b>${r.status}</b><br/>`;
  }
  document.getElementById('aptinfo').innerHTML = head +
    `${r.sub} · GUID: Apt-${floor}${r.id}…`;
}

function selectFloor(n) {
  state.floor = n;
  document.getElementById('floor').value = n;
  document.getElementById('floorv').textContent = n === 0 ? 'стилобат' : n === -1 ? 'ядро' : 'эт ' + n;
  if (n > 0) {
    const c = floorCalc(n);
    const teams = ['СтройМонтаж-А', 'ФасадПрофи', 'СтройМонтаж-А', 'ИнжСистемы'];
    const team = teams[n % teams.length];
    const frame = 100, fac = Math.max(0, Math.min(100, 140 - n * 5)), mep = Math.max(0, Math.min(100, 90 - n * 4));
    const late = n === OD.lateFloor ? OD.lateText : n >= OD.hotFrom ? '⚠ перерасход тепла' : '✅ в графике';
    document.getElementById('floorinfo').innerHTML =
      `<b>Этаж ${n}</b> · ${c.cost} · ${late}<br/>` +
      `🧱 Каркас ${frame}% · 🪟 Фасад ${fac}% · 🔧 Инженерия ${mep}%<br/>` +
      `Бетон ${c.concrete} · Арматура ${c.rebar} · Фасад ${c.facade}<br/>Трубы ${c.pipes} · Кабель ${c.cable}<br/>` +
      `👷 Подрядчик: ${team}<br/><span class="mono">Код этажа для сметы: Fl-${String(n).padStart(2, '0')}</span>`;
    controls.target.set(0, 7 + (n - 1) * FH, 0);
  } else if (n === 0) {
    document.getElementById('floorinfo').innerHTML = `<b>Стилобат</b> — коммерция, ИТП, насосная, паркинг −1. Смета укрупненно: ₸ 410 млн (MOCK).`;
  } else {
    document.getElementById('floorinfo').innerHTML = `<b>Ядро</b> — 3 лифта + лестница, стояки ОВ/ВК/ЭО/ДУ. Клик по цветному стояку — сеть.`;
  }
  // подсветка выбранной плиты — ярко
  floorMeshes.forEach(m => {
    if (m.material.emissive && m.userData.type === 'floor') {
      const sel = m.userData.n === n;
      m.material.emissive.setHex(sel ? 0x0ea5e9 : (state.night && groups.facade.children.includes(m) ? 0xffc873 : 0x000000));
      m.material.emissiveIntensity = sel ? 0.85 : (state.night && groups.facade.children.includes(m) ? 0.55 : 0);
      m.material.transparent = sel ? false : m.material.transparent;
    }
  });
  buildSection(n);
}

function applyFocus() {
  const net = state.lastNet;
  for (const [nn, g] of Object.entries(groups)) {
    if (!['water', 'heat', 'power', 'vent'].includes(nn)) continue;
    g.visible = state[nn];
    const on = nn === net;
    g.children.forEach(o => {
      if (o.material) {
        o.material.transparent = false;
        o.material.opacity = 1;
        if (o.material.emissive) o.material.emissiveIntensity = on ? 1.25 : 0.55;
      }
    });
  }
  document.querySelectorAll('.layers button').forEach(b => {
    const n = b.id.replace('btn-', '');
    const mine = n === net;
    if (!state[n]) { b.style.opacity = 0.3; b.style.boxShadow = 'none'; }
    else if (mine) { b.style.opacity = 1; b.style.boxShadow = `0 0 0 2px currentColor inset, 0 6px 22px -6px currentColor`; }
    else { b.style.opacity = 0.85; b.style.boxShadow = 'none'; }
  });
}

function showNet(net) {
  state.lastNet = net;
  const rows = NETS[net].lines.map(l =>
    `<div style="margin-top:6px;border-top:1px solid #334155;padding-top:6px"><b>${l.id}</b> — ${l.state}<br/>` +
    Object.entries(l).filter(([k]) => k !== 'id' && k !== 'state').map(([k, v]) => `${k}: ${v}`).join(' · ') + `</div>`).join('');
  document.getElementById('netinfo').innerHTML =
    `<b>${{ water: '🔵 ВК · вода', heat: '🔴 ОВ · тепло', power: '🟡 ЭО · свет', vent: '🟣 Вентиляция ДУ' }[net]}</b>${rows}`;
  applyFocus();
}

let riverMesh = null, gaugePole = null, floodTimers = [];
function buildSite() {
  // свой участок: золотая рамка + заливка
  const W2 = 46, D2 = 36;
  const pts = [new THREE.Vector3(-W2, 0.15, -D2), new THREE.Vector3(W2, 0.15, -D2),
    new THREE.Vector3(W2, 0.15, D2), new THREE.Vector3(-W2, 0.15, D2), new THREE.Vector3(-W2, 0.15, -D2)];
  const frame = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),
    new THREE.LineBasicMaterial({ color: 0xfbbf24 }));
  scene.add(frame);
  const fill = new THREE.Mesh(new THREE.PlaneGeometry(W2 * 2, D2 * 2),
    new THREE.MeshBasicMaterial({ color: 0xfbbf24, transparent: true, opacity: 0.06 }));
  fill.rotation.x = -Math.PI / 2; fill.position.y = 0.06;
  fill.userData = { type: 'plot', own: true };
  scene.add(fill); pickables.push(fill);
  // соседи: 10 участков по диаметру — кадастр из открытых данных
  const spots = [
    { x: 78, z: 2, w: 30, d: 26 }, { x: 76, z: -32, w: 26, d: 22 }, { x: 30, z: 62, w: 30, d: 22 },
    { x: -28, z: 62, w: 32, d: 22 }, { x: -80, z: 12, w: 34, d: 30 }, { x: -78, z: -30, w: 28, d: 20 },
    { x: -20, z: -34, w: 30, d: 14 }, { x: 112, z: 8, w: 26, d: 24 }, { x: 34, z: -34, w: 24, d: 14 },
    { x: -112, z: 4, w: 30, d: 28 },
  ];
  MOCK.plots.forEach((p, i) => {
    const s = spots[i % spots.length];
    if (p.built) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(s.w * 0.55, 5 + (i % 3) * 2, s.d * 0.5),
        new THREE.MeshStandardMaterial({ color: 0x46536e, roughness: 1, transparent: true, opacity: 0.85 }));
      b.position.set(s.x, 2.5 + (i % 3), s.z); b.castShadow = true;
      b.userData = { type: 'plot', own: false, pid: p.id };
      scene.add(b); pickables.push(b);
    }
    const edge = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(s.x - s.w / 2, 0.15, s.z - s.d / 2), new THREE.Vector3(s.x + s.w / 2, 0.15, s.z - s.d / 2),
      new THREE.Vector3(s.x + s.w / 2, 0.15, s.z + s.d / 2), new THREE.Vector3(s.x - s.w / 2, 0.15, s.z + s.d / 2)]),
      new THREE.LineBasicMaterial({ color: 0x5b6b8c }));
    scene.add(edge);
    const fillN = new THREE.Mesh(new THREE.PlaneGeometry(s.w, s.d),
      new THREE.MeshBasicMaterial({ color: p.built ? 0x46536e : 0x2f6b4f, transparent: true, opacity: 0.14 }));
    fillN.rotation.x = -Math.PI / 2; fillN.position.set(s.x, 0.07, s.z);
    fillN.userData = { type: 'plot', own: false, pid: p.id };
    scene.add(fillN); pickables.push(fillN);
  });
  // река Тобол: полоса на севере
  riverMesh = new THREE.Mesh(new THREE.PlaneGeometry(500, 56),
    new THREE.MeshStandardMaterial({ color: 0x1d6fa5, roughness: 0.25, metalness: 0.35, transparent: true, opacity: 0.85 }));
  riverMesh.rotation.x = -Math.PI / 2; riverMesh.position.set(0, 0.1, -78);
  scene.add(riverMesh);
  const bank = new THREE.Mesh(new THREE.BoxGeometry(500, 1.2, 4),
    new THREE.MeshStandardMaterial({ color: 0x55607a }));
  bank.position.set(0, 0.6, -48); scene.add(bank);
  // гидропост: столб с 4 рисками (каждые 0.3м)
  gaugePole = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 5, 8),
    new THREE.MeshStandardMaterial({ color: 0xe2e8f0 }));
  pole.position.y = 2.5; gaugePole.add(pole);
  for (let i = 0; i < 4; i++) {
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.12, 8),
      new THREE.MeshStandardMaterial({ color: i < 2 ? 0x34d399 : 0xf87171, emissive: i < 2 ? 0x34d399 : 0xf87171, emissiveIntensity: 0.6 }));
    ring.position.y = 0.5 + i * 0.35; gaugePole.add(ring);
  }
  gaugePole.position.set(-20, 0, -52); scene.add(gaugePole);
  // деревья в учете: 46 шт по границе и у реки
  const N = (MOCK.parcel && MOCK.parcel.trees) || 46;
  const trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.25, 0.35, 2.4, 6),
    new THREE.MeshStandardMaterial({ color: 0x6b4a2f, roughness: 1 }), N);
  const crown = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1.7, 0),
    new THREE.MeshStandardMaterial({ color: 0x2f9e5f, roughness: 0.9, flatShading: true }), N);
  const d = new THREE.Object3D();
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < N; i++) {
    const side = i % 4;
    const x = side === 0 ? -W2 - 4 - rnd() * 8 : side === 1 ? W2 + 4 + rnd() * 8 : (rnd() - 0.5) * 110;
    const z = side < 2 ? (rnd() - 0.5) * 70 : side === 2 ? -D2 - 5 - rnd() * 6 : D2 + 5 + rnd() * 8;
    d.position.set(x, 1.2, z); d.updateMatrix(); trunk.setMatrixAt(i, d.matrix);
    d.position.y = 3.4; d.scale.setScalar(0.85 + rnd() * 0.5); d.updateMatrix(); crown.setMatrixAt(i, d.matrix);
    d.scale.setScalar(1);
  }
  trunk.castShadow = crown.castShadow = true;
  scene.add(trunk); scene.add(crown);
}

function showPlot(own, name, pid) {
  const P = MOCK.parcel, R = MOCK.river;
  if (own) {
    document.getElementById('parcelinfo').innerHTML =
      `<b>⭐ Наш участок</b> · ${P.cadastre}<br/>${P.area} · ${P.status}<br/>🌳 Деревьев в учете: <b>${P.trees}</b><br/>🌊 ${R.name}: ${R.level}, ${R.forecast}<br/><span class="mono">Рядом участков в кадастре: ${MOCK.plots.length} — ткни в любой</span>`;
    return;
  }
  const p = MOCK.plots.find(x => x.id === pid);
  document.getElementById('parcelinfo').innerHTML = p
    ? `<b>Участок ${p.id}</b> · ${p.cadastre} (открытые данные)<br/>${p.area} · ${p.use}<br/>Владелец: ${p.owner} · ${p.status}<br/><span style="color:#94a3b8">Полные данные (сети, сметы) — только по своему. Датчики и сметы соседей не показываем.</span>`
    : `<b>Чужой участок (${name || 'сосед'})</b> — данных нет.<br/>Показываем только свой: граница приватности.`;
}

function floodDemo() {
  const R = MOCK.river;
  floodTimers.forEach(clearTimeout); floodTimers = [];
  const rising = riverMesh.position.y < 0.5;
  const steps = rising ? [0.4, 0.7, 0.9, 1.1] : [0.7, 0.4, 0.1];
  const SAFE = 2.4; // стилобат: дом стоит на +2.4м
  steps.forEach((lv, i) => floodTimers.push(setTimeout(() => {
    riverMesh.position.y = lv;
    riverMesh.material.opacity = 0.85 + (lv / 1.1) * 0.15;
    const last = i === steps.length - 1;
    const margin = (SAFE - lv).toFixed(1);
    document.getElementById('parcelinfo').innerHTML =
      `<b>🌊 ${R.name}</b> · уровень <b>+${lv.toFixed(1)} м</b> · ${R.sensor}<br/>` +
      (rising
        ? (last
          ? `⛔ Вода встала у набережной (+1.2 м). <b>Дом выше паводка на +${margin} м — подтоплений нет.</b> (MOCK-симуляция)`
          : `Вода идет… запас над домом +${margin} м`)
        : (last ? R.forecast : `Вода уходит… уровень +${lv.toFixed(1)} м`));
    if (last) alertBar(rising ? `🌊 Паводок встал у набережной. Запас дома +${margin} м — сухо` : 'Река в норме: ' + R.level, rising ? 'good' : 'good');
  }, 500 * (i + 1))));
}

const MASTERS = { plumb: '🔧 Сантехник Серік', elec: '⚡ Электрик Асхат', clean: '🧹 Клининг Айгерим', uk: '🏢 УК-диспетчер', lift: '🛗 Лифтер Болат' };
let resTasks = JSON.parse(localStorage.getItem('twin_restasks') || '[]');
function classifyResident(t) {
  t = t.toLowerCase();
  if (/теч|кран|вода|труба|засор|батаре/.test(t)) return ['plumb', '2 часа'];
  if (/свет|розетк|электри|щиток|подъезд.*темно|лифт/.test(t)) return t.includes('лифт') ? ['lift', '1 час'] : ['elec', '3 часа'];
  if (/гряз|убор|мусор|подъезд/.test(t)) return ['clean', 'сегодня'];
  if (/шум|сосед|парков|шлагбаум/.test(t)) return ['uk', 'завтра'];
  return ['uk', 'завтра'];
}
function renderResTasks() {
  document.getElementById('restasks').innerHTML = resTasks.length
    ? resTasks.map((t, i) => `<div class="card" style="margin:6px 0;${t.done ? 'opacity:.55' : ''}"><label class="chk" style="margin:0;${t.done ? 'text-decoration:line-through' : ''}"><input type="checkbox" data-r="${i}" ${t.done ? 'checked' : ''}/> <b>${t.master}</b> · ${t.text} · <span style="color:#94a3b8">${t.due}</span></label></div>`).join('')
    : '<div style="font-size:12px;color:#94a3b8">Пока тихо. Напиши — мастер прибежит 🛠️</div>';
  document.querySelectorAll('#restasks input').forEach(c => c.onchange = () => {
    resTasks[+c.dataset.r].done = c.checked;
    localStorage.setItem('twin_restasks', JSON.stringify(resTasks));
    renderResTasks();
    updateCounts();
  });
}
function sendChat(text) {
  text = (text || '').trim();
  if (!text) return;
  const log = document.getElementById('chatlog');
  log.innerHTML += `<div>🧑‍🦰 <b>Жилец:</b> ${text}</div>`;
  const [m, due] = classifyResident(text);
  const task = { master: MASTERS[m], text, due, done: false };
  resTasks.unshift(task);
  localStorage.setItem('twin_restasks', JSON.stringify(resTasks));
  renderResTasks();
  log.innerHTML += `<div>🤖 <b>Дом:</b> принял! ${MASTERS[m]} уже вызван, придет: ${due}. Заявка №Ж-${100 + resTasks.length} (MOCK)</div>`;
  log.scrollTop = log.scrollHeight;
  document.getElementById('feedlist').innerHTML =
    `<div>💬 ${new Date().toTimeString().slice(0, 5)} — жилец: «${text.slice(0, 40)}» → ${MASTERS[m]} (MOCK)</div>` +
    document.getElementById('feedlist').innerHTML;
  alertBar(`🛠️ ${MASTERS[m]} вызван! Придет: ${due}`, 'good');
  flashSection('d-chat');
}

function setRole(r) {
  const R = MOCK.roles[r];
  if (!R) return;
  document.querySelectorAll('#roles button').forEach(b => b.classList.toggle('hot', b.dataset.r === r));
  const names = { dev: '🏗 Владелец стройкомпании', gos: '🏛 Акимат — взгляд города', inv: '💼 Инвестор', own: '🔑 Владелец площадей' };
  let extra = '';
  if (r === 'gos') extra = '<br/><span class="mono">' + MOCK.docs.map(d => `${d.s} ${d.n}`).join('<br/>') + '</span>';
  if (r === 'inv') { extra = '<br/>' + GEO.salesLine; }
  document.getElementById('rolecard').innerHTML =
    `<b>${names[r]}</b> — что важно:<br/>` + R.kpi.map(([k, v]) => `• ${k}: <b>${v}</b>`).join('<br/>') + extra;
  if (r === 'dev') { flashSection('d-daily'); selectFloor(OD.lateFloor || FLOORS); }
  if (r === 'gos') { flashSection('d-daily'); alertBar('🏛 Акимат: предписания открыты — см. задания мастеров', 'warn'); }
  if (r === 'inv') { flashSection('d-money'); alertBar('💼 ' + GEO.salesLine.replace(/<[^>]+>/g, ' '), 'good'); }
  if (r === 'own') { flashSection('d-floor'); state.section = true; document.getElementById('section').checked = true; selectFloor(GEO.demoApt[0]); showApt(GEO.demoApt[0], GEO.demoApt[1]); alertBar('🔑 ' + GEO.ownerLine); }
}

let selBox = null;
function markSelected(obj) {
  if (selBox) { scene.remove(selBox); selBox.geometry.dispose(); selBox = null; }
  if (!obj) return;
  selBox = new THREE.BoxHelper(obj, 0xffd166);
  selBox.material.depthTest = false;
  selBox.renderOrder = 999;
  scene.add(selBox);
}

function setCnt(id, n, kind) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = n > 0 ? n : '';
  el.className = 'cnt' + (n > 0 ? ' ' + kind : '');
}

function updateCounts() {
  const doneT = new Set(JSON.parse(localStorage.getItem('twin_tasks') || '[]'));
  const openT = TASKS.filter(t => !doneT.has(t.id));
  setCnt('c-tasks', openT.length, openT.some(t => t.overdue) ? 'red' : 'info');
  const openR = resTasks.filter(t => !t.done).length;
  setCnt('c-chat', openR, 'info');
  setCnt('c-pred', EQ.filter(e => e.health < 65).length, 'red');
  setCnt('c-money', EST.filter(e => e.done < (e.plan ?? e.done)).length, 'amber');
  let badNets = 0;
  for (const k of ['water', 'heat', 'power', 'vent']) {
    if ((NETS[k].lines || []).some(l => l.state !== 'норма')) badNets++;
  }
  setCnt('c-nets', badNets, 'amber');
  setCnt('c-daily', MOCK.sensors.filter(s => s.flag !== 'норма').length + 1, 'amber');
  setCnt('c-street', 4, 'amber');
  setCnt('c-floor', 7, 'amber');
}

function flashCard(el) {
  if (!el) return;
  el.classList.remove('hot');
  void el.offsetWidth;
  el.classList.add('hot');
  clearTimeout(flashCard._t);
  flashCard._t = setTimeout(() => el.classList.remove('hot'), 1800);
}

function flashSection(id) {
  const d = document.getElementById(id);
  if (!d) return;
  document.querySelectorAll('#panel details[open]').forEach(x => { if (x !== d) x.open = false; });
  d.open = true;
  d.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  d.classList.remove('flash');
  void d.offsetWidth;
  d.classList.add('flash');
  clearTimeout(flashSection._t);
  flashSection._t = setTimeout(() => d.classList.remove('flash'), 1600);
}

const eqMeshes = {};
let pulseList = [];
function buildEq() {
  const grp = new THREE.Group(); scene.add(grp);
  const put = (id, geo, mat, x, y, z, eq) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z); m.castShadow = true;
    m.userData = { type: 'eq', eq: eq || id };
    grp.add(m); pickables.push(m); eqMeshes[eq || id] = m;
    return m;
  };
  const E = Object.fromEntries(EQ.map(e => [e.id, e]));
  const bad = (h) => h < 65 ? 0xf87171 : h < 85 ? 0xfbbf24 : 0x34d399;
  // ИТП в стилобате
  put('itp-1', new THREE.BoxGeometry(4.5, 3, 3.5),
    new THREE.MeshStandardMaterial({ color: 0xb45454, roughness: 0.6, emissive: bad(E['itp-1'].health), emissiveIntensity: 0.25 }), -14, 1.8, 15.5);
  // насос ХВС-2 в паркинге
  put('pump-2', new THREE.CylinderGeometry(1.1, 1.1, 2.6, 12),
    new THREE.MeshStandardMaterial({ color: 0x3f8fc4, roughness: 0.4, emissive: bad(E['pump-2'].health), emissiveIntensity: 0.3 }), 14, 0.4, 12);
  // БКТП
  put('bktp', new THREE.BoxGeometry(5, 2.2, 4),
    new THREE.MeshStandardMaterial({ color: 0x8a7a3a, roughness: 0.7, emissive: bad(E['bktp'].health), emissiveIntensity: 0.25 }), -14, 1.2, -15);
  // маркеры: кровля АХУ + лифт + датчик эт.17
  const mark = (id, x, y, z) => {
    const m = new THREE.Mesh(new THREE.OctahedronGeometry(1.1),
      new THREE.MeshStandardMaterial({ color: bad(EQ.find(e => e.id === id).health), emissive: bad(EQ.find(e => e.id === id).health), emissiveIntensity: 0.9, roughness: 0.3 }));
    m.position.set(x, y, z); m.userData = { type: 'eq', eq: id };
    grp.add(m); pickables.push(m); eqMeshes[id + ':m'] = m;
    if (EQ.find(e => e.id === id).health < 75) pulseList.push(m);
  };
  mark('ahu-1', -8, 7 + H + 4.6, -4);
  mark('lift-1', 8, 7 + H * 0.55, -2);
  mark('itp-1', -14, 5.2, 15.5);
}

function showStreet(kind, id) {
  flashSection('d-street');
  const el = document.getElementById('streetinfo');
  if (kind === 'bin') {
    const full = id === 2;
    el.innerHTML = full
      ? `<b>🗑 Бак №3 переполнен</b> — вывоз через 2ч, перевозчик уведомлен (MOCK). Статус площадки: <b>требует вывоза</b>`
      : `<b>🗑 Бак №${id + 1}</b> — заполнен ${35 + id * 10}%, норма. Вывоз по графику.`;
    if (full) alertBar('🗑 Мусорная площадка: бак №3 переполнен — заявка перевозчику', 'warn');
  } else if (kind === 'pot') {
    el.innerHTML = `<b>🕳 Яма №${id + 1}</b> — 40 см, фото с координатой → заявка в 109 создана (MOCK). Устранить за 48ч.`;
    alertBar('🕳 Дефект дороги зафиксирован — заявка в 109', 'warn');
  } else if (kind === 'lamp') {
    el.innerHTML = `<b>💡 Фонарь №3</b> — отказ драйвера, темно с 21:04. Заявка электрику, устранить за 1–2 дня (MOCK).`;
    alertBar('💡 Отказ светоточки №3 — заявка создана', 'warn');
  }
  document.getElementById('feedlist').innerHTML =
    `<div>🏙 ${new Date().toTimeString().slice(0, 5)} — ${kind === 'bin' ? 'бак №3: заявка на вывоз' : kind === 'pot' ? 'яма: заявка в 109' : 'фонарь №3: заявка электрику'} (MOCK)</div>` +
    document.getElementById('feedlist').innerHTML;
}

let lampFail = null;
function buildUrban() {
  // дорога на востоке
  const road = new THREE.Mesh(new THREE.PlaneGeometry(22, 170),
    new THREE.MeshStandardMaterial({ color: 0x232c40, roughness: 1 }));
  road.rotation.x = -Math.PI / 2; road.position.set(66, 0.08, 0); road.receiveShadow = true; scene.add(road);
  // ямы
  [[64, 18], [68, -12]].forEach(([x, z], i) => {
    const p = new THREE.Mesh(new THREE.CircleGeometry(1.4, 14),
      new THREE.MeshStandardMaterial({ color: 0x05070c, roughness: 1 }));
    p.rotation.x = -Math.PI / 2; p.position.set(x, 0.14, z);
    p.userData = { type: 'street', kind: 'pot', id: i };
    scene.add(p); pickables.push(p);
  });
  // мусорная площадка: 3 бака
  [0, 1, 2].forEach(i => {
    const bad = i === 2;
    const b = new THREE.Mesh(new THREE.BoxGeometry(1.6, bad ? 2.0 : 1.5, 1.6),
      new THREE.MeshStandardMaterial({ color: bad ? 0xb44444 : 0x3f7a52, roughness: 0.8, emissive: bad ? 0xb44444 : 0x000000, emissiveIntensity: bad ? 0.5 : 0 }));
    b.position.set(30 + i * 2.4, 0.8, 24); b.castShadow = true;
    b.userData = { type: 'street', kind: 'bin', id: i };
    scene.add(b); pickables.push(b);
    if (bad) pulseList.push(b);
  });
  // отказ фонаря №3: красный маркер
  lampFail = new THREE.Mesh(new THREE.OctahedronGeometry(0.9),
    new THREE.MeshStandardMaterial({ color: 0xf87171, emissive: 0xf87171, emissiveIntensity: 1 }));
  lampFail.position.set(-52, 8.4, -30);
  lampFail.userData = { type: 'street', kind: 'lamp', id: 3 };
  scene.add(lampFail); pickables.push(lampFail); pulseList.push(lampFail);
}

function blackout() {
  showNet('heat');
  flashSection('d-street');
  document.getElementById('streetinfo').innerHTML =
    `<b>💥 Порыв Т-ввод (MOCK)</b> — расчет зоны за 3 сек:<br/>Без тепла: <b>${OD.blackout}</b><br/>Отключатель: задвижка В-3, ИТП на байпасе. Норматив — 10 сек на расчет.`;
  alertBar(`💥 Порыв: без тепла ${OD.blackout}. Зона рассчитана за 3 сек`);
  (groups.heat.children || []).forEach(o => { if (o.material && o.material.emissive) { o.material.emissiveIntensity = 1.4; pulseList.push(o); } });
  setTimeout(() => { pulseList = pulseList.filter(m => !(groups.heat.children || []).includes(m)); syncLayers(); }, 6000);
}

function showEq(id) {
  const e = EQ.find(x => x.id === id);
  if (!e) return;
  flashSection('d-pred');
  if (e.net) showNet(e.net);
  if (e.floor >= 0) selectFloor(e.floor);
  const m = eqMeshes[id];
  if (m) {
    controls.target.copy(m.position);
    pulseList.push(m);
    setTimeout(() => { pulseList = pulseList.filter(x => x !== m); }, 4000);
  }
  flashCard(document.querySelector(`[data-eqcard="${id}"]`));
  alertBar(`🔮 ${e.name} · здоровье ${e.health}% · ТО ${e.to} · ${e.state}`);
}

function renderPred() {
  const col = (h) => h < 65 ? '#f87171' : h < 85 ? '#fbbf24' : '#34d399';
  document.getElementById('pred').innerHTML = EQ.map(e =>
    `<div class="card" data-eqcard="${e.id}"><b>${e.name}</b> · ${e.place} · <span style="color:${col(e.health)}">здоровье ${e.health}%</span><div class="bar"><div style="width:${e.health}%;background:${col(e.health)}"></div></div><div style="font-size:11px;color:#94a3b8;margin-top:4px">ТО ${e.to} · ресурса ${e.rul} · ${e.state}</div><button data-eq="${e.id}" style="margin-top:6px;width:100%;padding:6px;border-radius:8px;border:1px solid #2c3d5c;background:#16213a;color:#7dd3fc;cursor:pointer;font-size:12px">📍 Показать узел</button></div>`).join('');
  document.querySelectorAll('#pred [data-eq]').forEach(b => b.onclick = () => showEq(b.dataset.eq));
}

function gotoTask(id) {
  const t = TASKS.find(x => x.id === id);
  if (!t) return;
  if (t.eq) { showEq(t.eq); return; }
  if (t.net) showNet(t.net);
  selectFloor(t.floor ?? 20);
  flashSection('d-floor');
  alertBar(`${t.id} · ${t.text} — показано на модели`);
}

function agent(q) {
  q = (q || '').toLowerCase();
  const log = document.getElementById('agentlog');
  const log2 = document.getElementById('agentlog2');
  const say = (h) => { log.innerHTML = h; if (log2) log2.innerHTML = h.replaceAll('<b>Агент:</b>', '🤖 ').replaceAll('<b>Картина дня:</b>', '📊 '); };
  const KZ = /шығын|апат|мәртебе|тапсырма|тазалау|кім|қайда/.test(q);
  if (q.includes('перерасход') || q.includes('шығын')) { showNet('heat'); selectFloor(OD.agentFloor); alertBar('ОВ ' + GEO.agentOver + ' · поручение ИТП 24ч');
    say(`<b>Агент:</b> ${GEO.agentOver}. Поручение наладчику ИТП, 24ч. (MOCK)${KZ ? ' · (KZ: шығын табылды)' : ''}`);
  } else if (q.includes('авари') || q.includes('апат')) { showNet('power'); alertBar('Перегруз паркинг 91% · БКТП · зона отключения −1');
    say(`<b>Агент:</b> риск — паркинг перегруз 91% (зарядки). Зона отключения: паркинг −1 (расчет в пилоте).${KZ ? ' · (KZ: апат орны −1)' : ''}`);
  } else if (q.includes('поручен') || q.includes('тапсырма')) {
    alertBar('');
    const open = TASKS.filter(t => !JSON.parse(localStorage.getItem('twin_tasks') || '[]').includes(t.id)).length;
    say(`<b>Агент:</b> открытых ${open}, просрочено 2 — фасад эт 9, витраж стилобата (MOCK).`);
  } else if (q.includes('статус') || q.includes('мәртебе')) {
    alertBar('');
    say(`<b>Картина дня:</b> ` + EST.slice(0, 3).map(e => e.stage.split(' ')[0] + ' ' + e.done + '%/' + (e.plan ?? e.done) + '%').join(', ') + `. Риски: ИТП, насос ХВС-2, шум после 22:00.`);
  } else if (q.includes('убор') || q.includes('тазалау')) {
    alertBar('');
    say(`<b>Агент:</b> грязь на выезде КПП — 3 обращения. Поручение подрядчику (MOCK).`);
  } else { alertBar(''); say(`<b>Агент:</b> понимаю: авария / перерасход / поручение / статус / уборка · KZ: апат / шығын / тапсырма / мәртебе / тазалау. Полный LLM — в пилоте.`); }
}

function alertBar(t, kind) {
  const b = document.getElementById('alertbar');
  b.classList.remove('bad', 'warn', 'good');
  if (!t) { b.classList.remove('on'); b.textContent = ''; return; }
  b.textContent = (/⚠|💥|🕳|🔮/.test(t) ? '' : '⚠ ') + t;
  b.classList.add('on');
  if (kind) b.classList.add(kind);
  clearTimeout(alertBar._t);
  alertBar._t = setTimeout(() => b.classList.remove('on'), 9000);
}

function exportCSV() {
  const rows = [['stage', 'sum_mln', 'fact_pct', 'plan_pct'], ...EST.map(e => [e.stage, Math.round(e.sum / 1e6), e.done, e.plan ?? e.done])];
  const csv = rows.map(r => r.map(v => `"${String(v).replaceAll('"', '""')}"`).join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(["\ufeff" + csv], { type: 'text/csv' }));
  a.download = 'smeta-mock.csv'; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

let demoTimers = [];
function demoStop() { demoTimers.forEach(clearTimeout); demoTimers = []; controls.autoRotate = false; }
function demoPlay() {
  demoStop(); controls.autoRotate = true;
  const seq = [
    [0, () => { selectFloor(GEO.demoFloors[0]); showNet('heat'); }],
    [1200, () => selectFloor(GEO.demoFloors[1])],
    [2600, () => { state.xray = true; syncLayers(); syncSection(); }],
    [4000, () => { state.xray = false; syncLayers(); state.section = true; document.getElementById('section').checked = true; selectFloor(GEO.demoFloors[2]); }],
    [5600, () => showApt(GEO.demoApt[0], GEO.demoApt[1])],
    [7000, () => { setNight(true); showNet('power'); alertBar('Перегруз паркинг 91% · вечерний пик (MOCK)'); }],
    [8600, () => { setNight(false); alertBar(''); agent('статус'); }],
  ];
  seq.forEach(([t, fn]) => demoTimers.push(setTimeout(fn, t)));
}

function syncLayers() {
  for (const n of ['water', 'heat', 'power', 'vent']) groups[n].visible = state[n];
  groups.struct.visible = state.struct;
  groups.facade.visible = !state.xray;
  document.getElementById('xray').checked = state.xray;
  for (const n of ['water', 'heat', 'power', 'vent']) {
    const b = document.getElementById('btn-' + n);
    b.classList.toggle('on', state[n]);
  }
  applyFocus();
}

async function init() {
  MOCK = await (await fetch('mock.json')).json();
  GEO = MOCK.objects[OBJ] || MOCK.objects.gk;
  FLOORS = GEO.floors; FH = GEO.fh; H = FLOORS * FH; W = GEO.w; D = GEO.d;
  state.floor = FLOORS;
  const G = GEO.billQ;
  OD = G ? { agentFloor: 17, lateFloor: 9, hotFrom: 14, lateText: '⚠ отстает на 4 дня (витраж)', blackout: 'эт 14–20 · 60 квартир · ~180 жителей' } : MOCK.objData[OBJ];
  const META = G ? MOCK.object : MOCK.objData[OBJ].meta;
  EST = G ? MOCK.estimate : MOCK.objData[OBJ].estimate;
  TASKS = G ? MOCK.tasks : MOCK.objData[OBJ].tasks;
  EQ = G ? MOCK.equipment : MOCK.objData[OBJ].equipment;
  NETS = G ? MOCK.networks : MOCK.objData[OBJ].networks;
  ROOMS = G
    ? [{ id: 'A', rooms: '1к', area: 38.4, price: 15200000, status: 'свободна', sub: 'Отделка white-box (MOCK) · Окна на юг · Стояки ОВ/ВК за стеной холла' },
       { id: 'B', rooms: '2к', area: 56.2, price: 21900000, status: 'бронь', sub: 'Отделка white-box (MOCK) · Окна на юг · Стояки ОВ/ВК за стеной холла' },
       { id: 'C', rooms: '2к', area: 62.7, price: 24100000, status: 'свободна', sub: 'Отделка white-box (MOCK) · Окна на юг · Стояки ОВ/ВК за стеной холла' },
       { id: 'D', rooms: '3к', area: 84.1, price: 31800000, status: 'продана', sub: 'Отделка white-box (MOCK) · Окна на юг · Стояки ОВ/ВК за стеной холла' }]
    : MOCK.objData[OBJ].rooms;
  document.getElementById('objname').textContent = META.name;
  document.getElementById('objmeta').innerHTML =
    `<b>${META.address}</b><br/>Кадастр: ${META.cadastre}<br/>${META.status}`;
  const fl = document.getElementById('floor');
  fl.max = FLOORS; fl.value = FLOORS;
  camera.position.set(W + 36, 26 + H * 0.55, D + 68);
  controls.target.set(0, 7 + H / 2, 0);
  document.getElementById('estimate').innerHTML = EST.map(e => {
    const d = e.done - (e.plan ?? e.done);
    const flag = d === 0 ? '<span style="color:#34d399">в срок</span>' : `<span style="color:#f87171">отставание ${-d} п.п.</span>`;
    return `<div class="card"><b>${e.stage}</b> — ${(e.sum / 1e6).toFixed(0)} млн ₸ · факт ${e.done}% / план ${e.plan}% · ${flag}<div class="bar" style="position:relative"><div style="width:${e.done}%"></div><div style="position:absolute;top:-2px;left:${e.plan}%;width:2px;height:12px;background:#fbbf24"></div></div><div style="font-size:11px;color:#94a3b8;margin-top:4px">${e.mats || ''}</div></div>`;
  }).join('');
  const doneTasks = new Set(JSON.parse(localStorage.getItem('twin_tasks') || '[]'));
  const renderTasks = () => {
    document.getElementById('tasks').innerHTML = TASKS.map(t =>
      `<div class="card" style="margin:6px 0;${doneTasks.has(t.id) ? 'opacity:.55' : ''}"><label class="chk" style="margin:0;${doneTasks.has(t.id) ? 'text-decoration:line-through' : ''}"><input type="checkbox" data-t="${t.id}" ${doneTasks.has(t.id) ? 'checked' : ''}/> <b>${t.id}</b> · ${t.text} · <span style="color:${t.overdue ? '#f87171' : '#94a3b8'}">${t.due}</span></label><button data-g="${t.id}" style="margin-top:6px;width:100%;padding:6px;border-radius:8px;border:1px solid #2c3d5c;background:#16213a;color:#7dd3fc;cursor:pointer;font-size:12px">📍 Показать где</button></div>`).join('');
    const open = TASKS.filter(t => !doneTasks.has(t.id)).length;
    document.getElementById('taskcount').textContent = open;
    document.getElementById('st-open').textContent = open;
    document.querySelectorAll('#tasks input').forEach(c => c.onchange = () => {
      const was = c.checked;
      was ? doneTasks.add(c.dataset.t) : doneTasks.delete(c.dataset.t);
      localStorage.setItem('twin_tasks', JSON.stringify([...doneTasks]));
      renderTasks();
      updateCounts();
      const left = TASKS.filter(t => !doneTasks.has(t.id)).length;
      if (was) {
        alertBar(`✅ ${c.dataset.t} закрыто. Осталось заданий: ${left}`, 'good');
        document.getElementById('feedlist').innerHTML =
          `<div>✅ ${new Date().toTimeString().slice(0, 5)} — ${c.dataset.t} закрыто мастером (MOCK)</div>` +
          document.getElementById('feedlist').innerHTML;
      }
    });
    document.querySelectorAll('#tasks [data-g]').forEach(b => b.onclick = () => gotoTask(b.dataset.g));
  };
  renderTasks();
  updateCounts();
  document.getElementById('feedlist').innerHTML = MOCK.feed.map(f => `<div>🕐 ${f.t} — ${f.e}</div>`).join('');
  const avg = Math.round(EST.reduce((a, e) => a + e.done, 0) / EST.length;
  const lag = Math.max(...EST.map(e => (e.plan ?? e.done) - e.done));
  document.getElementById('st-ready').textContent = avg + '%';
  document.getElementById('st-lag').textContent = lag > 0 ? '−' + lag + ' п.п.' : '0';
  document.getElementById('daily').innerHTML =
    MOCK.sensors.map(s => `<div class="card"><b>${s.id}</b><br/>${s.val} · ${s.trend} · <b>${s.flag}</b></div>`).join('') +
    `<div class="card" style="border-color:#8a6d1c"><b>💰 Найдено денег (MOCK)</b><br/>Перерасход тепла ${MOCK.savings.heatPct}% ≈ <b>₸ ${(MOCK.savings.heatBase * MOCK.savings.heatPct / 100).toLocaleString('ru')}/мес</b><br/>Предотвращенная авария насоса ≈ <b>₸ ${MOCK.savings.pumpAvoid.toLocaleString('ru')}</b></div>` +
    `<div class="card"><b>Голос народа</b> — жалобы рядом с домом<br/>` + MOCK.appeals.map(a => `${a.theme} — ${a.count}`).join('<br/>') + `</div>`;

  buildTower(); resize(); buildEq(); buildUrban(); renderPred(); selectFloor(FLOORS); showNet('heat'); syncLayers();

  for (const n of ['water', 'heat', 'power', 'vent'])
    document.getElementById('btn-' + n).onclick = () => { state[n] = !state[n]; state[n] ? showNet(n) : syncLayers(); };
  document.getElementById('xray').onchange = (e) => { state.xray = e.target.checked; syncLayers(); syncSection(); };
  document.getElementById('struct').onchange = (e) => { state.struct = e.target.checked; syncLayers(); syncSection(); };
  document.getElementById('section').onchange = (e) => { state.section = e.target.checked; selectFloor(state.floor); };
  document.getElementById('dense').onchange = (e) => { state.dense = e.target.checked; denseMeshes.forEach(m => m.visible = state.dense); };
  document.getElementById('night').onchange = (e) => setNight(e.target.checked);
  document.getElementById('floor').oninput = (e) => selectFloor(+e.target.value);
  document.getElementById('q').addEventListener('keydown', e => { if (e.key === 'Enter') agent(e.target.value); });
  document.getElementById('q2').addEventListener('keydown', e => { if (e.key === 'Enter') agent(e.target.value); });
  document.querySelectorAll('#awidget .chips button').forEach(b => b.onclick = () => agent(b.dataset.a));
  const voice = (input, btn) => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { agent('статус'); document.getElementById('agentlog2').innerHTML += '<br/><span style="color:#f87171">🎤 не поддерживается в этом браузере — пиши текстом</span>'; return; }
    const r = new SR(); r.lang = 'ru-RU'; r.interimResults = false;
    btn.classList.add('live');
    r.onresult = (e) => { const t = e.results[0][0].transcript; input.value = t; agent(t); };
    r.onend = () => btn.classList.remove('live');
    r.onerror = () => btn.classList.remove('live');
    try { r.start(); } catch { btn.classList.remove('live'); }
  };
  document.getElementById('mic').onclick = () => voice(document.getElementById('q'), document.getElementById('mic'));
  document.getElementById('mic2').onclick = () => voice(document.getElementById('q2'), document.getElementById('mic2'));
  const aw = document.getElementById('awidget'), at = document.getElementById('atoggle');
  const setMini = (m) => { aw.classList.toggle('mini', m); at.textContent = m ? '⛶' : '—'; };
  at.onclick = (e) => { e.stopPropagation(); setMini(!aw.classList.contains('mini')); };
  aw.onclick = () => { if (aw.classList.contains('mini')) setMini(false); };
  document.getElementById('csv').onclick = exportCSV;
  document.getElementById('flood').onclick = floodDemo;
  document.getElementById('blackout').onclick = blackout;
  document.querySelectorAll('#objs button').forEach(b => {
    b.classList.toggle('hot', b.dataset.o === OBJ);
    b.onclick = () => { localStorage.setItem('twin_obj', b.dataset.o); location.reload(); };
  });
  document.querySelectorAll('#roles button').forEach(b => b.onclick = () => setRole(b.dataset.r));
  document.getElementById('chatlog').innerHTML =
    `<div>🧑‍🦱 <b>Мадина (эт 9):</b> здравствуйте, в подъезде лампочка моргает</div>` +
    `<div>🤖 <b>Дом:</b> принято! ⚡ Электрик Асхат вызван, придет: 3 часа ✅ (MOCK)</div>`;
  renderResTasks();
  const sendQc = () => { sendChat(document.getElementById('qc').value); document.getElementById('qc').value = ''; };
  document.getElementById('qcsend').onclick = sendQc;
  document.getElementById('qc').addEventListener('keydown', e => { if (e.key === 'Enter') sendQc(); });  document.getElementById('copyd').onclick = () => {
    const t = 'Fl-' + String(state.floor).padStart(2, '0') + ' (MOCK)';
    navigator.clipboard?.writeText(t);
    document.getElementById('floorinfo').innerHTML += `<br/><span style="color:#34d399">GUID ${t} скопирован</span>`;
  };
  document.getElementById('demoplay').onclick = demoPlay;
  document.getElementById('demoreset').onclick = () => { demoStop(); alertBar(''); setNight(false); state.xray = false; state.section = false; document.getElementById('section').checked = false; syncLayers(); selectFloor(FLOORS); showNet('heat'); };

  const ray = new THREE.Raycaster(), ptr = new THREE.Vector2();
  let downX = 0, downY = 0;
  renderer.domElement.addEventListener('pointerdown', (e) => { downX = e.clientX; downY = e.clientY; });
  renderer.domElement.addEventListener('click', (e) => {
    if (Math.hypot(e.clientX - downX, e.clientY - downY) > 6) return; // крутили — не клик
    const r = renderer.domElement.getBoundingClientRect();
    ptr.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    ptr.y = -((e.clientY - r.top) / r.height) * 2 + 1;
    ray.setFromCamera(ptr, camera);
    const hit = ray.intersectObjects(pickables, false)[0];
    if (!hit) return;
    markSelected(hit.object);
    const u = hit.object.userData;
    if (u.type === 'net') { showNet(u.net); flashSection('d-nets'); flashCard(document.getElementById('netinfo')); }
    else if (u.type === 'floor') { selectFloor(u.n); flashSection('d-floor'); flashCard(document.getElementById('floorinfo')); }
    else if (u.type === 'plot') { showPlot(u.own, u.name, u.pid); flashSection('d-plot'); flashCard(document.getElementById('parcelinfo')); }
    else if (u.type === 'eq') showEq(u.eq);
    else if (u.type === 'street') { showStreet(u.kind, u.id); flashCard(document.getElementById('streetinfo')); }
    else if (u.type === 'apt' && u.apt !== 'HALL') { showApt(u.floor, u.apt); flashSection('d-floor'); flashCard(document.getElementById('aptinfo')); }
  });

  const clock = new THREE.Clock();
  let last = 0;
  (function tick(t) {
    requestAnimationFrame(tick);
    if (!tickOn) return;
    if (t - last < 50) return; // ~20fps лимит для слабых машин
    last = t;
    const s = 1 + Math.sin(performance.now() / 300) * 0.12;
    pulseList.forEach(m => m.scale.setScalar(s));
    const dt = Math.min(clock.getDelta(), 0.05);
    for (const f of flows) {
      if (!f.dot.parent.visible) continue;
      f.t = (f.t + dt * f.speed) % 1;
      f.dot.position.set(f.x, 4 + f.t * H, f.z);
    }
    controls.update();
    renderer.render(scene, camera);
  })();
}
init();
