# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a WebXR project built with Three.js that creates an immersive spaceVR game. Players can use VR controllers or mouse controls to shoot cowboy enemies that spawn on both sides of a road in a 3D space environment. The game features dual weapon systems (blaster and flamethrower), AI enemy movement with collision avoidance, positional 3D audio, haptic feedback, and particle effects.

## Development Commands

- `npm run dev` - Start development server on port 8081 with HTTPS (required for WebXR)
- `npm run build` - Build for production (outputs to `dist/` directory)  
- `npm run format` - Format code using Prettier

## Architecture

### Core Files Structure

- **`src/index.js`** - Main application logic containing game mechanics, bullet physics, scoring, and both VR/mouse control handling
- **`src/init.js`** - WebXR initialization and emulation setup using IWER (Immersive Web Emulation Runtime)
- **`src/index.html`** - Entry HTML template
- **`src/assets/`** - 3D models (GLB/GLTF), audio files (OGG), and fonts

### Key Architecture Components

**WebXR Initialization (`init.js`)**
- Automatically detects native WebXR support
- Falls back to IWER emulation with DevUI for desktop development
- Sets up Three.js scene, camera, renderer, and XR controllers
- Configures gamepad input handling via gamepad-wrapper

**Game Logic (`index.js`)**
- Dual weapon system: red blaster (projectile-based) and blue flamethrower (particle-based) with weapon switching
- Dual input system: VR controllers (trigger for continuous fire, A button for weapon switching) and mouse controls
- Advanced enemy AI: cowboys with run/walk/idle animations, collision avoidance between enemies and obstacles, distance-based behavior states
- Bullet and particle physics systems with velocity-based movement, time-to-live cleanup, and collision detection
- GLTF model loading with SkeletonUtils for proper animation cloning
- Positional 3D audio system with different sounds for laser/flamethrower
- VR movement: thumbstick locomotion (left controller) and snap rotation (right thumbstick)
- Mouse mode: drag-to-look camera controls with raycast-based shooting

**Development Workflow**
- Webpack dev server configured for HTTPS (WebXR requirement) on all network interfaces
- ESLint integration with import sorting rules enforced (enforces specific member syntax sort order)
- Auto-copy of assets and favicon to dist during build
- Source maps enabled for debugging
- Multi-entry setup: main game (`index.js`) and test page (`test-cowboy.js`)

## WebXR Development Notes

### Testing Environment Setup
- Development server accessible via IP address for headset testing (shown in webpack console)
- Alternative: Use ADB port forwarding for restrictive networks
- Built-in IWER emulation provides desktop development with controller simulation
- DevUI interface allows manipulation of headset/controller transforms and "Play Mode" for FPS-style navigation

### Key Libraries
- **Three.js** - Core 3D rendering engine
- **IWER** - WebXR emulation runtime for desktop development  
- **gamepad-wrapper** - Simplified gamepad input handling
- **GSAP** - Animation library for smooth target transitions
- **troika-three-text** - High-quality text rendering in 3D space

### VR-Specific Patterns
- Controllers accessed via `renderer.xr.getController()` and `renderer.xr.getControllerGrip()`
- Gamepad input handled through connected/disconnected event listeners with GamepadWrapper
- Haptic feedback with different intensities per weapon: `gamepad.getHapticActuator(0).pulse(intensity, duration)`
- Dual rendering mode support (VR headset + desktop fallback with mouse controls)
- Fire rate limiting with timestamp tracking in gamepad userData
- XR_BUTTONS and XR_AXES constants from gamepad-wrapper for input handling

## Game Architecture Patterns

### Enemy AI System
- Cowboys spawn dynamically with configurable limits (max 20 concurrent)
- State-based behavior: RUN_SPEED > WALK_THRESHOLD > ATTACK_THRESHOLD distances
- Collision avoidance using vector mathematics for both enemy-enemy and enemy-obstacle interactions
- Animation system uses THREE.SkeletonUtils.clone() for proper instancing with independent animations
- Automatic cleanup of enemies that fall too far behind player

### Weapon System Architecture
- Weapon switching via `weapons` array with `currentWeapon` index
- Different firing mechanics: bullets (objects in scene) vs particles (pooled system for flamethrower)
- Particle pooling system with `flamethrowerParticlePool` for performance
- Different collision detection systems per weapon type

### Performance Considerations
- Object pooling for flamethrower particles (reuse particles instead of creating/destroying)
- Bullet cleanup with time-to-live system
- Enemy removal based on distance from player
- Animation mixers updated per frame with delta timing