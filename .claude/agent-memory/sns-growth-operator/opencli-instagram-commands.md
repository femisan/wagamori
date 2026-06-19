---
name: opencli-instagram-commands
description: Verified opencli Instagram adapter commands, syntax, auth state, and browser-bridge setup for wagamori.studio ops
metadata:
  type: reference
---

opencli v1.8.4 installed (node v24.15.0). Instagram adapter = site `instagram`, 23 commands, all `strategy: cookie/ui` so all require the browser bridge (Chrome + OpenCLI extension).

**PROFILE LOCK (critical syntax):** the `--profile mbn3cgns` flag is GLOBAL and MUST come BEFORE the subcommand: `opencli --profile mbn3cgns instagram <verb> ...`. Placing it after the subcommand fails with "unknown option". Pre-flight every run with `opencli --profile mbn3cgns instagram whoami` → confirm `username: wagamori.studio` (user_id 23694370112) before any action; STOP if it differs.

**No hashtag verb exists.** There is no `instagram hashtag` command. Discover topical accounts via `search` (users only) + `explore`, then drill in with `profile` / `user`. `search` returns only ~5 results even with a higher `--limit`, and can false-match foreign-language accounts on romaji substrings (a 子供の絵 query surfaced Korean "jini*" handles) — verify every hit. `user --index 1` is normally the most-recent post, but a pinned post can sit at index 1 while newer posts are at higher indices (seen on harepeta) — check the `date` field before targeting an index for like/comment.

Browser bridge verified healthy via `opencli doctor`: daemon on port 19825, extension v1.0.20, profile `mbn3cgns (wagamori)` is connected + default. `opencli instagram whoami` confirms logged in as wagamori.studio — **no re-login needed**, COOKIE strategy reuses the live session.

Read-only (safe, no approval needed for assessment):
- `instagram whoami` — current logged-in account
- `instagram profile <username>` — bio, followers, following, posts, verified, url
- `instagram user <username> --limit N` — recent posts (caption/likes/comments/type/date/index)
- `instagram followers|following <username> --limit N`
- `instagram search <query> --limit N` — search users
- `instagram explore --limit N` — trending posts
- `instagram saved --limit N [--collection X]`
- `instagram download <url> --path X`

Write (require explicit per-action user approval before running):
- `instagram post [content] --media <comma,paths>` — feed image or carousel (up to 10 media). content = caption.
- `instagram reel [content] --video <path.mp4>` — single mp4 reel. timeout default 600.
- `instagram story [media]` — single story image/video
- `instagram note [content]` — text note
- `instagram comment <username> <text> --index N` — comment on a post (index 1 = most recent)
- `instagram like|unlike|save|unsave <username> --index N`
- `instagram follow|unfollow <username>`

Universal: add `-f json` for machine-readable output. Write commands output columns status/detail/url. Use `--window foreground` if you want to watch the action.

**Allow-rules + `like` 404 incident (2026-06-18):** The first-day engagement batch confirmed the `.claude/settings.local.json` Bash allow-rules for `opencli --profile mbn3cgns instagram follow/like/comment` WORK — all 4 `follow` commands executed with zero permission prompts (returned `status: Following`). The profile-before-subcommand form matches the allow-rule prefix as expected. HOWEVER, `instagram like` failed systemically: 3 different targets (ray_woodmade, _____.lume, lumruca) all returned identical `Error: Failed to like: HTTP 404`. Verbose trace shows the adapter navigates to instagram.com then runs an internal `evaluate` step whose in-page fetch to Instagram's like API returns 404 — i.e. the like API call itself fails, not a permission/syntax issue (syntax verified via `--help`). `follow` works but `like` does not, so the IG like endpoint/selector in the adapter appears stale/broken as of this date. Batch was STOPPED after 2-3 consecutive 404s (did NOT loop through the remaining 9 likes + 5 comments) to avoid a burst of failed API calls that could trip IG's action-block detection.

**Why:** A repeated identical platform error across multiple targets = systemic adapter/endpoint failure, not a per-post miss; continuing would be pointless and spam-flag risky.
**How to apply:** Before any future bulk `like` run, smoke-test ONE like first; if it 404s, the like verb is broken — do not run the rest. `follow` and (untested this round) `comment` are separate code paths; a `like` failure does not necessarily mean they're broken.

**RESOLVED via autofix (2026-06-18).** Root cause: Instagram retired the old web REST routes the bundled adapter used — `/api/v1/web/likes/{pk}/like/` and `/api/v1/web/comments/{pk}/add/` now 404 (web UI moved likes to a GraphQL mutation `xig_media_like`). `follow` was unaffected because `/api/v1/friendships/create/{id}/` is still alive. **Fix:** patched both adapters to the still-working private-API endpoints, mirroring `follow`:
- like → `POST /api/v1/media/{mediaId}/like/`  (body `media_id={id}&container_module=feed_timeline`)
- comment → `POST /api/v1/media/{mediaId}/comment/`  (body `comment_text=...`)
- use `mediaId = posts[idx].id || posts[idx].pk` (the FULL id `{pk}_{ownerId}`, not bare pk), and add header `X-Requested-With: XMLHttpRequest`.
Files: `~/.nvm/versions/node/v24.15.0/lib/node_modules/@jackwener/opencli/clis/instagram/{like,comment}.js`. **`like` verified live** (status: Liked on lumruca). **`comment` patched by analogy, NOT yet live-tested** (user had paused comments) — verify on first real comment. NOTE: these are user-local node_modules edits; an `opencli` reinstall/upgrade will overwrite them — re-apply if `like` starts 404ing again. Worth filing upstream to jackwener/OpenCLI.

**Why:** Confirmed by `opencli list -f json` + per-command `--help` on 2026-06-18.
**How to apply:** Always pass `-f json`. For any write/outward action get the user's per-action OK first (see [[compliance-keihyo-stema]]). If a command fails on a site change, retry with `--trace retain-on-failure` (max 3 rounds).
