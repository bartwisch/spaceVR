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
import { XR_AXES, XR_BUTTONS } from 'gamepad-wrapper';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { gsap } from 'gsap';
import { init } from './init.js';

const bullets = {};
const forwardVector = new THREE.Vector3(0, 0, -1);
const bulletSpeed = 15; // Increased speed
const bulletTimeToLive = 3; // Increased TTL to 3 seconds

const blasterGroup = new THREE.Group();
const blueBlasterGroup = new THREE.Group(); // New blue weapon group



// Flamethrower particles
let flamethrowerParticles = [];
let maxFlamethrowerParticles = 100;
let flamethrowerParticlePool = [];



// Space environment
let asteroids = [];
let stars = [];
let nebulaClouds = [];

// Weapon switching
let currentWeapon = 0; // 0 = red weapon, 1 = blue weapon (flamethrower)
const weapons = [blasterGroup, blueBlasterGroup];

// Stationary machine gun system
let machineGun = null;
let machineGunMount = null;
let isBothHandsOnGun = false;
let machineGunFiring = false;
let machineGunFireRate = 0.1; // 10 rounds per second
let lastMachineGunShot = 0;
let leftHandOnGun = false;
let rightHandOnGun = false;
const HAND_DISTANCE_THRESHOLD = 0.5; // Max distance for hand to be "on" the gun





// Spaceship auto-pilot movement

let backgroundPlane = null;
let spaceship = null; // The player's spaceship
window.playerPosition = 0; // Make it globally accessible - represents spaceship position
let globalCamera = null; // Global reference to camera for spaceCowboy targeting
let autopilotSpeed = 5; // Speed of spaceship auto-pilot
let spaceshipPath = 0; // Current position along the spaceship's path

// Wave-based space cowboy spawning system
// Remove all wave spawning - pure space environment

// Power-up system
let activePowerUps = {};
let powerUpPickups = [];
const POWERUP_TYPES = {
	RAPID_FIRE: 'rapidFire',
	EXPLOSIVE_ROUNDS: 'explosiveRounds',
	SHIELD: 'shield'
};

// Mouse controls
let mouseBlaster = null;
let isMouseMode = false;
const mouse = new THREE.Vector2();
const raycaster = new THREE.Raycaster();
const keyStates = {};


let laserSound, scoreSound, cowboyCallouts, alienHisses;





function createPowerUp(scene, position, type) {
	// Create a simple glowing cube as power-up
	const geometry = new THREE.BoxGeometry(0.5, 0.5, 0.5);
	let material;
	
	switch(type) {
		case POWERUP_TYPES.RAPID_FIRE:
			material = new THREE.MeshBasicMaterial({ color: 0xff0000, transparent: true, opacity: 0.8 });
			break;
		case POWERUP_TYPES.EXPLOSIVE_ROUNDS:
			material = new THREE.MeshBasicMaterial({ color: 0xff8800, transparent: true, opacity: 0.8 });
			break;
		case POWERUP_TYPES.SHIELD:
			material = new THREE.MeshBasicMaterial({ color: 0x0088ff, transparent: true, opacity: 0.8 });
			break;
		default:
			material = new THREE.MeshBasicMaterial({ color: 0x00ff00, transparent: true, opacity: 0.8 });
	}
	
	const powerUp = new THREE.Mesh(geometry, material);
	powerUp.position.copy(position);
	powerUp.userData = { type: type, createdAt: Date.now() };
	
	// Add glowing effect
	const glowGeometry = new THREE.BoxGeometry(0.7, 0.7, 0.7);
	const glowMaterial = new THREE.MeshBasicMaterial({ 
		color: material.color, 
		transparent: true, 
		opacity: 0.3,
		side: THREE.BackSide 
	});
	const glow = new THREE.Mesh(glowGeometry, glowMaterial);
	powerUp.add(glow);
	
	scene.add(powerUp);
	powerUpPickups.push(powerUp);
	
	// Animate rotation
	const animateRotation = () => {
		powerUp.rotation.x += 0.01;
		powerUp.rotation.y += 0.02;
		powerUp.position.y += Math.sin(Date.now() * 0.005) * 0.01; // Floating effect
	};
	powerUp.userData.animate = animateRotation;
	
	console.log(`Power-up ${type} created at position:`, position);
}

