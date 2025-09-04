/**
 * Weapons System Module
 * Handles machine gun, bullets, and weapon switching functionality
 */

import * as THREE from 'three';
import { emitFlamethrowerParticles } from './particles.js';

// Constants
export const bullets = {};
export const forwardVector = new THREE.Vector3(0, 0, -1);
export const bulletSpeed = 15;
export const bulletTimeToLive = 3;
export const HAND_DISTANCE_THRESHOLD = 0.5;

// Weapon groups
export const blasterGroup = new THREE.Group();
export const blueBlasterGroup = new THREE.Group();
export const weapons = [blasterGroup, blueBlasterGroup];

// Machine gun state
export let machineGun = null;
export let machineGunMount = null;
export let isBothHandsOnGun = false;
export let machineGunFiring = false;
export let machineGunFireRate = 0.1;
export let lastMachineGunShot = 0;
export let leftHandOnGun = false;
export let rightHandOnGun = false;
export let currentWeapon = 0;

// Setters for module state
export function setMachineGun(gun) {
    machineGun = gun;
}

export function setMachineGunMount(mount) {
    machineGunMount = mount;
}

export function setCurrentWeapon(weapon) {
    currentWeapon = weapon;
}

export function createStationaryMachineGun(player) {
    // Create machine gun mount/base (initial position)
    const mountGeometry = new THREE.CylinderGeometry(0.3, 0.4, 0.2, 8);
    const mountMaterial = new THREE.MeshLambertMaterial({ color: 0x444444 });
    machineGunMount = new THREE.Mesh(mountGeometry, mountMaterial);
    machineGunMount.position.set(0, 0.8, -1.5);
    player.add(machineGunMount);
    
    // Create machine gun body
    const gunBodyGeometry = new THREE.BoxGeometry(0.15, 0.15, 1.2);
    const gunMaterial = new THREE.MeshLambertMaterial({ color: 0x666666 });
    machineGun = new THREE.Mesh(gunBodyGeometry, gunMaterial);
    
    // Create gun barrel
    const barrelGeometry = new THREE.CylinderGeometry(0.03, 0.03, 0.6, 8);
    const barrelMaterial = new THREE.MeshLambertMaterial({ color: 0x333333 });
    const barrel = new THREE.Mesh(barrelGeometry, barrelMaterial);
    barrel.rotation.z = Math.PI / 2;
    barrel.position.z = 0.4;
    machineGun.add(barrel);
    
    // Create left grip handle
    const leftGripGeometry = new THREE.CylinderGeometry(0.03, 0.03, 0.15, 8);
    const leftGrip = new THREE.Mesh(leftGripGeometry, gunMaterial);
    leftGrip.position.set(-0.2, -0.05, -0.3);
    leftGrip.rotation.x = Math.PI / 4;
    machineGun.add(leftGrip);
    
    // Create right grip handle  
    const rightGrip = new THREE.Mesh(leftGripGeometry, gunMaterial);
    rightGrip.position.set(0.2, -0.05, -0.3);
    rightGrip.rotation.x = Math.PI / 4;
    machineGun.add(rightGrip);
    
    // Create trigger area (invisible collision box)
    const triggerGeometry = new THREE.BoxGeometry(0.5, 0.2, 0.6);
    const triggerMaterial = new THREE.MeshBasicMaterial({ 
        color: 0x00ff00, 
        transparent: true, 
        opacity: 0.0
    });
    const triggerZone = new THREE.Mesh(triggerGeometry, triggerMaterial);
    triggerZone.position.set(0, -0.1, -0.2);
    machineGun.add(triggerZone);
    
    // Store reference for hand detection
    machineGun.userData = {
        leftGripPosition: leftGrip.position.clone(),
        rightGripPosition: rightGrip.position.clone(),
        triggerZone: triggerZone,
        barrelTip: new THREE.Vector3(0, 0, 0.7),
        isGrabbed: false,
        grabbedBy: null
    };
    
    // Mount gun to base initially
    machineGun.position.set(0, 0, 0);
    machineGunMount.add(machineGun);
    machineGunMount.scale.set(1, 1, 1);
    
    console.log('Stationary machine gun created');
}

