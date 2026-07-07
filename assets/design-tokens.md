# Gmail Lock — Design Tokens

Reference palette and type used across the lock screen, settings page, and popup.
Kept here so the look stays consistent if you extend the UI later.

## Color

| Token          | Hex / Value              | Use                                   |
|----------------|---------------------------|----------------------------------------|
| `bg-deep`      | `#05080C`                 | Page background                        |
| `bg-panel`     | `#0B131B` → `#0E1720`     | Card/panel gradient                    |
| `accent`       | `#83CEF4`                 | Primary accent, glow, focus states     |
| `accent-soft`  | `rgba(131,206,244,.12)`   | Subtle fills, hover backgrounds        |
| `text-primary` | `#EAF4FA`                 | Headings, primary text                 |
| `text-muted`   | `#7D94A3`                 | Secondary text, hints                  |
| `text-faint`   | `#445560`                 | Footnotes, disabled states             |
| `danger`       | `#FF6B7A`                 | Errors, incorrect password             |
| `success`      | `#6EE7A8`                 | Save confirmations                     |

## Type

- UI text: system font stack (`-apple-system, "Segoe UI", Roboto, sans-serif`)
- Eyebrows / readouts: monospace stack (`ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`),
  uppercase, `letter-spacing: 0.18em` — gives the "terminal readout" feel without
  bundling a custom font file.

## Motion

- Panel entrance: rise + fade, `cubic-bezier(0.16, 1, 0.3, 1)`, 0.45s
- Wrong password: horizontal shake, 0.45s
- Unlock: overlay fade-out, 0.4s
- Shield icon: continuous diagonal "scan" sweep, 2.6s loop
- All animation is skipped when `prefers-reduced-motion: reduce` is set.
