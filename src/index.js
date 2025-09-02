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

const RUN_SPEED = 2.5;
const WALK_SPEED = 0.8;
const ATTACK_THRESHOLD = 5; // Distance to stop and attack (or idle)
const WALK_THRESHOLD = 12; // Distance to switch from running to walking

const AVOIDANCE_RADIUS = 3.0;
const AVOIDANCE_STRENGTH = 1.5;

// Helper to smoothly transition between animations
function switchToAction(cowboyData, action, duration = 0.3) {
	if (!action || cowboyData.currentAction === action) {
		return;
	}

	const lastAction = cowboyData.currentAction;
	cowboyData.currentAction = action;

	if (lastAction) {
		lastAction.fadeOut(duration);
	}

	action.reset().setEffectiveWeight(1).fadeIn(duration).play();
}

// Cowboy enemies
const cowboys = [];
const cowboyMixers = [];
let cowboyGltf = null;

// Road and movement
let road = null;
let backgroundPlane = null;
let playerPosition = 0;
const playerSpeed = 1.5; // Player walking speed

// Mouse controls
let mouseBlaster = null;
let isMouseMode = false;
const mouse = new THREE.Vector2();
const raycaster = new THREE.Raycaster();
const keyStates = {};

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
	
	// Cowboys should spawn far away, appearing to come from the background plane.
	const ROAD_WIDTH = 9; // A bit less than the actual road width of 10
	const spawnX = (Math.random() - 0.5) * ROAD_WIDTH;
	const spawnZ = -playerPosition - 150; // Spawn at the plane's depth

	cowboy.position.set(
		spawnX,
		0, // ground level
		spawnZ
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
		
		console.log('Setting up animations, found:', cowboyGltf.animations.length, 'animations');
		
		// Find available animations
		let idleAction, deathAction, walkAction, runAction;
		
		for (const animation of cowboyGltf.animations) {
			const animName = animation.name.toLowerCase();
			console.log(`Found animation in cowboy model: ${animation.name}`);
			if (animName.includes('walk')) {
				walkAction = mixer.clipAction(animation);
			} else if (animName.includes('run')) {
				runAction = mixer.clipAction(animation);
			} else if (animName.includes('dead')) {
				deathAction = mixer.clipAction(animation);
			} else {
				// Use the first suitable animation as idle
				if (!idleAction) {
					idleAction = mixer.clipAction(animation);
				}
			}
		}
		
		const cowboyData = {
			mixer: mixer,
			animations: cowboyGltf.animations,
			currentAction: null,
			// Store actions in the mixer data object
			idleAction,
			deathAction,
			walkAction,
			runAction,
		};
		cowboyMixers.push(cowboyData);

		// Start with idle animation
		if (idleAction) {
			idleAction.setLoop(THREE.LoopRepeat, Infinity);
			idleAction.play();
			cowboyData.currentAction = idleAction;
			console.log('Idle animation started');
		} else {
			console.log('Could not find a suitable idle animation.');
		}
		
		// Store a flag for death state on the model's userData
		cowboy.userData.hasPlayedDeath = false;
		
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

function createTree() {
	const tree = new THREE.Group();

	const trunkMaterial = new THREE.MeshStandardMaterial({ color: 0x8B4513 }); // SaddleBrown
	const trunkGeometry = new THREE.CylinderGeometry(0.5, 0.5, 4, 8);
	const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
	trunk.position.y = 2; // Half of height
	tree.add(trunk);

	const leavesMaterial = new THREE.MeshStandardMaterial({ color: 0x228B22 }); // ForestGreen
	const leavesGeometry = new THREE.IcosahedronGeometry(3);
	const leaves = new THREE.Mesh(leavesGeometry, leavesMaterial);
	leaves.position.y = 5; // Above the trunk
	tree.add(leaves);

	return tree;
}

function createHouse() {
	const house = new THREE.Group();

	const baseMaterial = new THREE.MeshStandardMaterial({ color: 0xDEB887 }); // BurlyWood
	const baseGeometry = new THREE.BoxGeometry(5, 5, 5);
	const base = new THREE.Mesh(baseGeometry, baseMaterial);
	base.position.y = 2.5;
	house.add(base);

	const roofMaterial = new THREE.MeshStandardMaterial({ color: 0xA52A2A }); // Brown
	const roofGeometry = new THREE.ConeGeometry(4, 3, 4); // radius, height, radialSegments
	const roof = new THREE.Mesh(roofGeometry, roofMaterial);
	roof.position.y = 5 + 1.5; // On top of the base
	roof.rotation.y = Math.PI / 4; // Align pyramid edges
	house.add(roof);

	return house;
}

function populateScenery(scene) {
	for (let i = 0; i < 100; i++) {
		// Alternate sides
		const side = (i % 2 === 0) ? 1 : -1;

		// Position far from the road
		const xPos = side * (15 + Math.random() * 20);
		const zPos = -i * 20 - Math.random() * 10;

		if (Math.random() > 0.3) { // 70% chance of a tree
			const tree = createTree();
			tree.position.set(xPos, 0, zPos);
			tree.rotation.y = Math.random() * Math.PI;
			scene.add(tree);
		} else { // 30% chance of a house
			const house = createHouse();
			house.position.set(xPos, 0, zPos);
			house.rotation.y = Math.random() * Math.PI;
			scene.add(house);
		}
	}
}

function setupScene({ scene, camera, _renderer, player, _controllers, controls }) {
	// Create road
	createRoad(scene);
	populateScenery(scene);
	
	// Add some basic environment elements
	const ambientLight = new THREE.AmbientLight(0x404040, 2);
	scene.add(ambientLight);
	
	const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
	directionalLight.position.set(5, 10, 7);
	scene.add(directionalLight);

	// Create a large background plane
	const backgroundGeometry = new THREE.PlaneGeometry(500, 200);
	const backgroundMaterial = new THREE.MeshStandardMaterial({ color: 0x000020 }); // Dark blue
	backgroundPlane = new THREE.Mesh(backgroundGeometry, backgroundMaterial);
	
	// Position it far in the distance to act as a backdrop
	backgroundPlane.position.z = -150;
    backgroundPlane.position.y = 100; // Center it vertically a bit
	
	scene.add(backgroundPlane);
	
	// Create a circle around the player
	const ringGeometry = new THREE.RingGeometry(1.9, 2, 32);
	const ringMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00, side: THREE.DoubleSide });
	const ring = new THREE.Mesh(ringGeometry, ringMaterial);
	ring.rotation.x = -Math.PI / 2; // Rotate it to be flat on the ground
	ring.position.y = 0.1; // Lift it slightly above the ground

	// Add the circle as a child of the player so it moves with the player
	player.add(ring);
	
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

	// Add listeners for fly controls
	window.addEventListener('keydown', (event) => {
		keyStates[event.code] = true;
	});
	window.addEventListener('keyup', (event) => {
		keyStates[event.code] = false;
	});
}

