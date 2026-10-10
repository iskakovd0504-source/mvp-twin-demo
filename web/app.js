// Twin 3D — ЖК 20 этажей в духе BIM: каркас + фасад + стояки ОВ/ВК/ЭО/вент, смета по этажам.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

let MOCK = null;
const FLOORS = 20, FH = 3.1;
const state = { water: true, heat: true, power: true, vent: true, struct: true, xray: false, floor: 20, section: false, night: false, apt: null };
const APTS = [
  { id: 'A', rooms: '1к', area: 38.4, price: 15200000, status: 'свободна' },
  { id: 'B', rooms: '2к', area: 56.2, price: 21900000, status: 'бронь' },
  { id: 'C', rooms: '2к', area: 62.7, price: 24100000, status: 'свободна' },
  { id: 'D', rooms: '3к', area: 84.1, price: 31800000, status: 'продана' },
];
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
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
container.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x070d1a);
scene.fog = new THREE.Fog(0x070d1a, 180, 420);

const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1200);
camera.position.set(70, 62, 88);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 26, 0);
controls.maxPolarAngle = Math.PI / 2.05;
controls.autoRotate = true;
controls.autoRotateSpeed = 0.45;
controls.addEventListener('start', () => { controls.autoRotate = false; });

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

const H = FLOORS * FH; // ~62м
const W = 34, D = 20;

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
    pl.position.set(lx, 7, lz); scene.add(pl);
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
  for (let i = 0; i < 4; i++) {
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.5, 10, 10), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    groups[net].add(dot);
    flows.push({ dot, x, z, t: Math.random(), speed: 0.05 + Math.random() * 0.04 });
  }
}

function buildTower() {
  for (const k of ['water', 'heat', 'power', 'vent', 'struct', 'facade']) {
    groups[k] = new THREE.Group(); scene.add(groups[k]);
  }
  ground();

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
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x7dd3fc, roughness: 0.15, metalness: 0.55, transparent: true, opacity: 0.55 });
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

  // стояки в шахте (пучок как на 1-м референсе: маджента/желтый/голубой)
  riser(4.5, -2, 0.42, 0xe879f9, 'vent');
  riser(5.4, -2, 0.34, 0xfacc15, 'power');
  riser(6.3, -2, 0.38, 0xfb7185, 'heat');
  riser(7.2, -2, 0.34, 0x38bdf8, 'water');
  riser(4.5, 0.2, 0.3, 0x22d3ee, 'water');
  riser(5.4, 0.2, 0.3, 0xf97316, 'heat');

  // наружные вводы от границы участка к стилобату
  const intro = (z, y, c, net) => {
    const curve = new THREE.CatmullRomCurve3(
      [new THREE.Vector3(-60, y, z), new THREE.Vector3(-25, y, z), new THREE.Vector3(-W / 2 - 4, y, z * 0.3)]);
    const m = new THREE.Mesh(new THREE.TubeGeometry(curve, 32, 0.4, 8),
      new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.4 }));
    m.userData = { type: 'net', net }; groups[net].add(m); pickables.push(m);
  };
  intro(14, 0.6, 0x38bdf8, 'water');
  intro(20, 0.9, 0xfb7185, 'heat');
  intro(-24, 1.2, 0xfacc15, 'power');
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
  // 4 квартиры: перегородки + цветные подложки пола
  const cols = [-12.75, -4.25, 4.25, 12.75];
  APTS.forEach((a, i) => {
    const cx = cols[i];
    const patch = new THREE.Mesh(new THREE.BoxGeometry(7.6, 0.12, D - 3),
      new THREE.MeshStandardMaterial({ color: APT_COLORS[a.id], transparent: true, opacity: 0.35, roughness: 1 }));
    patch.position.set(cx, y + 0.32, 0);
    patch.userData = { type: 'apt', floor: n, apt: a.id };
    sectionGroup.add(patch); pickables.push(patch);
    // межквартирные стены
    if (i > 0) wall(0.25, FH - 0.6, D - 2, cx - 4.2, 0, a.id);
    // комната/кухня внутри
    wall(3.4, FH - 0.6, 0.22, cx + 0.4, -2, a.id);
    wall(0.22, FH - 0.6, 4.5, cx - 1, 3.5, a.id);
    // кровать + диван + кухня (условная мебель)
    const bed = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.7, 3.2),
      new THREE.MeshStandardMaterial({ color: 0x64748b }));
    bed.position.set(cx - 1.8, y + 0.6, -5); sectionGroup.add(bed);
    const sofa = new THREE.Mesh(new THREE.BoxGeometry(3, 0.8, 1.2),
      new THREE.MeshStandardMaterial({ color: 0x475569 }));
    sofa.position.set(cx + 1, y + 0.65, 5.5); sectionGroup.add(sofa);
    const kit = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1, 1),
      new THREE.MeshStandardMaterial({ color: 0x94a3b8 }));
    kit.position.set(cx + 0.4, y + 0.75, -7.5); sectionGroup.add(kit);
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
  lampLights.forEach(l => { l.intensity = on ? 220 : 0; });
}

