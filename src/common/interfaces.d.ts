import {WebSocket} from 'ws';
import {EventEmitter} from "node:events"

export interface ParticipantInfo {
    id: string, 
    nickname: string,
    score: number,
    isDead: boolean,
    isBot: boolean,
}

export interface Participant {
    makeGuess: (
        emitter: EventEmitter,
        roundStartTime: number, 
        handleClose: (ws: WebSocket) => void,
        addBroadcastGameEvent: (ge: GameEvent) => void,
        getAliveCount: () => number,
    ) => Promise<Object>,
    getInfo: () => ParticipantInfo,
    // return true if just died
    changeScore: (delta: number) => boolean,
    getSocket: () => WebSocket | null,
    getId: () => string,
    getNickname: () => string,
    getScore: () => number,
    getIsDead: () => boolean,
    getIsBot: () => boolean,
    setIsDead: (isDead: boolean) => void,
    // socket: WebSocket,
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
    roundStartTime: number,
    roundEndTime: number,
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
    roundStartTime: number,
    roundEndTime: number,
    //properties that start with just emphasizes that they represents the change in state but not the current state
    justDiedParticipants: Dead[],
    justAppliedRules: (2 | 3 | 4)[],
}


export interface ChangeCountdown extends GameEvent {
    event: "changeCountdown",
    reason: "participantDisconnectedMidgame" | "allDecided",
    startTime?: number,
    endTime: number,
}

export interface ParticipantDisconnectedMidgame extends GameEvent {
    event: "participantDisconnectedMidgame",
    aliveCount: number,
    id: string,
}

export interface Dead {
    id: string,
    reason: "disconnected" | "deadLimit" | "disconnectedMidgame",
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