function activatePowerUp(type) {
	switch(type) {
		case POWERUP_TYPES.RAPID_FIRE:
			activePowerUps.rapidFire = { 
				active: true, 
				endTime: Date.now() + 15000, // 15 seconds
				multiplier: 3 // 3x fire rate
			};
			console.log('Rapid Fire activated for 15 seconds!');
			break;
		case POWERUP_TYPES.EXPLOSIVE_ROUNDS:
			activePowerUps.explosiveRounds = { 
				active: true, 
				endTime: Date.now() + 10000, // 10 seconds
				radius: 3 // Explosion radius
			};
			console.log('Explosive Rounds activated for 10 seconds!');
			break;
		case POWERUP_TYPES.SHIELD:
			activePowerUps.shield = { 
				active: true, 
				endTime: Date.now() + 20000, // 20 seconds
				hits: 5 // Can absorb 5 hits
			};
			console.log('Shield activated for 20 seconds!');
			break;
	}
}

function createSpaceEnvironment(scene) {
	// Create starfield background
	createStarfield(scene);
	
	// Create rotating asteroids
	createAsteroids(scene);
	
	// Create nebula clouds
	createNebulaClouds(scene);
}

function createStarfield(scene) {
	const starGeometry = new THREE.BufferGeometry();
	const starCount = 1000;
	const positions = new Float32Array(starCount * 3);
	
	for (let i = 0; i < starCount * 3; i += 3) {
		// Random positions in a large sphere around the scene
		const radius = 500 + Math.random() * 1000;
		const theta = Math.random() * Math.PI * 2;
		const phi = Math.random() * Math.PI;
		
		positions[i] = radius * Math.sin(phi) * Math.cos(theta);
		positions[i + 1] = radius * Math.sin(phi) * Math.sin(theta);
		positions[i + 2] = radius * Math.cos(phi);
	}
	
	starGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
	
	const starMaterial = new THREE.PointsMaterial({
		color: 0xffffff,
		size: 2,
		transparent: true,
		opacity: 0.8
	});
	
	const starField = new THREE.Points(starGeometry, starMaterial);
	scene.add(starField);
	stars.push(starField);
}

function createAsteroids(scene) {
	for (let i = 0; i < 20; i++) {
		const size = 0.5 + Math.random() * 2;
		
		// Create irregular asteroid shape
		const geometry = new THREE.DodecahedronGeometry(size, 0);
		
		// Randomize vertices for irregular shape
		const vertices = geometry.attributes.position.array;
		for (let j = 0; j < vertices.length; j += 3) {
			vertices[j] *= 0.8 + Math.random() * 0.4;
			vertices[j + 1] *= 0.8 + Math.random() * 0.4;
			vertices[j + 2] *= 0.8 + Math.random() * 0.4;
		}
		geometry.attributes.position.needsUpdate = true;
		geometry.computeVertexNormals();
		
		const material = new THREE.MeshLambertMaterial({ 
			color: new THREE.Color().setHSL(0.1, 0.3, 0.3 + Math.random() * 0.3),
			flatShading: true
		});
		
		const asteroid = new THREE.Mesh(geometry, material);
		
		// Random position around the scene
		const angle = Math.random() * Math.PI * 2;
		const distance = 30 + Math.random() * 50;
		asteroid.position.set(
			Math.cos(angle) * distance,
			(Math.random() - 0.5) * 20,
			Math.sin(angle) * distance - window.playerPosition
		);
		
		// Random rotation
		asteroid.rotation.set(
			Math.random() * Math.PI,
			Math.random() * Math.PI,
			Math.random() * Math.PI
		);
		
		// Store rotation speeds
		asteroid.userData = {
			rotationSpeed: new THREE.Vector3(
				(Math.random() - 0.5) * 0.02,
				(Math.random() - 0.5) * 0.02,
				(Math.random() - 0.5) * 0.02
			)
		};
		
		scene.add(asteroid);
		asteroids.push(asteroid);
		obstacles.push(asteroid); // Add to obstacles for collision detection
	}
}

function createNebulaClouds(scene) {
	for (let i = 0; i < 5; i++) {
		const geometry = new THREE.SphereGeometry(10 + Math.random() * 20, 8, 6);
		const material = new THREE.MeshBasicMaterial({
			color: new THREE.Color().setHSL(0.6 + Math.random() * 0.4, 0.5, 0.3),
			transparent: true,
			opacity: 0.1 + Math.random() * 0.1,
			side: THREE.DoubleSide
		});
		
		const nebula = new THREE.Mesh(geometry, material);
		
		// Position nebula clouds in the distance
		nebula.position.set(
			(Math.random() - 0.5) * 200,
			(Math.random() - 0.5) * 100,
			-100 - Math.random() * 200
		);
		
		scene.add(nebula);
		nebulaClouds.push(nebula);
	}
}