function showApt(floor, id) {
  const a = APTS.find(x => x.id === id);
  if (!a) return;
  state.apt = id;
  const k = 1 + (floor > 14 ? 0.12 : 0) + floor * 0.004;
  const price = Math.round(a.price * k / 100000) / 10;
  document.getElementById('aptinfo').innerHTML =
    `<b>Квартира ${a.id} · ${a.rooms} · эт ${floor}</b> — ${a.area} м² · ₸ ${price} млн · <b>${a.status}</b><br/>` +
    `Отделка white-box (MOCK) · Окна на юг · Стояки ОВ/ВК за стеной холла · GUID: Apt-${floor}${a.id}…`;
}

function selectFloor(n) {
  state.floor = n;
  document.getElementById('floor').value = n;
  document.getElementById('floorv').textContent = n === 0 ? 'стилобат' : n === -1 ? 'ядро' : 'эт ' + n;
  if (n > 0) {
    const c = floorCalc(n);
    document.getElementById('floorinfo').innerHTML =
      `<b>Этаж ${n}</b> · ${c.cost}<br/>Бетон ${c.concrete} · Арматура ${c.rebar}<br/>Фасад ${c.facade} · Трубы ${c.pipes} · Кабель ${c.cable}<br/><span style="color:#94a3b8">GUID: Fl-${String(n).padStart(2, '0')}… (MOCK, ведомость в пилоте)</span>`;
    controls.target.set(0, 7 + (n - 1) * FH, 0);
  } else if (n === 0) {
    document.getElementById('floorinfo').innerHTML = `<b>Стилобат</b> — коммерция, ИТП, насосная, паркинг −1. Смета укрупненно: ₸ 410 млн (MOCK).`;
  } else {
    document.getElementById('floorinfo').innerHTML = `<b>Ядро</b> — 3 лифта + лестница, стояки ОВ/ВК/ЭО/ДУ. Клик по цветному стояку — сеть.`;
  }
  // подсветка выбранной плиты
  floorMeshes.forEach(m => {
    if (m.material.emissive && m.userData.type === 'floor')
      m.material.emissive.setHex(m.userData.n === n ? 0x0ea5e9 : (state.night && groups.facade.children.includes(m) ? 0xffc873 : 0x000000)),
      m.material.emissiveIntensity = m.userData.n === n ? 0.45 : (state.night && groups.facade.children.includes(m) ? 0.55 : 0);
  });
  buildSection(n);
}

function showNet(net) {
  const rows = MOCK.networks[net].lines.map(l =>
    `<div style="margin-top:6px;border-top:1px solid #334155;padding-top:6px"><b>${l.id}</b> — ${l.state}<br/>` +
    Object.entries(l).filter(([k]) => k !== 'id' && k !== 'state').map(([k, v]) => `${k}: ${v}`).join(' · ') + `</div>`).join('');
  document.getElementById('netinfo').innerHTML =
    `<b>${{ water: 'ВК · вода', heat: 'ОВ · тепло', power: 'ЭО · свет', vent: 'Вентиляция ДУ' }[net]}</b>${rows}`;
  for (const [nn, g] of Object.entries(groups)) {
    if (!['water', 'heat', 'power', 'vent'].includes(nn)) continue;
    g.children.forEach(o => { if (o.material && o.material.emissive) o.material.emissiveIntensity = (nn === net ? 1.2 : 0.5); });
  }
}

function agent(q) {
  q = (q || '').toLowerCase();
  const log = document.getElementById('agentlog');
  if (q.includes('перерасход')) { showNet('heat'); selectFloor(17); alertBar('ОВ перерасход +14% · эт 14–20 · поручение ИТП 24ч');
    log.innerHTML = `<b>Агент:</b> перерасход ОВ эт 14–20 (+14%). Поручение наладчику ИТП, 24ч. Этаж 17 подсвечен. (MOCK)`;
  } else if (q.includes('авари')) { showNet('power'); alertBar('Перегруз паркинг 91% · БКТП · зона отключения −1');
    log.innerHTML = `<b>Агент:</b> риск — паркинг перегруз 91% (зарядки). Зона отключения: паркинг −1 (расчет в пилоте).`;
  } else if (q.includes('поручен')) {
    alertBar('');
    log.innerHTML = `<b>Агент:</b> открытых 5, просрочено 2 — фасад эт 9, витраж стилобата (MOCK).`;
  } else if (q.includes('статус')) {
    alertBar('');
    log.innerHTML = `<b>Картина дня:</b> каркас 64%, фасад 38%, инженерия 22%. Риски: ИТП, насос ХВС-2, шум после 22:00.`;
  } else if (q.includes('убор')) {
    alertBar('');
    log.innerHTML = `<b>Агент:</b> грязь на выезде КПП — 3 обращения. Поручение подрядчику (MOCK).`;
  } else { alertBar(''); log.innerHTML = `<b>Агент:</b> понимаю: авария / перерасход / поручение / статус / уборка. Полный LLM — в пилоте.`; }
}

