/**
 * Environment Module
 * Handles space environment, power-ups, asteroids, stars, and nebula
 */

import * as THREE from 'three';

// Environment objects
export let asteroids = [];
export let stars = [];
export let nebulaClouds = [];
export let powerUpPickups = [];
export let activePowerUps = {};

// Spaceship state
export let backgroundPlane = null;
export let spaceship = null;
export let autopilotSpeed = 5;
export let spaceshipPath = 0;

// Power-up types
export const POWERUP_TYPES = {
    RAPID_FIRE: 'rapidFire',
    EXPLOSIVE_ROUNDS: 'explosiveRounds',
    SHIELD: 'shield'
};

// Setters for module state
export function setSpaceship(ship) {
    spaceship = ship;
}

export function setSpaceshipPath(path) {
    spaceshipPath = path;
}

export function getSpaceshipPath() {
    return spaceshipPath;
}

export function createPowerUp(scene, position, type) {
    // Create a simple glowing cube as power-up
    const geometry = new THREE.BoxGeometry(0.5, 0.5, 0.5);
    let material;
    
    switch(type) {
        case POWERUP_TYPES.RAPID_FIRE:
            material = new THREE.MeshBasicMaterial({ 
                color: 0xff0000, 
                transparent: true, 
                opacity: 0.8 
            });
            break;
        case POWERUP_TYPES.EXPLOSIVE_ROUNDS:
            material = new THREE.MeshBasicMaterial({ 
                color: 0xff8800, 
                transparent: true, 
                opacity: 0.8 
            });
            break;
        case POWERUP_TYPES.SHIELD:
            material = new THREE.MeshBasicMaterial({ 
                color: 0x0088ff, 
                transparent: true, 
                opacity: 0.8 
            });
            break;
        default:
            material = new THREE.MeshBasicMaterial({ 
                color: 0x00ff00, 
                transparent: true, 
                opacity: 0.8 
            });
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
        powerUp.position.y += Math.sin(Date.now() * 0.005) * 0.01;
    };
    powerUp.userData.animate = animateRotation;
    
    console.log(`Power-up ${type} created at position:`, position);
}

export function activatePowerUp(type) {
    switch(type) {
        case POWERUP_TYPES.RAPID_FIRE:
            activePowerUps.rapidFire = { 
                active: true, 
                endTime: Date.now() + 15000,
                multiplier: 3
            };
            console.log('Rapid Fire activated for 15 seconds!');
            break;
        case POWERUP_TYPES.EXPLOSIVE_ROUNDS:
            activePowerUps.explosiveRounds = { 
                active: true, 
                endTime: Date.now() + 10000,
                radius: 3
            };
            console.log('Explosive Rounds activated for 10 seconds!');
            break;
        case POWERUP_TYPES.SHIELD:
            activePowerUps.shield = { 
                active: true, 
                endTime: Date.now() + 20000,
                hits: 5
            };
            console.log('Shield activated for 20 seconds!');
            break;
    }
}

export function createSpaceEnvironment(scene) {
    createStarfield(scene);
    createAsteroids(scene);
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

export function updateSpaceEnvironment(delta) {
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

export function updateSpaceship(delta, player) {
    const spaceshipSpeed = autopilotSpeed;
    
    // Move the spaceship automatically through space
    spaceshipPath += spaceshipSpeed * delta;
    window.playerPosition += spaceshipSpeed * delta;
    
    // Update spaceship position with slight movement pattern
    if (spaceship) {
        // Add slight side-to-side and up-down movement for more dynamic feel
        spaceship.position.x = Math.sin(spaceshipPath * 0.2) * 2;
        spaceship.position.y = Math.cos(spaceshipPath * 0.15) * 1;
        spaceship.position.z = -window.playerPosition;
        
        // Slight rotation for banking turns
        spaceship.rotation.z = Math.sin(spaceshipPath * 0.2) * 0.1;
        spaceship.rotation.x = Math.cos(spaceshipPath * 0.15) * 0.05;
    }
    
    // Keep player positioned on the spaceship
    if (spaceship && player) {
        // Position player on the spaceship bridge/turret position
        player.position.set(
            spaceship.position.x, 
            spaceship.position.y + 2, // Elevated position for better view
            spaceship.position.z
        );
    }
    
    // Update player position tracking
    if (player) {
        window.playerPosition = -player.position.z;
    }
}

export function updatePowerUps(scene, player, delta) {
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