function createAlienSounds() {
	// Create alien communication sounds
	const alienSounds = [
		"*bioelectric hiss*",
		"*clicking sounds*", 
		"*alien shriek*",
		"*plasma charge noise*",
		"*telepathic buzz*"
	];
	
	alienHisses = alienSounds;
}

function playAlienSound() {
	if (alienHisses && alienHisses.length > 0) {
		const randomSound = alienHisses[Math.floor(Math.random() * alienHisses.length)];
		console.log(`👽 Alien: ${randomSound}`);
		
		// TODO: Replace with actual audio playback when audio files are available
		// const audio = new Audio(`audio/alien_${index}.ogg`);
		// audio.volume = 0.3;
		// audio.play();
	}
}

function createStationaryMachineGun(scene) {
	// Create machine gun mount/base
	const mountGeometry = new THREE.CylinderGeometry(0.3, 0.4, 0.2, 8);
	const mountMaterial = new THREE.MeshLambertMaterial({ color: 0x444444 });
	machineGunMount = new THREE.Mesh(mountGeometry, mountMaterial);
	machineGunMount.position.set(0, -0.5, -2); // Position in front of player
	scene.add(machineGunMount);
	
	// Create machine gun body
	const gunBodyGeometry = new THREE.BoxGeometry(0.15, 0.15, 1.2);
	const gunMaterial = new THREE.MeshLambertMaterial({ color: 0x666666 });
	machineGun = new THREE.Mesh(gunBodyGeometry, gunMaterial);
	
	// Create gun barrel
	const barrelGeometry = new THREE.CylinderGeometry(0.03, 0.03, 0.6, 8);
	const barrelMaterial = new THREE.MeshLambertMaterial({ color: 0x333333 });
	const barrel = new THREE.Mesh(barrelGeometry, barrelMaterial);
	barrel.rotation.z = Math.PI / 2; // Point forward
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
		opacity: 0.0 // Invisible
	});
	const triggerZone = new THREE.Mesh(triggerGeometry, triggerMaterial);
	triggerZone.position.set(0, -0.1, -0.2);
	machineGun.add(triggerZone);
	
	// Store reference for hand detection
	machineGun.userData = {
		leftGripPosition: leftGrip.position.clone(),
		rightGripPosition: rightGrip.position.clone(),
		triggerZone: triggerZone,
		barrelTip: new THREE.Vector3(0, 0, 0.7) // Barrel tip for bullet spawn
	};
	
	// Mount gun to base
	machineGun.position.set(0, 0.2, 0);
	machineGunMount.add(machineGun);
	
	console.log('Stationary machine gun created');
}

function checkHandsOnMachineGun(controllers) {
	if (!machineGun || !controllers[0] || !controllers[1]) {
		leftHandOnGun = false;
		rightHandOnGun = false;
		isBothHandsOnGun = false;
		return;
	}
	
	// Get world positions of grips
	const leftGripWorldPos = new THREE.Vector3();
	const rightGripWorldPos = new THREE.Vector3();
	
	// Calculate world positions of grip handles
	const leftGripLocal = machineGun.userData.leftGripPosition.clone();
	const rightGripLocal = machineGun.userData.rightGripPosition.clone();
	
	machineGun.localToWorld(leftGripLocal);
	machineGun.localToWorld(rightGripLocal);
	
	// Check left hand distance to left grip
	if (controllers[0] && controllers[0].raySpace) {
		const leftHandPos = new THREE.Vector3();
		controllers[0].raySpace.getWorldPosition(leftHandPos);
		const leftDistance = leftHandPos.distanceTo(leftGripLocal);
		leftHandOnGun = leftDistance < HAND_DISTANCE_THRESHOLD;
	}
	
	// Check right hand distance to right grip  
	if (controllers[1] && controllers[1].raySpace) {
		const rightHandPos = new THREE.Vector3();
		controllers[1].raySpace.getWorldPosition(rightHandPos);
		const rightDistance = rightHandPos.distanceTo(rightGripLocal);
		rightHandOnGun = rightDistance < HAND_DISTANCE_THRESHOLD;
	}
	
	// Both hands must be on gun to operate
	isBothHandsOnGun = leftHandOnGun && rightHandOnGun;
	
	// Visual feedback - change gun color when hands are on it
	if (isBothHandsOnGun) {
		machineGun.material.color.setHex(0x00ff00); // Green when ready
	} else if (leftHandOnGun || rightHandOnGun) {
		machineGun.material.color.setHex(0xffaa00); // Orange when one hand is on
	} else {
		machineGun.material.color.setHex(0x666666); // Gray when no hands
	}
}

