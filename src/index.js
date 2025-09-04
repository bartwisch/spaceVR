/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

// All (namespace) imports first

import * as THREE from 'three';
// Multiple imports next, sorted by imported identifier (ESLint sort-imports)
import { XR_BUTTONS } from 'gamepad-wrapper';


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




let laserSound;





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







function createStationaryMachineGun(player) {
	// Create machine gun mount/base
	const mountGeometry = new THREE.CylinderGeometry(0.3, 0.4, 0.2, 8);
	const mountMaterial = new THREE.MeshLambertMaterial({ color: 0x444444 });
	machineGunMount = new THREE.Mesh(mountGeometry, mountMaterial);
	machineGunMount.position.set(0, 1, -2); // Position in front of player
	player.add(machineGunMount);
	
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
	machineGunMount.scale.set(3, 3, 3);
	
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
	
	
	// Create space environment instead of road
	createSpaceEnvironment(scene);
	
	
	
	
	// Create stationary machine gun
	createStationaryMachineGun(player);
	
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

	
	
	// Create a simple wave sound for flamethrower by modifying the laser sound
	window.flamethrowerSound = new THREE.PositionalAudio(listener);
	// We'll set the buffer when the laser sound loads

	

	
	
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