function alertBar(t) {
  const b = document.getElementById('alertbar');
  if (!t) { b.classList.remove('on'); b.textContent = ''; return; }
  b.textContent = '⚠ ' + t;
  b.classList.add('on');
  clearTimeout(alertBar._t);
  alertBar._t = setTimeout(() => b.classList.remove('on'), 9000);
}

function exportCSV() {
  const rows = [['stage', 'sum_mln', 'done_pct'], ...MOCK.estimate.map(e => [e.stage, Math.round(e.sum / 1e6), e.done])];
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
    [0, () => { selectFloor(20); showNet('heat'); }],
    [1200, () => selectFloor(17)],
    [2600, () => { state.xray = true; syncLayers(); syncSection(); }],
    [4000, () => { state.xray = false; syncLayers(); state.section = true; document.getElementById('section').checked = true; selectFloor(12); }],
    [5600, () => showApt(12, 'B')],
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
  for (const n of ['water', 'heat', 'power', 'vent'])
    document.getElementById('btn-' + n).classList.toggle('on', state[n]);
}

async function init() {
  MOCK = await (await fetch('mock.json')).json();
  document.getElementById('objname').textContent = MOCK.object.name;
  document.getElementById('objmeta').innerHTML =
    `<b>${MOCK.object.address}</b><br/>Кадастр: ${MOCK.object.cadastre}<br/>${MOCK.object.status}`;
  document.getElementById('estimate').innerHTML = MOCK.estimate.map(e =>
    `<div class="card"><b>${e.stage}</b> — ${(e.sum / 1e6).toFixed(0)} млн ₸ · ${e.done}%<div class="bar"><div style="width:${e.done}%"></div></div></div>`).join('');
  document.getElementById('daily').innerHTML =
    MOCK.sensors.map(s => `<div class="card"><b>${s.id}</b><br/>${s.val} · ${s.trend} · <b>${s.flag}</b></div>`).join('') +
    `<div class="card"><b>Голос стройки</b><br/>` + MOCK.appeals.map(a => `${a.theme} — ${a.count}`).join('<br/>') + `</div>`;

  buildTower(); resize(); selectFloor(20); showNet('heat'); syncLayers();

  for (const n of ['water', 'heat', 'power', 'vent'])
    document.getElementById('btn-' + n).onclick = (e) => { state[n] = !state[n]; syncLayers(); };
  document.getElementById('xray').onchange = (e) => { state.xray = e.target.checked; syncLayers(); syncSection(); };
  document.getElementById('struct').onchange = (e) => { state.struct = e.target.checked; syncLayers(); syncSection(); };
  document.getElementById('section').onchange = (e) => { state.section = e.target.checked; selectFloor(state.floor); };
  document.getElementById('night').onchange = (e) => setNight(e.target.checked);
  document.getElementById('floor').oninput = (e) => selectFloor(+e.target.value);
  document.getElementById('q').addEventListener('keydown', e => { if (e.key === 'Enter') agent(e.target.value); });
  document.getElementById('csv').onclick = exportCSV;
  document.getElementById('copyd').onclick = () => {
    const t = 'Fl-' + String(state.floor).padStart(2, '0') + ' (MOCK)';
    navigator.clipboard?.writeText(t);
    document.getElementById('floorinfo').innerHTML += `<br/><span style="color:#34d399">GUID ${t} скопирован</span>`;
  };
  document.getElementById('demoplay').onclick = demoPlay;
  document.getElementById('demoreset').onclick = () => { demoStop(); alertBar(''); setNight(false); state.xray = false; state.section = false; document.getElementById('section').checked = false; syncLayers(); selectFloor(20); showNet('heat'); };

  const ray = new THREE.Raycaster(), ptr = new THREE.Vector2();
  renderer.domElement.addEventListener('click', (e) => {
    const r = renderer.domElement.getBoundingClientRect();
    ptr.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    ptr.y = -((e.clientY - r.top) / r.height) * 2 + 1;
    ray.setFromCamera(ptr, camera);
    const hit = ray.intersectObjects(pickables, false)[0];
    if (!hit) return;
    const u = hit.object.userData;
    if (u.type === 'net') showNet(u.net);
    else if (u.type === 'floor') selectFloor(u.n);
    else if (u.type === 'apt' && u.apt !== 'HALL') showApt(u.floor, u.apt);
  });

  const clock = new THREE.Clock();
  (function tick() {
    requestAnimationFrame(tick);
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
