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
        function onMessage(event: WebSocket.MessageEvent) {
            //remove ALL established listeners 
            ws.removeEventListener('message', onMessage);
            ws.removeEventListener('close', onClose);
            ws.removeEventListener('error', onError);
            console.log("received: ",event.data.toString());
            try{
                sendMsg(ws,{
                    result: "success",
                });

                resolve({
                    socket: event.target,
                    ...JSON.parse(event.data.toString())
                });
            }catch(e){
                reject({
                    socket: event.target,
                })
            }
            
        }
    
        ws.addEventListener('message', onMessage);
        
        const onClose = (event: WebSocket.CloseEvent) => {
            console.log("onClose fired in messaging.ts")
            ws.removeEventListener('message', onMessage);
            ws.removeEventListener('close', onClose);
            ws.removeEventListener('error', onError);
            reject({
                socket: event.target,
            })
        }

        ws.addEventListener('close', onClose);
    
        const onError = (event : WebSocket.ErrorEvent) => {
            console.log("onError fired in messaging.ts")
            ws.removeEventListener('message', onMessage);
            ws.removeEventListener('close', onClose);
            ws.removeEventListener('error', onError);
            reject({
                socket: event.target,
            })
        }

        ws.addEventListener('error', onError);
    });
}

export {sendMsg, broadcastMsg, recvMsg};