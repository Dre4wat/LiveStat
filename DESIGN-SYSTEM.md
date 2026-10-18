# LiveStat REDLINE ARENA — Black / Red / White (v0.6)

The UI theme is now strictly **black, red, white and neutral grays**. All navigation, sport cards, buttons, player cards, toggles, notification panels and milestones follow the same palette.

## Theme tokens
- Canvas: `#080809`; panels `#111114`, `#18181c`
- Primary red: `#f02e41`; brighter highlight `#ff5367`; deep red `#8e1023`
- White: `#ffffff`; secondary white `#d4d4d7`; neutral border `#39393e`
- Milestone: white/gray card with red outline instead of gold

## Matchup background fix
All `Select Game` cards now use **generic CSS-generated charcoal arena geometry**, faint center-court lines and soft red lighting. They do **not** use a shared Lakers photograph/logo. The wrong derived background image assets were removed from the project.

## Navigation
Select Sport → Select Game → Select Player (or Team) → Alert Loadout. Existing backend/alert engine, game IDs, push service and provider adapters remain untouched.

## Design-only changes
- The sport photos have a monochrome filter and red lighting instead of blue/gold.
- Team emblems in game cards are stylized initial badges; their colors are red for away and white for home (not official team logos).
- This is still the **preview/prototype**, not a public HTTPS deployment. Live feeds / iPhone push need deployment and real-game testing.

Preview locally: `npm install && npm start`, then open `http://localhost:3000/?preview=1`.
