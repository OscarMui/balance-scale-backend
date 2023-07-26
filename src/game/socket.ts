import * as WebSocket from 'ws';
import { v4 as uuidv4 } from 'uuid';
import {Participant, Req} from '../common/interface';
import {sendMsg} from "../common/messaging";
import assert from "../common/assert";
import Game from './game';
import { PARTICIPANTS_PER_GAME } from '../common/constants';

class Socket {
    private readonly wsServer : WebSocket.Server;
    private game : Game = new Game();

    constructor(wsServer : WebSocket.Server){
        this.wsServer = wsServer;
        
        wsServer.on('connection', (ws: WebSocket) => {
            // internal ID used for logging purposes only
            const id = uuidv4();
    
            console.log(`User ${id} connected, ${wsServer.clients.size} total connections`);
            
            //establish ping pong
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

            //send a successful connect message, with the participant id
            sendMsg(ws,{
                result: "success",
                id: id,
            },id);

    
            ws.on('message', (message: string) => {
                //TODO: only the joinGame request is handled here, might move it somewhere that makes more sense later
                try{
                    const req : Req = JSON.parse(message);
                    console.log(`received from ${id}:`, req);
                    if(req.method === "joinGame"){
                        //TODO: allow multiple games and multiple waiting rooms
                        if(this.game.isInProgress()){
                            console.log('Game in progress, please try again later');
                            sendMsg(ws,{
                                result: "error",
                                errorMsg: "Game in progress, please try again later",
                            },id);
                            return;
                        }
                        //if too much players are playing give error and just do nothing
                        if(this.game.getParticipantsCount() >= PARTICIPANTS_PER_GAME){
                            console.log('Maximum number of participants reached');
                            sendMsg(ws,{
                                result: "error",
                                errorMsg: "Maximum number of participants reached",
                            },id);
                            return;
                        }
                        sendMsg(ws,{
                            result: "success",
                            participantsCount: this.game.getParticipantsCount(),
                        },id);
                        this.game.addParticipantByInfo({
                            id: id,
                            nickname: req.nickname,
                            socket: ws,
                        })
                    }else{
                        //other methods are handled at other places of the code right now
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
                //TODO
                // participants = participants.filter((p)=>p.socket!==ws);
            });
        });
    }
    
}

export default Socket;