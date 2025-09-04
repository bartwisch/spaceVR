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

// Jetpack particles for space cowboys
let jetpackParticles = [];
let maxJetpackParticles = 200;
let jetpackParticlePool = [];

// Space environment
let asteroids = [];
let stars = [];
let nebulaClouds = [];

// Weapon switching
let currentWeapon = 0; // 0 = red weapon, 1 = blue weapon (flamethrower)
const weapons = [blasterGroup, blueBlasterGroup];

const RUN_SPEED = 2.5;
const WALK_SPEED = 0.8;
const ATTACK_THRESHOLD = 5; // Distance to stop and attack (or idle)
const WALK_THRESHOLD = 12; // Distance to switch from running to walking

const AVOIDANCE_RADIUS = 3.0; // For space cowboy-space cowboy avoidance
const OBSTACLE_AVOIDANCE_RADIUS = 8.0; // For space cowboy-obstacle avoidance
const AVOIDANCE_STRENGTH = 3.0; // Increased strength

// Space Cowboy enemies
const spaceCowboys = [];
const spaceCowboyMixers = [];
let spaceCowboyGltf = null;

// Spaceship auto-pilot movement
let road = null;
let backgroundPlane = null;
let spaceship = null; // The player's spaceship
window.playerPosition = 0; // Make it globally accessible - represents spaceship position
let globalCamera = null; // Global reference to camera for spaceCowboy targeting
let autopilotSpeed = 5; // Speed of spaceship auto-pilot
let spaceshipPath = 0; // Current position along the spaceship's path

// Wave-based space cowboy spawning system
let currentWave = 1;
let spaceCowboysInCurrentWave = 0;
let maxSpaceCowboysPerWave = 5; // Start with 5 spaceCowboys per wave
let spaceCowboysKilled = 0;
let waveStartTime = 0;
let timeBetweenWaves = 3; // 3 seconds between waves
let spawnRate = 2; // Spawn 1 spaceCowboy every 2 seconds during wave

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
const obstacles = [];

let laserSound, scoreSound, cowboyCallouts, alienHisses;



