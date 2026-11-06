# Realtime contract

`shared/src/events.ts` defines the Socket.IO event interfaces. Runtime schemas live in `shared/src/protocol.ts`.

## Client → server

| Event | Payload | Acknowledgement |
| --- | --- | --- |
| `session:join` | `{ nickname, color, roomId?, resumeToken? }` | Session identity, room snapshot, presence counts, and chat history |
| `player:input` | `{ sequence, membershipVersion, direction: { x, y } }` | None; snapshots acknowledge `lastInputSequence` |
| `room:join` | `{ roomId }` | Membership version, destination snapshot, and chat history |
| `profile:update` | `{ nickname, color }` | Updated player snapshot |
| `chat:send` | `{ text, membershipVersion }` | Accepted message or validation error |

Results use `{ ok: true, data }` or `{ ok: false, error: { code, message } }`. Defined error codes are `INVALID_INPUT`, `NOT_JOINED`, `RATE_LIMITED`, and `SESSION_EXPIRED`.

## Server → client

| Event | Payload | Purpose |
| --- | --- | --- |
| `room:snapshot` | `{ roomId, revision, players }` | Authoritative roster, positions, and sequence acknowledgements for the current room |
| `room:presence` | `Record<RoomId, number>` | Counts from the server's membership map |
| `chat:message` | `{ id, roomId, senderId, nickname, text, sentAt }` | Message sent to the sender's current server room |
| `session:error` | `{ code, message }` | Recoverable session/protocol error |

A player snapshot contains `id`, `nickname`, `color`, `roomId`, `position`, and `lastInputSequence`. It never contains a resume credential. A room revision is monotonic and lets clients discard stale snapshots. Server events must never expose users from another room.

## Protocol behavior

- Validate every incoming payload with Zod before state mutation. Limit nickname length and allowlist colors/room IDs. Reject non-finite, excessive, malformed, and out-of-order movement input.
- Identity and membership come from the socket's server-side session, not a claimed `playerId` in an input payload. Resume credentials are unguessable, short-lived, bounded in server memory, and never included in public snapshots or logs. Define single-active-connection semantics to prevent duplicates.
- Suggested starting cadence: client input at most 20 Hz, server movement simulation at 30 Hz, room snapshots at most 20 Hz only when state changes. Tune using actual tests. The server owns elapsed movement time and bounds; never trust client coordinates or timestamps.
- Expire held movement after a bounded input timeout. Validate room changes, discard old movement on transition, increment revision, update both affected room rosters and presence counts, and send the destination snapshot atomically with the acknowledgement.
- Rate-limit join/transition attempts as well as movement. Restrict CORS to configured frontend origins; CORS is not authorization.
- Reconnect through an authoritative full snapshot. Clear old listeners, interpolation state, and input; remove disconnected presence and prevent ghost avatars. Remote interpolation must tolerate dropped snapshots and room changes.
- Chat accepts up to 500 characters and rejects blank text. The server assigns the message ID, sender, room, and timestamp. Each session can send a burst of five messages and replenishes one send per second. The latest 100 messages per room are kept in memory and loaded on join or reconnect. The client deduplicates live messages and acknowledgements by ID.