function onFrame(
	delta,
	_time,
	{ scene, camera, _renderer, player, controllers },
) {
	// --- Fly Controls (replaces automatic movement) ---
    const FLY_SPEED = 10;
    const forward = new THREE.Vector3();
    const right = new THREE.Vector3();

    camera.getWorldDirection(forward);
    forward.y = 0; // Project onto horizontal plane
    forward.normalize();

    right.crossVectors(forward, camera.up); // Get the right vector

    if (keyStates['KeyW']) { // Forward
        player.position.add(forward.clone().multiplyScalar(FLY_SPEED * delta));
    }
    if (keyStates['KeyS']) { // Backward
        player.position.add(forward.clone().multiplyScalar(-FLY_SPEED * delta));
    }
    if (keyStates['KeyA']) { // Left (strafe)
        player.position.add(right.clone().multiplyScalar(-FLY_SPEED * delta));
    }
    if (keyStates['KeyD']) { // Right (strafe)
        player.position.add(right.clone().multiplyScalar(FLY_SPEED * delta));
    }
	
	// Move the road to stay centered on the player
	if (road) {
		road.position.z = -playerPosition;
	}

	// Move the background plane with the player to keep it as a backdrop
	if (backgroundPlane) {
		backgroundPlane.position.z = -playerPosition - 150;
	}
	
	// Update cowboys: movement, orientation, and animations
	for (let i = 0; i < cowboys.length; i++) {
		const cowboy = cowboys[i];
		const cowboyData = cowboyMixers[i];

		// Skip logic for cowboys that are "dead" and animating
		if (cowboy.userData.hasPlayedDeath) {
			continue;
		}

		// --- Orientation ---
		const playerTargetPosition = new THREE.Vector3();
		camera.getWorldPosition(playerTargetPosition);
		const lookAtTarget = new THREE.Vector3(
			playerTargetPosition.x,
			cowboy.position.y,
			playerTargetPosition.z,
		);
		cowboy.lookAt(lookAtTarget);

		// --- Movement & Animation ---
		const distanceToPlayer = cowboy.position.distanceTo(playerTargetPosition);
		let moveDirection = new THREE.Vector3();
		let speed = 0;

		if (distanceToPlayer > WALK_THRESHOLD) {
			moveDirection.subVectors(lookAtTarget, cowboy.position).normalize();
			speed = RUN_SPEED;
			switchToAction(cowboyData, cowboyData.runAction);

		} else if (distanceToPlayer > ATTACK_THRESHOLD) {
			moveDirection.subVectors(lookAtTarget, cowboy.position).normalize();
			speed = WALK_SPEED;
			switchToAction(cowboyData, cowboyData.walkAction);

		} else {
			speed = 0;
			switchToAction(cowboyData, cowboyData.idleAction);
		}

		// --- Collision Avoidance ---
		const avoidanceVector = new THREE.Vector3();
		for (let j = 0; j < cowboys.length; j++) {
			if (i === j) continue; // Don't check against self

			const otherCowboy = cowboys[j];
			// Only avoid cowboys that are also alive
			if (otherCowboy.userData.hasPlayedDeath) continue;

			const distanceToOther = cowboy.position.distanceTo(otherCowboy.position);

			if (distanceToOther < AVOIDANCE_RADIUS) {
				const awayVector = new THREE.Vector3().subVectors(cowboy.position, otherCowboy.position).normalize();
				avoidanceVector.add(awayVector);
			}
		}

		// Combine movement and avoidance vectors
		const intendedMove = moveDirection.multiplyScalar(speed);
		const avoidanceMove = avoidanceVector.multiplyScalar(AVOIDANCE_STRENGTH);
		
		const totalMove = new THREE.Vector3().add(intendedMove).add(avoidanceMove);

		// Apply the final movement
		cowboy.position.add(totalMove.multiplyScalar(delta));

		// --- Arrow Helper Update ---
		if (cowboy.userData.arrow) {
			const arrowPosition = new THREE.Vector3().copy(cowboy.position);
			arrowPosition.y += 1.5;
			cowboy.userData.arrow.position.copy(arrowPosition);
			const cowboyDirection = new THREE.Vector3().subVectors(lookAtTarget, cowboy.position).normalize();
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

							// Find the current index of the cowboy, as it may have changed
							const currentIndex = cowboys.indexOf(cowboy);
							if (currentIndex === -1) {
								// Cowboy already removed, do nothing
								return;
							}

							// Remove the arrow helper if it exists
							if (cowboy.userData.arrow) {
								scene.remove(cowboy.userData.arrow);
							}
							scene.remove(cowboy);
							cowboys.splice(currentIndex, 1);
							console.log('Cowboys array length after removal:', cowboys.length);
							
							// Remove corresponding mixer data at the same index
							cowboyMixers.splice(currentIndex, 1);
							
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