function spawnSpaceCowboy(scene) {
	if (!spaceCowboyGltf || blasterGroup.children.length === 0) {
		// Also check if blaster is loaded
		console.log('No spaceCowboy or blaster GLTF loaded yet');
		console.log('BlasterGroup children count:', blasterGroup.children.length);
		if (blasterGroup.children.length > 0) {
			console.log('First blaster child:', blasterGroup.children[0]);
		}
		return;
	}

	console.log('Spawning spaceCowboy...');
	console.log('BlasterGroup children count:', blasterGroup.children.length);
	if (blasterGroup.children.length > 0) {
		console.log('First blaster child:', blasterGroup.children[0]);
	}
	
	// Properly clone the GLTF scene with animations using SkeletonUtils
	const spaceCowboy = SkeletonUtils.clone(spaceCowboyGltf.scene);
	
	// Set position around the spaceship (360° approach)
	const angle = Math.random() * Math.PI * 2; // Random angle in radians
	const distance = 15 + Math.random() * 10; // 15-25 units from center
	
	// Use window.playerPosition for positioning
	spaceCowboy.position.set(
		Math.cos(angle) * distance,    // X: circular position
		Math.random() * 3,             // Y: slight height variation
		-window.playerPosition + Math.sin(angle) * distance  // Z: circular position around player
	);
	
	// Make the spaceCowboy face the spaceship
	spaceCowboy.lookAt(0, 1.6, -window.playerPosition); // Face the spaceship center
	
	spaceCowboy.scale.setScalar(1.2);
	scene.add(spaceCowboy);
	spaceCowboys.push(spaceCowboy);
	
	console.log('Space Cowboy added to scene at position:', spaceCowboy.position);
	console.log('Total Space Cowboys:', spaceCowboys.length);

	// Play space cowboy callout when spawning (30% chance)
	if (Math.random() < 0.3) {
		setTimeout(() => playSpaceCowboyCallout(), Math.random() * 2000); // Random delay 0-2 seconds
	}

	// Store shooting interval for this space cowboy
	const shootInterval = setInterval(() => {
		// Shoot at the player every 3 seconds
		if (globalCamera) {
			shootAtPlayer(spaceCowboy, scene, globalCamera);
		}
	}, 3000);
	
	// Store the interval ID so we can clear it later
	spaceCowboy.userData.shootInterval = shootInterval;

	console.log('Zombie added to scene at position:', spaceCowboy.position);
	console.log('Total spaceCowboys:', spaceCowboys.length);

	// Setup animation mixer for this spaceCowboy
	if (spaceCowboyGltf.animations && spaceCowboyGltf.animations.length > 0) {
		const mixer = new THREE.AnimationMixer(spaceCowboy);
		const spaceCowboyData = {
			mixer: mixer,
			animations: spaceCowboyGltf.animations,
			currentAction: null,
			idleAction: null,
			deathAction: null,
			walkAction: null,
			runAction: null
		};
		spaceCowboyMixers.push(spaceCowboyData);
		
		console.log('Setting up animations, found:', spaceCowboyGltf.animations.length, 'animations');
		
		// Find spaceCowboy-specific animations
		let idleAction = null;
		let deathAction = null;
		let walkAction = null;
		let runAction = null;
		
		for (let animation of spaceCowboyGltf.animations) {
			const animName = animation.name.toLowerCase();
			if (animName.includes('idle') || animName.includes('wink') || animName.includes('wave') || animName.includes('greeting')) {
				idleAction = mixer.clipAction(animation);
			} else if (animName.includes('dead') || animName.includes('death')) {
				deathAction = mixer.clipAction(animation);
			} else if (animName.includes('walk') || animName.includes('shamble')) {
				walkAction = mixer.clipAction(animation);
			} else if (animName.includes('run') || animName.includes('sprint')) {
				runAction = mixer.clipAction(animation);
			}
		}
		
		// If no specific animations found, use first animation as idle
		if (!idleAction && spaceCowboyGltf.animations.length > 0) {
			idleAction = mixer.clipAction(spaceCowboyGltf.animations[0]);
			console.log('Using first animation as idle:', spaceCowboyGltf.animations[0].name);
		}
		
		// Store all animation references
		spaceCowboyData.idleAction = idleAction;
		spaceCowboyData.deathAction = deathAction;
		spaceCowboyData.walkAction = walkAction;
		spaceCowboyData.runAction = runAction;
		
		// Start with idle animation
		if (idleAction) {
			idleAction.setLoop(THREE.LoopRepeat, Infinity);
			idleAction.play();
			spaceCowboyData.currentAction = idleAction;
			console.log('Idle animation started');
		}
		
		// Store animation references in userData
		spaceCowboy.userData = {
			...spaceCowboy.userData,
			idleAction: idleAction,
			deathAction: deathAction,
			walkAction: walkAction,
			runAction: runAction,
			hasPlayedDeath: false
		};
		
	} else {
		console.log('No animations found for spaceCowboy');
	}
}

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

function createSpaceCowboyCallouts() {
	// Create audio callouts for space cowboys
	const callouts = [
		"Yeehaw! Space ain't big enough for the both of us!",
		"Draw, partner!",
		"This here's my sector now!",
		"Giddyup, space cowpoke!",
		"Time to rustle some spaceship parts!",
		"Houston, we got a cowboy problem!",
		"Saddle up them rocket boots!"
	];
	
	cowboyCallouts = callouts;
}

