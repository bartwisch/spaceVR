# spaceVR Project Context

## Project Overview

**spaceVR** is an immersive WebXR game built with [Three.js](https://threejs.org/) where players use VR controllers or mouse controls to shoot cowboy enemies that spawn in a 3D space station environment. The game features sound, vibration, smooth animations, and a scoring system.

### Key Features
- Immersive WebXR experience for VR headsets
- Desktop emulation mode for development and testing
- Interactive VR controller support with haptic feedback
- 3D audio effects
- Animated cowboy enemies with GLTF models
- Score tracking system
- Responsive design that works on both VR and desktop

## Project Structure

```
spaceVR/
├── src/
│   ├── assets/           # 3D models, audio files, fonts
│   ├── index.html        # Main HTML entry point
│   ├── index.js          # Main application code
│   ├── init.js           # WebXR initialization and device setup
│   ├── test-cowboy.html  # Test page for cowboy models
│   └── test-cowboy.js    # Test code for cowboy models
├── webpack.config.cjs    # Webpack build configuration
├── package.json          # Project dependencies and scripts
├── launch.js             # Puppeteer launcher for automated testing
├── eslint.config.cjs     # ESLint configuration
├── prettier.config.cjs   # Prettier configuration
├── .github/workflows/    # GitHub Actions deployment workflow
├── README.md             # Project documentation
├── konzept.md            # Game design concepts (German)
├── problems.md           # Known issues and solutions
└── ...
```

## Technology Stack

- **Core Framework**: Three.js for 3D rendering
- **WebXR**: Native WebXR API and IWER (Immersive Web Emulation Runtime) for desktop development
- **Build System**: Webpack with development server
- **Languages**: JavaScript (ES6+ modules)
- **Asset Formats**: GLTF models, OGG audio files
- **Testing**: Puppeteer for automated browser testing
- **Code Quality**: ESLint and Prettier for linting and formatting

## Development Setup

### Prerequisites
- Node.js version 20.x or later
- npm version 10.x or later

### Installation
```bash
npm install
```

### Development Server
```bash
npm run dev
```
Starts the webpack development server on https://localhost:8081/

### Build for Production
```bash
npm run build
```
Generates optimized files in the `dist/` directory.

### Code Formatting
```bash
npm run format
```
Formats code using Prettier.

### Automated Launch
```bash
npm run launch
```
Launches the game in a browser using Puppeteer.

## WebXR Implementation

The project uses a dual approach for WebXR support:
1. **Native WebXR**: For VR headsets that support WebXR
2. **IWER Emulation**: For desktop development when native WebXR is not available

The `init.js` file handles the WebXR device detection and setup, automatically switching between native and emulated modes based on browser support.

## Asset Management

### 3D Models
- `blaster.glb`: Player weapon model
- `cowboy1.glb`: Enemy cowboy model
- `spacestation.glb`: Environment model
- `revolver.glb`: Alternative weapon model
- `target.glb`: Target model for testing

### Audio Files
- `laser.ogg`: Weapon firing sound
- `score.ogg`: Score update sound

### Fonts
- `SpaceMono-Bold.ttf`: UI font

## Code Architecture

### Main Entry Point (index.js)
The main game logic is implemented in `src/index.js`, which includes:
- Scene setup and initialization
- Enemy spawning and management
- Weapon systems (regular bullets and flamethrower)
- Collision detection
- Animation handling
- Power-up system
- VR and desktop control schemes

### Initialization (init.js)
Handles WebXR device setup, renderer configuration, and controller management.

### Testing (test-cowboy.js)
Dedicated test environment for verifying cowboy models and animations.

## Controls

### VR Mode
- **Left Controller Thumbstick**: Movement (strafing and forward/backward)
- **Right Controller Thumbstick**: Rotation
- **Trigger Button**: Fire weapon
- **Button A**: Switch weapons

### Desktop Mode
- **Mouse Drag**: Camera rotation
- **Mouse Click**: Fire weapon
- **Escape**: Exit mouse mode and re-enable camera controls
- **Both Mouse Buttons**: Fire stationary machine gun

## Game Mechanics

### Weapons
1. **Red Blaster**: Standard weapon with rapid fire
2. **Blue Flamethrower**: Continuous fire weapon with area damage

### Power-ups
- **Rapid Fire**: Increased fire rate for 15 seconds
- **Explosive Rounds**: Area damage for 10 seconds
- **Shield**: Absorbs hits for 20 seconds

### Enemies
Space cowboys approach the player from all directions with jetpacks, using different movement patterns and attack behaviors.

## Deployment

The project includes a GitHub Actions workflow for automatic deployment to GitHub Pages:
1. Push to `main` branch triggers build
2. `npm run build` generates production files
3. Files from `dist/` directory are deployed to GitHub Pages

## Known Issues and Solutions

Documented in `problems.md`:
1. Port conflicts with development server
2. ESLint import ordering requirements
3. HTTPS certificate warnings (expected for local development)

## Contributing

Follow standard GitHub workflow:
1. Fork the repository
2. Create feature branch
3. Commit changes
4. Submit pull request

Code must pass ESLint checks and follow project formatting guidelines.