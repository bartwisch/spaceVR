/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import * as THREE from 'three';

import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Text } from 'troika-three-text';
import { XR_BUTTONS } from 'gamepad-wrapper';
import { gsap } from 'gsap';
import { init } from './init.js';

const bullets = {};
const forwardVector = new THREE.Vector3(0, 0, -1);
const bulletSpeed = 10;
const bulletTimeToLive = 1;

const blasterGroup = new THREE.Group();
const targets = [];

// Cowboy enemies
const cowboys = [];
let cowboyMixer = null;

// Mouse controls
let mouseBlaster = null;
let isMouseMode = false;
const mouse = new THREE.Vector2();
const raycaster = new THREE.Raycaster();

let score = 0;
const scoreText = new Text();
scoreText.fontSize = 0.52;
scoreText.font = 'assets/SpaceMono-Bold.ttf';
scoreText.position.z = -2;
scoreText.color = 0xffa276;
scoreText.anchorX = 'center';
scoreText.anchorY = 'middle';

let laserSound, scoreSound;

function updateScoreDisplay() {
	const clampedScore = Math.max(0, Math.min(9999, score));
	const displayScore = clampedScore.toString().padStart(4, '0');
	scoreText.text = displayScore;
	scoreText.sync();
}

function fireBullet(scene, position, quaternion) {
	// Play laser sound
	if (laserSound.isPlaying) laserSound.stop();
	laserSound.play();

	const bulletPrototype = blasterGroup.getObjectByName('bullet');
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
	}
}

function setupScene({ scene, camera, _renderer, _player, _controllers }) {
	const gltfLoader = new GLTFLoader();

	gltfLoader.load('assets/spacestation.glb', (gltf) => {
		scene.add(gltf.scene);
	});

	gltfLoader.load('assets/blaster.glb', (gltf) => {
		blasterGroup.add(gltf.scene);
		
		// Create mouse blaster for non-VR mode
		mouseBlaster = gltf.scene.clone();
		mouseBlaster.position.set(0.3, -0.3, -0.5);
		mouseBlaster.scale.setScalar(0.8);
	});

	gltfLoader.load('assets/target.glb', (gltf) => {
		for (let i = 0; i < 3; i++) {
			const target = gltf.scene.clone();
			target.position.set(
				Math.random() * 10 - 5,
				i * 2 + 1,
				-Math.random() * 5 - 5,
			);
			scene.add(target);
			targets.push(target);
		}
	});

	// Load cowboy enemy
	gltfLoader.load('assets/cowboy1.glb', (gltf) => {
		const cowboy = gltf.scene;
		cowboy.position.set(-3, 0, -8);
		cowboy.scale.setScalar(1.2);
		scene.add(cowboy);
		cowboys.push(cowboy);

		// Setup animation mixer for cowboy
		if (gltf.animations && gltf.animations.length > 0) {
			cowboyMixer = new THREE.AnimationMixer(cowboy);
			
			// Find and play wink animation (or first available animation)
			let winkAction = null;
			for (let animation of gltf.animations) {
				if (animation.name.toLowerCase().includes('wink') || 
					animation.name.toLowerCase().includes('wave') ||
					animation.name.toLowerCase().includes('greeting')) {
					winkAction = cowboyMixer.clipAction(animation);
					break;
				}
			}
			
			// If no wink animation found, use first animation
			if (!winkAction && gltf.animations.length > 0) {
				winkAction = cowboyMixer.clipAction(gltf.animations[0]);
			}
			
			if (winkAction) {
				winkAction.setLoop(THREE.LoopRepeat, Infinity);
				winkAction.play();
			}
		}
	});

	scene.add(scoreText);
	scoreText.position.set(0, 0.67, -1.44);
	scoreText.rotateX(-Math.PI / 3.3);
	updateScoreDisplay();

	// Load and set up positional audio
	const listener = new THREE.AudioListener();
	camera.add(listener);

	const audioLoader = new THREE.AudioLoader();
	laserSound = new THREE.PositionalAudio(listener);
	audioLoader.load('assets/laser.ogg', (buffer) => {
		laserSound.setBuffer(buffer);
		blasterGroup.add(laserSound);
	});

	scoreSound = new THREE.PositionalAudio(listener);
	audioLoader.load('assets/score.ogg', (buffer) => {
		scoreSound.setBuffer(buffer);
		scoreText.add(scoreSound);
	});

	// Setup mouse controls
	window.addEventListener('mousemove', (event) => {
		// Normalize mouse coordinates to -1 to +1
		mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
		mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
	});

	window.addEventListener('click', (_event) => {
		if (!isMouseMode && mouseBlaster) {
			// Switch to mouse mode and add blaster to camera
			isMouseMode = true;
			camera.add(mouseBlaster);
		}
		
		if (isMouseMode && mouseBlaster) {
			// Calculate direction from blaster to mouse cursor
			raycaster.setFromCamera(mouse, camera);
			const targetPoint = new THREE.Vector3();
			raycaster.ray.at(10, targetPoint); // Project 10 units forward
			
			// Get blaster world position
			const blasterWorldPosition = new THREE.Vector3();
			mouseBlaster.getWorldPosition(blasterWorldPosition);
			
			// Calculate direction vector from blaster to target point
			const _direction = targetPoint.clone().sub(blasterWorldPosition).normalize();
			
			// Create quaternion from direction
			const quaternion = new THREE.Quaternion();
			const matrix = new THREE.Matrix4();
			matrix.lookAt(blasterWorldPosition, targetPoint, camera.up);
			quaternion.setFromRotationMatrix(matrix);
			
			fireBullet(scene, blasterWorldPosition, quaternion);
		}
	});
}

