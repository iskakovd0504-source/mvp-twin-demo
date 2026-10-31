import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

/* ------------------------------------------------------------------
   TWIN — procedural BIM stage
   One building. Two states. Scroll drives a clipping plane that turns
   the rendered tower into a construction / MEP model, floor by floor.
------------------------------------------------------------------- */

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

const PALETTE = {
  paper: 0xf2eee6,
  paperGround: 0xe5dfd3,
  ink: 0x111214,
  dark: 0x070b10,
  darkGround: 0x0a1017,
  glass: 0x1b2731,
  bronze: 0x3b342e,
  concrete: 0xd5cec1,
  core: 0x0d1318,
  bim: 0x8fe7ff,
  water: 0x38bdf8,
  heat: 0xfb7185,
  power: 0xfacc15,
  vent: 0xe879f9,
  accent: 0xb85c38,
};

const PODIUM = { w: 32, d: 26, h: 12, y: 6, floors: 3 };
const SEGMENTS = [
  { w: 22, d: 22, h: 46, y: 12, floors: 13 },
  { w: 19, d: 19, h: 38, y: 58, floors: 11 },
  { w: 16, d: 16, h: 30, y: 96, floors: 8 },
];
const CROWN = { w: 13, d: 13, h: 4.5, y: 128.25 };
const TOP = 138.5;

const CAMERA_KEYS = [
  { p: 0.0, pos: [58, 44, 210], target: [-13, 68, 0], fov: 34 },
  { p: 0.5, pos: [70, 54, 220], target: [-4, 68, 0], fov: 34.5 },
  { p: 1.0, pos: [64, 52, 214], target: [0, 70, 0], fov: 35 },
];

function makeFacadeTextures(renderer) {
  const size = 512;
  const cols = 4;
  const rows = 4;
  const base = document.createElement("canvas");
  base.width = size;
  base.height = size;
  const g = base.getContext("2d");

  const glow = document.createElement("canvas");
  glow.width = size;
  glow.height = size;
  const e = glow.getContext("2d");

  const grad = g.createLinearGradient(0, 0, size, size);
  grad.addColorStop(0, "#24313c");
  grad.addColorStop(0.45, "#152029");
  grad.addColorStop(1, "#0c1218");
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);

  e.fillStyle = "#000";
  e.fillRect(0, 0, size, size);

  const cw = size / cols;
  const ch = size / rows;

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const px = x * cw;
      const py = y * ch;
      const r = Math.random();

      if (r > 0.82) {
        const warm = g.createLinearGradient(px, py, px, py + ch);
        warm.addColorStop(0, "rgba(255, 197, 135, .34)");
        warm.addColorStop(1, "rgba(154, 96, 48, .06)");
        g.fillStyle = warm;
        g.fillRect(px + 3, py + 3, cw - 6, ch - 6);

        const eg = e.createLinearGradient(px, py, px, py + ch);
        eg.addColorStop(0, "rgba(255, 196, 128, .7)");
        eg.addColorStop(1, "rgba(255, 160, 80, .08)");
        e.fillStyle = eg;
        e.fillRect(px + 6, py + 6, cw - 12, ch - 12);
      } else if (r > 0.58) {
        g.fillStyle = "rgba(151, 191, 210, .09)";
        g.fillRect(px + 3, py + 3, cw - 6, ch - 6);
        e.fillStyle = "rgba(150, 210, 235, .16)";
        e.fillRect(px + 6, py + 6, cw - 12, ch - 12);
      } else {
        g.fillStyle = "rgba(4, 10, 14, .18)";
        g.fillRect(px + 3, py + 3, cw - 6, ch - 6);
      }

      // glass highlight
      g.fillStyle = "rgba(255, 255, 255, .035)";
      g.fillRect(px + 3, py + 3, cw - 6, 1);
    }
  }

  // mullions
  for (let i = 0; i <= cols; i++) {
    const x = i * cw;
    g.fillStyle = "rgba(4, 7, 10, .85)";
    g.fillRect(x - 3, 0, 6, size);
    g.fillStyle = "rgba(180, 196, 205, .11)";
    g.fillRect(x, 0, 1, size);
  }

  for (let i = 0; i <= rows; i++) {
    const y = i * ch;
    g.fillStyle = "rgba(3, 6, 8, .92)";
    g.fillRect(0, y - 4, size, 8);
    g.fillStyle = "rgba(190, 204, 212, .09)";
    g.fillRect(0, y, size, 1);
  }

  // diagonal reflection
  const refl = g.createLinearGradient(0, 0, size, size * 0.7);
  refl.addColorStop(0, "rgba(255,255,255,0)");
  refl.addColorStop(0.45, "rgba(255,255,255,.035)");
  refl.addColorStop(0.55, "rgba(255,255,255,.065)");
  refl.addColorStop(0.7, "rgba(255,255,255,0)");
  g.fillStyle = refl;
  g.fillRect(0, 0, size, size);

  const map = new THREE.CanvasTexture(base);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.anisotropy = renderer.capabilities.getMaxAnisotropy();

  const emissiveMap = new THREE.CanvasTexture(glow);
  emissiveMap.colorSpace = THREE.SRGBColorSpace;
  emissiveMap.wrapS = THREE.RepeatWrapping;
  emissiveMap.wrapT = THREE.RepeatWrapping;
  emissiveMap.anisotropy = renderer.capabilities.getMaxAnisotropy();

  return { map, emissiveMap };
}

function makeLabel(text, color = "#8fe7ff") {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.font = '500 38px "JetBrains Mono", monospace';
  ctx.fillStyle = color;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 8, 58);
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.4;
  ctx.fillRect(8, 86, 108, 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    depthTest: false,
  });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(17, 4.25, 1);
  return sprite;
}

function addBox(group, w, h, d, material, x, y, z, opts = {}) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = opts.cast !== false;
  mesh.receiveShadow = opts.receive !== false;
  group.add(mesh);
  return mesh;
}

function lineMaterial(color, opacity, clipping, additive = false) {
  const material = new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthWrite: false,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    clippingPlanes: clipping ? [clipping] : null,
  });
  material.clipShadows = true;
  return material;
}

