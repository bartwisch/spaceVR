/**
 * Game Loop Module
 * Handles main frame update logic and controller input processing
 */

import * as environmentModule from './environment.js';
import * as particlesModule from './particles.js';
import * as weaponsModule from './weapons.js';
import { XR_AXES, XR_BUTTONS } from 'gamepad-wrapper';

// Main game loop function
export function onFrame(
    delta,
    _time,
    { scene, _camera, _renderer, player, controllers }
) {
    // Update spaceship and player position
    environmentModule.updateSpaceship(delta, player);
    
    // Update space environment
    environmentModule.updateSpaceEnvironment(delta);
    
    // Update bullets
    weaponsModule.updateBullets(delta, scene);
    
    // Update flamethrower particles
    particlesModule.updateFlamethrowerParticles(delta, scene);
    
    // Update power-ups
    environmentModule.updatePowerUps(scene, player, delta);
    
    // Update machine gun system
    weaponsModule.checkHandsOnMachineGun(controllers);
    
    // Handle machine gun controls
    handleMachineGunControls(controllers, delta, _time, scene);
    
    // Update controller state display
    updateControllerStateDisplay(controllers);
}

// Handle machine gun controls
function handleMachineGunControls(controllers, delta, time, scene) {
    // Check for machine gun holding (both squeeze buttons pressed)
    let squeezePressed = false;
    if (controllers.left && controllers.left.gamepad && 
        controllers.right && controllers.right.gamepad) {
        const leftSqueeze = controllers.left.gamepad.getButton(XR_BUTTONS.SQUEEZE);
        const rightSqueeze = controllers.right.gamepad.getButton(XR_BUTTONS.SQUEEZE);
        squeezePressed = leftSqueeze && rightSqueeze;
    }

    // Handle gun rotation with thumbsticks when holding the gun
    if (squeezePressed && weaponsModule.machineGunMount) {
        // Use the thumbsticks for rotation
        if(controllers.right && controllers.right.gamepad) {
            const rightThumbstickX = controllers.right.gamepad.getAxis(XR_AXES.THUMBSTICK_X);
            const rightThumbstickY = controllers.right.gamepad.getAxis(XR_AXES.THUMBSTICK_Y);
            
            // Only rotate if thumbstick is pushed beyond deadzone
            if (Math.abs(rightThumbstickX) > 0.1 || Math.abs(rightThumbstickY) > 0.1) {
                const rotateSpeed = 2.0;
                const rotationDeltaY = -rightThumbstickX * rotateSpeed * delta;
                const rotationDeltaX = -rightThumbstickY * rotateSpeed * delta;
                
                // Rotate the gun around the Y axis (horizontal)
                weaponsModule.machineGunMount.rotateY(rotationDeltaY);
                
                // Rotate the gun around the X axis (vertical) - limited to avoid flipping
                const currentRotationX = weaponsModule.machineGunMount.rotation.x;
                const newRotationX = Math.max(-Math.PI/3, 
                    Math.min(Math.PI/3, currentRotationX + rotationDeltaX));
                weaponsModule.machineGunMount.rotation.x = newRotationX;
            }
        }
        
        // Also allow left thumbstick for additional control
        if(controllers.left && controllers.left.gamepad) {
            const leftThumbstickX = controllers.left.gamepad.getAxis(XR_AXES.THUMBSTICK_X);
            
            // Only rotate if thumbstick is pushed beyond deadzone
            if (Math.abs(leftThumbstickX) > 0.1) {
                const rotateSpeed = 1.0;
                const rotationDelta = -leftThumbstickX * rotateSpeed * delta;
                
                // Rotate the gun around the Y axis (horizontal)
                weaponsModule.machineGunMount.rotateY(rotationDelta);
            }
        }
    }
    
    // Handle trigger shooting for both controllers
    if (controllers.left && controllers.left.gamepad && weaponsModule.machineGun) {
        // Check if left trigger is pressed
        const leftTriggerPressed = controllers.left.gamepad.getButton(XR_BUTTONS.TRIGGER);
        if (leftTriggerPressed) {
            weaponsModule.fireMachineGun(scene, time, controllers);
            // Add haptic feedback
            try {
                controllers.left.gamepad.getHapticActuator(0).pulse(0.5, 100);
            } catch {
                // Haptic feedback not supported, ignore
            }
        }
    }
    
    if (controllers.right && controllers.right.gamepad && weaponsModule.machineGun) {
        // Check if right trigger is pressed
        const rightTriggerPressed = controllers.right.gamepad.getButton(XR_BUTTONS.TRIGGER);
        if (rightTriggerPressed) {
            weaponsModule.fireMachineGun(scene, time, controllers);
            // Add haptic feedback
            try {
                controllers.right.gamepad.getHapticActuator(0).pulse(0.5, 100);
            } catch {
                // Haptic feedback not supported, ignore
            }
        }
    }
}

