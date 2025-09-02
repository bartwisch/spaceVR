# Problems and Fixes Log

Date: 2025-09-01

This document records issues encountered while running the WebXR game and how they were resolved. File references below are clickable to jump to the relevant files.

---

## 1) Dev server port in use (EADDRINUSE 8081)

- Symptom:
  - Launching `npm run dev` failed with:
    - `Error: listen EADDRINUSE: address already in use 0.0.0.0:8081`
- Root cause:
  - A webpack-dev-server instance was already running on port 8081.
- Resolution used:
  - Opened the existing server at https://localhost:8081 (accepted the self‑signed cert warning; see item 3 below).
- Alternative resolutions:
  - Stop the existing process:
    - macOS:
      - `lsof -iTCP:8081 -sTCP:LISTEN`
      - `kill -TERM <PID>` (or `kill -9 <PID>` if necessary)
  - Use a different port temporarily:
    - `npm run dev -- --port 8082`
  - Change the default port persistently in [webpack.config.cjs](webpack.config.cjs:25):
    - `devServer.port = 8082`

---

## 2) ESLint overlay: import ordering blocked HMR reload

- Symptom:
  - Webpack overlay showed:
    - `[eslint] Imports should be sorted alphabetically (sort-imports)` for [src/index.js](src/index.js:8)
  - HMR message: “Errors while compiling. Reload prevented.”
- Root cause:
  - The project enforces import sort rules in [eslint.config.cjs](eslint.config.cjs:12):
    - `sort-imports` with:
      - `ignoreDeclarationSort: false` (declarations must be alphabetized within their syntax group)
      - `memberSyntaxSortOrder: ['none','all','multiple','single']`
- Fix applied:
  - Reordered import declarations at the top of [src/index.js](src/index.js:8) to satisfy the rule.
  - Ordering applied:
    - Namespace imports (“all” group), alphabetized:
      - `three`
      - `three/examples/jsm/utils/SkeletonUtils.js`
    - Single-member named imports (“single” group), alphabetized by imported identifier (case-sensitive per config):
      - `GLTFLoader` from `three/examples/jsm/loaders/GLTFLoader.js`
      - `Text` from `troika-three-text`
      - `XR_BUTTONS` from `gamepad-wrapper`
      - `gsap` from `gsap`
      - `init` from `./init.js`
- Result:
  - The overlay disappeared and HMR resumed; the game renders and runs as expected.

---

## 3) HTTPS warning on localhost (expected for self-signed dev cert)

- Symptom:
  - Browser showed “Your connection is not private” for https://localhost:8081 with `NET::ERR_CERT_AUTHORITY_INVALID`.
- Root cause:
  - Dev server is configured for HTTPS with a self-signed certificate in [webpack.config.cjs](webpack.config.cjs:18), which is normal for local development and required by WebXR (secure context).
- Resolution:
  - In the browser, choose “Advanced” → “Proceed to localhost (unsafe)”.
- Alternative (not recommended for WebXR):
  - Switching to HTTP (e.g., set `devServer.server = 'http'` in [webpack.config.cjs](webpack.config.cjs:23)) removes the warning but may break WebXR features that require HTTPS.

---

## Current status

- The game runs at https://localhost:8081.
- Scene renders score display; cowboy enemies spawn and animate along the road.
- HMR is active; ESLint overlay resolved by import reordering in [src/index.js](src/index.js:8).