export function checkHandsOnMachineGun(controllers) {
    if (!machineGun || !controllers.left || !controllers.right) {
        leftHandOnGun = false;
        rightHandOnGun = false;
        isBothHandsOnGun = false;
        return;
    }
    
    // Check if the gun is currently grabbed
    if (machineGun.userData.isGrabbed) {
        updateGrabbedGunPosition(controllers);
        return;
    }
    
    // Calculate world positions of grip handles
    const leftGripLocal = machineGun.userData.leftGripPosition.clone();
    const rightGripLocal = machineGun.userData.rightGripPosition.clone();
    
    machineGun.localToWorld(leftGripLocal);
    machineGun.localToWorld(rightGripLocal);
    
    // Check left hand distance to left grip
    let leftHandPos = new THREE.Vector3();
    if (controllers.left.raySpace) {
        controllers.left.raySpace.getWorldPosition(leftHandPos);
        const leftDistance = leftHandPos.distanceTo(leftGripLocal);
        leftHandOnGun = leftDistance < HAND_DISTANCE_THRESHOLD;
    }
    
    // Check right hand distance to right grip  
    let rightHandPos = new THREE.Vector3();
    if (controllers.right.raySpace) {
        controllers.right.raySpace.getWorldPosition(rightHandPos);
        const rightDistance = rightHandPos.distanceTo(rightGripLocal);
        rightHandOnGun = rightDistance < HAND_DISTANCE_THRESHOLD;
    }
    
    // Both hands must be on gun to operate
    isBothHandsOnGun = leftHandOnGun && rightHandOnGun;
    
    // Check for grabbing
    if (isBothHandsOnGun && !machineGun.userData.isGrabbed) {
        grabMachineGun(controllers);
    }
    
    // Visual feedback
    if (isBothHandsOnGun) {
        machineGun.material.color.setHex(0x00ff00);
    } else if (leftHandOnGun || rightHandOnGun) {
        machineGun.material.color.setHex(0xffaa00);
    } else {
        machineGun.material.color.setHex(0x666666);
    }
}

function grabMachineGun(controllers) {
    machineGun.userData.isGrabbed = true;
    machineGun.userData.grabbedBy = { left: controllers.left, right: controllers.right };
    machineGunMount.remove(machineGun);
    machineGun.userData.originalParent = machineGunMount;
    machineGun.userData.initialPosition = machineGun.getWorldPosition(new THREE.Vector3());
    machineGun.userData.initialQuaternion = machineGun.getWorldQuaternion(new THREE.Quaternion());
    console.log('Machine gun grabbed!');
}

function updateGrabbedGunPosition(controllers) {
    if (!machineGun.userData.isGrabbed) return;
    
    const leftHandPos = new THREE.Vector3();
    const rightHandPos = new THREE.Vector3();
    
    if (controllers.left.raySpace) {
        controllers.left.raySpace.getWorldPosition(leftHandPos);
    }
    
    if (controllers.right.raySpace) {
        controllers.right.raySpace.getWorldPosition(rightHandPos);
    }
    
    const centerPos = new THREE.Vector3();
    centerPos.addVectors(leftHandPos, rightHandPos).multiplyScalar(0.5);
    
    const handDirection = new THREE.Vector3();
    handDirection.subVectors(rightHandPos, leftHandPos).normalize();
    
    const targetQuaternion = new THREE.Quaternion();
    const upVector = new THREE.Vector3(0, 1, 0);
    targetQuaternion.setFromRotationMatrix(
        new THREE.Matrix4().lookAt(new THREE.Vector3(0, 0, 0), handDirection, upVector)
    );
    
    machineGun.position.copy(centerPos);
    machineGun.quaternion.slerp(targetQuaternion, 0.1);
    
    const leftGripLocal = machineGun.userData.leftGripPosition.clone();
    const rightGripLocal = machineGun.userData.rightGripPosition.clone();
    machineGun.localToWorld(leftGripLocal);
    machineGun.localToWorld(rightGripLocal);
    
    const leftDistance = leftHandPos.distanceTo(leftGripLocal);
    const rightDistance = rightHandPos.distanceTo(rightGripLocal);
    
    if (leftDistance > HAND_DISTANCE_THRESHOLD * 2 || rightDistance > HAND_DISTANCE_THRESHOLD * 2) {
        releaseMachineGun();
    }
}

export function releaseMachineGun() {
    if (!machineGun.userData.isGrabbed) return;
    machineGun.userData.isGrabbed = false;
    machineGun.userData.grabbedBy = null;
    console.log('Machine gun released!');
}

