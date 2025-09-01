/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

// All (namespace) imports first
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import * as THREE from 'three';
// Multiple imports next, sorted by imported identifier (ESLint sort-imports)
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { Text } from 'troika-three-text';
import { XR_BUTTONS } from 'gamepad-wrapper';
import { gsap } from 'gsap';
import { init } from './init.js';

const bullets = {};
const forwardVector = new THREE.Vector3(0, 0, -1);
const bulletSpeed = 15; // Increased speed
const bulletTimeToLive = 3; // Increased TTL to 3 seconds

const blasterGroup = new THREE.Group();
const targets = [];

// Cowboy enemies
const cowboys = [];
const cowboyMixers = [];
let cowboyGltf = null;
let spawnPending = false; // Flag to track if a spawn is already pending

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

function spawnCowboy(scene) {
	if (!cowboyGltf) {
		console.log('No cowboy GLTF loaded yet');
		return;
	}

	console.log('Spawning cowboy...');
	
	// Properly clone the GLTF scene with animations using SkeletonUtils
	const cowboy = SkeletonUtils.clone(cowboyGltf.scene);
	
	// Set random position like targets
	cowboy.position.set(
		Math.random() * 10 - 5,    // Random X: -5 to +5
		Math.random() * 3,        // Random Y: 0 to +3
		-Math.random() * 5 - 5    // Random Z: -10 to -5
	);
	cowboy.scale.setScalar(1.2);
	scene.add(cowboy);
	cowboys.push(cowboy);
	
	console.log('Cowboy added to scene at position:', cowboy.position);
	console.log('Total cowboys:', cowboys.length);

	// Setup animation mixer for this cowboy
	if (cowboyGltf.animations && cowboyGltf.animations.length > 0) {
		const mixer = new THREE.AnimationMixer(cowboy);
		const cowboyData = {
			mixer: mixer,
			animations: cowboyGltf.animations,
			currentAction: null
		};
		cowboyMixers.push(cowboyData);
		
		console.log('Setting up animations, found:', cowboyGltf.animations.length, 'animations');
		
		// Find and play wink animation (or first available animation)
		let idleAction = null;
		let deathAction = null;
		
		for (let animation of cowboyGltf.animations) {
			const animName = animation.name.toLowerCase();
			if (animName.includes('wink') || animName.includes('wave') || animName.includes('greeting')) {
				idleAction = mixer.clipAction(animation);
			} else if (animName.includes('dead')) {
				deathAction = mixer.clipAction(animation);
			}
		}
		
		// If no specific animations found, use first animation as idle
		if (!idleAction && cowboyGltf.animations.length > 0) {
			idleAction = mixer.clipAction(cowboyGltf.animations[0]);
			console.log('Using first animation as idle:', cowboyGltf.animations[0].name);
		}
		
		if (idleAction) {
			idleAction.setLoop(THREE.LoopRepeat, Infinity);
			idleAction.play();
			cowboyData.currentAction = idleAction;
			console.log('Idle animation started');
		}
		
		// Store death animation reference
		cowboy.userData = {
			idleAction: idleAction,
			deathAction: deathAction,
			hasPlayedDeath: false
		};
		
	} else {
		console.log('No animations found for cowboy');
	}
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
		cowboyGltf = gltf;
		// Spawn 3 cowboys initially
		for (let i = 0; i < 3; i++) {
			spawnCowboy(scene);
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
			
			// Calculate direction vector from blaster to target point (used for quaternion calculation)
			targetPoint.clone().sub(blasterWorldPosition).normalize();
			
			// Create quaternion from direction
			const quaternion = new THREE.Quaternion();
			const matrix = new THREE.Matrix4();
			matrix.lookAt(blasterWorldPosition, targetPoint, camera.up);
			quaternion.setFromRotationMatrix(matrix);
			
			fireBullet(scene, blasterWorldPosition, quaternion);
		}
	});
}

