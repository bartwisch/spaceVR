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

// Cowboy enemies
const cowboys = [];
const cowboyMixers = [];
let cowboyGltf = null;

// Road and movement
let road = null;
let playerPosition = 0;
const playerSpeed = 1.5; // Player walking speed

// Mouse controls
let mouseBlaster = null;
let isMouseMode = false;
const mouse = new THREE.Vector2();
const raycaster = new THREE.Raycaster();

let score = 0;
const scoreText = new Text();
scoreText.fontSize = 0.3; // Smaller font size for top position
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
	
	// Set position on either side of the road, close to the player
	const side = Math.random() > 0.5 ? 1 : -1; // Left or right side
	const distanceFromRoad = 3 + Math.random() * 2; // 3-5 units from road center
	
	cowboy.position.set(
		side * distanceFromRoad,    // X: left or right of road
		0,                          // Y: ground level
		-playerPosition - 5 - Math.random() * 5  // Z: close to player (5-10 units ahead)
	);
	
	// Make the cowboy face the player's blaster position
	// Initially point toward a default position, will be updated in onFrame
	cowboy.lookAt(0, 1.6, -playerPosition); // Default to player's eye level
	
	cowboy.scale.setScalar(1.2);
	scene.add(cowboy);
	cowboys.push(cowboy);
	
	// Create a visual arrow to show where the cowboy is looking
	const arrowDirection = new THREE.Vector3(0, 1.6, -playerPosition).sub(cowboy.position).normalize();
	const arrowOrigin = new THREE.Vector3().copy(cowboy.position);
	arrowOrigin.y += 1.5; // Position arrow at cowboy's eye level
	
	const arrowLength = 3;
	const arrowColor = 0xff0000; // Red color
	
	const arrowHelper = new THREE.ArrowHelper(arrowDirection, arrowOrigin, arrowLength, arrowColor);
	scene.add(arrowHelper);
	
	// Store arrow reference with cowboy for updates
	cowboy.userData.arrow = arrowHelper;
	
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
			...cowboy.userData,
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

function createRoad(scene) {
	// Create a simple road using a plane
	const roadGeometry = new THREE.PlaneGeometry(10, 2000); // Longer road
	const roadMaterial = new THREE.MeshStandardMaterial({ 
		color: 0x333333,
		roughness: 0.8,
		metalness: 0.2
	});
	
	road = new THREE.Mesh(roadGeometry, roadMaterial);
	road.rotation.x = -Math.PI / 2; // Lay flat
	road.position.y = -0.5; // Slightly below player level
	
	// Add road markings (center line)
	const centerLineGeometry = new THREE.PlaneGeometry(0.2, 2);
	const centerLineMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff });
	
	// Add lane markings
	const laneMarkingGeometry = new THREE.PlaneGeometry(0.3, 1);
	const laneMarkingMaterial = new THREE.MeshStandardMaterial({ color: 0xffff00 });
	
	for (let i = 0; i < 200; i++) {
		// Center line markings
		const centerMarking = new THREE.Mesh(centerLineGeometry, centerLineMaterial);
		centerMarking.rotation.x = -Math.PI / 2;
		centerMarking.position.set(0, -0.49, -i * 10);
		road.add(centerMarking);
		
		// Left lane markings
		const leftMarking = new THREE.Mesh(laneMarkingGeometry, laneMarkingMaterial);
		leftMarking.rotation.x = -Math.PI / 2;
		leftMarking.position.set(-2, -0.49, -i * 10 - 2);
		road.add(leftMarking);
		
		// Right lane markings
		const rightMarking = new THREE.Mesh(laneMarkingGeometry, laneMarkingMaterial);
		rightMarking.rotation.x = -Math.PI / 2;
		rightMarking.position.set(2, -0.49, -i * 10 - 2);
		road.add(rightMarking);
	}
	
	scene.add(road);
}

