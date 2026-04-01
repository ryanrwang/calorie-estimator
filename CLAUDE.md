# calorie-estimator

Personal calorie estimation web app with Gemini AI, optimized for LoseIt logging.

## Tech Stack
- **Frontend:** Vanilla JS + CSS (no frameworks, no build step)
- **Backend:** PHP (Bluehost shared hosting)
- **Database:** MySQL (added in Session 2)
- **AI:** Gemini 2.5 Flash / Flash Thinking / Pro via Google AI Studio API (free tier) + Claude Sonnet / Opus via Anthropic API (paid)
- **Deployment:** GitHub Actions SFTP to Bluehost

## Running / Testing
- Open `index.php` via a local PHP server (`php -S localhost:8000`) or test on Bluehost after deploy
- **Windows:** PHP 8.4 is installed via winget at `C:\Users\DarkD\AppData\Local\Microsoft\WinGet\Packages\PHP.PHP.8.4_Microsoft.Winget.Source_8wekyb3d8bbwe\php.exe`
- **Mac:** PHP is installed via Homebrew at `/opt/homebrew/bin/php`
- `.claude/launch.json` uses `"php"` as the executable — works cross-platform as long as PHP is on PATH
- The Gemini API calls require the server to have outbound HTTPS access (Bluehost does)

## Key Files
| File | Purpose |
|---|---|
| `index.php` | Main page — text input hero, photo upload, results display, localStorage history |
| `api/estimate.php` | POST endpoint — calls Gemini API, returns JSON |
| `includes/config.php` | Gitignored config — API key, DB credentials, passphrase |
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
- Auth is optional, not gating. The app works fully without login
- Logged-out users get Flash only + localStorage history
- Logged-in users get model selection + persistent MySQL history
- localStorage history and MySQL history are independent and do not sync
- Thumbnails are ~200px base64 JPEG strings, never full images
- API usage counter tracks three buckets: flash (250 RPD), pro (100 RPD), claude (paid, no limit — informational)
- Two AI providers: Gemini (free tier, has grounding for restaurant lookups) and Claude (paid, uses training knowledge). Provider routing handled in api/estimate.php
- Claude Sonnet and Opus are only available to logged-in users
- CSRF protection on all forms
- Client-side image compression: 1024px for API, 200px for thumbnails

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

## Environment
- **Mac:** `gh` CLI is installed via Homebrew at `/opt/homebrew/bin/gh`.
- **Windows:** `gh` CLI is installed at `/c/Program Files/GitHub CLI/gh.exe` — use this full path since it's not on the bash PATH.

## Repo Hygiene

### On session start
- Run `git status`, `git stash list`, and `git branch -a` to check for uncommitted changes, lingering stashes, stale branches, or divergence from remote.
- Flag any issues to the user before starting work.

### After push or PR
- Run `git status`, `git stash list`, `git branch -a`, and `git fetch --prune` to verify clean state.
- Flag any stale branches, uncommitted changes, or divergence.
- Ask the user what they'd like to work on next.

## "Push to prod"

When the user says **"push to prod"**, execute this full pipeline automatically:
1. **Commit** any uncommitted changes on the current branch (if any)
2. **Push** the branch to GitHub (`git push -u origin <branch>`)
3. **Create a PR** via `gh pr create`
4. **Merge the PR** immediately via `gh pr merge --squash` — use squash merge so the merge commit title on `main` is the descriptive PR title
5. **Switch to main** and pull (`git checkout main && git pull`)
6. **Delete the feature branch** locally (`git branch -d <branch>`)
7. **Prune** stale remote refs (`git fetch --prune`)
8. Run the standard post-push hygiene checks (status, stash list, branch -a)

If already on `main` with uncommitted changes, commit and push directly — no PR needed.

## Deployment
- **Host:** Bluehost (shared PHP hosting)
- **Repo:** GitHub with auto-deploy to Bluehost via GitHub Actions
- Do not commit `cache/` or `error_log` — these are in `.gitignore`.

## Current Session

Status: COMPLETE (all 3 sessions done)

### Summary:
Personal calorie estimation web app. Text or photo → AI estimate for LoseIt logging. Two AI providers: Gemini (Flash/Thinking/Pro with grounding, free tier) and Claude (Sonnet/Opus, paid). Works without account (Flash + localStorage). Passphrase login + username adds persistent history and full model selection.

### What was built:
- Session 1: Core flow, Gemini Flash + grounding, provider-based backend architecture, image compression, CSRF, localStorage history
- Session 2: Passphrase auth, MySQL history, Anthropic API integration, 5-model toggle (3 Gemini + 2 Claude), provider-aware history
- Session 3: Per-provider API counter, copy to clipboard, loading/error states, mobile polish

### API details:
- Gemini free tier: Flash (10 RPM, 250 RPD), Flash Thinking (same), Pro (5 RPM, 100 RPD), Grounding (500 RPD)
- Claude paid: Sonnet and Opus via Anthropic API, no daily cap, tracked for visibility
- All Gemini limits per API key, reset midnight Pacific. Google has changed limits before
- Claude has no grounding — uses training knowledge for restaurant lookups

### Known issues:
- Flash Thinking thinkingBudget is set to 1024 tokens — may need tuning based on response quality
- Claude API timeout set to 90s (vs 55s for Gemini) since Opus can be slower
- DB save silently logs errors to error_log rather than failing the request — monitor after deploy
- Copy-to-clipboard parsing relies on "Item — low–high" format; unusual AI response formats may fall back to raw text copy
- Gemini rate limits (RPM) are not tracked — only daily quotas (RPD) are enforced. Rapid successive requests could hit RPM limits and get 429s
- data/api_usage.json uses file locking (flock) which works on single-server Bluehost but would need a different approach for multi-server setups
