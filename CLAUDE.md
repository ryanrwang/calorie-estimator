# calorie-estimator

Personal calorie estimation web app with Gemini AI, optimized for LoseIt logging.

## Tech Stack
- **Frontend:** Vanilla JS + CSS (no frameworks, no build step)
- **Backend:** PHP (Bluehost shared hosting)
- **Database:** MySQL (added in Session 2)
- **AI:** Two models. Free: Gemini 3 Flash Preview (`gemini-3-flash-preview`) via Google AI Studio API, without search. Paid, logged-in only: Claude Sonnet 5.5 (`claude-sonnet-5-5`) via Anthropic API. Model IDs live in `$geminiModels` / `$anthropicModels` in `api/estimate.php`
- **Deployment:** GitHub Actions FTP to Bluehost

## Running / Testing
- Open `index.php` via a local PHP server (`php -S localhost:8000`) or test on Bluehost after deploy
- **Windows:** PHP 8.4 is installed via winget at `C:\Users\DarkD\AppData\Local\Microsoft\WinGet\Packages\PHP.PHP.8.4_Microsoft.Winget.Source_8wekyb3d8bbwe\php.exe`
- **Mac:** PHP is installed via Homebrew at `/opt/homebrew/bin/php`
- `.claude/launch.json` has two configs: `calories-mac` (Homebrew PHP via bash) and `calories-win` (WinGet PHP direct). Use the one matching the current OS with `preview_start`
- The Gemini API calls require the server to have outbound HTTPS access (Bluehost does)

## Key Files
| File | Purpose |
|---|---|
| `index.php` | Main page — text input hero, photo upload, results display, localStorage history |
| `api/estimate.php` | POST endpoint — calls Gemini/Claude API, returns JSON |
| `api/usage.php` | GET endpoint — returns current global usage counts and limits (prefetched on page load) |
| `includes/config.php` | Gitignored config — API key, DB credentials, passphrase, per-model limits, hard-stop flag |
| `includes/csrf.php` | CSRF token generation and validation |
| `includes/auth.php` | Auth helper functions (passphrase + username login) |
| `login.php` | Passphrase entry + username selection/creation |
| `history.php` | Persistent history page (requires auth) |
| `tokens.js` | Design token system — primitives + semantic, light/dark |
| `styles.css` | Global styles using CSS custom properties from tokens |
| `app.js` | Client-side logic — form handling, image compression, localStorage history |
| `schema.sql` | MySQL CREATE TABLE statements |
| `data/api_usage.json` | Daily API call counter (per model) |

## Rules
- When the user asks for "plaintext" output, produce absolutely no markdown formatting — no headers, no bold, no bullets, no backticks, no code blocks. Claude input fields do not render markdown.
- Auth is optional, not gating. The app works fully without login
- Logged-out users get Flash only + localStorage history
- Logged-in users can pick Flash or Sonnet + persistent MySQL history
- localStorage history and MySQL history are independent and do not sync
- Thumbnails are ~200px base64 JPEG strings, never full images
- API usage counter tracks per-model: flash, sonnet — each with its own configurable daily limit in config.php. Retired keys (flash-thinking, pro, opus) only remain as labels for old saved history; history filters group meals by provider (Gemini / Claude)
- Hard-stop flag (`usage_hard_stop`) in config blocks requests when a model's limit is reached; can be toggled off to allow unlimited usage
- Two AI providers: Gemini (free tier, no search) and Claude (paid, `web_search` tool for restaurant lookups). Provider routing handled in api/estimate.php
- Do not add the `google_search` tool to Gemini requests while the key is on the free tier: Search grounding is not on the free tier for any Gemini 3 model, and every request returns 429
- Claude Sonnet is only available to logged-in users
- CSRF protection on all forms
- Client-side image compression: 1024px for API, 200px for thumbnails
- Every new interactive element (buttons, clickable icons, etc.) must include a `data-tooltip` attribute. Text-labeled buttons with clear visible labels are exempt.

## Design Tokens

The project uses a centralized design token system defined in `tokens.js` with light/dark theme support.

`tokens.js` exposes two interfaces:
- **`window.TOKENS`** — JS object with `primitives` and `semantic` layers
- **CSS custom properties** — injected on `:root` and `[data-theme="dark"]`

