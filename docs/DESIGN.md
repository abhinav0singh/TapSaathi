# Web design notes

The web app (`apps/web`) follows an iOS and Uber feel: a quiet gray canvas, white rounded surfaces,
true-black primary actions, and regular to semibold type. There are no outlines; space and tone
separate things. Components come from shadcn/ui (built on Base UI) and live in `components/ui`.

## Who each screen is for

| Screen | User | Notes |
| :-- | :-- | :-- |
| `/worker/[id]` | Delivery rider, outdoors, one hand, often on a weak network | Route on top, sheet below, actions in the thumb zone. English and Hindi are always one line apart. A "no signal" banner shows the last known time. |
| `/supervisor` | Supervisor, laptop first, phone second | Queue sorted overdue, then critical, then longest wait. One action: record acknowledgment. The case opens as a sheet on a phone. |
| `/ops` | Demo operator (judges watching) | Stage list for the current alert, map, riders by urgency, deliveries, and audit, impact and context tabs. |

## Rules

- **State is never color alone.** Each risk state has a color, an icon and a word
  (`components/status/stateMeta.tsx`). Do not add a state without all three.
- **Type scale:** page titles 26px, section titles 18-20px, body 15-16px, labels 13-14px. Only real
  numbers use large type; words such as "Loading" stay small (`Stat` in `app/ops/page.tsx`).
- **Weights:** 400, 500 and 600 only.
- **Fonts:** Inter for Latin and Noto Sans Devanagari for Hindi. Give Hindi headings extra line height.
- **Time:** format with `lib/time.ts` (fixed locale and the Asia/Kolkata zone) so server and browser
  output match. Use `useNow` for anything that ticks.
- **Honesty copy stays:** the simulated-demo notices, "TaapSaathi has not placed an emergency call",
  and "acknowledgment is not medical clearance".

## Tokens

Defined in `app/globals.css`: `canvas`, `surface`, `fill`, `label`, `label-2`, and the state tones
`safe`, `caution`, `high`, `critical`, `rest`, `wait` (each with a `-tint` and `-ink` variant).
`app/shadcn.css` is vendored from shadcn/ui and provides the `data-*` variants the components use.

## Logic that is tested

`lib/stages.ts` (alert stages), `lib/auditText.ts` (audit events in plain words) and
`lib/humanize.ts` have unit tests under `lib/`.
