# LiveStat Arena v0.8 — public-access edition

Cinematic black/red/white sports alerts prototype. Five leagues: NFL, NBA, college football, NCAA men's basketball and NCAA women's basketball. **No private code is needed**; the app opens directly to Select Sport.

## Game box scores (v0.8)

From **Select Game**, tap **VIEW BOX SCORE** below any matchup. LiveStat fetches the ESPN game-summary box score and displays team comparisons plus player stat tables, with basketball and football categories matched to the feed. The two teams are switchable; you can return to selecting a player to create an alert loadout.

Game box scores refresh approximately every 25 seconds while the live box-score view remains open. Pending games may have no stats, and an unofficial ESPN feed may be incomplete, delayed, or unavailable. Preview mode provides clearly labeled sample box scores.

API route: `GET /api/boxscore?sport=nba&game=401766122`. There is no new external dependency. Automated tests cover parsing, missing data, markup escaping and responsive interface module syntax.

## Changes from v0.6

- Removed the shared access-code screen and Authorization headers.
- Visitors automatically receive a signed, HttpOnly, SameSite browser session cookie (one year). No sign-up or code entry.
- Watches, alert history, demo events and Web Push endpoints are now isolated to their own anonymous browser, including server-side checks for deletes and test pushes.
- Rejects cross-site write requests; caps each visitor at 40 saved watches, and the total at 500.
- Preserved the black, red and white UI, sport→game→player selection, one-change-per-play alerts, once-per-game milestone notifications and replaceable data-provider architecture.
- New Render Blueprint (`render.yaml`) for a **free experimental deployment** and a separate `render.production.example.yaml` for optional paid persistent hosting.

### Privacy and persistence

This is an **anonymous prototype**, not a full user-account system. Each phone/browser has its own settings. Clearing browser cookies resets access to the old session; different devices do not sync automatically. Don't use it for sensitive personal data. Public production use at scale needs rate limiting, stronger abuse protections, a database, account recovery, and operational monitoring. Cookies protect one visitor from ordinary access by another but are not a substitute for robust authentication.

## Local run

Node.js 20 or newer:

```sh
npm install
npm start
```

Then open http://localhost:3000. You will go straight to the app; no access key or login. To see a fake demo with mock games and simulated alerts, use http://localhost:3000/?preview=1. Main app uses free unofficial ESPN data when available. You can save per-play alerts and targets on the same statistic, e.g. LeBron Points Every Change + 15-point Target.

Tests: `npm test`. The live feed and actual iPhone Web Push delivery have not been verified with a real game.

## Publish on Render

### Experimental $0 web service

1. Put the contents of this project in its **own GitHub repository** (don't put it in an unrelated project).
2. Connect GitHub to Render and select **New → Blueprint**. Pick that repository and its included `render.yaml`.
3. Deploy, then visit the HTTPS `.onrender.com` URL Render gives you.
4. The login screen will not appear.

**Important:** Render's Free web service can spin down, restart, and uses **ephemeral storage**. It cannot reliably monitor games when asleep, and saved watches, session tracking data and push subscriptions disappear on restart/redeploy. The free plan is only for trying the interface and alerts while the service is active. No claim of truly instantaneous or reliable background notifications.

### Reliable monitoring upgrade

Use the example `render.production.example.yaml` as a starting point for paid deployment. It adds a persistent 1 GB disk with `LIVESTAT_DATA_DIR=/var/data` and a continuously running paid web instance. As of October 2026 Render lists the 0.5 CPU / 512 MB tier at approximately $7/month plus about $0.25/month for 1GB SSD. Check Render's latest prices before committing. An always-on process and persistent storage are required for consistent push tracking.

To keep sessions and push subscriptions working between redeploys, preserve `SESSION_SECRET` and VAPID keys. The server generates VAPID keys on first start and writes them to `LIVESTAT_DATA_DIR/vapid.json` if no values are provided. Set `VAPID_SUBJECT` to a real mailto: contact when configuring a public service.

### iPhone notifications

From Safari, add the hosted HTTPS site to your Home Screen. Open that installed app and use Settings → Enable Notifications, then Settings → Test Push. iPhone Home Screen Web Push needs iOS 16.4+ and permission. Data-provider accuracy, network latency, and Apple push delivery mean notifications may be late or missed.

## Source layout

- `server.js` serves the UI and visitor-scoped API
- `public/` contains the website, UI and PWA assets
- `src/providers/espn.js` is an unofficial ESPN adapter, subject to breakage, delays and terms/licensing requirements
- `src/providers/paid.example.js` is the future paid adapter example
- `src/engine/monitor.js` tracks game events and milestones
- `src/engine/push.js` sends push messages to the correct visitor's browser subscriptions
- `render.yaml` is the free but unreliable deployment starting point
- `render.production.example.yaml` is the optional paid persistent deployment example

**This ZIP is deployment-ready but does not mean the site is already deployed.** No public address is included until an actual hosting account deploys it.