### Token Rules
- **All code must use tokens** for colors, spacing, sizing, typography, border-radius, shadows, opacity, and transitions. Never hardcode these values.
- **Use semantic tokens first** (`var(--color-text-primary)` or `TOKENS.semantic.color.text.primary`). Fall back to primitives only when no semantic token exists.
- **Before adding any new design value**, check `tokens.js` first. If the value exists, use it. If not, add a new primitive and semantic token before using it.
- **All spacing and sizing must use the 4px base grid:** 0, 1, 2, 4, 8, 12, 16, 20, 24, 32, 40, 48, 56, 64, 80, 96, 128. Off-grid values are not allowed.
- **Breakpoints and z-index are intentionally NOT tokenized.** They have implicit ordering dependencies. Do not refactor without explicit approval.

### Usage — CSS
```css
.my-element {
    color: var(--color-text-secondary);
    background: var(--color-bg-surface);
    padding: var(--spacing-md);
    border-radius: var(--radius-sm);
}
```

### Usage — JavaScript
```javascript
var t = window.TOKENS;
element.style.color = t.semantic.color.text.secondary;
```

## Input Card Expanded/Compact States

The `.input-card` has two states: expanded (default, for editing) and compact (after submit, shows results). The compact state is toggled via `.input-card.compact` class, animated with the Web Animations API in `app.js`.

### Critical rules — do not break:
- **Text must not shift** between expanded and compact. Both states use `padding-left: var(--spacing-md)` (16px) and `padding-top: var(--spacing-md)` (16px) on the `.food-input` textarea. The compact card has NO card-level padding — all positioning comes from the textarea's own padding.
- **Compact height is explicitly set** to `59px !important` on `.food-input` (16px top + 27px line-height + 16px bottom). Do NOT use `height: auto` on a textarea — it resolves to the `rows` attribute, not the content. The `!important` is required to beat inline `style.height` set by the auto-resize JS.
- **Layout axis stays the same.** Both states use `flex-direction: column`. Do NOT change compact to `flex-direction: row` — it makes vertical text alignment impossible to match because `align-items: center` depends on sibling heights.
- **Compact actions are absolutely positioned** (`position: absolute; right; top: 50%; transform: translateY(-50%)`) inside the card. They are NOT flex siblings of the textarea.
- **Toolbar and photo-preview use `display: none`** in compact. Do NOT try to animate these with opacity/max-height — it causes visible flashing during the transition.
- **Height animation uses Web Animations API** (FLIP pattern in `compactInput()`/`expandInput()`). The `.animating` class temporarily sets `overflow: hidden` to clip content during the transition.

## Modal Component

All `<dialog>` modals use a shared `.modal` component defined in `styles.css`. Do NOT create one-off dialog styles.

### HTML template
```html
<dialog id="my-dialog" class="modal">
    <div class="modal-content">
        <div class="modal-header">
            <h2 class="modal-title">Title</h2>
            <button type="button" class="modal-close" aria-label="Close">
                <span class="material-symbols-outlined">close</span>
            </button>
        </div>
        <!-- Body content here -->
        <div class="modal-actions">
            <button type="button" class="modal-btn">Secondary</button>
            <button type="button" class="modal-btn modal-btn-primary">Primary</button>
        </div>
    </div>
</dialog>
```

### Available classes
| Class | Purpose |
|---|---|
| `.modal` | Dialog shell — 400px max, 16px mobile margins, `overflow: hidden` |
| `.modal-lg` | Wider variant (560px), top-pinned, scrollable content area |
| `.modal-content` | Padding wrapper |
| `.modal-header` | Title + close button row |
| `.modal-title` | Heading text |
| `.modal-close` | 32px icon-only close button |
| `.modal-body` | Body text (secondary color, small font) |
| `.modal-actions` | Button row (flex, gap) |
| `.modal-btn` | Standard button (bordered, secondary) |
| `.modal-btn-primary` | Primary button (filled, orange) |