function addLines(group, points, material) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(points, 3)
  );
  const lines = new THREE.LineSegments(geometry, material);
  group.add(lines);
  return lines;
}

/* ------------------------------------------------------------------
   Main stage
------------------------------------------------------------------- */

export function createStage(canvas) {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.8));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.02;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.localClippingEnabled = true;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(PALETTE.paper);
  scene.fog = new THREE.Fog(PALETTE.paper, 280, 620);

  const camera = new THREE.PerspectiveCamera(35, 1, 1, 1200);

  const pmrem = new THREE.PMREMGenerator(renderer);
  const envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
  scene.environment = envRT.texture;

  /* lights */
  const hemi = new THREE.HemisphereLight(0xfff7ea, 0x222a30, 0.85);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xffe8c9, 2.35);
  sun.position.set(78, 135, 86);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -120;
  sun.shadow.camera.right = 120;
  sun.shadow.camera.top = 180;
  sun.shadow.camera.bottom = -20;
  sun.shadow.camera.near = 40;
  sun.shadow.camera.far = 360;
  sun.shadow.bias = -0.0004;
  scene.add(sun);

  const fill = new THREE.DirectionalLight(0xa9d4ff, 0.7);
  fill.position.set(-90, 45, -70);
  scene.add(fill);

  const rim = new THREE.DirectionalLight(0xffffff, 0.9);
  rim.position.set(20, 55, -120);
  scene.add(rim);

  /* ------------------------------------------------------------------
     Materials + clipping
  ------------------------------------------------------------------- */

  const solidClip = new THREE.Plane(new THREE.Vector3(0, 1, 0), 2);
  const bimClip = new THREE.Plane(new THREE.Vector3(0, -1, 0), -2);
  const solidMaterials = [];
  const bimMaterials = [];

  const registerSolid = (material) => {
    material.clippingPlanes = [solidClip];
    material.clipShadows = true;
    solidMaterials.push(material);
    return material;
  };

  const registerBim = (material) => {
    material.clippingPlanes = [bimClip];
    material.clipShadows = true;
    bimMaterials.push(material);
    return material;
  };

  const baseTextures = makeFacadeTextures(renderer);

  const makeGlass = (floors) => {
    const map = baseTextures.map.clone();
    const emissiveMap = baseTextures.emissiveMap.clone();
    map.needsUpdate = true;
    emissiveMap.needsUpdate = true;
    map.repeat.set(1.25, floors / 4);
    emissiveMap.repeat.set(1.25, floors / 4);

    return registerSolid(
      new THREE.MeshPhysicalMaterial({
        map,
        emissiveMap,
        emissive: new THREE.Color(0xffd2a1),
        emissiveIntensity: 0.55,
        color: 0xffffff,
        metalness: 0.68,
        roughness: 0.14,
        clearcoat: 1,
        clearcoatRoughness: 0.08,
        envMapIntensity: 1.75,
        transparent: true,
        opacity: 0.93,
        side: THREE.FrontSide,
      })
    );
  };

  const concrete = registerSolid(
    new THREE.MeshStandardMaterial({
      color: PALETTE.concrete,
      roughness: 0.82,
      metalness: 0.02,
    })
  );

  const bronze = registerSolid(
    new THREE.MeshStandardMaterial({
      color: PALETTE.bronze,
      roughness: 0.38,
      metalness: 0.84,
      envMapIntensity: 1.2,
    })
  );

  const darkMetal = registerSolid(
    new THREE.MeshStandardMaterial({
      color: 0x161b1e,
      roughness: 0.42,
      metalness: 0.78,
    })
  );

  const coreMat = registerSolid(
    new THREE.MeshStandardMaterial({
      color: PALETTE.core,
      roughness: 0.55,
      metalness: 0.35,
    })
  );

  const balconyGlass = registerSolid(
    new THREE.MeshPhysicalMaterial({
      color: 0x9fd8e6,
      metalness: 0.2,
      roughness: 0.05,
      transparent: true,
      opacity: 0.36,
      side: THREE.DoubleSide,
      envMapIntensity: 2,
    })
  );

  /* A fine architectural outline keeps the tower readable when the
     stage turns dark before the BIM linework is fully revealed. */
  const solidEdgeMat = registerSolid(
    new THREE.LineBasicMaterial({
      color: 0xffd9b2,
      transparent: true,
      opacity: 0.22,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
  );

  const solidFloorMat = registerSolid(
    new THREE.LineBasicMaterial({
      color: 0xfff0dc,
      transparent: true,
      opacity: 0.14,
      depthWrite: false,
    })
  );

  /* context materials are faded out as BIM appears */
  const contextMat = new THREE.MeshStandardMaterial({
    color: 0xc7c0b4,
    roughness: 0.95,
    metalness: 0,
    transparent: true,
    opacity: 1,
  });
  const treeTrunkMat = new THREE.MeshStandardMaterial({
    color: 0x5c5347,
    roughness: 1,
    transparent: true,
    opacity: 1,
  });
  const treeCrownMat = new THREE.MeshStandardMaterial({
    color: 0x6d7b67,
    roughness: 1,
    transparent: true,
    opacity: 1,
  });

  const groundMat = new THREE.MeshStandardMaterial({
    color: PALETTE.paperGround,
    roughness: 1,
    metalness: 0,
  });
  const plazaMat = new THREE.MeshStandardMaterial({
    color: 0xded7ca,
    roughness: 1,
    metalness: 0,
  });

  /* ------------------------------------------------------------------
     Ground + context
  ------------------------------------------------------------------- */

  const model = new THREE.Group();
  scene.add(model);

  const envGroup = new THREE.Group();
  model.add(envGroup);

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(620, 620), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.02;
  ground.receiveShadow = true;
  envGroup.add(ground);

  const plaza = new THREE.Mesh(
    new THREE.CircleGeometry(54, 96),
    plazaMat
  );
  plaza.rotation.x = -Math.PI / 2;
  plaza.position.y = 0.005;
  plaza.receiveShadow = true;
  envGroup.add(plaza);

  const plazaRing = new THREE.Mesh(
    new THREE.RingGeometry(53.5, 54.2, 96),
    new THREE.MeshBasicMaterial({
      color: 0x8b8478,
      transparent: true,
      opacity: 0.38,
      side: THREE.DoubleSide,
    })
  );
  plazaRing.rotation.x = -Math.PI / 2;
  plazaRing.position.y = 0.012;
  envGroup.add(plazaRing);

  // low context massing
  const context = new THREE.Group();
  envGroup.add(context);
  const contextBoxes = [
    [-72, 8, -38, 26, 16, 20],
    [-86, 12, 18, 20, 24, 24],
    [-58, 5, 48, 24, 10, 18],
    [66, 7, -46, 30, 14, 22],
    [80, 11, 10, 22, 22, 26],
    [52, 4, 50, 30, 8, 17],
    [-16, 9, -72, 34, 18, 22],
    [34, 6, -84, 26, 12, 20],
  ];
  for (const [x, y, z, w, h, d] of contextBoxes) {
    addBox(context, w, h, d, contextMat, x, y, z, { cast: false });
  }

  // trees
  const trees = new THREE.Group();
  envGroup.add(trees);
  const trunkGeo = new THREE.CylinderGeometry(0.28, 0.4, 3.4, 6);
  const crownGeo = new THREE.IcosahedronGeometry(2.1, 1);
  const treePositions = [
    [-38, -32], [-28, -44], [-14, -50], [16, -48], [34, -38], [42, -18],
    [44, 12], [34, 36], [16, 45], [-8, 48], [-30, 40], [-44, 20], [-46, -6],
  ];
  for (const [x, z] of treePositions) {
    const trunk = new THREE.Mesh(trunkGeo, treeTrunkMat);
    trunk.position.set(x, 1.7, z);
    trunk.castShadow = true;
    trees.add(trunk);
    const crown = new THREE.Mesh(crownGeo, treeCrownMat);
    crown.position.set(x, 4.2, z);
    crown.scale.set(1, 1.1, 1);
    crown.castShadow = true;
    trees.add(crown);
  }

  /* ------------------------------------------------------------------
     Solid building
  ------------------------------------------------------------------- */

  const solid = new THREE.Group();
  model.add(solid);
  const glassMats = [];
  const floorBands = [];

  const addFloorBands = (w, d, y0, h, floors, material) => {
    for (let i = 0; i <= floors; i++) {
      const y = y0 + (i / floors) * h;
      const band = addBox(solid, w + 0.3, 0.12, d + 0.3, material, 0, y, 0, {
        cast: false,
        receive: false,
      });
      floorBands.push(band);
    }
  };

  const addFins = (w, d, y0, h) => {
    const finGeo = new THREE.BoxGeometry(0.22, h, 0.22);
    const corners = [
      [-w / 2, -d / 2], [w / 2, -d / 2], [-w / 2, d / 2], [w / 2, d / 2],
    ];
    for (const [x, z] of corners) {
      const fin = new THREE.Mesh(finGeo, bronze);
      fin.position.set(x, y0 + h / 2, z);
      fin.castShadow = true;
      solid.add(fin);
    }

    const count = Math.max(2, Math.round(w / 5.5));
    for (let i = 1; i < count; i++) {
      const x = -w / 2 + (i / count) * w;
      for (const z of [-d / 2, d / 2]) {
        const fin = new THREE.Mesh(finGeo, bronze);
        fin.position.set(x, y0 + h / 2, z);
        fin.castShadow = true;
        solid.add(fin);
      }
    }
    for (let i = 1; i < count; i++) {
      const z = -d / 2 + (i / count) * d;
      for (const x of [-w / 2, w / 2]) {
        const fin = new THREE.Mesh(finGeo, bronze);
        fin.position.set(x, y0 + h / 2, z);
        fin.castShadow = true;
        solid.add(fin);
      }
    }
  };

  const addBalconies = (w, d, y0, floors, floorH, side = 1) => {
    for (let i = 2; i < floors - 1; i += 3) {
      const y = y0 + i * floorH + 0.15;
      const slab = addBox(
        solid, w * 0.34, 0.16, 1.55, concrete, 0, y, side * (d / 2 + 0.75)
      );
      slab.castShadow = true;
      const rail = addBox(
        solid, w * 0.34, 1.0, 0.07, balconyGlass, 0, y + 0.58, side * (d / 2 + 1.48),
        { cast: false }
      );
      rail.castShadow = false;
    }
  };

  // podium
  const podiumGlass = makeGlass(PODIUM.floors);
  glassMats.push(podiumGlass);
  addBox(solid, PODIUM.w, PODIUM.h, PODIUM.d, podiumGlass, 0, PODIUM.y, 0);
  addFloorBands(PODIUM.w, PODIUM.d, PODIUM.y - PODIUM.h / 2, PODIUM.h, PODIUM.floors, bronze);

  // podium canopy
  addBox(solid, PODIUM.w + 4, 0.45, PODIUM.d + 4, concrete, 0, PODIUM.h + 0.2, 0);
  addBox(solid, PODIUM.w + 4.4, 0.08, PODIUM.d + 4.4, bronze, 0, PODIUM.h + 0.46, 0, { cast: false });

  // entrance
  addBox(solid, 12, 5.2, 0.4, darkMetal, 0, 2.6, PODIUM.d / 2 + 0.2, { cast: false });
  const entranceGlow = new THREE.Mesh(
    new THREE.BoxGeometry(10.6, 0.08, 0.08),
    new THREE.MeshBasicMaterial({ color: 0xffc58a })
  );
  entranceGlow.position.set(0, 5.3, PODIUM.d / 2 + 0.42);
  solid.add(entranceGlow);

  // main segments
  for (const seg of SEGMENTS) {
    const mat = makeGlass(seg.floors);
    glassMats.push(mat);
    addBox(solid, seg.w, seg.h, seg.d, mat, 0, seg.y + seg.h / 2, 0);
    addFloorBands(seg.w, seg.d, seg.y, seg.h, seg.floors, bronze);
    addFins(seg.w, seg.d, seg.y, seg.h);
    addBalconies(seg.w, seg.d, seg.y, seg.floors, seg.h / seg.floors, 1);
  }

  // core visible through glass
  addBox(solid, 8.6, 114, 8.6, coreMat, 0, 57, 0, { cast: false });
  for (let i = 0; i < 34; i++) {
    const y = 3.2 + i * 3.5;
    const slab = addBox(solid, 20.4, 0.16, 20.4, concrete, 0, y, 0, {
      cast: false,
      receive: false,
    });
    slab.material = concrete;
  }

  // crown + spire
  addBox(solid, CROWN.w, CROWN.h, CROWN.d, darkMetal, 0, CROWN.y, 0);
  for (let i = 0; i < 6; i++) {
    addBox(solid, CROWN.w + 0.2, 0.1, CROWN.d + 0.2, bronze, 0, CROWN.y - 1.8 + i * 0.6, 0, {
      cast: false,
      receive: false,
    });
  }
  const spire = new THREE.Mesh(
    new THREE.CylinderGeometry(0.13, 0.32, 8.2, 8),
    bronze
  );
  spire.position.set(0, 134.8, 0);
  spire.castShadow = true;
  solid.add(spire);
  const beacon = new THREE.Mesh(
    new THREE.SphereGeometry(0.32, 12, 12),
    new THREE.MeshBasicMaterial({ color: 0xff5a4e })
  );
  beacon.position.set(0, 139.0, 0);
  solid.add(beacon);

  // roof parapet
  addBox(solid, CROWN.w + 0.7, 0.55, CROWN.d + 0.7, concrete, 0, 130.5, 0, {
    cast: false,
  });

  /* Outline + floor lines over the solid massing. These are clipped
     together with the facade and give the tower a crisp silhouette in
     the dark render-to-BIM transition. */
  const outlinePoints = [];
  const floorLinePoints = [];

  const pushRect = (w, d, y, arr) => {
    const x = w / 2;
    const z = d / 2;
    arr.push(-x, y, -z, x, y, -z);
    arr.push(x, y, -z, x, y, z);
    arr.push(x, y, z, -x, y, z);
    arr.push(-x, y, z, -x, y, -z);
  };

  const pushVolume = (w, d, y0, h, arr) => {
    const x = w / 2;
    const z = d / 2;
    const y1 = y0 + h;
    pushRect(w, d, y0, arr);
    pushRect(w, d, y1, arr);
    arr.push(-x, y0, -z, -x, y1, -z);
    arr.push(x, y0, -z, x, y1, -z);
    arr.push(x, y0, z, x, y1, z);
    arr.push(-x, y0, z, -x, y1, z);
  };

  pushVolume(PODIUM.w, PODIUM.d, 0, PODIUM.h, outlinePoints);
  for (let i = 1; i <= PODIUM.floors; i++) {
    pushRect(PODIUM.w, PODIUM.d, (i / PODIUM.floors) * PODIUM.h, floorLinePoints);
  }

  for (const seg of SEGMENTS) {
    pushVolume(seg.w, seg.d, seg.y, seg.h, outlinePoints);
    for (let i = 1; i <= seg.floors; i++) {
      pushRect(seg.w, seg.d, seg.y + (i / seg.floors) * seg.h, floorLinePoints);
    }
  }

  pushVolume(CROWN.w, CROWN.d, CROWN.y - CROWN.h / 2, CROWN.h, outlinePoints);

  addLines(solid, outlinePoints, solidEdgeMat);
  addLines(solid, floorLinePoints, solidFloorMat);

  /* ------------------------------------------------------------------
     BIM model
  ------------------------------------------------------------------- */

  const bim = new THREE.Group();
  model.add(bim);

  const structMat = registerBim(lineMaterial(PALETTE.bim, 0.46));
  const structBright = registerBim(lineMaterial(PALETTE.bim, 0.95, null, true));
  const coreLineMat = registerBim(lineMaterial(0xffffff, 0.74));
  const dimMat = registerBim(lineMaterial(PALETTE.bim, 0.72));

  const structurePoints = [];
  const brightPoints = [];
  const corePoints = [];
  const dimPoints = [];

  const rectAt = (w, d, y, arr) => {
    const x = w / 2;
    const z = d / 2;
    arr.push(-x, y, -z, x, y, -z);
    arr.push(x, y, -z, x, y, z);
    arr.push(x, y, z, -x, y, z);
    arr.push(-x, y, z, -x, y, -z);
  };

  // slabs + columns + beams
  for (const seg of SEGMENTS) {
    const fh = seg.h / seg.floors;
    const x1 = -seg.w / 2;
    const x2 = seg.w / 2;
    const z1 = -seg.d / 2;
    const z2 = seg.d / 2;
    for (let i = 0; i <= seg.floors; i++) {
      const y = seg.y + i * fh;
      rectAt(seg.w, seg.d, y, i % 3 === 0 ? brightPoints : structurePoints);
      if (i % 2 === 0) {
        structurePoints.push(x1, y, 0, x2, y, 0);
        structurePoints.push(0, y, z1, 0, y, z2);
        for (const t of [-1 / 3, 1 / 3]) {
          structurePoints.push(t * seg.w, y, z1, t * seg.w, y, z2);
          structurePoints.push(x1, y, t * seg.d, x2, y, t * seg.d);
        }
      }
    }

    const colX = [-seg.w * 0.4, -seg.w * 0.14, seg.w * 0.14, seg.w * 0.4];
    const colZ = [-seg.d * 0.4, -seg.d * 0.14, seg.d * 0.14, seg.d * 0.4];
    for (const x of colX) {
      for (const z of colZ) {
        structurePoints.push(x, seg.y, z, x, seg.y + seg.h, z);
      }
    }

    // volume edges
    const x = seg.w / 2;
    const z = seg.d / 2;
    const y0 = seg.y;
    const y1 = seg.y + seg.h;
    brightPoints.push(
      -x, y0, -z, x, y0, -z, x, y0, -z, x, y0, z, x, y0, z, -x, y0, z, -x, y0, z, -x, y0, -z,
      -x, y1, -z, x, y1, -z, x, y1, -z, x, y1, z, x, y1, z, -x, y1, z, -x, y1, z, -x, y1, -z,
      -x, y0, -z, -x, y1, -z, x, y0, -z, x, y1, -z,
      -x, y0, z, -x, y1, z, x, y0, z, x, y1, z
    );
  }

  // podium
  for (let i = 0; i <= PODIUM.floors; i++) {
    const y = (i / PODIUM.floors) * PODIUM.h;
    rectAt(PODIUM.w, PODIUM.d, y, i === 0 ? brightPoints : structurePoints);
  }
  for (const x of [-PODIUM.w * 0.4, -PODIUM.w * 0.14, PODIUM.w * 0.14, PODIUM.w * 0.4]) {
    for (const z of [-PODIUM.d * 0.4, -PODIUM.d * 0.14, PODIUM.d * 0.14, PODIUM.d * 0.4]) {
      structurePoints.push(x, 0, z, x, PODIUM.h, z);
    }
  }

  // core
  const coreW = 8.6;
  const coreD = 8.6;
  const coreY0 = 0;
  const coreY1 = 126;
  const cx = coreW / 2;
  const cz = coreD / 2;
  for (const y of [coreY0, coreY1]) {
    corePoints.push(-cx, y, -cz, cx, y, -cz, cx, y, -cz, cx, y, cz, cx, y, cz, -cx, y, cz, -cx, y, cz, -cx, y, -cz);
  }
  for (const [x, z] of [[-cx, -cz], [cx, -cz], [cx, cz], [-cx, cz]]) {
    corePoints.push(x, coreY0, z, x, coreY1, z);
  }
  // core X bracing
  for (let y = 0; y < 126; y += 18) {
    corePoints.push(-cx, y, cz, cx, y + 18, cz, cx, y, cz, -cx, y + 18, cz);
  }

  // dimension lines
  for (const dimX of [-PODIUM.w / 2 - 8, PODIUM.w / 2 + 8]) {
    dimPoints.push(dimX, 0, 0, dimX, TOP, 0);
    for (let y = 0; y <= TOP; y += 10) {
      dimPoints.push(dimX - 1.2, y, 0, dimX + 1.2, y, 0);
    }
  }

  addLines(bim, structurePoints, structMat);
  addLines(bim, brightPoints, structBright);
  addLines(bim, corePoints, coreLineMat);
  addLines(bim, dimPoints, dimMat);

  // translucent floor plates
  const plateMat = registerBim(
    new THREE.MeshBasicMaterial({
      color: PALETTE.bim,
      transparent: true,
      opacity: 0.075,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
  );
  for (const seg of SEGMENTS) {
    const fh = seg.h / seg.floors;
    for (let i = 0; i <= seg.floors; i++) {
      const plate = new THREE.Mesh(
        new THREE.PlaneGeometry(seg.w, seg.d),
        plateMat
      );
      plate.rotation.x = -Math.PI / 2;
      plate.position.y = seg.y + i * fh;
      bim.add(plate);
    }
  }
  const podiumPlate = new THREE.Mesh(
    new THREE.PlaneGeometry(PODIUM.w, PODIUM.d),
    plateMat
  );
  podiumPlate.rotation.x = -Math.PI / 2;
  podiumPlate.position.y = 0.05;
  bim.add(podiumPlate);

  // MEP risers + branches
  const mepSpecs = [
    { color: PALETTE.water, x: -2.6, z: -1.2, dir: [1, 0], label: "ВК" },
    { color: PALETTE.heat, x: -1.1, z: -1.2, dir: [-1, 0], label: "ОВ" },
    { color: PALETTE.power, x: 1.1, z: 1.2, dir: [0, 1], label: "ЭО" },
    { color: PALETTE.vent, x: 2.6, z: 1.2, dir: [0, -1], label: "ВЕНТ" },
  ];

  for (const spec of mepSpecs) {
    const mat = registerBim(
      new THREE.MeshBasicMaterial({ color: spec.color, depthWrite: false })
    );
    const riser = new THREE.Mesh(
      new THREE.CylinderGeometry(0.14, 0.14, 126, 8),
      mat
    );
    riser.position.set(spec.x, 63, spec.z);
    bim.add(riser);

    for (let y = 8; y <= 120; y += 16) {
      const node = new THREE.Mesh(
        new THREE.SphereGeometry(0.3, 10, 10),
        mat
      );
      node.position.set(spec.x, y, spec.z);
      bim.add(node);
    }

    const branchMat = registerBim(lineMaterial(spec.color, 0.92));
    const branchPoints = [];
    for (let y = 12; y <= 120; y += 12) {
      const lenX = spec.dir[0] * 9.4;
      const lenZ = spec.dir[1] * 9.4;
      if (lenX !== 0) {
        branchPoints.push(spec.x, y, spec.z, spec.x + lenX, y, spec.z);
      } else {
        branchPoints.push(spec.x, y, spec.z, spec.x, y, spec.z + lenZ);
      }
    }
    addLines(bim, branchPoints, branchMat);
  }

  // ground BIM grid
  const bimGrid = new THREE.GridHelper(320, 64, PALETTE.bim, PALETTE.bim);
  bimGrid.position.y = 0.03;
  bimGrid.material.transparent = true;
  bimGrid.material.opacity = 0;
  bimGrid.material.depthWrite = false;
  bim.add(bimGrid);

  // plaza outline in BIM
  const plazaOutline = new THREE.Mesh(
    new THREE.RingGeometry(53.8, 54.1, 96),
    new THREE.MeshBasicMaterial({
      color: PALETTE.bim,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
  );
  plazaOutline.rotation.x = -Math.PI / 2;
  plazaOutline.position.y = 0.04;
  bim.add(plazaOutline);

  // labels
  const labels = new THREE.Group();
  labels.visible = false;
  model.add(labels);
  const labelTop = makeLabel("138.5 M");
  labelTop.position.set(-24, 136, 6);
  labels.add(labelTop);
  const labelLod = makeLabel("LOD 400");
  labelLod.position.set(6, 112, 12);
  labels.add(labelLod);
  const labelCore = makeLabel("CORE");
  labelCore.position.set(8, 66, 8);
  labels.add(labelCore);
  const labelMep = makeLabel("MEP / ВК · ОВ · ЭО", "#fb7185");
  labelMep.position.set(10, 34, 10);
  labels.add(labelMep);
  const labelIfc = makeLabel("IFC 4.3");
  labelIfc.position.set(-38, 96, 16);
  labels.add(labelIfc);
  const labelQto = makeLabel("5D / QTO", "#facc15");
  labelQto.position.set(26, 52, 16);
  labels.add(labelQto);

  /* ------------------------------------------------------------------
     Scan plane
  ------------------------------------------------------------------- */

  const scanGroup = new THREE.Group();
  scene.add(scanGroup);

  const scanPoints = [];
  const sw = PODIUM.w / 2 + 3;
  const sd = PODIUM.d / 2 + 3;
  scanPoints.push(
    -sw, 0, -sd, sw, 0, -sd,
    sw, 0, -sd, sw, 0, sd,
    sw, 0, sd, -sw, 0, sd,
    -sw, 0, sd, -sw, 0, -sd
  );
  const scanGeo = new THREE.BufferGeometry();
  scanGeo.setAttribute("position", new THREE.Float32BufferAttribute(scanPoints, 3));
  const scanLine = new THREE.LineSegments(
    scanGeo,
    new THREE.LineBasicMaterial({
      color: PALETTE.bim,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  scanGroup.add(scanLine);

  const scanPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(82, 82),
    new THREE.MeshBasicMaterial({
      color: PALETTE.bim,
      transparent: true,
      opacity: 0.11,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  scanPlane.rotation.x = -Math.PI / 2;
  scanGroup.add(scanPlane);

  const scanHalo = new THREE.Mesh(
    new THREE.RingGeometry(46, 58, 64),
    new THREE.MeshBasicMaterial({
      color: PALETTE.bim,
      transparent: true,
      opacity: 0.18,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  scanHalo.rotation.x = -Math.PI / 2;
  scanGroup.add(scanHalo);

  const scanLight = new THREE.PointLight(PALETTE.bim, 0, 90, 2);
  scanGroup.add(scanLight);

  scanGroup.visible = false;

  /* ------------------------------------------------------------------
     Progress + camera
  ------------------------------------------------------------------- */

  const groundLight = new THREE.Color(PALETTE.paperGround);
  const groundDark = new THREE.Color(PALETTE.darkGround);
  const plazaLight = new THREE.Color(0xded7ca);
  const plazaDark = new THREE.Color(0x0d151d);
  const bgLight = new THREE.Color(PALETTE.paper);
  const bgDark = new THREE.Color(PALETTE.dark);

  let targetProgress = 0;
  let progress = 0;
  let targetMouse = { x: 0, y: 0 };
  let mouse = { x: 0, y: 0 };
  let isMobile = false;
  let width = 1;
  let height = 1;

  const resize = () => {
    width = window.innerWidth;
    height = window.innerHeight;
    isMobile = width < 900;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isMobile ? 1.6 : 1.8));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };

  const applyProgress = (p) => {
    const t = smooth(0.02, 0.38, p);
    scene.background.copy(bgLight).lerp(bgDark, t);
    scene.fog.color.copy(bgLight).lerp(bgDark, t);

    groundMat.color.copy(groundLight).lerp(groundDark, t);
    plazaMat.color.copy(plazaLight).lerp(plazaDark, t);
    contextMat.opacity = 1 - t * 0.86;
    treeTrunkMat.opacity = 1 - t * 0.8;
    treeCrownMat.opacity = 1 - t * 0.8;
    plazaRing.material.opacity = 0.38 * (1 - t * 0.8);

    hemi.intensity = lerp(0.85, 0.36, t);
    sun.intensity = lerp(2.35, 1.0, t);
    fill.intensity = lerp(0.7, 0.45, t);
    rim.intensity = lerp(0.9, 2.0, t);

    const scanT = smooth(0.055, 0.945, p);
    const scanY = lerp(-2, TOP + 3, scanT);

    solidClip.constant = -scanY;
    bimClip.constant = scanY;

    scanGroup.visible = p > 0.008 && p < 0.992;
    scanGroup.position.y = scanY;
    scanLight.intensity = 12 * Math.sin(Math.PI * clamp(scanT, 0, 1));

    bimGrid.material.opacity = smooth(0.2, 0.78, p) * 0.26;
    plazaOutline.material.opacity = smooth(0.2, 0.78, p) * 0.55;

    const labelFade = smooth(0.46, 0.8, p);
    labels.visible = labelFade > 0.01;
    labels.children.forEach((label) => {
      label.material.opacity = labelFade;
    });

    // A little lift of the BIM plates for readability
    bim.position.y = smooth(0.45, 1, p) * 0.6;
  };

  const applyCamera = (p) => {
    let a = CAMERA_KEYS[0];
    let b = CAMERA_KEYS[CAMERA_KEYS.length - 1];
    for (let i = 0; i < CAMERA_KEYS.length - 1; i++) {
      if (p >= CAMERA_KEYS[i].p && p <= CAMERA_KEYS[i + 1].p) {
        a = CAMERA_KEYS[i];
        b = CAMERA_KEYS[i + 1];
        break;
      }
    }
    const local = b.p === a.p ? 0 : smooth(a.p, b.p, p);
    const mobileScale = isMobile ? 1.28 : 1;

    const px = lerp(a.pos[0], b.pos[0], local) * mobileScale + mouse.x * 3.2;
    const py = lerp(a.pos[1], b.pos[1], local) - mouse.y * 2.2;
    const pz = lerp(a.pos[2], b.pos[2], local) * mobileScale;

    const tx = lerp(a.target[0], b.target[0], local) + mouse.x * 1.2;
    const ty = lerp(a.target[1], b.target[1], local) - mouse.y * 0.8;
    const tz = lerp(a.target[2], b.target[2], local);

    camera.position.set(px, py, pz);
    camera.fov = lerp(a.fov, b.fov, local) + (isMobile ? 7 : 0);
    camera.updateProjectionMatrix();
    camera.lookAt(tx, ty, tz);

    model.position.x = isMobile ? 0 : 8;
    model.rotation.y =
      -0.58 +
      smooth(0, 1, p) * 1.28 +
      mouse.x * 0.035 +
      Math.sin(performance.now() * 0.00009) * 0.018;
  };

  const clock = new THREE.Clock();
  let raf = 0;

  const tick = () => {
    raf = requestAnimationFrame(tick);
    if (document.hidden) return;

    const dt = Math.min(clock.getDelta(), 0.05);
    const speed = reduce ? 1 : Math.min(1, dt * 5.5);
    progress += (targetProgress - progress) * speed;

    mouse.x += (targetMouse.x - mouse.x) * Math.min(1, dt * 5);
    mouse.y += (targetMouse.y - mouse.y) * Math.min(1, dt * 5);

    applyProgress(progress);
    applyCamera(progress);
    renderer.render(scene, camera);
  };

  const onResize = () => resize();
  window.addEventListener("resize", onResize, { passive: true });
  resize();
  tick();

  return {
    setProgress(value) {
      targetProgress = clamp(value, 0, 1);
    },
    setMouse(x, y) {
      targetMouse.x = clamp(x, -1, 1);
      targetMouse.y = clamp(y, -1, 1);
    },
    dispose() {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      renderer.dispose();
    },
  };
}

/* ------------------------------------------------------------------
   Mini project scenes
------------------------------------------------------------------- */

function miniMaterials() {
  const glass = new THREE.MeshPhysicalMaterial({
    color: 0x56717f,
    metalness: 0.5,
    roughness: 0.24,
    clearcoat: 1,
    clearcoatRoughness: 0.08,
    envMapIntensity: 1.05,
    emissive: 0x0a2230,
    emissiveIntensity: 0.6,
    transparent: true,
    opacity: 0.96,
  });
  const concrete = new THREE.MeshStandardMaterial({
    color: 0x9a9488,
    roughness: 0.86,
    metalness: 0.04,
  });
  const dark = new THREE.MeshStandardMaterial({
    color: 0x222a30,
    roughness: 0.42,
    metalness: 0.55,
  });
  const edge = new THREE.LineBasicMaterial({
    color: 0x9fe8ff,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
  });
  const warm = new THREE.MeshBasicMaterial({
    color: 0xffc58a,
    transparent: true,
    opacity: 0.8,
    depthWrite: false,
  });
  const ring = new THREE.MeshBasicMaterial({
    color: 0x8fe7ff,
    transparent: true,
    opacity: 0.26,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  return { glass, concrete, dark, edge, warm, ring };
}

function addMiniStrip(group, w, x, y, z, mat) {
  const strip = new THREE.Mesh(new THREE.BoxGeometry(w, 0.055, 0.035), mat);
  strip.position.set(x, y, z);
  group.add(strip);
  return strip;
}

function addMiniPlatform(group, radius, mats) {
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(radius, 64),
    new THREE.MeshStandardMaterial({
      color: 0x0d151c,
      roughness: 0.95,
      metalness: 0.12,
    })
  );
  disc.rotation.x = -Math.PI / 2;
  disc.position.y = 0.005;
  disc.receiveShadow = true;
  group.add(disc);

  const halo = new THREE.Mesh(
    new THREE.RingGeometry(radius * 0.94, radius, 64),
    mats.ring
  );
  halo.rotation.x = -Math.PI / 2;
  halo.position.y = 0.02;
  group.add(halo);

  const inner = new THREE.Mesh(
    new THREE.RingGeometry(radius * 0.56, radius * 0.575, 64),
    mats.ring
  );
  inner.rotation.x = -Math.PI / 2;
  inner.position.y = 0.022;
  inner.material = mats.ring.clone();
  inner.material.opacity = 0.09;
  group.add(inner);
}

function addMiniBox(group, w, h, d, mat, x, y, z, edgeMat) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry), edgeMat);
  edges.position.copy(mesh.position);
  group.add(edges);
  return mesh;
}

function buildMiniMassing(variant) {
  const mats = miniMaterials();
  const group = new THREE.Group();

  if (variant === "tower") {
    addMiniPlatform(group, 4.0, mats);
    addMiniBox(group, 6.2, 1.2, 5.4, mats.concrete, 0, 0.6, 0, mats.edge);
    addMiniBox(group, 3.5, 5.4, 3.5, mats.glass, 0, 3.9, 0, mats.edge);
    addMiniBox(group, 2.9, 4.2, 2.9, mats.glass, 0, 8.7, 0, mats.edge);
    addMiniBox(group, 2.2, 3.0, 2.2, mats.glass, 0, 12.3, 0, mats.edge);
    addMiniBox(group, 2.6, 0.5, 2.6, mats.dark, 0, 14.05, 0, mats.edge);

    for (let i = 0; i < 3; i++) {
      addMiniStrip(group, 4.9, 0, 0.32 + i * 0.34, 2.73, mats.warm);
    }
    for (let i = 0; i < 4; i++) {
      addMiniStrip(group, 2.55, 0, 2.25 + i * 1.25, 1.78, mats.warm);
    }
    for (let i = 0; i < 3; i++) {
      addMiniStrip(group, 2.05, 0, 7.45 + i * 1.2, 1.48, mats.warm);
    }
    for (let i = 0; i < 2; i++) {
      addMiniStrip(group, 1.45, 0, 11.5 + i * 1.2, 1.13, mats.warm);
    }

    for (let i = 0; i < 4; i++) {
      addMiniBox(group, 2.2, 0.08, 0.9, mats.concrete, 0, 2.6 + i * 1.7, 2.05, mats.edge);
    }
  } else if (variant === "campus") {
    addMiniPlatform(group, 4.4, mats);
    addMiniBox(group, 9.0, 0.8, 6.4, mats.concrete, 0, 0.4, 0, mats.edge);
    addMiniBox(group, 2.6, 4.2, 3.0, mats.glass, -3.0, 2.9, -0.3, mats.edge);
    addMiniBox(group, 2.3, 6.2, 2.6, mats.glass, 0, 3.9, 0, mats.edge);
    addMiniBox(group, 3.0, 3.4, 2.8, mats.glass, 3.2, 2.5, 0.2, mats.edge);
    addMiniBox(group, 1.2, 0.7, 2.2, mats.concrete, -1.5, 1.2, 1.5, mats.edge);
    addMiniBox(group, 1.2, 0.7, 2.2, mats.concrete, 1.6, 1.2, 1.5, mats.edge);
    addMiniBox(group, 6.8, 0.25, 0.16, mats.dark, 0, 4.55, 3.2, mats.edge);

    for (let i = 0; i < 3; i++) {
      addMiniStrip(group, 1.9, -3.0, 1.4 + i * 1.1, 1.22, mats.warm);
      addMiniStrip(group, 1.65, 0, 1.5 + i * 1.6, 1.32, mats.warm);
      addMiniStrip(group, 2.2, 3.2, 1.45 + i * 0.9, 1.62, mats.warm);
    }
  } else {
    addMiniPlatform(group, 4.4, mats);
    addMiniBox(group, 9.2, 0.7, 6.6, mats.concrete, 0, 0.35, 0, mats.edge);
    addMiniBox(group, 7.6, 2.4, 2.6, mats.glass, 0, 1.9, -0.6, mats.edge);
    addMiniBox(group, 2.6, 2.4, 3.4, mats.glass, -2.6, 1.9, 1.6, mats.edge);
    addMiniBox(group, 2.6, 2.4, 3.4, mats.glass, 2.6, 1.9, 1.6, mats.edge);
    addMiniBox(group, 2.4, 0.35, 2.2, mats.concrete, 0, 3.25, -0.2, mats.edge);
    addMiniBox(group, 3.2, 0.14, 0.14, mats.dark, 0, 3.55, 1.1, mats.edge);

    for (let i = 0; i < 2; i++) {
      addMiniStrip(group, 6.4, 0, 1.35 + i * 0.75, 0.72, mats.warm);
      addMiniStrip(group, 1.7, -2.6, 1.3 + i * 0.8, 3.32, mats.warm);
      addMiniStrip(group, 1.7, 2.6, 1.3 + i * 0.8, 3.32, mats.warm);
    }
  }

  return { group, mats };
}

function createMiniScene(canvas, variant) {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: "low-power",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.92;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 100);

  const envRT = new THREE.PMREMGenerator(renderer).fromScene(
    new RoomEnvironment(),
    0.04
  );
  scene.environment = envRT.texture;

  const hemi = new THREE.HemisphereLight(0xdff4ff, 0x0a0f14, 0.75);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xfff4e5, 1.7);
  sun.position.set(7, 12, 8);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -12;
  sun.shadow.camera.right = 12;
  sun.shadow.camera.top = 18;
  sun.shadow.camera.bottom = -8;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 40;
  scene.add(sun);

  const rim = new THREE.DirectionalLight(0x8fe7ff, 1.6);
  rim.position.set(-8, 6, -6);
  scene.add(rim);

  const fill = new THREE.DirectionalLight(0xffffff, 0.55);
  fill.position.set(-4, 4, 12);
  scene.add(fill);

  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(7.5, 64),
    new THREE.MeshStandardMaterial({
      color: 0x0b1218,
      roughness: 0.95,
      metalness: 0.12,
    })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.02;
  ground.receiveShadow = true;
  scene.add(ground);

  const grid = new THREE.GridHelper(18, 18, 0x2f6f7c, 0x2f6f7c);
  grid.position.y = 0.01;
  grid.material.transparent = true;
  grid.material.opacity = 0.12;
  grid.material.depthWrite = false;
  scene.add(grid);

  const { group } = buildMiniMassing(variant);
  group.position.y = 0.02;
  scene.add(group);

  const framing =
    {
      tower: { viewHeight: 17.5, centerY: 6.8 },
      campus: { viewHeight: 13.5, centerY: 3.4 },
      school: { viewHeight: 13, centerY: 1.9 },
    }[variant] || { viewHeight: 14, centerY: 3 };

  const viewDir = new THREE.Vector3(0.58, 0.3, 0.76).normalize();
  const viewDistance =
    framing.viewHeight / 2 / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  camera.position.set(
    viewDir.x * viewDistance,
    framing.centerY + viewDir.y * viewDistance,
    viewDir.z * viewDistance
  );
  camera.lookAt(0, framing.centerY, 0);

  let manualY = -0.55;
  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  let visible = false;
  let w = 1;
  let h = 1;
  let raf = 0;
  const clock = new THREE.Clock();

  const resize = () => {
    const rect = canvas.getBoundingClientRect();
    w = Math.max(1, rect.width);
    h = Math.max(1, rect.height);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };

  const tick = () => {
    raf = requestAnimationFrame(tick);
    if (!visible || document.hidden) return;

    const dt = Math.min(clock.getDelta(), 0.05);
    if (!dragging && !reduce) {
      manualY += dt * 0.12;
    }
    group.rotation.y += (manualY - group.rotation.y) * Math.min(1, dt * 8);
    group.position.y = 0.02 + Math.sin(performance.now() * 0.0007) * 0.04;
    renderer.render(scene, camera);
  };

  canvas.addEventListener("pointerdown", (event) => {
    dragging = true;
    lastX = event.clientX;
    lastY = event.clientY;
    canvas.setPointerCapture?.(event.pointerId);
  });

  canvas.addEventListener("pointermove", (event) => {
    if (!dragging) return;
    const dx = event.clientX - lastX;
    const dy = event.clientY - lastY;
    manualY += dx * 0.008;
    group.rotation.x = clamp(group.rotation.x + dy * 0.002, -0.12, 0.18);
    lastX = event.clientX;
    lastY = event.clientY;
  });

  const stopDrag = () => {
    dragging = false;
  };
  canvas.addEventListener("pointerup", stopDrag);
  canvas.addEventListener("pointercancel", stopDrag);
  canvas.addEventListener("pointerleave", stopDrag);

  const io = new IntersectionObserver(
    (entries) => {
      visible = entries[0]?.isIntersecting || false;
      if (visible) clock.getDelta();
    },
    { rootMargin: "160px" }
  );
  io.observe(canvas);

  const ro = new ResizeObserver(resize);
  ro.observe(canvas);

  resize();
  tick();
}

export function createMiniScenes() {
  document.querySelectorAll("canvas[data-mini]").forEach((canvas) => {
    createMiniScene(canvas, canvas.dataset.mini);
  });
}
