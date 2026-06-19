---
name: feedback-new-account-warmup
description: wagamori.studio is a brand-new IG account — got soft-blocked (forced logout) twice under light automation on 2026-06-18; warm up manually, keep automation minimal
metadata:
  type: feedback
---

The wagamori.studio account got **logged out twice within one day (2026-06-18)** during light automated engagement (follows + a handful of likes). The browser bridge stayed healthy (`opencli doctor` green) but the IG `sessionid` cookie was dropped → `whoami` returned `AUTH_REQUIRED`. This is almost certainly Instagram **soft-blocking a brand-new account (1 follower, near-zero history)** that performed API-driven actions.

**Why:** New accounts with no history are highly sensitive to automation signals; even modest follow/like bursts via the (private-API) adapter can trigger forced logout / action-block. Two logouts in a row = a real risk signal, not a fluke.

**How to apply:**
- For a fresh account, **warm up manually first**: post real content, browse, and do a few manual likes/follows by hand for days/weeks before any automation.
- When automating, keep volume **very low** and spacing **long** (single-digit actions/day, 60–120s+ gaps).
- Treat a forced logout as a STOP signal: pause automation for several days, don't re-run immediately after re-login (the user paused on 2026-06-18 after the 2nd logout).
- `follow`/`like`/`comment` all run through the browser session, so a logout halts everything; always pre-flight `whoami`. Relates to [[opencli-instagram-commands]] and [[compliance-keihyo-stema]].
