import {WebSocket} from 'ws';
import {EventEmitter} from "node:events"
import { ParticipantStatus } from './constants';

export interface ParticipantInfo {
    id: string, 
    nickname: string,
    score: number,
    status: ParticipantStatus,
    isBot: boolean,
}

export interface Participant {
    makeGuess: (
        emitter: EventEmitter,
        roundStartTime: number, 
        handleClose: (ws: WebSocket) => void,
        addBroadcastGameEvent: (ge: GameEvent) => void,
        total: number,
    ) => Promise<Object>,
    getInfo: () => ParticipantInfo,
    // return true if just died
    changeScore: (delta: number) => boolean,
    getSocket: () => WebSocket | null,
    setSocket: (ws: WebSocket) => void,
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
    activeCount: number,
}

export interface GameInfo extends GameEvent {
    event: "gameInfo",
    participants: ParticipantGuess[],
    round: number,
    gameEnded: boolean,
    activeCount: number,
    target: number,
    winners: string[], //winners id
    roundStartTime: number,
    roundEndTime: number,
    //properties that start with just emphasizes that they represents the change in state but not the current state
    justDiedParticipants: Dead[],
    justDisconnectedParticipants: Disconnected[],
    justReconnectedParticipants: Reconnected[],
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
    id: string,
}

export interface Dead {
    id: string,
    reason: "deadLimit",
}

export interface Disconnected {
    id: string,
    reason: "disconnected" | "disconnectedMidgame",
}

export interface Reconnected {
    id: string,
    reason: "reconnected",
}

export interface Tip {
    message: string,
    showFrom?: Date,
    showTo?: Date,
}

export interface ServerAnnouncement extends Announcement{
    type: "server",
    title: string,
    body: string,
}

export interface ClientAnnouncement extends Announcement {
    shortCode: string,
    type: "client",
}

export interface Announcement {
    type: "client"|"server",
    showFrom?: Date,
    showTo?: Date,
    shortCode?: string,
    eventTime?: number,
    title?: string,
    body?: string,
}

export interface Statistic {
    createdAt: Date,
    numBots: number,
    numPlayers: number,
    target: number,
    round: number,
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