// One renderer, original-scale imported ruins, manifest collision and support data.
import * as THREE from 'three';
import { LEVEL } from './level.js';
import { loadAssetLevel } from './asset-level.js';
import { loadModel } from './model-assets.js';

function aabb(entry, index) {
  const [x, y, z] = entry.center;
  const [w, h, d] = entry.size;
  if (![x, y, z, w, h, d].every(Number.isFinite) || Math.min(w, h, d) <= 0) {
    throw new Error(`无效碰撞体: ${entry.name || index}`);
  }
  return {
    id: `${entry.name}-${index}`, name: entry.name, owner: entry.owner,
    minX: x - w / 2, maxX: x + w / 2,
    minY: y - h / 2, maxY: y + h / 2,
    minZ: z - d / 2, maxZ: z + d / 2,
  };
}

export function createEnvironment(container) {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(container.clientWidth || window.innerWidth, container.clientHeight || window.innerHeight);
  renderer.shadowMap.enabled = false;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x17110d);
  scene.fog = new THREE.Fog(0x302b27, 22, 55);
  scene.add(new THREE.HemisphereLight(0xe9edff, 0x91816e, 2.1));
  scene.add(new THREE.AmbientLight(0xffead1, 0.7));
  const sun = new THREE.DirectionalLight(0xfff1da, 1.8);
  sun.position.set(20, 28, 10);
  scene.add(sun);

  // Arrays retain their identity: callers must await ready before starting a run.
  const colliders = [];
  const surfaces = [];
  const cameraObstacles = [];
  const roots = [];
  const visibilityBands = [];
  let activeFloor = null;
  const hiddenMaterial = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
  let disposed = false;
  scene.userData.surfaces = surfaces;
  scene.userData.cameraObstacles = cameraObstacles;
  scene.surfaces = surfaces;

  function supportBox(entry, name) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...entry.size), hiddenMaterial);
    mesh.name = name;
    mesh.position.fromArray(entry.center);
    // Three.Raycaster intersects invisible meshes when explicitly supplied.
    mesh.visible = false;
    mesh.userData.walkable = true;
    scene.add(mesh);
    roots.push(mesh);
    surfaces.push(mesh);
    return mesh;
  }

  function rampSurface(stair) {
    // Corners are world coordinates; positive Y winding for downward raycasts.
    const points = stair.ramp_corners.flat();
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
    geometry.setIndex([0, 1, 2, 0, 2, 3]);
    geometry.computeVertexNormals();
    // Defensively enforce upward local face normals (no object-space rotation).
    const a = new THREE.Vector3().fromArray(points, 0);
    const b = new THREE.Vector3().fromArray(points, 3);
    const c = new THREE.Vector3().fromArray(points, 6);
    if (b.clone().sub(a).cross(c.clone().sub(a)).y < 0) {
      geometry.setIndex([0, 2, 1, 0, 3, 2]);
      geometry.computeVertexNormals();
    }
    const mesh = new THREE.Mesh(geometry, hiddenMaterial);
    mesh.name = `${stair.name}_ContinuousSupport`;
    mesh.visible = false;
    mesh.userData.walkable = true;
    scene.add(mesh);
    roots.push(mesh);
    surfaces.push(mesh);
  }

  const ready = Promise.all([
    loadAssetLevel(),
    loadModel('./ruins-environment.glb'),
    loadModel('./ruins-treasure-colliders.glb'),
  ]).then(([manifest, environment, proxies]) => {
    if (disposed) throw new Error('环境在资源加载完成前已被销毁');
    for (const key of ['colliders', 'floor_tiles', 'stairs', 'mesh_colliders', 'treasures']) {
      if (!Array.isArray(manifest[key])) throw new Error(`关卡清单缺少数组: ${key}`);
    }
    const model = environment.scene;
    model.name = 'Ruins_Environment';
    // Never recenter, rotate or rescale the glTF: its coordinates match the manifest.
    scene.add(model);
    roots.push(model);
    model.traverse((node) => {
      if (node.isLight) {
        node.castShadow = false;
        if (node.isPointLight) { node.intensity = Math.min(node.intensity, 14); node.distance = 7; node.decay = 2; }
      }
      if (!node.isMesh) return;
      node.castShadow = false;
      node.receiveShadow = false;
      const materials = Array.isArray(node.material) ? node.material : [node.material];
      for (const material of materials) {
        if (!material.transparent) { material.roughness = Math.max(material.roughness ?? 0.8, 0.85); material.metalness = 0; }
        if (material.transparent) { material.opacity = Math.min(material.opacity, 0.25); material.depthWrite = false; }
      }
      if (node.userData.collision !== false && materials.some((m) => !m.transparent)) {
        cameraObstacles.push(node);
      }
    });
    for (const treasure of LEVEL.treasures) {
      if (!scene.getObjectByName(treasure.visual_node)) {
        throw new Error(`环境GLB缺少宝藏根节点: ${treasure.visual_node}`);
      }
    }
    manifest.colliders.forEach((entry, index) => {
      // Triggers are damage volumes, never physical high walls.
      if (entry.isTrigger || entry.trigger_only || entry.type === 'TRIGGER') return;
      colliders.push(aabb(entry, index));
      supportBox(entry, `Support_${entry.name}_${index}`);
    });
    manifest.floor_tiles.forEach((tile, index) => supportBox(tile, `FloorSupport_${index}`));
    manifest.stairs.forEach(rampSurface);
    for (const entry of manifest.mesh_colliders.filter((item) => item.walkable)) {
      const mesh = proxies.scene.getObjectByName(entry.name);
      if (!mesh || !mesh.isMesh) throw new Error(`碰撞GLB缺少可行走网格: ${entry.name}`);
      // Freeze imported world geometry into identity-space for face-normal consumers.
      proxies.scene.updateMatrixWorld(true);
      const geometry = mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);
      const surface = new THREE.Mesh(geometry, hiddenMaterial);
      surface.name = `${entry.name}_Support`;
      surface.visible = false;
      surface.userData.walkable = true;
      scene.add(surface);
      roots.push(surface);
      surfaces.push(surface);
    }
    // Proxy source meshes are not displayed; their cloned support remains alive.
    release(proxies.scene);
    scene.updateMatrixWorld(true);
    model.traverse(node => {
      if (!node.isMesh) return;
      const decoration = /Hanging_Vine|Vine_Leaf|Wall_Moss|Moss_Mat|Stone_Tablet|Amber_.*_Gem/.test(node.name);
      if (decoration) { node.visible = false; node.userData.visualClutter = true; }
      const box = new THREE.Box3().setFromObject(node);
      visibilityBands.push({ node, minY: box.min.y, maxY: box.max.y, decoration });
    });
    // Remove hidden decorative leaves from camera collisions as well.
    for (let i = cameraObstacles.length - 1; i >= 0; i--) if (cameraObstacles[i].userData.visualClutter) cameraObstacles.splice(i, 1);
    scene.userData.levelManifest = manifest;
    return { scene, colliders, surfaces, cameraObstacles, manifest };
  }).catch((cause) => {
    const error = new Error(`遗迹环境加载失败，游戏不能启动: ${cause.message}`, { cause });
    console.error(error);
    throw error; // Explicit rejection: no old gray-box fallback.
  });

  function release(root) {
    const geometries = new Set();
    const materials = new Set();
    const textures = new Set();
    root.traverse((node) => {
      if (node.geometry) geometries.add(node.geometry);
      const list = node.material ? (Array.isArray(node.material) ? node.material : [node.material]) : [];
      for (const material of list) {
        materials.add(material);
        for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
      }
    });
    geometries.forEach((item) => item.dispose());
    textures.forEach((item) => item.dispose());
    materials.forEach((item) => { if (item !== hiddenMaterial) item.dispose(); });
  }

  function reset() { /* Static asset; gameplay modules own collection and hazards. */ }
  function update(dt, elapsed, playerSnapshot) {
    if (!playerSnapshot) return;
    const y = playerSnapshot.position.y;
    const floor = Math.max(-10, Math.min(0, Math.round(y / 5) * 5));
    if (floor === activeFloor) return;
    activeFloor = floor;
    // Cut away upper storeys only; support/collision proxies stay intact.
    // Never override treasure children, whose visibility belongs to collectibles.
    for (const band of visibilityBands) {
      if (band.decoration || /Treasure|Box_Gold|Gold_Glow/.test(band.node.name)) continue;
      band.node.visible = band.minY < floor + 3.8 && band.maxY > floor - 5.3;
    }
  }
  function resize(width, height) {
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  }
  function dispose() {
    if (disposed) return;
    disposed = true;
    for (const root of roots) { release(root); scene.remove(root); }
    hiddenMaterial.dispose();
    colliders.length = surfaces.length = cameraObstacles.length = 0;
    renderer.domElement.remove();
    renderer.dispose();
  }
  return { scene, renderer, ready, colliders, surfaces, cameraObstacles, reset, update, resize, dispose };
}