export function fireMachineGun(scene, time, controllers) {
    if (!isBothHandsOnGun || !machineGun) return;
    
    if (time - lastMachineGunShot < machineGunFireRate) return;
    
    const bulletGeometry = new THREE.SphereGeometry(0.02);
    const bulletMaterial = new THREE.MeshBasicMaterial({ color: 0xffff00 });
    const bullet = new THREE.Mesh(bulletGeometry, bulletMaterial);
    
    const barrelTipWorld = machineGun.userData.barrelTip.clone();
    machineGun.localToWorld(barrelTipWorld);
    bullet.position.copy(barrelTipWorld);
    
    const gunDirection = new THREE.Vector3(0, 0, 1);
    machineGun.localToWorld(gunDirection);
    gunDirection.sub(machineGun.position).normalize();
    
    gunDirection.x += (Math.random() - 0.5) * 0.1;
    gunDirection.y += (Math.random() - 0.5) * 0.1;
    
    bullet.userData = {
        velocity: gunDirection.clone().multiplyScalar(25),
        timeToLive: 3,
        startTime: time
    };
    
    scene.add(bullet);
    if (!bullets) window.bullets = {};
    bullets[bullet.uuid] = bullet;
    
    lastMachineGunShot = time;
    
    // Visual muzzle flash effect
    const flashGeometry = new THREE.SphereGeometry(0.1);
    const flashMaterial = new THREE.MeshBasicMaterial({ 
        color: 0xffff00,
        transparent: true,
        opacity: 0.8
    });
    const muzzleFlash = new THREE.Mesh(flashGeometry, flashMaterial);
    muzzleFlash.position.copy(barrelTipWorld);
    scene.add(muzzleFlash);
    
    setTimeout(() => {
        scene.remove(muzzleFlash);
    }, 50);
    
    // Haptic feedback
    if (controllers && controllers[0] && controllers[0].gamepad) {
        controllers[0].gamepad.getHapticActuator(0).pulse(0.3, 100);
    }
    if (controllers && controllers[1] && controllers[1].gamepad) {
        controllers[1].gamepad.getHapticActuator(0).pulse(0.3, 100);
    }
    
    console.log('Machine gun fired!');
}

export function fireBullet(scene, position, quaternion, laserSound, flamethrowerSound) {
    if (currentWeapon === 1) {
        // Flamethrower mode
        if (flamethrowerSound && !flamethrowerSound.isPlaying) {
            flamethrowerSound.play();
        }
        
        const directionVector = forwardVector.clone().applyQuaternion(quaternion);
        emitFlamethrowerParticles(position, directionVector, scene);
    } else {
        // Regular bullet mode
        if (laserSound.isPlaying) laserSound.stop();
        laserSound.play();

        const currentBlasterGroup = weapons[currentWeapon];
        const bulletPrototype = currentBlasterGroup.getObjectByName('bullet');
        
        if (bulletPrototype) {
            const bullet = bulletPrototype.clone();
            scene.add(bullet);
            bullet.position.copy(position);
            bullet.quaternion.copy(quaternion);

            const directionVector = forwardVector
                .clone()
                .applyQuaternion(bullet.quaternion);
            bullet.userData = {
                velocity: directionVector.multiplyScalar(bulletSpeed),
                timeToLive: bulletTimeToLive,
            };
            bullets[bullet.uuid] = bullet;
        } else {
            // Create bullet dynamically
            const bulletGeometry = new THREE.SphereGeometry(0.05, 8, 8);
            const bulletMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
            const bullet = new THREE.Mesh(bulletGeometry, bulletMaterial);
            
            scene.add(bullet);
            bullet.position.copy(position);
            bullet.quaternion.copy(quaternion);

            const directionVector = forwardVector
                .clone()
                .applyQuaternion(bullet.quaternion);
            bullet.userData = {
                velocity: directionVector.multiplyScalar(bulletSpeed),
                timeToLive: bulletTimeToLive,
            };
            bullets[bullet.uuid] = bullet;
        }
    }
}

export function updateBullets(delta, scene) {
    Object.values(bullets).forEach((bullet) => {
        if (bullet.userData.timeToLive < 0) {
            console.log('Bullet TTL expired, removing bullet:', bullet.uuid);
            delete bullets[bullet.uuid];
            scene.remove(bullet);
            return;
        }
        const deltaVec = bullet.userData.velocity.clone().multiplyScalar(delta);
        bullet.position.add(deltaVec);
        bullet.userData.timeToLive -= delta;
    });
}
