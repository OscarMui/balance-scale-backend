import * as express from 'express';
import * as http from 'http';
import * as WebSocket from 'ws';
import { v4 as uuidv4 } from 'uuid';
import './interface';

// Important constants
const GAME_LIMIT = 2;

const app = express();

//initialize a simple http server
const server = http.createServer(app);

//initialize the WebSocket server instance
const wsServer = new WebSocket.Server({ 
    server,
    path: "/game",
});

let participants : [WebSocket, Participant][] = [];

const getParticipantsWs = () => {
    return participants.map(([ws,p])=>ws)
}

const getParticipantsP = () => {
    return participants.map(([ws,p])=>p)
}

const sendMsg = (ws: WebSocket, msg : Res) => {
    ws.send(JSON.stringify(msg))
}

const broadcastMsg = (wss: WebSocket[], msg : Res) => {
    wss.forEach((ws)=>{
        ws.send(JSON.stringify(msg))
    })
}

wsServer.on('connection', (ws: WebSocket) => {
    // internal ID used for logging purposes only
    const id = uuidv4();

    console.log(`User ${id} connected, ${wsServer.clients.size} total connections`);

    //if number of clients, including this new client, is too much we terminate this new connection.
    // if(wsServer.clients.size > GAME_LIMIT){
    //     console.log('Maximum number of clients reached, terminating connection with ${id}...');
    //     ws.terminate();
    //     return;
    // }

    // Send a pong, then initialise a timeout of 10 seconds.
    let pingTimeout : NodeJS.Timeout;
    const waitPing = () => {
        ws.pong();
        //a timeout s.t. if client does not respond in 10 seconds, we terminate the connection
        pingTimeout = setTimeout(() => {
            console.log(`No ping received, terminating connection with ${id}...`);
            ws.terminate();
        }, 10000);
    }

    ws.on('ping', () => {
        // console.log('Received ping message from client');
        clearTimeout(pingTimeout);
        waitPing();
    });

    waitPing();

    //connection is up, let's add a simple simple event
    ws.on('message', (message: string) => {
        //log the received message and send it back to the client
        // console.log(`received from ${id}: %s`, message);

        try{
            const req : Req = JSON.parse(message);

            if(req.method === "joinGame"){
                //if too much players are playing give error and just do nothing
                if(participants.length >= GAME_LIMIT){
                    console.log('Maximum number of participants reached');
                    sendMsg(ws,{
                        method: "joinGame",
                        result: "error",
                        errorMsg: "Maximum number of participants reached",
                    });
                    return;
                }
                participants.push([ws,{
                    id: id,
                    nickname: req.nickname
                },]);
                console.log(`${id} joined the game registered, total ${participants.length} participants.`)
                sendMsg(ws,{
                    method: "joinGame",
                    result: "success",
                    participantsCount: participants.length,
                });
                if(participants.length === GAME_LIMIT){
                    broadcastMsg(getParticipantsWs(),{
                        method: "startGame",
                        result: "success",
                        participants: getParticipantsP(),
                    });
                }
            }else{
                console.error("Error bad method from message", message);
                sendMsg(ws,{
                    method: "joinGame",
                    result: "error",
                    errorMsg: "Bad method",
                });
            }
        }catch(e){
            console.error("Error with decoding message: ", message);
            sendMsg(ws,{
                method: "joinGame",
                result: "error",
                errorMsg: "Cannot decode message",
            });
        }
        // const broadcastRegex = /^broadcast\:/;

        // if (broadcastRegex.test(message)) {
        //     message = message.toString().replace(broadcastRegex, '');

        //     //send back the message to the other clients
        //     wsServer.clients
        //         .forEach(client => {
        //             if (client != ws) {
        //                 client.send(`Hello, broadcast message -> ${message}`);
        //             }    
        //         });
            
        // } else {
        //     ws.send(`Hello, you sent -> ${message}`);
        // }
    });

    ws.on('close', () => {
        console.log(`User ${id} disconnected`);
        participants = participants.filter(([pws,p])=>pws!==ws);
    });

    //send immediatly a feedback to the incoming connection    
    ws.send('Hi there, I am a WebSocket server');
});

//start our server
server.listen(process.env.PORT || 8999, () => {
    // @ts-ignore
    console.log(`Server started on port ${server.address().port} :)`);
});