function playSpaceCowboyCallout() {
	if (cowboyCallouts && cowboyCallouts.length > 0) {
		const randomCallout = cowboyCallouts[Math.floor(Math.random() * cowboyCallouts.length)];
		console.log(`🤠 Space Cowboy: "${randomCallout}"`);
		
		// TODO: Replace with actual audio playback when audio files are available
		// const audio = new Audio(`audio/cowboy_${index}.ogg`);
		// audio.volume = 0.5;
		// audio.play();
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

function createJetpackParticle(spaceCowboy) {
	// Reuse particles from pool if available
	if (jetpackParticlePool.length > 0) {
		const particle = jetpackParticlePool.pop();
		resetJetpackParticle(particle, spaceCowboy);
		return particle;
	}

	const geometry = new THREE.SphereGeometry(0.02, 6, 6);
	const material = new THREE.MeshBasicMaterial({ 
		color: new THREE.Color().setHSL(0.1, 1, 0.6), // Orange flame color
		transparent: true,
		opacity: 0.8
	});
	
	const particle = new THREE.Mesh(geometry, material);
	resetJetpackParticle(particle, spaceCowboy);
	
	return particle;
}

function resetJetpackParticle(particle, spaceCowboy) {
	// Position at the space cowboy's back (jetpack location)
	const jetpackOffset = new THREE.Vector3(0, -0.5, 0.3); // Behind and below
	particle.position.copy(spaceCowboy.position).add(jetpackOffset);
	
	// Random spread for jetpack exhaust
	particle.position.x += (Math.random() - 0.5) * 0.2;
	particle.position.y += (Math.random() - 0.5) * 0.2;
	particle.position.z += (Math.random() - 0.5) * 0.2;
	
	// Jetpack exhaust direction (downward and slightly behind)
	particle.userData = {
		velocity: new THREE.Vector3(
			(Math.random() - 0.5) * 2,
			-3 - Math.random() * 2, // Downward thrust
			-1 - Math.random() * 2  // Backward thrust
		),
		life: 1.0,
		maxLife: 1.0 + Math.random() * 0.5,
		startColor: new THREE.Color().setHSL(0.1, 1, 0.8), // Bright orange
		endColor: new THREE.Color().setHSL(0.0, 1, 0.2)    // Dark red
	};
	
	particle.material.color.copy(particle.userData.startColor);
	particle.material.opacity = 0.8;
	particle.scale.setScalar(0.5 + Math.random() * 0.5);
}

function updateJetpackParticles(delta, scene) {
	for (let i = jetpackParticles.length - 1; i >= 0; i--) {
		const particle = jetpackParticles[i];
		const userData = particle.userData;
		
		// Update position
		particle.position.add(userData.velocity.clone().multiplyScalar(delta));
		
		// Update life
		userData.life -= delta;
		const lifeRatio = userData.life / userData.maxLife;
		
		if (lifeRatio <= 0) {
			// Remove particle
			scene.remove(particle);
			jetpackParticles.splice(i, 1);
			
			// Return to pool for reuse
			if (jetpackParticlePool.length < maxJetpackParticles) {
				jetpackParticlePool.push(particle);
			}
		} else {
			// Update visual properties
			particle.material.color.lerpColors(userData.endColor, userData.startColor, lifeRatio);
			particle.material.opacity = lifeRatio * 0.8;
			particle.scale.setScalar(lifeRatio * (0.5 + Math.random() * 0.3));
		}
	}
}

function shootAtPlayer(spaceCowboy, scene, camera) {
	// Check if space cowboy is still alive
	if (spaceCowboy.userData.hasPlayedDeath) {
		return;
	}
	
	// Get space cowboy's position
	const spaceCowboyPosition = new THREE.Vector3();
	spaceCowboy.getWorldPosition(spaceCowboyPosition);
	
	// Get player's actual camera position
	const playerPos = new THREE.Vector3();
	camera.getWorldPosition(playerPos);
	
	// Calculate direction from spaceCowboy to player
	const direction = new THREE.Vector3().subVectors(playerPos, spaceCowboyPosition).normalize();
	
	// Create a bullet
	const bulletGeometry = new THREE.SphereGeometry(0.1, 8, 8);
	const bulletMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
	const bullet = new THREE.Mesh(bulletGeometry, bulletMaterial);
	
	// Position bullet at spaceCowboy's position
	bullet.position.copy(spaceCowboyPosition);
	
	// Set bullet velocity
	const bulletSpeed = 10;
	bullet.userData = {
		velocity: direction.multiplyScalar(bulletSpeed),
		timeToLive: 5 // Bullet disappears after 5 seconds
	};
	
	scene.add(bullet);
	
	// Store bullet for updates
	if (!window.spaceCowboyBullets) window.spaceCowboyBullets = [];
	window.spaceCowboyBullets.push(bullet);
	
	console.log('Zombie shot at player');
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
	
	// Road markers have been removed.
	
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
			obstacles.push(tree);
		} else { // 30% chance of a house
			const house = createHouse();
			house.position.set(xPos, 0, zPos);
			house.rotation.y = Math.random() * Math.PI;
			scene.add(house);
			obstacles.push(house);
		}
	}
}

