const production = false

// Constants mainly for testing purposes
export const PARTICIPANTS_PER_GAME = production ? 5 : 2;
export const DEAD_LIMIT = production ? -10 : -3;

//tolerance time to network delays, the client does not know about this
export const NETWORK_DELAY_MS = production ? 1000 : 1000;

//time allowed per round
export const ROUND_TIME_MS = production ? 3 * 60 * 1000 : 60 * 1000; //180s

//time allowed when every player has made their decision
export const SHORTENED_TIME_MS = production ? 15 * 1000 : 15 * 1000; //15s

//time given to players before round 0 first, 7 seconds seem too long, the client does not know about this
export const ROUND_ZERO_DIGEST_TIME_MS = 2 * 1000; //2s

//time given to players between rounds to digest information, the client does not know about this
export const ROUND_INFO_DIGEST_TIME_MS = 7 * 1000; //7s

//time given to players to digest other normal information, the client does not know about this
export const DIGEST_TIME_MS = 5 * 1000; //5s

export const ACCEPTED_CLIENT_VERSIONS = ["20230811.dev"]