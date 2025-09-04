/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

// Main entry point - imports the setup module which initializes everything
import './setup.js';

// The setup module handles:
// - Scene initialization
// - Space environment creation
// - Weapon systems setup
// - Audio loading
// - Game loop initialization

// All game logic is now modularized into separate files:
// - weapons.js: Machine gun and bullet systems
// - environment.js: Space environment and power-ups
// - particles.js: Flamethrower particle system
// - gameLoop.js: Main game update logic
// - setup.js: Scene setup and initialization
