# Custom period by dragging over the calendar — design

Date: 2026-11-13. Builds on the detail window of scope 16 (PR #47).

## Intent

The player wants a balance over any span of days, not only day / week / month / all. They pick it
where they already read the days: by dragging over the bars of the calendar at the top of the
detail window. The table, donut and ships then cover that span and the gold box surrounds it.

## Goals

- Press on a day, drag to another day of the shown month, release: the window shows that span.
- A plain click on a day keeps meaning "this day only".
- Works with a mouse and with a finger (Firefox Android).
- The dateline reads the span ("4 – 11 November 2026"); no period button is pressed.

## Non-goals

- Spans across several months (the calendar shows one month; option C was declined).
- Keyboard range selection; saving custom spans.

## Anti-goals

- Any game request or timer: the stats request goes to the player's own server, once, on release
  (AGENTS.md §4, §1.3).
- Breaking the page scroll on a phone while the finger is on the calendar.

## Approaches

| Option | Trade-off |
|---|---|
| **A. Drag over the bars (picked)** | Mouse and touch, a click keeps its meaning; spans stay inside the shown month |
| B. Shift + click | Simplest, no phone support |
| C. "Custom" button then two clicks | Explicit, allows multi-month spans, one more control and mode |

The player picked A.

## Design

**API.** `GET /api/v1/stats` accepts `period=custom` with `from` and `to` (`YYYY-MM-DD`), both
required for `custom`, `from <= to`, ignored for other periods. The response `range` is
`{ from, to }`; `days` (calendar bars) stay the month of `today`. `Period` gains `'custom'` in
`packages/shared`; `periodRange` takes the bounds for it.

**Client state.** `{ period, refDay, range? }`. A drag sets `period: 'custom'` and `range`; `refDay`
stays, so the shown month does not move. A period button or a day click leaves custom. The month
arrows switch a custom span to the whole new month (my call: a span of the old month would not be
visible there).

**Drag.** On the calendar: `pointerdown` on a day starts; moving over days (found with
`elementFromPoint`, since touch keeps targeting the first element) redraws the gold box live;
`pointerup` on another day requests the span, on the same day it is the existing day click.
`touch-action: pan-y` on the calendar lets the finger drag sideways while vertical page scroll
keeps working. Bounds are sorted, so dragging right to left works.

**Older server.** A server without `custom` answers 400; for a custom request the window shows
"Update your Starledger server to use custom periods" instead of the generic error (my call).

## Left to the builder

- Test split between `calendar.ts` (drag → callback) and `details.ts` (state, request, label).
- Whether `pointercancel` simply drops the drag (expected).
