import * as WebSocket from 'ws';
//send a message to a websocket, id is optional and is for debugging only
const sendMsg = (ws: WebSocket, msg : Object, id? : string) => {
    if(id) console.log(`sent to ${id}:`,msg);
    else console.log("sent: ",msg);
    
    ws.send(JSON.stringify(msg))
}

//send a message to multiple websockets
const broadcastMsg = (wss: WebSocket[], msg : Object) => {
    console.log("broadcasted: ",msg);
    wss.forEach((ws)=>{
        ws.send(JSON.stringify(msg))
    })
}

//wait for a message
const recvMsg = (ws: WebSocket) : Promise<Object> => {
    return new Promise((resolve, reject) => {
        function onMessage(res: WebSocket.MessageEvent) {
            ws.removeEventListener('message', onMessage);
            console.log("received: ",res.data.toString());
            sendMsg(ws,{
                result: "success",
            });
            resolve(JSON.parse(res.data.toString()));
        }
    
        ws.addEventListener('message', onMessage);
    
        ws.addEventListener('close', () => {
            reject(new Error('WebSocket closed'));
        });
    
        ws.addEventListener('error', (event : WebSocket.ErrorEvent) => {
            reject(new Error(`WebSocket error: ${event}`));
        });
    });
}

export {sendMsg, broadcastMsg, recvMsg};