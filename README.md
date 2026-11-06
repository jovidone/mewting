# Mewting

**A Cozy Place to Meet** — a small, playable space with pastel blob cats.

Choose a nickname and coat, explore five rooms with WASD or the arrow keys, and share a room with friends over Socket.IO. The rooms and mascots use procedural vector graphics.

## Requirements

- Windows 10/11 with native **Node.js 22.12+ (22.x) or Node.js 24.x**, and **npm 10+**. This workspace was verified using Node.js 24.19.0 and npm 11.17.0.
- PowerShell and a modern desktop browser with WebGL enabled.
- Internet access for the first dependency installation. No WSL, containers, database, or LiveKit installation is needed for this milestone.

## Start developing

Open PowerShell in the repository root:

```powershell
Set-Location 'D:\.Library\Documents\GitHub\mewting'
node --version
npm --version
npm ci
npm run dev
```

Open **http://localhost:5173**. The command first builds the shared package, then starts Vite and the Fastify development server together. Stop both with **Ctrl+C**.

Vite forwards same-origin Socket.IO traffic to Fastify at port 3000. The local backend health endpoint is **http://localhost:3000/health**. If the backend is unavailable, you can still explore locally and reconnect from the room screen.

No environment setup is required. To override the optional backend defaults:

```powershell
Copy-Item .\backend\.env.example .\backend\.env
```

The default backend address is `127.0.0.1:3000`. If you change it for development, update the Vite proxy target as well. Vite uses `127.0.0.1:5173` and requires that port to be free.

To use two terminals instead of the combined command, run the shared build once:

```powershell
npm run build --workspace=@mewting/shared
```

Then run `npm run dev:frontend` in one PowerShell terminal and `npm run dev:backend` in another. When editing shared source during development, rebuild it with the same shared build command (or restart `npm run dev`).

## Play

1. Enter a nickname of 1–20 visible Unicode characters and choose one of six pastel coats.
2. Select **Make yourself at home**. You spawn in **The Lobby**.
3. Use **WASD** or **arrow keys** to move. Click the canvas or **Click here to wander** to restore keyboard focus after using the navigation.
4. Visit **Pawffice**, **Mewting Room**, **Catfé**, and **Catnap Corner** using the sidebar. Each room has its own layout, palette, and spawn point.
5. Select your cat at the bottom of the sidebar to edit your nickname or coat. Movement pauses while the editor is open; **Escape** closes it.

Nickname and coat are saved to browser localStorage. Reloading returns to the entry form with those choices restored. A valid invitation selects its room after character creation. Without a valid invitation, the initial room is the Lobby. If browser storage is blocked, the game remains usable and explains that preferences could not be saved.

## Invite friends

After the room shows **Online**, select **Invite Friends**. The link uses the origin you opened and the server-confirmed room. If the clipboard is unavailable, copy the selectable link shown beside the button. The guest opens the link, chooses a nickname and coat, and joins the same Socket.IO room. The room link is shareable with anyone who can reach that origin.

For a friend on another network, use a public HTTPS origin. Install [cloudflared for Windows](https://developers.cloudflare.com/tunnel/downloads/) and build the app with `npm run build`. Stop any development backend using port 3000. In one PowerShell window, start a [Cloudflare Quick Tunnel](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/):

```powershell
cloudflared tunnel --url http://127.0.0.1:3000
```

In a second PowerShell window at the repository root, use the exact HTTPS origin that cloudflared printed:

```powershell
$env:PUBLIC_APP_URL = 'https://your-assigned-name.trycloudflare.com'
npm run start --workspace=@mewting/backend
```

Open that HTTPS address yourself before copying an invitation. Fastify serves the built frontend and Socket.IO on the same origin in this mode. Open the copied link on a separate network and verify that both cats appear in the room and can see each other move. Keep the computer, backend, and tunnel running. If a new tunnel gives you a different URL, restart the backend with that origin and copy fresh links.

Movement is frame-rate independent, diagonal movement has the same speed as cardinal movement, and cats stay within the room boundaries. Switching tabs or moving keyboard focus out of the canvas clears held keys. The canvas resizes without changing world coordinates. Reduced-motion preferences disable decorative cat animation.

## Verification and production build

Run these commands from the repository root:

```powershell
npm run typecheck
npm test
npm run build
npm run preview
```

The preview serves the production frontend for offline exploration at **http://localhost:4173**. Use the same-origin backend mode above to test the built frontend with multiplayer. Build output is in `frontend/dist`, `backend/dist`, and `shared/dist`. To run the built backend separately:

```powershell
npm run start --workspace=@mewting/backend
```

To check its health from another PowerShell terminal:

```powershell
Invoke-RestMethod http://localhost:3000/health
```

The automated tests use Node's test runner through `tsx`. They cover movement speed, frame rates, all boundaries, stalled frames, keyboard combinations, room IDs/spawns, nickname validation, corrupt/blocked preference storage, and the health endpoint. See [the verification checklist](docs/VERIFICATION.md) for browser checks and recorded results.

## Architecture

```text
mewting/
├── frontend/             React UI, Tailwind CSS, Vite, PixiJS 8
│   └── src/
│       ├── components/   Nickname/coat form and vector UI graphics
│       ├── game/         Canvas lifecycle, keyboard input, room drawing, cats
│       └── preferences.ts
├── backend/              Fastify health endpoint and Zod environment validation
├── shared/               Room definitions, identity rules, movement, planned event types
├── tests/                TypeScript behavioral tests
├── docs/                 Specification, technical review, event contract, verification
├── package.json          npm workspaces and Windows-compatible scripts
└── package-lock.json     Reproducible dependency resolution
```

React manages the interface and subscribes to the multiplayer client. PixiJS handles movement and rendering outside React’s render loop. Fastify and Socket.IO own player identity, room membership, and authoritative positions.

The [technical review](docs/TECHNICAL_REVIEW.md) records the original design decisions. The active Socket.IO contracts and Zod schemas are in `shared/src/events.ts` and `shared/src/protocol.ts`.

## Milestones and limitations

| Milestone | Scope | Status |
| --- | --- | --- |
| 1 | Initialization, frontend, blob cats, five rooms, local movement | Implemented |
| 2 | Socket.IO multiplayer, server identity, rooms, presence, synchronization | Implemented |
| 3 | Room chat and invite links | Invites implemented. Chat pending. |
| 4 | LiveKit voice, permissions, speaking indicators, room audio isolation | Not implemented |
| 5 | Full-product testing, error handling, documentation, visual polish | Not implemented |

- Furniture is decorative and can be walked through. Only room boundaries block movement. Avatar depth sorting and furniture collision are not part of Milestone 1.
- Keyboard controls are desktop-only. The interface adapts to narrower widths, but touch movement is out of scope.
- WebGL is required; a failed renderer shows a retry action and browser guidance. There is no software-canvas fallback or WebGL context-loss recovery yet.
- Chat and voice are pending. Multiplayer state is held in memory and resets when the backend restarts.
