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
            //remove ALL established listeners 
            ws.removeEventListener('message', onMessage);
            ws.removeEventListener('close', onClose);
            ws.removeEventListener('error', onError);
            console.log("received: ",res.data.toString());
            sendMsg(ws,{
                result: "success",
            });
            resolve(JSON.parse(res.data.toString()));
        }
    
        ws.addEventListener('message', onMessage);
        
        const onClose = () => {
            reject(new Error('WebSocket closed'));
        }

        ws.addEventListener('close', onClose);
    
        const onError = (event : WebSocket.ErrorEvent) => {
            reject(new Error(`WebSocket error: ${event}`));
        }

        ws.addEventListener('error', onError);
    });
}

export {sendMsg, broadcastMsg, recvMsg};