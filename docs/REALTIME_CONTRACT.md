# Planned realtime contract — not active in Milestone 1

`shared/src/events.ts` defines the TypeScript event interfaces planned for Milestone 2. No Socket.IO server/client is installed, and no transport is connected. Runtime schemas and protocol behavior must be implemented and tested in that milestone.

## Client → server

| Event | Payload | Acknowledgement |
| --- | --- | --- |
| `session:join` | `{ nickname, color, resumeToken? }` | Result with server-issued `playerId`, opaque `resumeToken`, and room snapshot |
| `player:input` | `{ sequence, direction: { x, y } }` | None; snapshots acknowledge `lastInputSequence` |
| `room:join` | `{ roomId }` | Result with authoritative destination room snapshot |

Results use `{ ok: true, data }` or `{ ok: false, error: { code, message } }`. Defined error codes are `INVALID_INPUT`, `NOT_JOINED`, `RATE_LIMITED`, and `SESSION_EXPIRED`.

## Server → client

| Event | Payload | Purpose |
| --- | --- | --- |
| `room:snapshot` | `{ roomId, revision, players }` | Authoritative roster, positions, and sequence acknowledgements for the current room |
| `room:presence` | `{ counts: Record<RoomId, number> }` | Counts from the server's membership map |
| `session:error` | `{ code, message }` | Recoverable session/protocol error |

A player snapshot contains `id`, `nickname`, `color`, `roomId`, `position`, and `lastInputSequence`. It never contains a resume credential. A room revision is monotonic and lets clients discard stale snapshots. Server events must never expose users from another room.

## Required behavior for Milestone 2

- Validate every incoming payload with Zod before state mutation. Limit nickname length and allowlist colors/room IDs. Reject non-finite, excessive, malformed, and out-of-order movement input.
- Identity and membership come from the socket's server-side session, not a claimed `playerId` in an input payload. Resume credentials are unguessable, short-lived, bounded in server memory, and never included in public snapshots or logs. Define single-active-connection semantics to prevent duplicates.
- Suggested starting cadence: client input at most 20 Hz, server movement simulation at 30 Hz, room snapshots at most 20 Hz only when state changes. Tune using actual tests. The server owns elapsed movement time and bounds; never trust client coordinates or timestamps.
- Expire held movement after a bounded input timeout. Validate room changes, discard old movement on transition, increment revision, update both affected room rosters and presence counts, and send the destination snapshot atomically with the acknowledgement.
- Rate-limit join/transition attempts as well as movement. Restrict CORS to configured frontend origins; CORS is not authorization.
- Reconnect through an authoritative full snapshot. Clear old listeners, interpolation state, and input; remove disconnected presence and prevent ghost avatars. Remote interpolation must tolerate dropped snapshots and room changes.
- Chat events/history/invites belong to Milestone 3. LiveKit room membership/token endpoints belong to Milestone 4. Do not treat this contract as an implementation of those features.