### Rules
- **Every new modal must use these shared classes.** Do not duplicate shell/header/button CSS per modal.
- `.modal-btn` with `flex: 1` makes buttons equal-width inside `.modal-actions`. A single button fills the row.
- For complex modals (e.g. split dialog), use `.modal-lg` and keep unique interior styles separate.
- All modals open via `dialog.showModal()`, close via backdrop click, close button, or Escape.
- The image overlay (`<div class="image-overlay">`) is NOT a modal — it's a full-screen viewer and stays separate.

## Deployment
- **Host:** Bluehost (shared PHP hosting)
- **Repo:** GitHub with auto-deploy to Bluehost via GitHub Actions
- Do not commit `cache/` or `error_log` — these are in `.gitignore`.

## Current Session

Status: COMPLETE (all 3 sessions done)

### Summary:
Personal calorie estimation web app. Text or photo → AI estimate for LoseIt logging. Two models: Gemini 3 Flash Preview (free, no search) and Claude Sonnet 5.5 (paid, web search). Works without account (Flash + localStorage). Passphrase login + username adds persistent history and the Sonnet option. The lineup was trimmed from five models to two in Nov 2026.

### What was built:
- Session 1: Core flow, Gemini Flash + grounding, provider-based backend architecture, image compression, CSRF, localStorage history
- Session 2: Passphrase auth, MySQL history, Anthropic API integration, 5-model toggle (3 Gemini + 2 Claude), provider-aware history
- Session 3: Per-provider API counter, copy to clipboard, loading/error states, mobile polish

### API details:
- Gemini free tier: per-model limits are shown at aistudio.google.com/rate-limit, not in the docs. Search grounding needs a billed project (5,000 searches a month free, then $14 per 1,000)
- Free-tier speed test (Nov 2026, one run each on the real prompt, no search): 3 Flash Preview 16s, 3.1 Flash-Lite 2.7s, 3.5 Flash-Lite 3.7s but lumped items together, 3.8 Flash 85s, 3.6 Flash / 3.5 Flash / flash-latest over 90s. Re-test before switching models
- Claude paid: Sonnet 5.5 at $2 / $10 per 1M tokens, plus web search at about $10 per 1,000 searches. Daily cap in config (default 50) for cost control. Requests opt into server-side refusal fallbacks (`fallbacks: "default"`, beta `server-side-fallback-2026-07-01`) and continue `pause_turn` replies up to twice
- All Gemini limits per API key, reset midnight Pacific. Google has changed limits before

### Known issues:
- Claude API timeout set to 90s (vs 55s for Gemini) since web search turns can be slow. Sonnet runs at effort `medium` with `max_tokens` 16000 (thinking counts toward it)
- DB save silently logs errors to error_log rather than failing the request — monitor after deploy
- Copy-to-clipboard parsing relies on "Item — low–high" format; unusual AI response formats may fall back to raw text copy
- Gemini rate limits (RPM) are not tracked — only daily quotas (RPD) are enforced. Rapid successive requests could hit RPM limits and get 429s
- data/api_usage.json uses file locking (flock) which works on single-server Bluehost but would need a different approach for multi-server setups

## Open issues

- **No forced HTTPS redirect (from the portfolio audit, 14 Oct 2026). Bring this up at the start of the next session on this app.**
  - **Problem:** this app's `.htaccess` turns on `RewriteEngine`, and in Apache that replaces the site root's rewrite rules instead of adding to them. So the root's redirect (plain http and non-www to `https://www.`) never runs here.
  - **Live check (14 Oct):** `http://www.ryanrwang.com/apps/calories/` and `https://ryanrwang.com/apps/calories/` both load with 200 instead of a 301, and the same happens on clearful.net. Every other page on the site redirects.
  - **Risk:** HSTS (1 year, sent site-wide) protects visitors after their first HTTPS page, so the gap is a first visit over plain http, which includes the passphrase login and API calls.
  - **Fix:** add `RewriteOptions Inherit` on the line after `RewriteEngine On`, as `motoinsight/.htaccess` does in the portfolio repo. Inherited rules run after this file's own, so the `[F,L]` blocks on `includes/` and `data/` still win.
  - **Check after deploy:** both URLs above should return `301` to `https://www.<same host>/apps/calories/`. Login, history, photo upload and the API should still work over HTTPS.
