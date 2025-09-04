/**
 * Setup Module
 * Handles scene initialization and configuration
 */

import * as THREE from 'three';
import * as environmentModule from './environment.js';
import * as weaponsModule from './weapons.js';
import { init } from './init.js';
import { onFrame } from './gameLoop.js';

// Audio elements
export let laserSound;
export let flamethrowerSound;

// Initialize window globals
window.playerPosition = 0;
window.flamethrowerSound = null;

export function setupScene({ scene, camera, _renderer, player, _controllers, controls: _controls }) {
    scene.background = new THREE.Color(0x000000);
    
    // Create space environment instead of road
    environmentModule.createSpaceEnvironment(scene);
    
    // Create stationary machine gun
    weaponsModule.createStationaryMachineGun(player);
    
    // Space environment lighting
    const ambientLight = new THREE.AmbientLight(0x101020, 1.5); // Darker space ambient
    scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(5, 10, 7);
    scene.add(directionalLight);
    
    // Create a circle around the player
    const ringGeometry = new THREE.RingGeometry(1.9, 2, 32);
    const ringMaterial = new THREE.MeshBasicMaterial({ 
        color: 0x00ff00, 
        side: THREE.DoubleSide 
    });
    const ring = new THREE.Mesh(ringGeometry, ringMaterial);
    ring.rotation.x = -Math.PI / 2; // Rotate it to be flat on the ground
    ring.position.y = 0.1; // Lift it slightly above the ground
    
    // Add the circle as a child of the player so it moves with the player
    player.add(ring);
    
    // Spawn test power-ups for machine gun testing
    setTimeout(() => {
        environmentModule.createPowerUp(
            scene, 
            new THREE.Vector3(3, 1, -5), 
            environmentModule.POWERUP_TYPES.RAPID_FIRE
        );
        environmentModule.createPowerUp(
            scene, 
            new THREE.Vector3(-3, 1, -8), 
            environmentModule.POWERUP_TYPES.EXPLOSIVE_ROUNDS
        );
        environmentModule.createPowerUp(
            scene, 
            new THREE.Vector3(0, 1, -12), 
            environmentModule.POWERUP_TYPES.SHIELD
        );
    }, 5000);
    
    // Create 3D text display for button names
    let buttonTextDisplay = null;
    import('troika-three-text').then(({ Text }) => {
        buttonTextDisplay = new Text();
        buttonTextDisplay.text = 'No button pressed';
        buttonTextDisplay.fontSize = 0.2;
        buttonTextDisplay.color = 0x00ff00;
        buttonTextDisplay.position.set(0, 1.5, -2); // Position in front of the player
        buttonTextDisplay.sync();
        scene.add(buttonTextDisplay);
        
        // Store reference for updates
        window.buttonTextDisplay = buttonTextDisplay;
    });
    
    // Load and set up positional audio
    const listener = new THREE.AudioListener();
    camera.add(listener);
    
    const audioLoader = new THREE.AudioLoader();
    laserSound = new THREE.PositionalAudio(listener);
    audioLoader.load('assets/laser.ogg', (buffer) => {
        laserSound.setBuffer(buffer);
        weaponsModule.blasterGroup.add(laserSound);
        
        // Also set up flamethrower sound
        if (window.flamethrowerSound) {
            window.flamethrowerSound.setBuffer(buffer);
            // Set a lower playback rate for a deeper, wave-like sound
            window.flamethrowerSound.setPlaybackRate(0.7);
        }
    });
    
    // Create a simple wave sound for flamethrower
    window.flamethrowerSound = new THREE.PositionalAudio(listener);
    flamethrowerSound = window.flamethrowerSound;
    
    // Disable context menu on right-click for machine gun controls
    window.addEventListener('contextmenu', (event) => {
        event.preventDefault();
    });
}

// Export functions for weapon system to use
export function getFlamethrowerSound() {
    return flamethrowerSound;
}

export function getLaserSound() {
    return laserSound;
}

// Initialize the game
init(setupScene, onFrame);
