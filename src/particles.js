/**
 * Particles Module
 * Handles flamethrower particle system
 */

import * as THREE from 'three';

// Flamethrower particles state
export let flamethrowerParticles = [];
export let maxFlamethrowerParticles = 100;
export let flamethrowerParticlePool = [];

// Create a flamethrower particle
export function createFlamethrowerParticle() {
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

// Update flamethrower particles
export function updateFlamethrowerParticles(delta, scene) {
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

// Emit flamethrower particles
export function emitFlamethrowerParticles(position, direction, scene) {
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

// Clear all flamethrower particles
export function clearFlamethrowerParticles(scene) {
    for (const particle of flamethrowerParticles) {
        scene.remove(particle);
        flamethrowerParticlePool.push(particle);
    }
    flamethrowerParticles = [];
}

// Get current particle count
export function getFlamethrowerParticleCount() {
    return flamethrowerParticles.length;
}

// Set max particles
export function setMaxFlamethrowerParticles(max) {
    maxFlamethrowerParticles = max;
}