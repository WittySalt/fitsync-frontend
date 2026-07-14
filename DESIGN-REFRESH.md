# FitSync Design Refresh — Energy Layer (2026-07)

A visual-language upgrade on top of the FE-1..3 token foundation. Goal: move the
UI from "clean admin dashboard" toward an energetic, fitness-brand feel without
breaking the token golden rule (no raw hex outside `src/styles/fitsync-tokens.css`).

## New tokens (light + dark variants included)

| Token | Purpose |
|---|---|
| `--gradient-accent` | Signature green→teal energy gradient. Primary buttons, brand mark, eyebrow dash, progress fills. |
| `--gradient-hero` / `--text-on-hero(-muted)` | Immersive dark-green hero panels (same in both themes). |
| `--hero-glass(-hover/-border)` / `--hero-glow` | Glassmorphism chips and light blobs inside hero panels. |
| `--workout(-strong/-subtle/-text)` | Workout domain color (blue family). |
| `--nutrition(-subtle/-text)` | Nutrition domain color (amber family). |
| `--body-domain` / `--body-subtle` / `--body-text` | Body-metrics domain color (teal family). |
| `--text-on-domain` | Text on saturated domain buttons (white in light, near-black in dark). |
| `--shadow-glow(-workout/-nutrition)` | Colored glow elevation for CTAs. |
| `--bg-glow-1/2` | Ambient radial glows layered onto the page background. |
| New primitives | `--teal-300..600`, `--lime-300/400`, `--blue-400/600`, `--amber-400/700`. |

## Patterns introduced

- **Ambient background:** `body` layers two fixed radial glows over `--bg` so pages
  have depth instead of a flat slate field.
- **Staggered entrance:** `.page-grid > *` rises in with 60ms stagger
  (`rise-in`, `--dur-slow`, `--ease-out`); fully disabled by the global
  `prefers-reduced-motion` override.
- **Eyebrow dash:** `.eyebrow` / `.card-label` get an 18px gradient dash — the
  small signature detail repeated across every page.
- **Gradient CTAs:** `.button.primary` uses `--gradient-accent` + `--shadow-glow`;
  `.button.workout` / `.button.nutrition` use their domain gradients + glows.
- **Hero scene (dashboard):** `.hero-panel` is now `--gradient-hero` with glass
  quick-action chips (`--hero-glass`, backdrop-blur) and two decorative light blobs.
- **Domain-tinted metric cards:** icon chips (flame / scale `fs-icon`s) tinted per
  domain; hover borders take the domain color; stat numbers use `tabular-nums`.
- **Nav identity:** sidebar active item = `--accent-subtle` pill + inset accent bar
  + accent icon; brand mark uses the signature gradient.
- **Progress visuals:** rings sweep teal→domain color; `.progress-track` fills with
  the accent gradient and animates width.

## Rules that still apply

- Semantic tokens only in component SCSS (`color-mix()` over tokens is allowed).
- All motion must be neutralized by the global reduced-motion block (it is —
  everything uses `animation`/`transition`, no JS-driven motion).
- Domain buttons must keep AA contrast: `--text-on-domain` flips to near-black in
  dark mode where domain colors brighten (blue-400/amber-400/teal-400).
