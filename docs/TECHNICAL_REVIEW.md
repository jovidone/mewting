# Specification review and Milestone 1 decisions

Both `AGENTS.md` and `docs/MASTER_SPEC.md` were read in full before implementation. The original specification is preserved.

## Critical scope and technical issues

1. **Full-product requirements versus milestone scope.** Sections 2, 6, 10, and 12 describe the eventual v0.1 system, while section 11 and the current request limit implementation to Milestone 1. Implement local play and a minimal project scaffold now. Do not activate Socket.IO, chat, invites, LiveKit, or misleading online UI. The remaining acceptance tests are explicitly deferred.
2. **Client IDs cannot become authorization.** Milestone 1 generates a UUID for the lifetime of the local page session and persists only validated nickname/coat preferences. A later backend must assign player identity, derive membership from its own session, and never accept a public player ID as proof of ownership. Session resumption needs an opaque server-issued credential and duplicate-connection policy.
3. **Room geometry and movement rules are unspecified.** Use a shared 960 × 640 logical world, 220 units/second movement, normalized diagonal input, and a 50 ms maximum simulation step. Shared walk bounds account for the body and nickname. Every room has a predefined safe spawn. Decorations are non-solid in this milestone; future collision geometry must be shared with the server.
4. **Runtime validation is different from TypeScript contracts.** Planned event interfaces are documentation only. Milestone 2 must add Zod schemas for every incoming event, payload/rate limits, room checks, monotonic sequence handling, and server-controlled movement time. No realtime events enter this app in Milestone 1.
5. **PixiJS 8 initializes asynchronously.** React StrictMode, unmounts, and pending initialization can race. The canvas effect guards cancellation, disposes late results, removes keyboard/visibility listeners, disconnects ResizeObserver, and destroys the private Pixi application. Animation stays outside React state to avoid rendering the interface on every frame. See [PixiJS application lifecycle](https://pixijs.com/8.x/guides/components/application).
6. **Keyboard focus and resizing need explicit behavior.** Movement is accepted only while the canvas region has focus. Profile editing pauses movement. Blur, hidden documents, and room changes clear held input. Rendering scales world coordinates rather than changing movement bounds with the viewport. Browser storage errors are recoverable.
7. **Native Windows and LiveKit are separate future verification tasks.** Node/Vite/Fastify scripts use native npm/Node commands without Bash, WSL, or containers. No LiveKit service is needed for local play. At Milestone 4, verify the then-current official Windows server distribution and launch procedure, and document any support gap before depending on it. Keep API secrets on the backend, issue short-lived room-scoped tokens, handle microphone secure-context requirements, and serialize leave/join so a client cannot occupy two voice rooms.

## Architecture and defaults

- npm workspaces: `shared`, `frontend`, `backend`, in dependency build order.
- React + TypeScript + Vite own the UI; [Tailwind's official Vite plugin](https://tailwindcss.com/docs/installation/using-vite) supplies Tailwind CSS.
- PixiJS 8 draws all rooms and cats procedurally, using a private capped ticker and WebGL. No fetched art or fonts.
- React state is sufficient; Zustand remains optional until state complexity warrants it.
- Fastify provides a health endpoint only, with Zod-validated startup configuration.
- Shared room IDs, constants, identity validation, movement logic, and planned event types keep the future server compatible with the client.
- Nicknames: trim surrounding whitespace, allow 1–20 Unicode code points, reject control/format characters, and render as text. Coats: six allowlisted pastel choices. Invalid stored preferences are ignored.
- All five room buttons remain available. Transitions reset to the target spawn; clicking the active room does not reset position.
- No environment variables are required for the frontend. Optional backend settings contain no secrets.

## Milestone order

1. **Current:** project scaffold, local identity, five rooms, blob mascots, movement, necessary verification and setup documentation.
2. **Next, only when requested:** server-authoritative Socket.IO multiplayer, room membership, presence, synchronization, reconnection.
3. Room-scoped chat, validation/rate limits, invite URL parsing and validation.
4. LiveKit audio, backend tokens, explicit consent, devices, speaking status, and isolated room transitions.
5. Full-product acceptance testing, cross-browser/error recovery coverage, final documentation and polish.

Basic tests, error states, and documentation are included now because the repository's verification rules apply to each milestone; this does not implement the later product features.

