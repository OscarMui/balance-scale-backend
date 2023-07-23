import * as express from 'express';
import * as http from 'http';
import * as WebSocket from 'ws';
import { v4 as uuidv4 } from 'uuid';
import {Participant, Req} from './interface';

// Important constants
const GAME_LIMIT = 2;
const DEAD_LIMIT = -10;

const app = express();

//initialize a simple http server
const server = http.createServer(app);

//initialize the WebSocket server instance
const wsServer = new WebSocket.Server({ 
    server,
    path: "/game",
});

// Important variables
let participants : Participant[] = [];

const getParticipantsSocket = () => {
    return participants.map((p)=>p.socket)
}

const getParticipantsInfo = () => {
    return participants.map((p)=>{return {
        id: p.id, 
        nickname: p.nickname, 
        guesses: p.guesses, 
        score: p.score, 
        isDead: p.isDead
    }})
}

//send a message to a websocket, id is optional and is for debugging only
const sendMsg = (ws: WebSocket, msg : Object, id? : string) => {
    if(id) console.log(`sent to ${id}:`,msg);
    else console.log("sent: ",msg);
    
    ws.send(JSON.stringify(msg))
}

//send a message to multiple websockets
const broadcastMsg = (wss: WebSocket[], msg : Object) => {
    console.log("sent: ",msg);
    wss.forEach((ws)=>{
        ws.send(JSON.stringify(msg))
    })
}

function recvMsg(ws: WebSocket): Promise<Object> {
    return new Promise((resolve, reject) => {
        function onMessage(res: WebSocket.MessageEvent) {
            ws.removeEventListener('message', onMessage);
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

//whole game process
const game = async () => {
    let round = 0;
    let gameEnd = false;

    while(!gameEnd){
        broadcastMsg(getParticipantsSocket(),{
            event: "roundStart",
            participants: getParticipantsInfo(),
            round: round,
        });
        const ress = await Promise.all(getParticipantsSocket().map((ws)=>recvMsg(ws)))
        console.log("all res received",ress);
        // ress.forEach((res)=>{
        //     const p = participants.filter((p)=>p.socket === ws)
        // })
        

        round += 1;
    }
}

wsServer.on('connection', (ws: WebSocket) => {
    // internal ID used for logging purposes only
    const id = uuidv4();

    console.log(`User ${id} connected, ${wsServer.clients.size} total connections`);

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

    ws.on('message', (message: string) => {
        //log the received message and send it back to the client
        

        try{
            const req : Req = JSON.parse(message);
            console.log(`received from ${id}:`, req);
            if(req.method === "joinGame"){
                //if too much players are playing give error and just do nothing
                if(participants.length >= GAME_LIMIT){
                    console.log('Maximum number of participants reached');
                    sendMsg(ws,{
                        result: "error",
                        errorMsg: "Maximum number of participants reached",
                    },id);
                    return;
                }
                participants.push({
                    id: id,
                    nickname: req.nickname,
                    socket: ws,
                    guesses: [],
                    score: 0,
                    isDead: false,
                });
                sendMsg(ws,{
                    result: "success",
                    participantsCount: participants.length,
                    id: id,
                },id);
                if(participants.length === GAME_LIMIT){
                    game();
                }
            }else{
                //maybe received by the game method
                // sendMsg(ws,{
                //     result: "error",
                //     errorMsg: "Bad method",
                // });
            }
        }catch(e){
            sendMsg(ws,{
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
        participants = participants.filter((p)=>p.socket!==ws);
    });

    //TODO: send immediatly a feedback to the incoming connection    
    // ws.send('Hi there, I am a WebSocket server');
});

//start our server
server.listen(process.env.PORT || 8999, () => {
    // @ts-ignore
    console.log(`Server started on port ${server.address().port} :)`);
});