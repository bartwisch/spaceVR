# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project Overview

This is a WebXR tutorial project that creates an immersive game using Three.js. Players can use VR controllers or mouse controls to shoot animated cowboy enemies that spawn on both sides of a road in a 3D space station environment. The project demonstrates key WebXR concepts including controller interactions, 3D audio, haptic feedback, GLTF model loading, and dual-mode development (VR headset + desktop emulation).

## Development Commands

- `npm run dev` - Start development server on port 8081 with HTTPS (required for WebXR)
- `npm run build` - Build for production (outputs to `dist/` directory)
- `npm run format` - Format code using Prettier

## WebXR Development Setup

### Local Development Access
- Development server runs on `https://0.0.0.0:8081` (accessible on local network)
- IP address for headset testing is displayed in webpack console
- Alternative: Use ADB port forwarding for restrictive networks (`chrome://inspect/#devices`)

### Built-in Emulation
- IWER (Immersive Web Emulation Runtime) automatically activates when no native WebXR support detected
- DevUI provides controller simulation and "Play Mode" for FPS-style navigation
- Compatible with Immersive Web Emulator browser extension

## Architecture

### Core Application Structure

**Initialization Layer (`src/init.js`)**
- Handles WebXR runtime detection and IWER emulation fallback
- Configures Three.js scene with room environment lighting
- Sets up dual controller system with gamepad-wrapper integration
- Manages camera, renderer, and orbit controls for desktop development
- Creates controller event listeners for connect/disconnect states

**Game Logic Layer (`src/index.js`)**
- Implements dual input system: VR controllers (trigger button) and mouse controls (click)
- Bullet physics with velocity-based movement and time-to-live cleanup system
- GLTF asset loading for blaster weapon and animated cowboys
- Hit detection using 3D distance calculations for cowboys
- Score tracking system with custom font rendering via troika-three-text
- Positional 3D audio system for laser shots and scoring feedback

### Key Components

**WebXR Controller Management**
- Controllers accessed via `renderer.xr.getController()` and `renderer.xr.getControllerGrip()`
- Event-driven gamepad connection handling with GamepadWrapper integration
- Haptic feedback triggered via `gamepad.getHapticActuator(0).pulse()`
- Dynamic blaster attachment to active controller with controller model hiding

**Animation and Model System**
- GLTF models cloned using `SkeletonUtils.clone()` for proper animation support
- THREE.AnimationMixer for cowboy character animations with automatic loop detection
- GSAP-powered target scaling animations and respawn transitions
- Automatic cowboy respawning system after elimination

**Dual-Mode Input Handling**
- Automatic mode switching between VR and mouse controls based on controller presence
- Mouse mode uses raycaster to calculate bullet trajectory from screen coordinates
- VR mode uses controller world position and quaternion for accurate spatial firing
- Shared bullet firing logic with position and quaternion parameters

### Build System

**Webpack Configuration**
- HTTPS dev server required for WebXR APIs
- ESLint integration with import sorting enforcement
- Asset copying from `src/assets/` to `dist/assets/`
- Three.js module resolution optimization
- Source maps enabled for debugging

**Asset Organization**
- `src/assets/`: GLTF models (.glb), audio files (.ogg), and fonts (.ttf)
- Automatic asset copying during build process
- Models: blaster weapon, cowboy character
- Audio: laser shot sound, scoring sound with positional audio support

### Code Quality Standards

**ESLint Rules**
- Enforced import sorting with specific order: namespace, multiple, single imports
- Unused variables warnings with underscore prefix exception
- Class member spacing requirements

**WebXR-Specific Patterns**
- Always check for native WebXR support before IWER fallback
- Use gamepad update loops in animation frames
- Handle controller connection states dynamically
- Implement haptic feedback with try/catch for compatibility
- Use world position/quaternion for spatial calculations in VR

## Testing and Debugging

### VR Headset Testing
- Connect headset via USB with developer mode enabled
- Use displayed IP address from webpack console for network access
- Certificate warnings can be safely dismissed

### Desktop Development
- IWER DevUI provides controller simulation and transform manipulation
- "Play Mode" enables cursor-locked FPS-style navigation
- Mouse controls automatically activate when no VR controllers detected

### Animation Debugging
- Cowboy animations searched by name patterns: "wink", "wave", "greeting"
- Console logging for animation setup and cowboy spawning states
- Animation mixers require manual update in render loop
