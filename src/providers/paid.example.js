// Commercial upgrade: implement the same per-league functions and replace
// espnProviders in server.js. Stable athlete IDs or a migration are needed.
export function commercialProviderTemplate(sport){
  return {id:`licensed-${sport}`,sport,
    async teams(){throw new Error('Implement team lookup')},
    async roster(teamId){throw new Error('Implement athlete roster lookup')},
    async games(){throw new Error('Implement scoreboard lookup')},
    async plays(gameId){throw new Error('Implement ordered per-play stat events')}
  };
}
// Normalized play: {id,gameId,teamId,text,period,clock,scoringPlay,
// scoreValue,participants,structuredStats?}. Update matchPlay to read
// licensed provider structuredStats for authoritative athlete attribution.
