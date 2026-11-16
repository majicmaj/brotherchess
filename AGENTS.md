# Brotherchess

A GPLv3 fork of OpenChess for Brotherhood's custom chess variant. Keep upstream
attribution. Use Chessground for presentation and a shared TypeScript rules engine.
The multiplayer server is authoritative for moves, identities, clocks and dice.

## Hard quality gates

Run npm run check before committing. Enforce 800 lines per tracked text file,
cyclomatic complexity <=20, control-flow nesting <=3, strict TypeScript, no unused
variables, and formatting. Never disable a gate to ship. Keep feature modules small.
Tests are only for critical rules, authorization, transactions and recovery; keep
all tests offline and fast. Do not introduce UI snapshot tests.

## Architecture

- src/rules: pure serializable game state, movement, attacks, abilities and legality.
- src/shared: wire protocol and shared presentation descriptions.
- src/server: authoritative Cloudflare Durable Object rooms and routing.
- src/client: Chessground interface, lobby and reconnect handling.
- tests: critical variant and multiplayer invariants.
- scripts: quality and build tools.

Persist every accepted turn before broadcasting. Reject stale revisions and
unauthorized actions. Reconnection restores the exact clocks, board, rescue charge,
revival state, cooldown and captured pieces. Never trust client dice. Preserve
Cloudflare's existing wildcard route; deploy only the exact Brotherchess hostname.
Never commit credentials, private Discord transcripts, or personal research data.
