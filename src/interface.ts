interface Participant {
    id: string,
    nickname: string,
}

interface Req {
    method: string,
    [key: string]: any;
}

interface Res {
    method: string,
    result: "success" | "error",
    errorMsg?: string,
    [key: string]: any;
}
// interface JoinGameReq extends Req {
//     nickname: string,
// }

// interface JoinGameRes extends Res {
//     participantsCount: number,
// }