function setupScene({ scene, camera, _renderer, player, _controllers, controls }) {
	// Store global camera reference for space cowboy targeting
	globalCamera = camera;
	
	// Create space environment instead of road
	createSpaceEnvironment(scene);
	
	// Initialize space-western audio system
	createSpaceCowboyCallouts();
	createAlienSounds();
	
	// Create road (keep for collision system)
	createRoad(scene);
	populateScenery(scene);
	
	// Space environment lighting
	const ambientLight = new THREE.AmbientLight(0x202040, 1.5); // Darker space ambient
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

	// Load spaceCowboy enemy (use cowboy model as placeholder)
	gltfLoader.load('assets/cowboy1.glb', (gltf) => {
		spaceCowboyGltf = gltf;
		// Spawn a single test spaceCowboy after a short delay
		setTimeout(() => spawnSpaceCowboy(scene), 2000);
		
		// Spawn test power-ups after a longer delay
		setTimeout(() => {
			createPowerUp(scene, new THREE.Vector3(3, 1, -5), POWERUP_TYPES.RAPID_FIRE);
			createPowerUp(scene, new THREE.Vector3(-3, 1, -8), POWERUP_TYPES.EXPLOSIVE_ROUNDS);
			createPowerUp(scene, new THREE.Vector3(0, 1, -12), POWERUP_TYPES.SHIELD);
		}, 5000);
	});

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
	
	// Move the road and background to stay centered on the player
	if (road) {
		road.position.z = -window.playerPosition;
	}
	if (backgroundPlane) {
		backgroundPlane.position.z = -window.playerPosition - 150;
	}
	
	// Update spaceCowboys: movement, orientation, and animations
	for (let i = 0; i < spaceCowboys.length; i++) {
		const spaceCowboy = spaceCowboys[i];
		const spaceCowboyData = spaceCowboyMixers[i];

		// Skip logic for spaceCowboys that are "dead" and animating
		if (spaceCowboy.userData.hasPlayedDeath) {
			continue;
		}

		// --- Orientation ---
		const playerTargetPosition = new THREE.Vector3();
		camera.getWorldPosition(playerTargetPosition);
		const lookAtTarget = new THREE.Vector3(
			playerTargetPosition.x,
			spaceCowboy.position.y,
			playerTargetPosition.z,
		);
		spaceCowboy.lookAt(lookAtTarget);

		// --- Movement & Animation ---
		const distanceToPlayer = spaceCowboy.position.distanceTo(playerTargetPosition);
		let moveDirection = new THREE.Vector3();
		let speed = 0;

		if (distanceToPlayer > WALK_THRESHOLD) {
			moveDirection.subVectors(lookAtTarget, spaceCowboy.position).normalize();
			speed = RUN_SPEED;
			// Switch to run animation
			if (spaceCowboyData.runAction) {
				if (spaceCowboyData.currentAction !== spaceCowboyData.runAction) {
					if (spaceCowboyData.currentAction) {
						spaceCowboyData.currentAction.fadeOut(0.3);
					}
					spaceCowboyData.runAction.reset().fadeIn(0.3).play();
					spaceCowboyData.currentAction = spaceCowboyData.runAction;
				}
			} else if (spaceCowboyData.idleAction) {
				// Fallback to idle if no run animation
				if (spaceCowboyData.currentAction !== spaceCowboyData.idleAction) {
					if (spaceCowboyData.currentAction) {
						spaceCowboyData.currentAction.fadeOut(0.3);
					}
					spaceCowboyData.idleAction.reset().fadeIn(0.3).play();
					spaceCowboyData.currentAction = spaceCowboyData.idleAction;
				}
			}

		} else if (distanceToPlayer > ATTACK_THRESHOLD) {
			moveDirection.subVectors(lookAtTarget, spaceCowboy.position).normalize();
			speed = WALK_SPEED;
			// Switch to walk animation
			if (spaceCowboyData.walkAction) {
				if (spaceCowboyData.currentAction !== spaceCowboyData.walkAction) {
					if (spaceCowboyData.currentAction) {
						spaceCowboyData.currentAction.fadeOut(0.3);
					}
					spaceCowboyData.walkAction.reset().fadeIn(0.3).play();
					spaceCowboyData.currentAction = spaceCowboyData.walkAction;
				}
			} else if (spaceCowboyData.idleAction) {
				// Fallback to idle if no walk animation
				if (spaceCowboyData.currentAction !== spaceCowboyData.idleAction) {
					if (spaceCowboyData.currentAction) {
						spaceCowboyData.currentAction.fadeOut(0.3);
					}
					spaceCowboyData.idleAction.reset().fadeIn(0.3).play();
					spaceCowboyData.currentAction = spaceCowboyData.idleAction;
				}
			}

		} else {
			speed = 0;
			// Switch to idle animation
			if (spaceCowboyData.idleAction) {
				if (spaceCowboyData.currentAction !== spaceCowboyData.idleAction) {
					if (spaceCowboyData.currentAction) {
						spaceCowboyData.currentAction.fadeOut(0.3);
					}
					spaceCowboyData.idleAction.reset().fadeIn(0.3).play();
					spaceCowboyData.currentAction = spaceCowboyData.idleAction;
				}
			}
		}

		// --- Collision Avoidance ---
		const avoidanceVector = new THREE.Vector3();
		// Avoid other spaceCowboys
		for (let j = 0; j < spaceCowboys.length; j++) {
			if (i === j) continue; // Don't check against self

			const otherZombie = spaceCowboys[j];
			// Only avoid spaceCowboys that are also alive
			if (otherZombie.userData.hasPlayedDeath) continue;

			const distanceToOther = spaceCowboy.position.distanceTo(otherZombie.position);

			if (distanceToOther < AVOIDANCE_RADIUS) {
				const awayVector = new THREE.Vector3().subVectors(spaceCowboy.position, otherZombie.position).normalize();
				avoidanceVector.add(awayVector);
			}
		}

		// Avoid obstacles (trees, houses)
		for (const obstacle of obstacles) {
			const distanceToObstacle = spaceCowboy.position.distanceTo(obstacle.position);
			if (distanceToObstacle < OBSTACLE_AVOIDANCE_RADIUS) {
				const awayVector = new THREE.Vector3().subVectors(spaceCowboy.position, obstacle.position).normalize();
				avoidanceVector.add(awayVector);
			}
		}

		// Combine movement and avoidance vectors
		const intendedMove = moveDirection.multiplyScalar(speed);
		const avoidanceMove = avoidanceVector.multiplyScalar(AVOIDANCE_STRENGTH);
		
		const totalMove = new THREE.Vector3().add(intendedMove).add(avoidanceMove);

		// Apply the final movement
		spaceCowboy.position.add(totalMove.multiplyScalar(delta));
	}
	
	// Wave-based spaceCowboy spawning system
	if (spaceCowboyGltf) {
		// Check if current wave is complete
		if (spaceCowboysInCurrentWave >= maxSpaceCowboysPerWave && spaceCowboys.length === 0) {
			// Wave complete, start next wave after delay
			if (Date.now() - waveStartTime > timeBetweenWaves * 1000) {
				currentWave++;
				spaceCowboysInCurrentWave = 0;
				maxSpaceCowboysPerWave = Math.min(20, 5 + (currentWave - 1) * 2); // Increase difficulty
				spawnRate = Math.max(1, spawnRate - 0.1); // Faster spawning each wave
				waveStartTime = Date.now();
				console.log(`Starting Wave ${currentWave} with ${maxSpaceCowboysPerWave} spaceCowboys`);
			}
		}
		
		// Spawn spaceCowboys during active wave
		if (spaceCowboysInCurrentWave < maxSpaceCowboysPerWave && spaceCowboys.length < maxSpaceCowboysPerWave) {
			// Check spawn timing
			if (Math.random() < (1 / (spawnRate * 60))) { // Convert to per-frame probability
				spawnSpaceCowboy(scene);
				spaceCowboysInCurrentWave++;
				console.log(`Spawned spaceCowboy ${spaceCowboysInCurrentWave}/${maxSpaceCowboysPerWave} in wave ${currentWave}`);
			}
		}
	}
	
	// Remove spaceCowboys that are too far behind
	for (let i = spaceCowboys.length - 1; i >= 0; i--) {
		const spaceCowboy = spaceCowboys[i];
		if (spaceCowboy.position.z > -window.playerPosition + 15) { // 15 units behind player
			// Clear the shooting interval
			if (spaceCowboy.userData.shootInterval) {
				clearInterval(spaceCowboy.userData.shootInterval);
			}
			scene.remove(spaceCowboy);
			spaceCowboys.splice(i, 1);
			if (spaceCowboyMixers[i]) {
				spaceCowboyMixers.splice(i, 1);
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

		// Check collision with spaceCowboys
		if (!bulletHit) {
			spaceCowboys.forEach((spaceCowboy, index) => {
				if (bulletHit) {
					console.log('Skipping spaceCowboy check - bullet already hit something');
					return;
				}
				const distance = spaceCowboy.position.distanceTo(bullet.position);
				// Increased hitbox size for better collision detection
				if (distance < 2.0) {
					console.log('Zombie collision detected! Distance:', distance, 'Index:', index);
					console.log('Zombie position:', spaceCowboy.position);
					console.log('Bullet position:', bullet.position);
					console.log('Zombies array length before removal:', spaceCowboys.length);
					bulletHit = true;
					
					// Play death animation if available
					const spaceCowboyData = spaceCowboyMixers[index];
					if (spaceCowboyData && spaceCowboyData.mixer && spaceCowboy.userData && spaceCowboy.userData.deathAction && !spaceCowboy.userData.hasPlayedDeath) {
						console.log('Playing death animation in place');
						spaceCowboy.userData.hasPlayedDeath = true;
						
						// Stop current idle animation
						if (spaceCowboy.userData.idleAction) {
							spaceCowboy.userData.idleAction.stop();
						}
						
						// Play death animation
						const deathAction = spaceCowboy.userData.deathAction;
						deathAction.setLoop(THREE.LoopOnce, 1);
						deathAction.clampWhenFinished = true;
						deathAction.play();
						
						// Remove bullet but keep spaceCowboy visible during death animation
						console.log('Removing bullet from bullets object and scene');
						delete bullets[bullet.uuid];
						scene.remove(bullet);
						
						// After death animation completes, remove spaceCowboy
						setTimeout(() => {
							console.log('Death animation complete, removing spaceCowboy from scene');

							// Find the current index of the spaceCowboy, as it may have changed
							const currentIndex = spaceCowboys.indexOf(spaceCowboy);
							if (currentIndex === -1) {
								// Zombie already removed, do nothing
								return;
							}

							// Clear the shooting interval
							if (spaceCowboy.userData.shootInterval) {
								clearInterval(spaceCowboy.userData.shootInterval);
							}
							
							scene.remove(spaceCowboy);
							spaceCowboys.splice(currentIndex, 1);
							console.log('Zombies array length after removal:', spaceCowboys.length);
							
							// Remove corresponding mixer data at the same index
							spaceCowboyMixers.splice(currentIndex, 1);
							
						}, 4000); // Wait 4 seconds total for death animation
						
					} else {
						// No death animation available, remove immediately
						console.log('No death animation available, removing immediately');
						console.log('Removing bullet from bullets object and scene');
						delete bullets[bullet.uuid];
						scene.remove(bullet);
						console.log('Removing spaceCowboy from scene');
						// Clear the shooting interval
						if (spaceCowboy.userData.shootInterval) {
							clearInterval(spaceCowboy.userData.shootInterval);
						}
						scene.remove(spaceCowboy);
						spaceCowboys.splice(index, 1);
						console.log('Zombies array length after removal:', spaceCowboys.length);
						
						// Remove corresponding mixer data
						if (spaceCowboyMixers[index]) {
							spaceCowboyMixers.splice(index, 1);
						}
					}

					// Score display removed - no need to update score
					console.log('Zombie hit processing complete');
				}
			});
		}
	});
	
	// Update spaceCowboy animations
	spaceCowboyMixers.forEach(spaceCowboyData => {
		if (spaceCowboyData.mixer) {
			spaceCowboyData.mixer.update(delta);
		}
	});
	
	// Update spaceCowboy bullets
	if (window.spaceCowboyBullets) {
		for (let i = window.spaceCowboyBullets.length - 1; i >= 0; i--) {
			const bullet = window.spaceCowboyBullets[i];
			
			// Update bullet position
			bullet.position.add(bullet.userData.velocity.clone().multiplyScalar(delta));
			
			// Update TTL
			bullet.userData.timeToLive -= delta;
			
			// Remove bullet if TTL expired
			if (bullet.userData.timeToLive <= 0) {
				scene.remove(bullet);
				window.spaceCowboyBullets.splice(i, 1);
			}
			
			// TODO: Add collision detection with player
		}
	}
	
	// Update flamethrower particles
	updateFlamethrowerParticles(delta, scene);
	
	// Update jetpack particles for space cowboys
	updateJetpackParticles(delta, scene);
	
	// Update space environment
	updateSpaceEnvironment(delta);
	
	// Spawn jetpack particles for moving space cowboys
	spaceCowboys.forEach(spaceCowboy => {
		if (!spaceCowboy.userData.hasPlayedDeath && Math.random() < 0.3) {
			// Create jetpack particles
			for (let i = 0; i < 2; i++) {
				const particle = createJetpackParticle(spaceCowboy);
				scene.add(particle);
				jetpackParticles.push(particle);
			}
		}
	});
	
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
		
		// Check collision with spaceCowboys
		for (let j = spaceCowboys.length - 1; j >= 0; j--) {
			const spaceCowboy = spaceCowboys[j];
			if (spaceCowboy.userData.hasPlayedDeath) continue;
			
			const distance = spaceCowboy.position.distanceTo(particle.position);
			// Smaller hitbox for flamethrower (particles are small)
			if (distance < 1.0) {
				// Kill the spaceCowboy
				const spaceCowboyData = spaceCowboyMixers[j];
				if (spaceCowboyData && spaceCowboyData.mixer && spaceCowboy.userData && spaceCowboy.userData.deathAction && !spaceCowboy.userData.hasPlayedDeath) {
					console.log('Zombie hit by flamethrower! Distance:', distance);
					spaceCowboy.userData.hasPlayedDeath = true;
					
					// Stop current idle animation
					if (spaceCowboy.userData.idleAction) {
						spaceCowboy.userData.idleAction.stop();
					}
					
					// Play death animation
					const deathAction = spaceCowboy.userData.deathAction;
					deathAction.setLoop(THREE.LoopOnce, 1);
					deathAction.clampWhenFinished = true;
					deathAction.play();
					
					// Clear the shooting interval
					if (spaceCowboy.userData.shootInterval) {
						clearInterval(spaceCowboy.userData.shootInterval);
					}
					
					// Increase score
					// Score display removed - no need to update score
					
					// Remove the particle that hit the spaceCowboy
					scene.remove(particle);
					flamethrowerParticlePool.push(particle);
					flamethrowerParticles.splice(i, 1);
					
					// After death animation completes, remove spaceCowboy
					setTimeout(() => {
						// Find the current index of the spaceCowboy, as it may have changed
						const currentIndex = spaceCowboys.indexOf(spaceCowboy);
						if (currentIndex === -1) {
							// Zombie already removed, do nothing
							return;
						}

						// Clear the shooting interval
						if (spaceCowboy.userData.shootInterval) {
							clearInterval(spaceCowboy.userData.shootInterval);
						}
						
						scene.remove(spaceCowboy);
						spaceCowboys.splice(currentIndex, 1);
						console.log('Zombies array length after removal:', spaceCowboys.length);
						
						// Remove corresponding mixer data at the same index
						spaceCowboyMixers.splice(currentIndex, 1);
						
					}, 4000); // Wait 4 seconds total for death animation
					
					break; // Break since this particle is now gone
				}
			}
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