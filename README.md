# Cedar — Patient follow-up workspace

The active code is the Cedar prototype developed in Codex. It uses plain HTML, CSS, and JavaScript with fictional patient records and scripted conversations. State is stored locally in the browser; there is no live messaging, AI backend, or practice-system integration.

## Run

```sh
npm start
```

Open **http://localhost:4173/redesigns/index.html** for the current Patients, Knowledge, and Integrations interface. `npm run dev` runs the same server. Requires Python 3; no installation or build step is needed. If port 4173 is already occupied by the Codex preview, use `python3 -m http.server 4174 --directory dist` and open the same path on port 4174.

## Verify

```sh
npm test
```

Uses Node's built-in test runner. The 12 workflow tests cover scheduling, pauses, completion, contact preferences, and duplicate booking protection.

## Code

- `dist/redesigns/`: current interface, styles, knowledge content, calendar, source viewers, and scheduled reminder preview.
- `dist/engine.js`: shared demo state and workflow logic.
- `dist/index.html`, `dist/app.js`, `dist/style.css`: earlier Codex prototype, retained alongside the current interface.
- `tests/`: workflow tests.

## Previous app

**`reference/previous-app-2026-10-08/`** contains the React/Vite app that was previously at this repository's root, including its source, README, package files, configuration, and installed dependencies. Its original README documents how to run it. Work inside that folder when referring to the old version.

The destination repository's `.git` history and `.claude` configuration remain at the root. The source Codex project's Git metadata was not copied. No commit or push was made during the transfer.
