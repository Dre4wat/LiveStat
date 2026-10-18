# LiveStat Arena v1.0 — sports intelligence prototype

Cinematic black/red/white sports alerts prototype. Five leagues: NFL, NBA, college football, NCAA men's basketball and NCAA women's basketball. **No private code is needed**; the app opens directly to Select Sport.

## Position-first player selection (v1.1)

When picking a player for an NFL, college-football, NBA, or college-basketball game:

1. Choose the team.
2. Select a **position group** (e.g. QB, RB, WR, TE, defensive line, linebackers, cornerbacks, safeties; or basketball guards, forwards, centers).
3. Players within that group appear in priority order based on **published ESPN depth charts**, followed by **team statistical leaders** and **selected-game starters/performance** when supplied.
4. Choose a player and configure tracking alerts.

The search bar searches across the roster even before a group is chosen; the **View All Players** fallback remains available. Switching teams resets position selection. Badges such as `#1 DEPTH CHART` or `TEAM STAT LEADER` are only shown when ranking metadata exists.

Data is best-effort from ESPN's unofficial public feeds. College depth charts and some team leader reports may not be available. When none of those rankings are available, players fall back to alphabetical order rather than an invented starter ranking. Roster rank information is refreshed periodically.

## Football player stat tracker — position-aware

The NFL and College Football player loadouts no longer assume every athlete is a receiver. When you select a player, their ESPN roster position determines the default stat menu:
- QB: completions, passing attempts/yards/TDs, interceptions thrown, rushing attempts/yards/TDs, fumbles
- RB/FB: rushing and receiving stats (including targets), plus returns and fumbles
- WR/TE: receiving and rushing stats
- DL/LB/DB: tackles, solo/assisted tackles, sacks, tackles for loss, interceptions, passes defended, forced fumbles, fumble recoveries and defensive TDs
- K/P/returner: kicking, punting and return stats relevant to the position

Click **SHOW ALL STATS** to include stats outside the position suggestions, such as QB receiving stats on a trick play.

Stats are validated and saved across the browser and server. The box-score parser identifies passing, rushing, receiving and defensive sections by context; a generic YDS column is never automatically classified as receiving yards. Defender and specialist "Every Change" alerts use **confirmed ESPN box-score differences**, not guaranteed single-play events. One update can combine several plays and may be delayed; initial loading never falsely reports past events as new. Any stat missing from ESPN is shown as unavailable rather than zero.

## LiveStat v1.0 — Game Intelligence, Missions, Discord

The new features are committed directly to `Dre4wat/LiveStat` and included in the same Render deployment when auto-deploy is enabled.

### Game Center
On a match card tap **GAME CENTER**:
- Live/archived play-by-play grouped by quarter, with scoring plays and highlights for names in the saved watchlist.
- Game momentum from score differences, lead changes and biggest leads.
- ESPN-supplied win probability where provided; never a fabricated model estimate.
- Period scoring totals, scoring timeline and close-game Clutch Mode.
- NFL/CFB drive cards with available plays, yardage, starts and results.
- Basketball shot locations only if coordinates exist. Court diagram is approximate; no chart if source has no coordinates.
- Text recap export and any saved alerts matching the game's name.

### Command Center / Mission Tracker
- Your active player and team watch targets update from the box scores currently supplied by ESPN.
- One card per player or game, progress bars, missing-data states, pinning, comparison of two saved players, and mission completion.
- Updating while the screen is visible approximately every 25 seconds. No guaranteed background live update on the free Render plan.

### Advanced Alert Builder
Within an alert loadout:
- Every-play and individual milestone alerts remain independent.
- Extra once-per-game combined mission alert when ALL or ANY of at least two targets are achieved.
- Optional "almost there" alert before a target, plus min-quarter and max-score-margin constraints on the combined alert.
- NFL/CFB team events include red-zone entries (at most once per drive), scoring drives and turnovers where play text supports identification.
- Box-score verification checks missed threshold crossings and downward stat corrections but does **not** invent individual plays for a box-score jump.

### League Center and profiles
- League standings and injury reports (when ESPN exposes a supported response).
- Season player stats, recent game logs, and pregame form/scouting available in Player Profile.
- Historical matches through the date picker; availability depends on ESPN's retention.

### Optional Discord integration
Open **Settings → Discord Alert Relay**:
1. In your Discord channel, create a webhook under Channel Settings → Integrations → Webhooks.
2. Paste its HTTPS URL into LiveStat (do not share the URL in chat).
3. Choose from per-play, milestone, almost-there and correction messages; enable and save.
4. Send a test event.

The webhook is stored server-side for the browser's anonymous session. It is not shown in the response or shared with other visitors; cross-site updates are rejected. Disable it at any time. Webhooks can disappear when free Render ephemeral storage is reset. Discord is opt-in; rate-limited and configured with no mass mentions.

### Accuracy and availability caveats
This is a substantial functional prototype, **not a verified commercial real-time stat service**. ESPN's public interfaces are unofficial and vary by league and game. Live push notifications, game-specific shot coordinates, historic player game logs, injuries and standings are best effort and not end-to-end verified across all competitions. Full period-by-period *player* splits, exhaustive opponent-specific scouting, downloadable video highlights, and licensed near-instant data are not guaranteed. Free Render can sleep and lose watchlists/webhooks on restart. Paid always-on hosting with durable storage is recommended for reliable notifications.

API additions: `/api/intelligence`, `/api/profile`, `/api/league`, `/api/tracker`, `/api/discord`. Tests: `npm test`; GitHub Actions syntax and integration tests run on every push to main.

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
