# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a WebXR tutorial project built with Three.js that teaches developers to create immersive VR experiences. The project is a game where players can use VR controllers or mouse controls to shoot cowboy enemies that spawn on both sides of a road in a 3D space station environment.

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
- Dual input system: VR controllers (trigger button) and mouse controls (click)
- Bullet physics system with velocity-based movement and time-to-live cleanup
- GLTF model loading for blaster weapon and animated cowboy character
- Hit detection using 3D distance calculations
- Score tracking with custom font rendering via troika-three-text
- Positional 3D audio for laser shots and scoring
- GSAP animations for target scaling and respawn effects

**Development Workflow**
- Webpack dev server configured for HTTPS (WebXR requirement) on all network interfaces
- ESLint integration with import sorting rules enforced
- Auto-copy of assets and favicon to dist during build
- Source maps enabled for debugging

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
- Gamepad input handled through connected/disconnected event listeners
- Haptic feedback triggered via `gamepad.getHapticActuator(0).pulse()`
- Dual rendering mode support (VR headset + desktop fallback with mouse controls)