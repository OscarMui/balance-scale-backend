import {WebSocket} from 'ws';

export interface ParticipantInfo {
    id: string, 
    nickname: string,
    score: number,
    isDead: boolean,
}

export interface Participant extends ParticipantInfo{
    socket: WebSocket,
}

export interface ParticipantGuess extends ParticipantInfo{
    guess: number | null, //null if participant died
}

export interface Req {
    method: string,
    [key: string]: any;
}

export interface GameEvent {
    event: string,
}

export interface GameStart extends GameEvent {
    event: "gameStart",
    participants: ParticipantInfo[],
    round: number,
    gameEnded: boolean,
    aliveCount: number,
}

export interface GameInfo extends GameEvent {
    event: "gameInfo",
    participants: ParticipantGuess[],
    round: number,
    gameEnded: boolean,
    aliveCount: number,
    target: number,
    winners: string[], //winners id
    //properties that start with just emphasizes that they represents the change in state but not the current state
    justDiedParticipants: string[], //dead id
    justAppliedRules: (2 | 3 | 4)[],
}

// export enum Special {
//     PLAYER_DEAD = 0,
//     PLAYER_DISCONNECTED = 1,
//     ADDITIONAL_RULE_APPLIED = 2,
// }

// export interface SubmitGuessReq {
//     method: "submitNumber",
//     id: string,
//     guess: number,
// }

// export interface Res {
//     method: string,
//     result: "success" | "error",
//     errorMsg?: string,
//     [key: string]: any;
// }
// export interface JoinGameReq extends Req {
//     nickname: string,
// }

// export interface JoinGameRes extends Res {
//     participantsCount: number,
// }