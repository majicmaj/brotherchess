# Brotherchess

Brotherhood chess with five character abilities, private multiplayer rooms and a
Lichess-style interface. A GPLv3 fork of [OpenChess](https://github.com/caydenchapple/openchess),
using the actual [Lichess Chessground](https://github.com/lichess-org/chessground) board.
The custom game rules, interface and durable room implementation replace the
standard-chess coaching and analysis features from the upstream starter.

## Run

Node 24 or newer:

```sh
npm ci
npm run dev
```

The local Worker includes persistent SQLite-backed Durable Objects. Create a room,
send its URL to a friend and play. Refreshing/reconnecting restores the exact game.
Seat keys stay in each player's browser and are never part of invite links.

## Brotherhood rules

Ordinary chess movement, check and checkmate apply. Shuffled setups keep kings and
rooks in place, with bishops on opposite colours and matching layouts for both sides.

- **Monkus / king — Motivational Wank:** after a safe normal one-square king move,
  optionally move one adjacent friendly non-king piece one square in any direction
  to an empty square. The extra move cannot expose your king. Castling cannot rally.
- **BigDoe / knight — Please Join VC:** when landing on the enemy back rank,
  optionally roll 1d6 minus 1 and revive up to that many captured pawns on empty
  pawn-starting squares, from a-file to h-file. Once per side. BigDoe survives;
  zero rolls and blocked/full home rows still spend the revival.
- **Barb / rook — Stop Skipping Leg Day:** friendly pieces immediately left and
  right of a rook gain one-square king-style moves and captures, instead of an
  ordinary move. Passive, no stacking, and no bonus king moves.
- **Ethan B / bishop — Moving the Fucking Goalposts:** the first captured non-king
  ally defended by a bishop before the move is rescued, if a safe adjacent square
  exists. The nearest empty, unattacked square is chosen automatically; orthogonal
  squares precede diagonals, then file/rank order breaks ties. The attacker lands normally. Once per side, shared by both bishops. No available safe square means
  the piece dies and the save remains. A rescued pawn cannot land on ranks 1 or 8.
- **Tushar / queen — Willing Sacrifice:** capture your own non-king pieces. Ethan
  can rescue a protected sacrifice, spending the same once-per-side save.

An active power is part of that turn, followed by two ordinary turns before any
other active power. The cooldown is shared by the side, not individual pieces.
Barb and Ethan are passive. Underdog mode requires one ordinary turn for the
underdog and three for the favourite; it is experimental, not a calibrated Elo
handicap. Promotions and revival never replenish rescue/revival charges.

Castling, en passant and normal promotion are supported. Castling rights are lost
when a rook is rescued. Captured promoted pawns return as ordinary pawns. Games are untimed. Existing timed rooms are upgraded without losing seats, board
state or power charges; pending rescues complete automatically.

Repetition includes the board, castling/pawn movement rights, cooldowns, charges,
en passant and pawn reserves. The fifty-move rule applies. Standard insufficient
material checks are unsafe with resurrection and auras, so only bare kings trigger
an automatic material draw. Players can agree to a draw or resign.

## Architecture

- `src/rules/`: pure shared TypeScript rules; no network or browser dependencies.
- `src/shared/`: protocol and character descriptions.
- `src/server/`: authoritative Worker and SQLite-backed Durable Object per room.
- `src/client/`: small framework-free Chessground application.
- `tests/`: fast offline tests for critical legality, powers, recovery and authorization.
- `scripts/`: bundling, formatting and hard quality gates.

The server validates every command and revision, rolls revival dice after move
validation, persists accepted state before broadcasting and uses WebSocket
hibernation. Legacy clock alarms are removed on recovery. Replays and
client-provided board state are never trusted. Source code is public under GPLv3.

## Quality

```sh
npm run format
npm run check
npx wrangler deploy --dry-run
```

Strict TypeScript, no unused variables, cyclomatic complexity at most 20, nesting
at most three and no tracked text file above 800 lines. The generated lockfile is
compacted by `node scripts/lock.mjs` after dependency changes. Critical tests are
offline; UI snapshot tests are intentionally absent.

## Deploy

```sh
npm run deploy
```

`wrangler.jsonc` deploys only `brotherchess.hobbyhood.app/*`, preserving the existing
wildcard DNS and unrelated routes. The existing proxied wildcard DNS covers this
hostname. Worker assets serve the static client; `/api/*` reaches the room service.
Keep Cloudflare credentials outside Git. Deployment uses the operator's existing
Cloudflare authorization or a scoped `CLOUDFLARE_API_TOKEN` environment variable.

## License and credits

GPL-3.0-or-later; see LICENSE. Retains the OpenChess fork history and attribution.
Chessground is GPL-3.0-or-later. Its included cburnett piece artwork is by
Colin M. L. Burnett, licensed GPL-2.0-or-later. Serve this repository's source link
and preserve notices when redistributing. No standard Stockfish analysis is shown:
standard chess engines do not understand Brotherhood's special rules.

The optional Faces theme uses community Discord profile portraits; see
`assets/avatars/NOTICE.md`. Classic chess artwork remains available by default.
