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
- API usage counter tracks two buckets: flash (250 RPD) and pro (100 RPD)
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

Session 1 status: COMPLETE

### What was built:
- Core estimation flow working end to end
- Text input (primary) and photo upload (secondary) both functional
- Gemini 2.5 Flash API integration with Grounding with Google Search enabled
- api/estimate.php structured with provider-based branching (Gemini path implemented, Anthropic path stubbed/ready for Session 2)
- Model identifier is a variable, defaults to "flash"
- Client-side image compression (1024px for API) and thumbnail generation (~200px base64)
- CSRF protection on all forms via includes/csrf.php
- localStorage history on the main page (reverse-chronological, with thumbnails, stores model_used)
- Mobile-first layout with text input as the hero element
- All UI styled with design tokens — no hardcoded values
- Theme toggle preserved from scaffold

### Architecture notes for next session:
- Auth is optional, not gating. Estimation flow and localStorage history work without login
- PHP sessions started for CSRF. Session 2 piggybacks for auth
- includes/config.php has gemini_api_key filled in, plus commented-out fields for anthropic_api_key, DB credentials, and app_passphrase
- api/estimate.php has provider branching: gemini path works, anthropic path needs implementing in Session 2
- The frontend sends model identifier in the request. Session 2 adds the model toggle UI
- The frontend sends base64 thumbnail in the payload. Session 2 stores it in DB for logged-in users
- localStorage history stores model_used per entry
- localStorage history on index.php should never be removed or replaced
- Gemini free tier: Flash (10 RPM, 250 RPD), Flash Thinking (same, uses thinkingConfig), Pro (5 RPM, 100 RPD)
- Claude API (Session 2): Sonnet and Opus via Anthropic API, paid per token, no grounding (uses training knowledge for restaurant lookups)

### Known issues or considerations for next session:
- Flash Thinking and Pro model paths are mapped in estimate.php but the frontend hardcodes "flash" — Session 2 adds the model toggle UI
- No rate limiting or API usage tracking yet — Session 3 adds the per-provider counter
- No error retry or user-friendly error messages beyond basic display — Session 3 polishes this
- localStorage has a ~5MB limit; history is capped at 50 entries with thumbnail cleanup to stay within bounds
