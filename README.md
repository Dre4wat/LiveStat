# LiveStat Arena v1.2 — Arena + Analytics Lab

Cinematic black/red/white sports alerts prototype. Five leagues: NFL, NBA, college football, NCAA men's basketball and NCAA women's basketball. **No private code is needed**; the app opens directly to Select Sport.

## Animated Stat Cards Studio — direct GitHub implementation

Open **Analytics Lab**, choose a player with recorded ESPN statistics, then select **Animated Cards** or **Player Cards → Animate this Card**. Three templates are available:

- **Performance Recap** — four available recorded stat values with animated count-ups and averages derived from the accessible game logs.
- **Target Reached** — choose an available stat and target. Badge only displays "TARGET ACHIEVED" if the recorded stat meets that goal. A manually entered goal is a user-set threshold, not an invented player statistic.
- **Mission Complete** — take milestones from the selected player's saved LiveStat alert loadout; goals are marked complete only when the corresponding game stats are present and meet each target.

Export 1080×1080 square (Discord), 1080×1350 portrait (social feed), or 1080×1920 vertical (TikTok/Reels/Shorts). The animated canvas is rendered in the browser without an AI image/video service. **PNG export** is available; **video export** uses the browser's supported MediaRecorder formats, preferring MP4 when supported and otherwise WebM. **iPhone/Safari recording availability varies**, and a browser lacking canvas stream capture will be offered PNG instead; no guaranteed universal MP4 conversion on the free server.

The studio reuses **current ESPN box-score statistics, historical game logs, real headshots via the restricted image proxy, and available team colors**. It never displays fabricated performances or unsourced milestone completions. Source data can be incomplete or delayed. No video clip licensing or paid API is required.

Files: `public/animated-cards.js`, `public/analytics-lab.js`, `public/analytics-lab.css`; with updated PWA cache, interface entry, and `test/animated-cards.test.js`. This was added directly to the current v1.2+ GitHub repository; the separately generated old v0.8 ZIP is obsolete and **must not replace** the live site.

## LiveStat Analytics Lab (v1.2)

Access **Analytics** from the desktop sidebar or iPhone bottom navigation. You can also open it from a selected player's Arena alert-loadout screen or from a saved player watch.

### Player History & Trends
- Select one of the five leagues, search an ESPN athlete by name or enter a numeric ESPN athlete ID.
- Choose a historical season and inspect **only the games ESPN returned**: individual games, opponents, results, stat columns, a line chart, sample game-log averages, and downloadable CSV.
- Compare two seasons or request a four-season archive; unavailable years remain empty. Season averages derived from the accessible game log are labeled **sample averages** and not misrepresented as official full-season stats.

### Custom Stat Dashboards
- Add/remove stat tiles, move them left/right, choose the displayed trend metric, and save separately named dashboard layouts.
- Layout preferences persist in the same browser's local storage. They do not yet sync between devices.

### Player Card Studio
- Create an actual **1080 × 1350 PNG**, with player name, position, ESPN headshot where supplied, sports colors and recorded stats.
- Modes: last recorded game, game-log average, best game in the accessible sample, or **selected-game box score** when opened from Arena with a valid game and team.
- The card displays comparison averages where possible. It uses a restricted ESPN-image proxy for canvas safety and falls back to an initials graphic if the headshot is unavailable.
- **Share** using the saved PNG; no misleading fabricated numbers or generated portraits.

### Formula Lab
- Construct custom indexes, such as `PTS + REB + AST` or `(PTS + 2 * AST) / 3`.
- Calculator supports numeric fields available in the latest recorded game, arithmetic and parentheses. It never runs user-supplied JavaScript.

### Player and Game Analyst
- The Lab's **Game Analyst** tab produces natural-language facts based on the athlete's **recorded game logs**: recent changes, samples, latest game and best performance.
- The Arena **Game Center → Game Analyst** tab describes scoring by period, recorded lead changes, quarter advantages, box-score leaders, and football third-down rates *only when data supports those claims*.
- Statistical analysis is free and deterministic; it is **not an LLM**. The optional **Try AI Explanation** button can use a server-side `OPENAI_API_KEY` and optional `LIVESTAT_AI_MODEL` environment variable for language refinement. Without configuration, it transparently falls back to a free statistical report. Do not place an API key in public GitHub files or browser JavaScript.
- ESPN data feeds are unofficial and may omit some leagues/years/stats; results are not guaranteed complete. Report sources explicitly reflect this uncertainty.

### API routes

`GET /api/analytics/search?sport=nba&q=LeBron`

`GET /api/analytics/player?sport=nba&athlete=1966&season=2025`

`GET /api/analytics/current?sport=nba&athlete=1966&team=13&game=401000001`

`GET /api/analytics/game?sport=nba&game=401000001`

`POST /api/analytics/analyst` using `{sport,athlete,season,metric,ai}`

`GET /api/analytics/headshot?url=...` accepts only the approved ESPN CDN headshot/team image directories.

All changes use the same existing Node.js server and Render deployment; no new npm dependency is required.

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
