# Repository Guidelines

## Project Structure & Module Organization
- `src/`: application source. Entry points: `index.js` (game) and `test-cowboy.js` (demo). Core modules: `setup.js` (scene/camera/renderer), `environment.js` (space station, lighting), `gameLoop.js` (tick/update), `particles.js`, `weapons.js`, `init.js` (WebXR/IWER emulator bootstrap). HTML in `index.html`; runtime assets in `src/assets/`.
- `assets/`: repository images/docs (not bundled).
- `dist/`: webpack build output (generated).
- `.github/workflows/deploy.yml`: GitHub Pages build/deploy.

## Build, Test, and Development Commands
- `npm run dev`: start webpack-dev-server at `https://localhost:8081` with ESLint overlay.
- `npm run build`: build production bundles into `dist/`.
- `npm run format`: format source using Prettier.
- `npm run launch`: open a Chromium instance via Puppeteer pointing at `https://localhost:8081` (run after `npm run dev`).
Note: WebXR requires HTTPS; accept the self-signed cert in dev.

## Coding Style & Naming Conventions
- Indentation: tabs; EOL: LF. Quotes: single; trailing commas: all; arrow parens: always (configured in `prettier.config.cjs`).
- ESLint: `eslint:recommended` + Prettier. Rules: `sort-imports` (error); `no-unused-vars` (warn; prefix intentionally unused with `_`); `lines-between-class-members` (warn) — see `eslint.config.cjs`.
- Naming: files `kebab-case.js`; classes `PascalCase`; functions/vars `camelCase`. Place new runtime assets in `src/assets/`.

## Testing Guidelines
- No automated tests yet. Perform manual smoke tests:
  - `npm run dev` then open `https://localhost:8081` (or `npm run launch`).
  - Verify desktop emulation and XR entry work; check console for errors.
- If adding tests, prefer `tests/` with `*.spec.js`; include light unit tests (scene helpers) and basic Puppeteer flows for critical paths.

## Commit & Pull Request Guidelines
- Commits: imperative mood, concise subject (≤72 chars), optional scope (e.g., `env:`, `weapons:`); reference issues (`Fixes #123`).
- PRs: clear description and rationale, linked issues, before/after notes; include screenshot/short clip for visual changes; list manual test steps; keep diffs focused.

## Security & Configuration Tips
- Do not commit secrets. Large binaries belong in `src/assets/` (copied by webpack). Avoid breaking HTTPS locally: the dev server uses a self-signed cert required by WebXR.
- `init.js` enables IWER-based emulation; disable other XR emulators to avoid conflicts.

