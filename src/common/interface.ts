import {WebSocket} from 'ws';

export interface Participant {
    id: string,
    nickname: string,
    socket: WebSocket,
    guesses: number[],
    score: number,
    isDead: boolean,
}

export interface Req {
    method: string,
    [key: string]: any;
}

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