function fireMachineGun(scene, time, controllers) {
	if (!isBothHandsOnGun || !machineGun) return;
	
	// Check fire rate
	if (time - lastMachineGunShot < machineGunFireRate) return;
	
	// Create bullet
	const bulletGeometry = new THREE.SphereGeometry(0.02);
	const bulletMaterial = new THREE.MeshBasicMaterial({ color: 0xffff00 }); // Yellow bullets
	const bullet = new THREE.Mesh(bulletGeometry, bulletMaterial);
	
	// Position bullet at gun barrel tip
	const barrelTipWorld = machineGun.userData.barrelTip.clone();
	machineGun.localToWorld(barrelTipWorld);
	bullet.position.copy(barrelTipWorld);
	
	// Get gun's forward direction
	const gunDirection = new THREE.Vector3(0, 0, 1);
	machineGun.localToWorld(gunDirection);
	gunDirection.sub(machineGun.position).normalize();
	
	// Add some spread for machine gun effect
	gunDirection.x += (Math.random() - 0.5) * 0.1;
	gunDirection.y += (Math.random() - 0.5) * 0.1;
	
	// Set bullet velocity
	bullet.userData = {
		velocity: gunDirection.clone().multiplyScalar(25), // Fast bullets
		timeToLive: 3,
		startTime: time
	};
	
	scene.add(bullet);
	if (!bullets) window.bullets = {};
	bullets[bullet.uuid] = bullet;
	
	// Update last shot time
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
	
	// Remove muzzle flash after short duration
	setTimeout(() => {
		scene.remove(muzzleFlash);
	}, 50);
	
	// Haptic feedback for both controllers
	if (controllers && controllers[0] && controllers[0].gamepad) {
		controllers[0].gamepad.getHapticActuator(0).pulse(0.3, 100);
	}
	if (controllers && controllers[1] && controllers[1].gamepad) {
		controllers[1].gamepad.getHapticActuator(0).pulse(0.3, 100);
	}
	
	console.log('Machine gun fired!');
}

function updateSpaceEnvironment(delta) {
	// Rotate asteroids
	asteroids.forEach(asteroid => {
		asteroid.rotation.x += asteroid.userData.rotationSpeed.x;
		asteroid.rotation.y += asteroid.userData.rotationSpeed.y;
		asteroid.rotation.z += asteroid.userData.rotationSpeed.z;
	});
	
	// Animate nebula clouds (subtle pulsing)
	nebulaClouds.forEach((nebula, index) => {
		const time = Date.now() * 0.001 + index;
		nebula.material.opacity = 0.1 + Math.sin(time * 0.5) * 0.05;
		nebula.scale.setScalar(0.9 + Math.sin(time * 0.3) * 0.1);
	});
}





function fireBullet(scene, position, quaternion) {
	// Check if we're using the flamethrower (weapon 1)
	if (currentWeapon === 1) {
		// Flamethrower mode - play continuous sound
		if (window.flamethrowerSound && !window.flamethrowerSound.isPlaying) {
			window.flamethrowerSound.play();
		}
		
		// Create flamethrower particles
		const directionVector = forwardVector.clone().applyQuaternion(quaternion);
		emitFlamethrowerParticles(position, directionVector, scene);
	} else {
		// Regular bullet mode - play laser sound
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
			// Create bullet dynamically if no prototype exists
			const bulletGeometry = new THREE.SphereGeometry(0.05, 8, 8);
			const bulletMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 }); // Red for weapon 0
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



