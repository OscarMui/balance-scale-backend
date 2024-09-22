const production = true

// Constants mainly for testing purposes
export const PARTICIPANTS_PER_GAME = production ? 5 : 3;
export const DEAD_LIMIT = production ? -5 : -3;

// max number of rounds permitted in a game to prevent infinite loops
export const ROUND_LIMIT = 200;

// max number of games permitted to prevent overloading of servers
export const GAMES_LIMIT = 1000;

//tolerance time to network delays, the client does not know about this
export const NETWORK_DELAY_MS = production ? 1000 : 1000;

//time allowed per round
export const ROUND_TIME_MS = production ? 60 * 1000 : 30 * 1000; 

//time allowed when every player has made their decision
export const SHORTENED_TIME_MS = production ? 5 * 1000 : 5 * 1000;

//time allowed for players to amend their guesses when disconnected
export const SHORTENED_TIME_AMEND_MS = production ? 30 * 1000 : 5 * 1000;

//time given to players before round 0 first, 7 seconds seem too long, the client does not know about this
export const ROUND_ZERO_DIGEST_TIME_MS = 2 * 1000;

//time given to players between rounds to digest information, the client does not know about this
export const ROUND_INFO_DIGEST_TIME_MS = 10 * 1000;

//time given to players to digest other normal information, the client does not know about this
export const DIGEST_TIME_MS = 5 * 1000;

//waiting time before the room is populated with computer players
export const POPULATE_BOTS_TIME_MS = production ? 15 * 1000 : 5 * 1000;

export const PREFERRED_CLIENT_VERSIONS = ["20240815.0.app","20240922.0.app"]
export const ACCEPTED_CLIENT_VERSIONS =  PREFERRED_CLIENT_VERSIONS.concat(["20240106.0.cmd","20240106.0.app"])