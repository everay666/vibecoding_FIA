// B: imported articulated explorer; visual actions do not mutate session data.
import * as THREE from 'three';
import { PLAYER_ACTION as ACTION, GAME_EVENT } from './config.js';
import { loadModel, disposeModel } from './model-assets.js';

const WALK_SPEED = 3.5, RUN_SPEED = 6, GRAVITY = 24, HEIGHT = 1.79;

function resolveCollision(position, radius, colliders, bounds) {
  for (let pass = 0; pass < 4; pass++) {
    for (const box of colliders) {
      // Only solids overlapping the player's body block horizontal motion.
      // Walkable tops within a small step height can be mounted normally.
      if (box.isTrigger || box.trigger_only || box.minY >= position.y + HEIGHT - 0.03 || box.maxY <= position.y + 0.24) continue;
      const x = THREE.MathUtils.clamp(position.x, box.minX, box.maxX);
      const z = THREE.MathUtils.clamp(position.z, box.minZ, box.maxZ);
      const dx = position.x - x, dz = position.z - z;
      const distance = Math.hypot(dx, dz);
      if (distance >= radius) continue;
      if (distance > 0.000001) {
        position.x += dx * (radius - distance) / distance;
        position.z += dz * (radius - distance) / distance;
      } else {
        const faces = [
          { distance: position.x - box.minX, axis: 'x', value: box.minX - radius },
          { distance: box.maxX - position.x, axis: 'x', value: box.maxX + radius },
          { distance: position.z - box.minZ, axis: 'z', value: box.minZ - radius },
          { distance: box.maxZ - position.z, axis: 'z', value: box.maxZ + radius },
        ];
        faces.sort((a, b) => a.distance - b.distance);
        position[faces[0].axis] = faces[0].value;
      }
    }
    position.x = THREE.MathUtils.clamp(position.x, bounds.minX + radius, bounds.maxX - radius);
    position.z = THREE.MathUtils.clamp(position.z, bounds.minZ + radius, bounds.maxZ - radius);
  }
}