function onFrame(
	delta,
	_time,
	{ scene, camera, _renderer, _player, controllers },
) {
	// Check if we're in VR mode or mouse mode
	const isInVR = controllers.right && controllers.right.gamepad;
	
	if (isInVR) {
		// VR Mode - hide mouse blaster if it's visible
		if (isMouseMode && mouseBlaster && mouseBlaster.parent === camera) {
			camera.remove(mouseBlaster);
			isMouseMode = false;
		}
		
		const { gamepad, raySpace, mesh } = controllers.right;
		if (!raySpace.children.includes(blasterGroup)) {
			raySpace.add(blasterGroup);
			mesh.visible = false;
		}
		if (gamepad.getButtonClick(XR_BUTTONS.TRIGGER)) {
			try {
				gamepad.getHapticActuator(0).pulse(0.6, 100);
			} catch {
				// do nothing
			}

			const blasterWorldPosition = new THREE.Vector3();
			const blasterWorldQuaternion = new THREE.Quaternion();
			blasterGroup.getWorldPosition(blasterWorldPosition);
			blasterGroup.getWorldQuaternion(blasterWorldQuaternion);
			
			fireBullet(scene, blasterWorldPosition, blasterWorldQuaternion);
		}
	} else {
		// Non-VR Mode - show mouse blaster if not already visible
		if (!isMouseMode && mouseBlaster && mouseBlaster.parent !== camera) {
			camera.add(mouseBlaster);
			isMouseMode = true;
		}
	}

	Object.values(bullets).forEach((bullet) => {
		if (bullet.userData.timeToLive < 0) {
			delete bullets[bullet.uuid];
			scene.remove(bullet);
			return;
		}
		const deltaVec = bullet.userData.velocity.clone().multiplyScalar(delta);
		bullet.position.add(deltaVec);
		bullet.userData.timeToLive -= delta;

		let bulletHit = false;

		// Check collision with targets
		if (!bulletHit) {
			targets
				.filter((target) => target.visible)
				.forEach((target) => {
					if (bulletHit) return;
					const distance = target.position.distanceTo(bullet.position);
					if (distance < 1) {
						bulletHit = true;
						delete bullets[bullet.uuid];
						scene.remove(bullet);

						gsap.to(target.scale, {
							duration: 0.3,
							x: 0,
							y: 0,
							z: 0,
							onComplete: () => {
								target.visible = false;
								setTimeout(() => {
									target.visible = true;
									target.position.x = Math.random() * 10 - 5;
									target.position.z = -Math.random() * 5 - 5;

									// Scale back up the target
									gsap.to(target.scale, {
										duration: 0.3,
										x: 1,
										y: 1,
										z: 1,
									});
								}, 1000);
							},
						});

						score += 10;
						updateScoreDisplay();
						if (scoreSound.isPlaying) scoreSound.stop();
						scoreSound.play();
					}
				});
		}

		// Check collision with cowboys
		if (!bulletHit) {
			cowboys.forEach((cowboy, index) => {
				if (bulletHit) return;
				const distance = cowboy.position.distanceTo(bullet.position);
				if (distance < 1.5) {
					bulletHit = true;
					delete bullets[bullet.uuid];
					scene.remove(bullet);
					scene.remove(cowboy);
					cowboys.splice(index, 1);

					score += 50;
					updateScoreDisplay();
					if (scoreSound.isPlaying) scoreSound.stop();
					scoreSound.play();
				}
			});
		}
	});
	
	// Update cowboy animation
	if (cowboyMixer) {
		cowboyMixer.update(delta);
	}
	
	gsap.ticker.tick(delta);
}

init(setupScene, onFrame);
