import * as WebSocket from 'ws';
import { v4 as uuidv4 } from 'uuid';
import {Participant, Req} from '../common/interfaces';
import {broadcastMsg, recvMsg, sendMsg} from "../common/messaging";
import assert from "../common/assert";
import Game from './game';
import { NETWORK_DELAY_MS, PARTICIPANTS_PER_GAME } from '../common/constants';

class Socket {
    private readonly wsServer : WebSocket.Server;
    private games : Game[] = [new Game()]

    constructor(wsServer : WebSocket.Server){
        this.wsServer = wsServer;
        
        wsServer.on('connection', async (ws: WebSocket) => {
            // internal ID used for logging purposes only
            const id = uuidv4();
    
            console.log(`User ${id} connected, ${wsServer.clients.size} total connections`);
            
            //establish ping pong
            // Send a pong, then initialise a timeout of 10 seconds.
            let pingTimeout : NodeJS.Timeout;
            const waitPing = () => {
                ws.pong();
                //update: disable this check to tolerate bad network
                //a timeout s.t. if client does not respond in 10 seconds, we terminate the connection
                // pingTimeout = setTimeout(() => {
                //     console.log(`No ping received, terminating connection with ${id}...`);
                //     ws.terminate();
                // }, 5000 + NETWORK_DELAY_MS);
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

            //receive one message from the client, expect it to be joinGame
            try{
                const req = (await recvMsg(ws)) as Req;
                assert(req.method=="joinGame");
                
                this.games = this.games.filter((game)=>!game.isEnded())

                if(this.games.length == 0 || this.games[0].isInProgress()){
                    //start a new game
                    this.games = [new Game(), ...this.games];
                }
                if(this.games[0].isInProgress()){
                    console.log('Game in progress, please try again later');
                    sendMsg(ws,{
                        result: "error",
                        errorMsg: "Game in progress, please try again later",
                    },id);
                    return;
                }
                //if too much players are playing give error and just do nothing
                if(this.games[0].getParticipantsCount() >= PARTICIPANTS_PER_GAME){
                    console.log('Maximum number of participants reached');
                    sendMsg(ws,{
                        result: "error",
                        errorMsg: "Maximum number of participants reached",
                    },id);
                    return;
                }
                sendMsg(ws,{
                    result: "success",
                    participantsCount: this.games[0].getParticipantsCount()+1,
                    participantsPerGame: PARTICIPANTS_PER_GAME,
                },id);

                //note that the new joiner would not get this message
                broadcastMsg(this.games[0].getParticipantsSocket(), {
                    event: "updateParticipantsCount",
                    participantsCount: this.games[0].getParticipantsCount()+1,
                    participantsPerGame: PARTICIPANTS_PER_GAME,
                })

                this.games[0].addParticipantByInfo({
                    id: id,
                    nickname: req.nickname || "Player",
                    socket: ws,
                })
            }catch(e){
                console.log("Error with joinGame request, connection terminated with client.")
                ws.close();
            }
            
            // very good for debugging
            // ws.on('message', (message: string) => {
            //     const req = JSON.parse(message);
            //     console.debug("WILD",req)
            // });
    
            // ws.on('close', () => {
            //     console.log(`User ${id} disconnected`);
            // });
        });
    }
    
}

export default Socket;