// Update controller state display
function updateControllerStateDisplay(controllers) {
    const controllerStateDiv = document.getElementById('controller-state');
    if (controllerStateDiv) {
        let stateString = 'Controllers:\n';
        let currentlyPressed = [];
        
        if (controllers.left && controllers.left.gamepad) {
            stateString += 'Left:\n';
            for (const button in XR_BUTTONS) {
                if (controllers.left.gamepad.getButton(XR_BUTTONS[button])) {
                    stateString += `  ${button} pressed\n`;
                    currentlyPressed.push(`Left ${button}`);
                }
            }
            for (const axis in XR_AXES) {
                const value = controllers.left.gamepad.getAxis(XR_AXES[axis]);
                if (Math.abs(value) > 0.1) {
                    stateString += `  ${axis}: ${value.toFixed(2)}\n`;
                }
            }
        }
        
        if (controllers.right && controllers.right.gamepad) {
            stateString += 'Right:\n';
            for (const button in XR_BUTTONS) {
                if (controllers.right.gamepad.getButton(XR_BUTTONS[button])) {
                    stateString += `  ${button} pressed\n`;
                    currentlyPressed.push(`Right ${button}`);
                }
            }
            for (const axis in XR_AXES) {
                const value = controllers.right.gamepad.getAxis(XR_AXES[axis]);
                if (Math.abs(value) > 0.1) {
                    stateString += `  ${axis}: ${value.toFixed(2)}\n`;
                }
            }
        }
        
        // Add a section to clearly show currently pressed buttons
        if (currentlyPressed.length > 0) {
            stateString += '\nCurrently Pressed:\n';
            currentlyPressed.forEach(button => {
                stateString += `  ${button}\n`;
            });
            
            // Add visual feedback when buttons are pressed
            controllerStateDiv.style.backgroundColor = 'rgba(0, 100, 0, 0.7)';
            controllerStateDiv.style.borderColor = '#00ff00';
            controllerStateDiv.style.borderWidth = '2px';
            controllerStateDiv.style.borderStyle = 'solid';
            
            // Update 3D text display with the first pressed button
            if (window.buttonTextDisplay) {
                window.buttonTextDisplay.text = `Button: ${currentlyPressed[0]}`;
                window.buttonTextDisplay.color = 0x00ff00;
                window.buttonTextDisplay.sync();
            }
        } else {
            stateString += '\nNo buttons currently pressed\n';
            
            // Reset to default styling when no buttons pressed
            controllerStateDiv.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
            controllerStateDiv.style.borderColor = '';
            controllerStateDiv.style.borderWidth = '';
            controllerStateDiv.style.borderStyle = '';
            
            // Update 3D text display
            if (window.buttonTextDisplay) {
                window.buttonTextDisplay.text = 'No button pressed';
                window.buttonTextDisplay.color = 0xffffff;
                window.buttonTextDisplay.sync();
            }
        }
        
        controllerStateDiv.innerHTML = stateString;
    }
}
