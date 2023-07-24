import {WebSocket} from 'ws';

interface Participant {
    id: string,
    nickname: string,
    socket: WebSocket,
    guesses: number[],
    score: number,
    isDead: boolean,
}

interface Req {
    method: string,
    [key: string]: any;
}

// interface SubmitGuessReq {
//     method: "submitNumber",
//     id: string,
//     guess: number,
// }

export {Participant, Req};
// interface Res {
//     method: string,
//     result: "success" | "error",
//     errorMsg?: string,
//     [key: string]: any;
// }
// interface JoinGameReq extends Req {
//     nickname: string,
// }

// interface JoinGameRes extends Res {
//     participantsCount: number,
// }