function checkAndSpawnCowboys(scene) {
	// Only spawn new cowboys when we have less than 3 cowboys
	// and there isn't already a spawn pending
	if (cowboys.length < 3 && !spawnPending) {
		spawnPending = true;
		console.log('Spawning new cowboy to maintain count, setting spawnPending = true');
		setTimeout(() => {
			spawnCowboy(scene);
			spawnPending = false;
			console.log('Cowboy spawned, setting spawnPending = false');
		}, 100); // Small delay to ensure removal is complete
	} else {
		console.log('Not spawning new cowboy - cowboys.length:', cowboys.length, 'spawnPending:', spawnPending);
	}
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
			console.log('Bullet TTL expired, removing bullet:', bullet.uuid);
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
						console.log('Target collision detected! Distance:', distance);
						console.log('Target position:', target.position);
						console.log('Bullet position:', bullet.position);
						bulletHit = true;
						console.log('Removing bullet from bullets object and scene');
						delete bullets[bullet.uuid];
						scene.remove(bullet);

						console.log('Starting target removal animation');
						gsap.to(target.scale, {
							duration: 0.3,
							x: 0,
							y: 0,
							z: 0,
							onComplete: () => {
								console.log('Target scale animation complete, hiding target');
								target.visible = false;
								setTimeout(() => {
									console.log('Respawning target');
									target.visible = true;
									target.position.x = Math.random() * 10 - 5;
									target.position.z = -Math.random() * 5 - 5;

									// Scale back up the target
									console.log('Animating target scale back to normal');
									gsap.to(target.scale, {
										duration: 0.3,
										x: 1,
										y: 1,
										z: 1,
										onComplete: () => {
											console.log('Target respawn animation complete');
										}
									});
								}, 1000);
							},
						});

						score += 10;
						updateScoreDisplay();
						if (scoreSound.isPlaying) scoreSound.stop();
						scoreSound.play();
						console.log('Target hit processing complete');
					}
				});
		}

		// Check collision with cowboys
		if (!bulletHit) {
			cowboys.forEach((cowboy, index) => {
				if (bulletHit) {
					console.log('Skipping cowboy check - bullet already hit something');
					return;
				}
				const distance = cowboy.position.distanceTo(bullet.position);
				// Increased hitbox size for better collision detection
				if (distance < 2.0) {
					console.log('Cowboy collision detected! Distance:', distance, 'Index:', index);
					console.log('Cowboy position:', cowboy.position);
					console.log('Bullet position:', bullet.position);
					console.log('Cowboys array length before removal:', cowboys.length);
					bulletHit = true;
					
					// Play death animation if available
					const cowboyData = cowboyMixers[index];
					if (cowboyData && cowboyData.mixer && cowboy.userData && cowboy.userData.deathAction && !cowboy.userData.hasPlayedDeath) {
						console.log('Playing death animation in place');
						cowboy.userData.hasPlayedDeath = true;
						
						// Stop current idle animation
						if (cowboy.userData.idleAction) {
							cowboy.userData.idleAction.stop();
						}
						
						// Play death animation
						const deathAction = cowboy.userData.deathAction;
						deathAction.setLoop(THREE.LoopOnce, 1);
						deathAction.clampWhenFinished = true;
						deathAction.play();
						
						// Remove bullet but keep cowboy visible during death animation
						console.log('Removing bullet from bullets object and scene');
						delete bullets[bullet.uuid];
						scene.remove(bullet);
						
						// After death animation completes, remove cowboy
						setTimeout(() => {
							console.log('Death animation complete, removing cowboy from scene');
							scene.remove(cowboy);
							cowboys.splice(index, 1);
							console.log('Cowboys array length after removal:', cowboys.length);
							
							// Remove corresponding mixer data
							if (cowboyMixers[index]) {
								cowboyMixers.splice(index, 1);
							}

							// Check if we need to spawn a new cowboy
							checkAndSpawnCowboys(scene);
						}, 4000); // Wait 4 seconds total for death animation
						
					} else {
						// No death animation available, remove immediately
						console.log('No death animation available, removing immediately');
						console.log('Removing bullet from bullets object and scene');
						delete bullets[bullet.uuid];
						scene.remove(bullet);
						console.log('Removing cowboy from scene');
						scene.remove(cowboy);
						cowboys.splice(index, 1);
						console.log('Cowboys array length after removal:', cowboys.length);
						
						// Remove corresponding mixer data
						if (cowboyMixers[index]) {
							cowboyMixers.splice(index, 1);
						}

						// Check if we need to spawn a new cowboy
						checkAndSpawnCowboys(scene);
					}

					score += 50;
					updateScoreDisplay();
					if (scoreSound.isPlaying) scoreSound.stop();
					scoreSound.play();
					console.log('Cowboy hit processing complete');
				}
			});
		}
	});
	
	// Update cowboy animations
	cowboyMixers.forEach(cowboyData => {
		if (cowboyData.mixer) {
			cowboyData.mixer.update(delta);
		}
	});
	
	// Ensure we always have 3 cowboys
	if (cowboyGltf && cowboys.length < 3 && !spawnPending) {
		spawnPending = true;
		setTimeout(() => {
			spawnCowboy(scene);
			spawnPending = false;
		}, 100);
	}
	
	gsap.ticker.tick(delta);
}

init(setupScene, onFrame);