function setupScene({ scene, camera, _renderer, player, _controllers, controls }) {
	scene.background = new THREE.Color(0x000000);
	// Store global camera reference for space cowboy targeting
	globalCamera = camera;
	
	// Create space environment instead of road
	createSpaceEnvironment(scene);
	
	
	createAlienSounds();
	
	// Create stationary machine gun
	createStationaryMachineGun(scene);
	
	// Remove road and scenery - pure space environment
	
	// Space environment lighting
	const ambientLight = new THREE.AmbientLight(0x101020, 1.5); // Darker space ambient
	scene.add(ambientLight);
	
	const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
	directionalLight.position.set(5, 10, 7);
	scene.add(directionalLight);

	
	
	// Create a circle around the player
	const ringGeometry = new THREE.RingGeometry(1.9, 2, 32);
	const ringMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00, side: THREE.DoubleSide });
	const ring = new THREE.Mesh(ringGeometry, ringMaterial);
	ring.rotation.x = -Math.PI / 2; // Rotate it to be flat on the ground
	ring.position.y = 0.1; // Lift it slightly above the ground

	// Add the circle as a child of the player so it moves with the player
	player.add(ring);
	
	// Load models
	const gltfLoader = new GLTFLoader();

	gltfLoader.load('assets/blaster.glb', (gltf) => {
		blasterGroup.add(gltf.scene);
		console.log('=== RED BLASTER LOADED ===');
		console.log('Blaster group children count:', blasterGroup.children.length);
		if (blasterGroup.children.length > 0) {
			const firstChild = blasterGroup.children[0];
			console.log('First blaster child:', firstChild);
			console.log('First blaster child name:', firstChild.name);
			console.log('First blaster child type:', firstChild.type);
			console.log('First blaster child visible:', firstChild.visible);
			console.log('First blaster child children count:', firstChild.children.length);
			if (firstChild.children.length > 0) {
				console.log('First blaster grandchild:', firstChild.children[0]);
				console.log('First blaster grandchild name:', firstChild.children[0].name);
			}
		}
		
		// Create mouse blaster for non-VR mode
		mouseBlaster = gltf.scene.clone();
		mouseBlaster.position.set(0.3, -0.3, -0.5);
		mouseBlaster.scale.setScalar(0.8);
	});

	// Load blue weapon variant (flamethrower)
	gltfLoader.load('assets/blaster.glb', (gltf) => {
		const blueBlaster = gltf.scene.clone();
		
		// Modify material to make it look like a flamethrower
		blueBlaster.traverse((child) => {
			if (child.isMesh) {
				child.material = child.material.clone();
				child.material.color = new THREE.Color(0x4444ff); // Blue color
				child.material.emissive = new THREE.Color(0x000066); // Blue glow
				child.material.metalness = 0.3;
				child.material.roughness = 0.7;
			}
		});
		
		// Add a flame nozzle effect
		const nozzleGeometry = new THREE.ConeGeometry(0.1, 0.3, 8);
		const nozzleMaterial = new THREE.MeshBasicMaterial({ 
			color: 0xff4400,
			transparent: true,
			opacity: 0.7
		});
		const nozzle = new THREE.Mesh(nozzleGeometry, nozzleMaterial);
		nozzle.rotation.x = Math.PI;
		nozzle.position.z = -0.1;
		blueBlaster.add(nozzle);
		
		blueBlasterGroup.add(blueBlaster);
		console.log('=== BLUE FLAMETHROWER LOADED ===');
	});

	// Load spaceship model
	gltfLoader.load('assets/spacestation.glb', (gltf) => {
		spaceship = gltf.scene.clone();
		spaceship.scale.setScalar(2); // Make it bigger
		spaceship.position.set(0, 0, 0); // Center position
		scene.add(spaceship);
		console.log('Spaceship loaded and added to scene');
	}, undefined, (error) => {
		console.error('Failed to load spaceship GLTF:', error);
	});

		
	
	// Spawn test power-ups for machine gun testing
	setTimeout(() => {
		createPowerUp(scene, new THREE.Vector3(3, 1, -5), POWERUP_TYPES.RAPID_FIRE);
		createPowerUp(scene, new THREE.Vector3(-3, 1, -8), POWERUP_TYPES.EXPLOSIVE_ROUNDS);
		createPowerUp(scene, new THREE.Vector3(0, 1, -12), POWERUP_TYPES.SHIELD);
	}, 5000);

	// Load and set up positional audio
	const listener = new THREE.AudioListener();
	camera.add(listener);

	const audioLoader = new THREE.AudioLoader();
	laserSound = new THREE.PositionalAudio(listener);
	audioLoader.load('assets/laser.ogg', (buffer) => {
		laserSound.setBuffer(buffer);
		blasterGroup.add(laserSound);
		
		// Also set up flamethrower sound using the same buffer but with different playback rate
		if (window.flamethrowerSound) {
			window.flamethrowerSound.setBuffer(buffer);
			// Set a lower playback rate for a deeper, wave-like sound
			window.flamethrowerSound.setPlaybackRate(0.7);
		}
	});

	scoreSound = new THREE.PositionalAudio(listener);
	audioLoader.load('assets/score.ogg', (buffer) => {
		scoreSound.setBuffer(buffer);
		// Score text removed, so no need to add sound to it
	});
	
	// Create a simple wave sound for flamethrower by modifying the laser sound
	window.flamethrowerSound = new THREE.PositionalAudio(listener);
	// We'll set the buffer when the laser sound loads

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
		
		// Track mouse button states for machine gun
		if (event.button === 0) { // Left mouse button
			keyStates['mouseLeft'] = true;
		} else if (event.button === 2) { // Right mouse button
			keyStates['mouseRight'] = true;
		}
		
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

	window.addEventListener('mouseup', (event) => {
		isDragging = false;
		
		// Clear mouse button states for machine gun
		if (event.button === 0) { // Left mouse button
			keyStates['mouseLeft'] = false;
		} else if (event.button === 2) { // Right mouse button
			keyStates['mouseRight'] = false;
		}
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
	
	// Disable context menu on right-click for machine gun controls
	window.addEventListener('contextmenu', (event) => {
		event.preventDefault();
	});
}

function onFrame(
	delta,
	_time,
	{ scene, camera, _renderer, player, controllers },
) {
	// Spaceship auto-pilot movement
	const spaceshipSpeed = autopilotSpeed;
	
	// Move the spaceship automatically through space
	spaceshipPath += spaceshipSpeed * delta;
	window.playerPosition += spaceshipSpeed * delta;
	
	// Update spaceship position with slight movement pattern
	if (spaceship) {
		// Add slight side-to-side and up-down movement for more dynamic feel
		spaceship.position.x = Math.sin(spaceshipPath * 0.2) * 2; // Side movement
		spaceship.position.y = Math.cos(spaceshipPath * 0.15) * 1; // Vertical movement
		spaceship.position.z = -window.playerPosition; // Forward movement
		
		// Slight rotation for banking turns
		spaceship.rotation.z = Math.sin(spaceshipPath * 0.2) * 0.1;
		spaceship.rotation.x = Math.cos(spaceshipPath * 0.15) * 0.05;
	}
	
	// --- Stationary Turret Mechanics ---
	// Player is fixed on the spaceship and can only look around and shoot
	// No manual movement allowed - spaceship moves automatically
	
	// Keep player positioned on the spaceship
	if (spaceship) {
		// Position player on the spaceship bridge/turret position
		player.position.set(
			spaceship.position.x, 
			spaceship.position.y + 2, // Elevated position for better view
			spaceship.position.z
		);
	}
	
	// Update player position tracking
	window.playerPosition = -player.position.z;
	
	
	
	
	
	
	// Check if we're in VR mode or mouse mode
	const isInVR = controllers.right && controllers.right.gamepad;
	
	if (isInVR) {
		// VR Mode - hide mouse blaster if it's visible
		if (isMouseMode && mouseBlaster && mouseBlaster.parent === camera) {
			camera.remove(mouseBlaster);
			isMouseMode = false;
		}
		
		const { gamepad, raySpace, mesh } = controllers.right;
		// Add the current weapon to the controller (start with red weapon)
		if (!raySpace.children.includes(weapons[currentWeapon])) {
			raySpace.add(weapons[currentWeapon]);
			mesh.visible = false;
		}
		
		// Handle thumbstick movement
		if (controllers.left && controllers.left.gamepad) {
			const leftGamepad = controllers.left.gamepad;
			const thumbstickX = leftGamepad.getAxis(XR_AXES.THUMBSTICK_X);
			const thumbstickY = leftGamepad.getAxis(XR_AXES.THUMBSTICK_Y);
			
			// Only move if thumbstick is pushed beyond deadzone
			if (Math.abs(thumbstickX) > 0.1 || Math.abs(thumbstickY) > 0.1) {
				const moveSpeed = 5.0;
				const moveX = thumbstickX * moveSpeed * delta;
				const moveZ = -thumbstickY * moveSpeed * delta; // Invert Y axis for natural forward/backward movement
				
				// Get player's current rotation to move in the correct direction
				const playerDirection = new THREE.Vector3();
				camera.getWorldDirection(playerDirection);
				playerDirection.y = 0;
				playerDirection.normalize();
				
				// Calculate strafe direction (perpendicular to forward)
				const strafeDirection = new THREE.Vector3();
				strafeDirection.crossVectors(playerDirection, camera.up);
				
				// Apply movement
				player.position.x += moveX * strafeDirection.x + moveZ * playerDirection.x;
				player.position.z += moveX * strafeDirection.z + moveZ * playerDirection.z;
				
				// Update player position tracking
				window.playerPosition = -player.position.z;
			}
		}
		
		// Handle right thumbstick rotation
		if (gamepad) {
			const rightThumbstickX = gamepad.getAxis(XR_AXES.THUMBSTICK_X);
			
			// Only rotate if thumbstick is pushed beyond deadzone
			if (Math.abs(rightThumbstickX) > 0.1) {
				const rotateSpeed = 2.0;
				const rotationDelta = -rightThumbstickX * rotateSpeed * delta; // Invert for natural rotation
				
				// Rotate the player around the Y axis
				player.rotateY(rotationDelta);
			}
			
			// Handle weapon switching with button press (using BUTTON_1, typically the A button)
			if (gamepad.getButtonDown(XR_BUTTONS.BUTTON_1)) {
				// Switch weapon
				currentWeapon = (currentWeapon + 1) % weapons.length;
				const weaponNames = ['Blaster', 'Flamethrower'];
				console.log('Switched to weapon:', weaponNames[currentWeapon]);
				
				// Update the weapon model shown in the player's hand
				if (raySpace.children.includes(blasterGroup)) {
					raySpace.remove(blasterGroup);
				}
				if (raySpace.children.includes(blueBlasterGroup)) {
					raySpace.remove(blueBlasterGroup);
				}
				
				// Add the current weapon to the controller
				raySpace.add(weapons[currentWeapon]);
			}
			
			// Handle continuous fire (dauerfeuer) when trigger is held
			if (gamepad.getButton(XR_BUTTONS.TRIGGER)) {
				// Check if we should fire (implementing a fire rate limit)
				if (!gamepad.userData) gamepad.userData = {};
				if (!gamepad.userData.lastFireTime) gamepad.userData.lastFireTime = 0;
				
				const currentTime = Date.now();
				// Different fire rates for different weapons
				const fireRate = currentWeapon === 1 ? 50 : 150; // Faster for flamethrower
				
				if (currentTime - gamepad.userData.lastFireTime > fireRate) {
					try {
						// Different haptic feedback for different weapons
						const intensity = currentWeapon === 1 ? 0.2 : 0.3;
						const duration = currentWeapon === 1 ? 30 : 50;
						gamepad.getHapticActuator(0).pulse(intensity, duration);
					} catch {
						// do nothing
					}
					
					const blasterWorldPosition = new THREE.Vector3();
					const blasterWorldQuaternion = new THREE.Quaternion();
					weapons[currentWeapon].getWorldPosition(blasterWorldPosition);
					weapons[currentWeapon].getWorldQuaternion(blasterWorldQuaternion);
					
					fireBullet(scene, blasterWorldPosition, blasterWorldQuaternion);
					gamepad.userData.lastFireTime = currentTime;
				}
			} else {
				// Trigger released - stop flamethrower sound if it's playing
				if (currentWeapon === 1 && window.flamethrowerSound && window.flamethrowerSound.isPlaying) {
					window.flamethrowerSound.stop();
				}
			}
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

		
	});
	
	
	
	
	
	// Update flamethrower particles
	updateFlamethrowerParticles(delta, scene);
	
	
	
	// Update space environment
	updateSpaceEnvironment(delta);
	
	// Update machine gun system
	checkHandsOnMachineGun(controllers);
	
	// Check for machine gun firing (both triggers pressed)
	let triggerPressed = false;
	if (controllers[0] && controllers[0].gamepad && controllers[1] && controllers[1].gamepad) {
		const leftTrigger = controllers[0].gamepad.getAxis(XR_AXES.TRIGGER);
		const rightTrigger = controllers[1].gamepad.getAxis(XR_AXES.TRIGGER);
		triggerPressed = leftTrigger > 0.5 && rightTrigger > 0.5;
	}
	
	// Fire machine gun if both hands are on gun and both triggers are pressed
	if (isBothHandsOnGun && triggerPressed) {
		fireMachineGun(scene, _time, controllers);
	}
	
	// Desktop mouse controls for machine gun (both mouse buttons)
	if (isMouseMode && keyStates['mouseLeft'] && keyStates['mouseRight']) {
		// Simulate both hands on gun for mouse mode
		isBothHandsOnGun = true;
		fireMachineGun(scene, _time, controllers);
	}
	
	// Remove space cowboy particle effects - pure space environment
	
	// Update power-ups
	// Animate power-up pickups
	for (let i = powerUpPickups.length - 1; i >= 0; i--) {
		const powerUp = powerUpPickups[i];
		if (powerUp.userData.animate) {
			powerUp.userData.animate();
		}
		
		// Check collision with player/spaceship
		if (player && powerUp.position.distanceTo(player.position) < 2) {
			// Activate power-up
			activatePowerUp(powerUp.userData.type);
			
			// Remove power-up
			scene.remove(powerUp);
			powerUpPickups.splice(i, 1);
		}
		
		// Remove old power-ups (after 30 seconds)
		else if (Date.now() - powerUp.userData.createdAt > 30000) {
			scene.remove(powerUp);
			powerUpPickups.splice(i, 1);
		}
	}
	
	// Check for expired power-ups
	Object.keys(activePowerUps).forEach(key => {
		const powerUp = activePowerUps[key];
		if (powerUp.active && Date.now() > powerUp.endTime) {
			powerUp.active = false;
			console.log(`${key} power-up expired`);
		}
	});
	
	gsap.ticker.tick(delta);
}

function createFlamethrowerParticle() {
	// Reuse particles from pool if available
	if (flamethrowerParticlePool.length > 0) {
		return flamethrowerParticlePool.pop();
	}
	
	// Create new particle - even smaller size for better effect
	const geometry = new THREE.SphereGeometry(0.01, 3, 3);
	const material = new THREE.MeshBasicMaterial({
		color: new THREE.Color(
			Math.random() * 0.5 + 0.5, // Red component (0.5 - 1.0)
			Math.random() * 0.3,       // Green component (0.0 - 0.3)
			0                          // Blue component (0.0)
		),
		transparent: true,
		opacity: 0.9
	});
	const particle = new THREE.Mesh(geometry, material);
	
	particle.userData = {
		velocity: new THREE.Vector3(),
		lifetime: 0,
		maxLifetime: 0,
		isFlame: true // Mark as flame particle for collision detection
	};
	
	return particle;
}

function updateFlamethrowerParticles(delta, scene) {
	for (let i = flamethrowerParticles.length - 1; i >= 0; i--) {
		const particle = flamethrowerParticles[i];
		
		// Update particle
		particle.position.add(particle.userData.velocity.clone().multiplyScalar(delta));
		
		// Update lifetime
		particle.userData.lifetime += delta;
		
		// Fade out as particle ages
		const lifeRatio = particle.userData.lifetime / particle.userData.maxLifetime;
		particle.material.opacity = 0.8 * (1 - lifeRatio);
		
		// Randomly flicker color
		if (Math.random() < 0.1) {
			particle.material.color = new THREE.Color(
				Math.random() * 0.5 + 0.5, // Red
				Math.random() * 0.3,       // Green
				0                          // Blue
			);
		}
		
		
		
		// Remove dead particles
		if (particle.userData.lifetime >= particle.userData.maxLifetime) {
			scene.remove(particle);
			flamethrowerParticlePool.push(particle);
			flamethrowerParticles.splice(i, 1);
		}
	}
}

function emitFlamethrowerParticles(position, direction, scene) {
	// Emit multiple particles per call for flame effect
	const particleCount = 8; // More particles for denser flame
	
	for (let i = 0; i < particleCount; i++) {
		if (flamethrowerParticles.length >= maxFlamethrowerParticles) {
			// Don't create more particles if we've hit the limit
			break;
		}
		
		const particle = createFlamethrowerParticle();
		
		// Position particle at weapon nozzle with slight randomness
		particle.position.copy(position);
		particle.position.x += (Math.random() - 0.5) * 0.05;
		particle.position.y += (Math.random() - 0.5) * 0.05;
		particle.position.z += (Math.random() - 0.5) * 0.05;
		
		// Set velocity with spread
		const spread = 0.2; // Tighter spread for more focused flame
		particle.userData.velocity.copy(direction);
		particle.userData.velocity.x += (Math.random() - 0.5) * spread;
		particle.userData.velocity.y += (Math.random() - 0.5) * spread;
		particle.userData.velocity.z += (Math.random() - 0.5) * spread;
		
		// Scale velocity for flamethrower effect - faster particles
		particle.userData.velocity.multiplyScalar(8 + Math.random() * 7);
		
		// Set lifetime - shorter for more dynamic effect
		particle.userData.maxLifetime = 0.3 + Math.random() * 0.3;
		particle.userData.lifetime = 0;
		
		scene.add(particle);
		flamethrowerParticles.push(particle);
	}
}

init(setupScene, onFrame);