function setupScene({ scene, camera, _renderer, player, _controllers, controls }) {
	// Create road
	createRoad(scene);
	
	// Add some basic environment elements
	const ambientLight = new THREE.AmbientLight(0x404040, 2);
	scene.add(ambientLight);
	
	const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
	directionalLight.position.set(5, 10, 7);
	scene.add(directionalLight);
	
	// Create a circle around the player
	const circleGeometry = new THREE.BufferGeometry();
	const circleMaterial = new THREE.LineBasicMaterial({ color: 0x00ff00 }); // Green color
	
	// Create circle points
	const radius = 2;
	const segments = 32;
	const circlePoints = [];
	for (let i = 0; i <= segments; i++) {
		const theta = (i / segments) * Math.PI * 2;
		circlePoints.push(
			Math.cos(theta) * radius,
			0.1, // Slightly above ground
			Math.sin(theta) * radius
		);
	}
	
	circleGeometry.setAttribute('position', new THREE.Float32BufferAttribute(circlePoints, 3));
	const circle = new THREE.Line(circleGeometry, circleMaterial);
	
	// Add the circle as a child of the player so it moves with the player
	player.add(circle);
	
	const gltfLoader = new GLTFLoader();

	gltfLoader.load('assets/blaster.glb', (gltf) => {
		blasterGroup.add(gltf.scene);
		
		// Create mouse blaster for non-VR mode
		mouseBlaster = gltf.scene.clone();
		mouseBlaster.position.set(0.3, -0.3, -0.5);
		mouseBlaster.scale.setScalar(0.8);
	});

	// Load cowboy enemy
	gltfLoader.load('assets/cowboy1.glb', (gltf) => {
		cowboyGltf = gltf;
		// Spawn initial cowboys
		for (let i = 0; i < 5; i++) {
			setTimeout(() => spawnCowboy(scene), i * 1000);
		}
	});

	scene.add(scoreText);
	scoreText.position.set(0, 1.5, -2); // Position at the top of the screen
	scoreText.rotateX(-Math.PI / 6); // Adjust rotation for better visibility
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

	// Mouse drag rotation variables
	let isDragging = false;
	let previousMouseX = 0;
	let previousMouseY = 0;
	let cameraRotationY = 0;
	let cameraRotationX = 0;

	// Setup mouse controls
	window.addEventListener('mousedown', (event) => {
		isDragging = true;
		previousMouseX = event.clientX;
		previousMouseY = event.clientY;
		
		// Disable OrbitControls when starting drag
		if (controls) {
			controls.enabled = false;
		}
	});

	window.addEventListener('mousemove', (event) => {
		// Handle camera rotation with mouse drag
		if (isDragging) {
			const deltaX = event.clientX - previousMouseX;
			const deltaY = event.clientY - previousMouseY;
			
			// Adjust camera rotation based on mouse movement
			cameraRotationY -= deltaX * 0.01; // Horizontal rotation
			cameraRotationX -= deltaY * 0.01; // Vertical rotation (standard - moving mouse up looks up)
			
			// Limit vertical rotation to prevent flipping
			cameraRotationX = Math.max(-Math.PI/2, Math.min(Math.PI/2, cameraRotationX));
			
			// Apply rotation to camera using quaternions for stability
			const quatX = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), cameraRotationX);
			const quatY = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), cameraRotationY);
			
			// Combine rotations
			camera.quaternion.copy(quatY).multiply(quatX);
			
			previousMouseX = event.clientX;
			previousMouseY = event.clientY;
		}
		
		// Also update mouse coordinates for shooting
		mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
		mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
	});

	window.addEventListener('mouseup', () => {
		isDragging = false;
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
	
	// Re-enable OrbitControls when exiting mouse mode
	window.addEventListener('keydown', (event) => {
		if (isMouseMode && event.key === 'Escape') {
			isMouseMode = false;
			if (mouseBlaster && mouseBlaster.parent === camera) {
				camera.remove(mouseBlaster);
			}
			// Re-enable OrbitControls
			if (controls) {
				controls.enabled = true;
			}
			// Reset camera rotation
			cameraRotationY = 0;
			cameraRotationX = 0;
			camera.quaternion.set(0, 0, 0, 1); // Reset to identity quaternion
		}
	});
}

function onFrame(
	delta,
	_time,
	{ scene, camera, _renderer, player, controllers },
) {
	// Update player position for forward movement
	playerPosition += playerSpeed * delta;
	player.position.z = -playerPosition;
	
	// Move the road to stay centered on the player
	if (road) {
		road.position.z = -playerPosition;
	}
	
	// Update cowboy orientations to face the player's blaster
	for (let i = 0; i < cowboys.length; i++) {
		const cowboy = cowboys[i];
		
		// Determine the blaster position based on current mode
		let blasterPosition;
		if (isMouseMode && mouseBlaster) {
			// In mouse mode, get blaster position from camera
			blasterPosition = new THREE.Vector3();
			mouseBlaster.getWorldPosition(blasterPosition);
		} else {
			// In VR mode or default, use player/camera position with offset
			blasterPosition = new THREE.Vector3(0, 1.6, -playerPosition); // Approximate blaster position
		}
		
		// Make cowboys face the blaster position
		cowboy.lookAt(blasterPosition);
		
		// Update the arrow to show where the cowboy is looking
		if (cowboy.userData.arrow) {
			// Update arrow position to match cowboy's position (at eye level)
			const arrowPosition = new THREE.Vector3().copy(cowboy.position);
			arrowPosition.y += 1.5; // Position arrow at cowboy's eye level
			cowboy.userData.arrow.position.copy(arrowPosition);
			
			// Update arrow direction to match cowboy's facing direction
			const cowboyDirection = new THREE.Vector3().subVectors(blasterPosition, cowboy.position).normalize();
			cowboy.userData.arrow.setDirection(cowboyDirection);
		}
	}
	
	// Spawn new cowboys periodically
	if (cowboyGltf && cowboys.length < 20 && Math.random() < 0.1) {
		spawnCowboy(scene);
	}
	
	// Remove cowboys that are too far behind
	for (let i = cowboys.length - 1; i >= 0; i--) {
		const cowboy = cowboys[i];
		if (cowboy.position.z > -playerPosition + 15) { // 15 units behind player
			// Remove the arrow helper if it exists
			if (cowboy.userData.arrow) {
				scene.remove(cowboy.userData.arrow);
			}
			scene.remove(cowboy);
			cowboys.splice(i, 1);
			if (cowboyMixers[i]) {
				cowboyMixers.splice(i, 1);
			}
		}
	}
	
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
							// Remove the arrow helper if it exists
							if (cowboy.userData.arrow) {
								scene.remove(cowboy.userData.arrow);
							}
							scene.remove(cowboy);
							cowboys.splice(index, 1);
							console.log('Cowboys array length after removal:', cowboys.length);
							
							// Remove corresponding mixer data
							if (cowboyMixers[index]) {
								cowboyMixers.splice(index, 1);
							}
						}, 4000); // Wait 4 seconds total for death animation
						
					} else {
						// No death animation available, remove immediately
						console.log('No death animation available, removing immediately');
						console.log('Removing bullet from bullets object and scene');
						delete bullets[bullet.uuid];
						scene.remove(bullet);
						console.log('Removing cowboy from scene');
						// Remove the arrow helper if it exists
						if (cowboy.userData.arrow) {
							scene.remove(cowboy.userData.arrow);
						}
						scene.remove(cowboy);
						cowboys.splice(index, 1);
						console.log('Cowboys array length after removal:', cowboys.length);
						
						// Remove corresponding mixer data
						if (cowboyMixers[index]) {
							cowboyMixers.splice(index, 1);
						}
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
	
	gsap.ticker.tick(delta);
}

init(setupScene, onFrame);