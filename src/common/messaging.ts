import * as WebSocket from 'ws';

//no try catch is needed for sendMsg and broadcastMsg
//The browser will throw an exception if you call send() when the connection is in the CONNECTING state. If you call send() when the connection is in the CLOSING or CLOSED states, the browser will silently discard the data.

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
const recvMsg = (ws: WebSocket, sendConfirmation=false) : Promise<Object> => {
    return new Promise((resolve, reject) => {
        function onMessage(event: WebSocket.MessageEvent) {
            //remove ALL established listeners 
            ws.removeEventListener('message', onMessage);
            ws.removeEventListener('close', onClose);
            ws.removeEventListener('error', onError);
            console.log("received: ",event.data.toString());
            if(sendConfirmation){
                sendMsg(ws,{
                    result: "success",
                });
            }

            resolve({
                socket: ws,
                ...JSON.parse(event.data.toString())
            });
        }
    
        ws.addEventListener('message', onMessage);
        
        const onClose = (event: WebSocket.CloseEvent) => {
            console.log("onClose fired in messaging.ts")
            ws.removeEventListener('message', onMessage);
            ws.removeEventListener('close', onClose);
            ws.removeEventListener('error', onError);
            reject({
                socket: ws,
            })
        }

        ws.addEventListener('close', onClose);
    
        const onError = (event : WebSocket.ErrorEvent) => {
            console.log("onError fired in messaging.ts")
            ws.removeEventListener('message', onMessage);
            ws.removeEventListener('close', onClose);
            ws.removeEventListener('error', onError);
            reject({
                socket: ws,
            })
        }

        ws.addEventListener('error', onError);
    });
}

export {sendMsg, broadcastMsg, recvMsg};