export function createPlayer({ scene, spawn }) {
  const group = new THREE.Group(); group.name = 'player-controller'; scene.add(group);
  const visual = new THREE.Group(); group.add(visual);
  const position = new THREE.Vector3(), velocity = new THREE.Vector2();
  const groundRay = new THREE.Raycaster();
  let yaw = 0, velY = 0, grounded = true, speed = 0;
  let action = ACTION.IDLE, forced = null, animTime = 0, stride = 0, landTimer = 0;
  let disposed = false, model = null, joints = {};
  const ready = loadModel('./explorer.glb').then(gltf => {
    if (disposed) { disposeModel(gltf.scene); return; }
    model = gltf.scene;
    visual.add(model);
    model.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(model);
    const scale = HEIGHT / box.getSize(new THREE.Vector3()).y;
    model.scale.setScalar(scale); model.position.y = -box.min.y * scale;
    // Asset boots/face point +Z; controller yaw=0 points -Z.
    model.rotation.y = Math.PI;
    for (const name of ['L_Shoulder', 'R_Shoulder', 'L_Hip', 'R_Hip', 'L_Knee', 'R_Knee', 'TorsoPivot', 'Head_Yaw']) {
      const node = model.getObjectByName(name);
      if (!node) throw new Error('人物模型缺少动作节点：' + name);
      joints[name] = { node, base: node.rotation.clone() };
    }
    model.traverse(object => { if (object.isMesh) { object.castShadow = false; object.receiveShadow = false; } });
    // Small overlapping joint caps close low-poly seam gaps while pivots move.
    const seamMaterial = new THREE.MeshStandardMaterial({ color: 0x80614a, roughness: 0.9 });
    for (const [name, radius] of [['L_Shoulder',0.075],['R_Shoulder',0.075],['L_Hip',0.078],['R_Hip',0.078],['L_Knee',0.065],['R_Knee',0.065]]) {
      const joint = joints[name].node;
      const cap = new THREE.Mesh(new THREE.SphereGeometry(radius, 10, 8), seamMaterial);
      cap.name = 'joint-seam-' + name; joint.add(cap);
    }
    pose();
  });
  function rotate(name, x = 0, z = 0) {
    const joint = joints[name]; if (!joint) return;
    joint.node.rotation.x += x; joint.node.rotation.z += z;
  }
  function pose() {
    visual.position.set(0, 0, 0); visual.rotation.set(0, 0, 0);
    for (const joint of Object.values(joints)) joint.node.rotation.copy(joint.base);
    if (action === ACTION.COLLECT) {
      const progress = forced ? 1 - forced.remaining / forced.duration : 1;
      const bend = Math.sin(Math.PI * THREE.MathUtils.clamp(progress, 0, 1));
      visual.position.y = -0.17 * bend;
      rotate('TorsoPivot', -0.35 * bend);
      rotate('L_Shoulder', -0.8 * bend); rotate('R_Shoulder', -1.15 * bend);
      rotate('L_Knee', 0.5 * bend); rotate('R_Knee', 0.5 * bend);
    } else if (action === ACTION.HURT) {
      visual.rotation.z = Math.sin(animTime * 24) * 0.1;
      rotate('L_Shoulder', -0.9); rotate('R_Shoulder', -0.9);
    } else if (action === ACTION.VICTORY) {
      rotate('L_Shoulder', 0, -2.5); rotate('R_Shoulder', 0, 2.5);
    } else if (!grounded) {
      rotate('L_Shoulder', 0, -0.5); rotate('R_Shoulder', 0, 0.5);
      rotate('L_Hip', -0.3); rotate('R_Hip', 0.35);
    } else if (speed > 0.1) {
      const swing = Math.sin(stride * Math.PI * 2) * (action === ACTION.RUN ? 0.48 : 0.32);
      rotate('L_Hip', swing); rotate('R_Hip', -swing);
      rotate('L_Shoulder', -swing); rotate('R_Shoulder', swing);
      visual.position.y = Math.abs(Math.sin(stride * Math.PI * 2)) * 0.025;
    } else visual.position.y = Math.sin(animTime * 2) * 0.01;
    if (landTimer > 0) visual.position.y -= landTimer * 0.3;
  }
  function reset(nextSpawn = spawn) {
    position.set(...nextSpawn.position); yaw = nextSpawn.yaw;
    velocity.set(0, 0); velY = 0; speed = 0; grounded = true;
    action = ACTION.IDLE; forced = null; animTime = 0; stride = 0; landTimer = 0;
    group.position.copy(position); group.rotation.set(0, yaw, 0); pose();
  }
  function supportAt(x, z, ceiling, surfaces) {
    groundRay.set(new THREE.Vector3(x, ceiling, z), new THREE.Vector3(0, -1, 0));
    groundRay.near = 0; groundRay.far = 100;
    const hits = groundRay.intersectObjects(surfaces, false);
    const hit = hits.find(item => item.face && item.face.normal.y > 0.05);
    return hit ? hit.point.y : -Infinity;
  }
  function update(dt, input, world) {
    dt = Math.min(0.05, Math.max(0, dt));
    const surfaces = world.surfaces || scene.userData.surfaces;
    const events = [];
    animTime += dt; landTimer = Math.max(0, landTimer - dt);
    if (forced) { forced.remaining -= dt; if (forced.remaining <= 0) forced = null; }
    const locked = !!forced?.lockMovement;
    const mx = input.moveX, my = input.moveY;
    const magnitude = Math.min(1, Math.hypot(mx, my));
    const dx = -Math.sin(world.cameraYaw) * my + Math.cos(world.cameraYaw) * mx;
    const dz = -Math.cos(world.cameraYaw) * my - Math.sin(world.cameraYaw) * mx;
    const length = Math.hypot(dx, dz);
    const targetSpeed = (input.sprintHeld ? RUN_SPEED : WALK_SPEED) * magnitude;
    const blend = 1 - Math.exp(-(magnitude > 0 ? 14 : 20) * dt);
    if (locked) velocity.set(0, 0);
    else {
      const target = new THREE.Vector2(dx, dz);
      if (length > 0) target.multiplyScalar(targetSpeed / length);
      velocity.lerp(target, blend);
      if (length > 0.001) {
        const targetYaw = Math.atan2(-dx, -dz);
        yaw += Math.atan2(Math.sin(targetYaw - yaw), Math.cos(targetYaw - yaw)) * (1 - Math.exp(-18 * dt));
      }
      if (input.jumpPressed && grounded) { velY = 6; grounded = false; events.push({ type: GAME_EVENT.JUMP }); }
    }
    const oldX = position.x, oldZ = position.z;
    const radius = world.playerRadius;
    const steps = Math.max(1, Math.ceil(Math.max(velocity.length(), Math.abs(velY)) * dt / Math.max(0.04, radius * 0.3)));
    for (let i = 0; i < steps; i++) {
      const subDt = dt / steps, oldY = position.y;
      position.x += velocity.x * subDt; position.z += velocity.y * subDt;
      resolveCollision(position, radius, world.colliders, world.bounds);
      const floor = surfaces ? supportAt(position.x, position.z, oldY + (grounded ? 0.25 : 0.02), surfaces) : 0;
      if (grounded && floor >= oldY - 0.28 && floor <= oldY + 0.25) {
        position.y = floor; velY = 0;
      } else {
        grounded = false; velY -= GRAVITY * subDt;
        let nextY = oldY + velY * subDt;
        // Ascending head collision against upper floor undersides and solid boxes.
        if (velY > 0) {
          for (const box of world.colliders) {
            if (box.isTrigger || position.x + radius <= box.minX || position.x - radius >= box.maxX || position.z + radius <= box.minZ || position.z - radius >= box.maxZ) continue;
            if (oldY + HEIGHT <= box.minY && nextY + HEIGHT >= box.minY) { nextY = box.minY - HEIGHT - 0.01; velY = 0; }
          }
        }
        if (velY <= 0 && floor <= oldY + 0.02 && nextY <= floor) {
          nextY = floor; velY = 0; grounded = true; landTimer = 0.18;
          events.push({ type: GAME_EVENT.LAND });
        }
        position.y = nextY;
      }
    }
    // A malformed gap must not leave the player falling forever.
    if (position.y < -25) { reset(); events.push({ type: GAME_EVENT.LAND }); }
    speed = dt > 0 ? Math.hypot(position.x - oldX, position.z - oldZ) / dt : 0;
    const oldStep = Math.floor(stride * 2);
    if (grounded) stride += speed * dt / 1.65;
    if (Math.floor(stride * 2) > oldStep && speed > 0.2) events.push({ type: GAME_EVENT.STEP });
    action = forced?.name || (!grounded ? (velY > 0 ? ACTION.JUMP : ACTION.FALL) : landTimer > 0 ? ACTION.LAND : speed > 0.1 ? (input.sprintHeld ? ACTION.RUN : ACTION.WALK) : ACTION.IDLE);
    group.position.copy(position); group.rotation.y = yaw; pose();
    return events;
  }
  function getSnapshot() { return { position: position.clone(), yaw, speed, grounded, action, controlLocked: !!forced?.lockMovement }; }
  function playAction(name, duration = 0.9, options = {}) {
    if (!Object.values(ACTION).includes(name) || !Number.isFinite(duration) || duration <= 0) return;
    forced = { name, duration, remaining: duration, lockMovement: options.lockMovement === true }; action = name;
    if (forced.lockMovement) { velocity.set(0, 0); speed = 0; } pose();
  }
  function dispose() { disposed = true; scene.remove(group); if (model) disposeModel(model); }
  reset();
  return { group, ready, reset, update, getSnapshot, playAction, dispose };
}
