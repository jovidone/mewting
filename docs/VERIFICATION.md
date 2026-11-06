# Milestone 1 verification

## Repeatable commands

Run from the repository root in PowerShell after `npm ci`:

```powershell
npm run typecheck
npm test
npm run build
npm audit
```

Typechecks cover every workspace. Builds emit shared JavaScript/declarations, the frontend production bundle, and the backend. The behavior tests cover movement and input, identity/preferences, room definitions, and backend health. `npm audit` requires registry network access.

## Browser checklist

Use `npm run dev` and open http://localhost:5173 in a desktop browser:

- Submit an empty or whitespace nickname: an accessible validation message appears.
- Select a coat and enter a valid nickname: the entry preview updates; joining shows one labeled cat in the Lobby.
- Hold WASD, then arrow keys: the cat moves, faces its direction, and animates. Hold diagonal input: speed remains consistent.
- Hold movement toward each wall: the cat remains inside the room.
- Click each of the five room buttons: heading, palette, furniture, and spawn update. The active room is marked.
- Move focus away from the canvas, open the profile editor, or switch browser tabs while moving: movement stops. Returning does not leave a stuck key.
- Edit nickname/coat: the avatar and sidebar update. Escape cancels without applying unsaved changes.
- Refresh: nickname and coat are restored in the entry form; joining starts in the Lobby.
- Resize the browser: room proportions and position remain stable. Navigation/form controls remain usable at narrower widths. Touch movement is intentionally absent.
- With reduced motion enabled, decorative idle/walk bounce is disabled; movement still works.
- Open two browser windows: each has independent local state. There is no socket connection, chat, or microphone prompt.
- Stop the optional backend: the frontend remains playable.

## Recorded results

Executed on **2026-11-06**, Windows native PowerShell, Node.js **24.19.0**, npm **11.17.0**:

| Check | Result |
| --- | --- |
| `npm install` | Dependencies installed; lockfile generated |
| `npm run typecheck` | Passed for shared, frontend, and backend |
| `npm test` | **10 passed, 0 failed** |
| `npm run build` | Passed for all three workspaces; Vite production assets emitted |
| `npm run dev` | Vite and Fastify started together on ports 5173 and 3000 |
| Frontend HTTP request | HTTP 200 from `http://127.0.0.1:5173/` |
| Backend HTTP request | `/health` returned `status: ok`, milestone 1, `local-only` |
| `npm audit --json` | Passed: **0 vulnerabilities** after updating concurrently to 9.2.5 |
| `npm ls --depth=0` | Passed; workspace links and direct dependencies resolved |
| `git diff --check` | Passed; Git emitted its normal LF-to-CRLF notice for README |

The initial sandbox could not reach the npm registry or expose its loopback servers to the browser. Dependency installation and browser-accessible development servers were rerun with approved network/process access. This is an execution-environment limitation, not a project requirement.

### Browser checks actually performed

Using the Codex in-app browser against the development server:

- Empty nickname submission displayed the validation error.
- Joining with a nickname and selected sage coat rendered the labeled mascot.
- WASD and arrow input visibly moved the cat; sustained input reached and stopped at all four bounds.
- Visited and visually inspected all five room scenes; room headings, navigation selection, furniture, and spawn positions changed.
- Saved a new nickname and lavender coat; both the scene and sidebar updated without resetting the room.
- Escape discarded an unsaved nickname edit and restored the profile button's focus.
- Reload restored the saved nickname and coat in the entry form; joining returned to the Lobby.
- Inspected desktop **1366 × 900**, default panel, and narrow **390 × 844** layouts. Narrow navigation remained usable, with no document-level horizontal overflow. The temporary viewport override was reset afterward.
- Canvas count remained **1** after scene changes and after refresh under React StrictMode.
- Browser warning/error log queries returned **no entries** after the checks.

### Not independently exercised in the browser

Blocked/corrupt localStorage behavior was covered by automated tests, not browser policy changes. Diagonal speed and frame-rate invariance were tested mathematically. Reduced-motion behavior, tab-switching while a key remains held, renderer failure/retry, other browser engines, and production-preview browser behavior were not manually exercised. No multiplayer, chat, invite, voice, or reconnection acceptance tests were run; their implementation belongs to later milestones.
