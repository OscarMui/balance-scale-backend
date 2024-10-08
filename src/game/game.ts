import WebSocket from 'ws';
import { v4 as uuidv4 } from 'uuid';

import {Dead, Disconnected, GameEvent, GameInfo, GameStart, Participant, ParticipantGuess, ParticipantInfo, Reconnected } from '../common/interfaces';
import { DEAD_LIMIT, DIGEST_TIME_MS, PARTICIPANTS_PER_GAME, ParticipantStatus, POPULATE_BOTS_TIME_MS, ROUND_INFO_DIGEST_TIME_MS, ROUND_LIMIT, ROUND_TIME_MS, ROUND_ZERO_DIGEST_TIME_MS } from '../common/constants';
import { broadcastMsg, sendMsg } from '../common/messaging';
import assert from '../common/assert';
import { EventEmitter } from 'node:events';
import Bot from './bot';
import Player from './player';
import { createStatistic } from '../common/firestore';

class Game {
    private participants : Participant[] = [];
    private inProgress: boolean = false; //flag that is forever set to true once the game has enough participants
    private gameEvents : GameEvent[] = [];
    private populateTimeout : NodeJS.Timeout | null = null
    private readonly id = uuidv4();
    private round : number = 1;
    private roundStartTime : number = 0;
    private justReconnectedParticipants: Reconnected[] = [];

    constructor(){}
    
    getId = () => this.id;

    getParticipantsCount = () => this.participants.length;

    addPlayer(p: Player){
        broadcastMsg(this.getParticipantsSocket(), {
            event: "updateParticipantsCount",
            participantsCount: this.getParticipantsCount()+1,
            participantsPerGame: PARTICIPANTS_PER_GAME,
        })

        this.participants.push(p)
        
        const socket = p.getSocket()

        socket.addEventListener('close', this.onClose);
        socket.addEventListener('error', this.onError);
        
        if(this.populateTimeout) clearTimeout(this.populateTimeout)

        if(this.getParticipantsCount()==PARTICIPANTS_PER_GAME){
            this.inProgress = true;
            this.gameBody();
        }else{
            this.populateTimeout = this.populateWithBots()
        }
    }

    isInProgress = () => this.inProgress;

    isEnded = () => this.inProgress && (this.getActiveCount() <= 1 || this.getHumanActiveCount() == 0);

    // requirements: disconnected but not dead, and at least 3 points away from dying
    getCanReconnectParticipants = () => this.participants.filter((p)=>p.getInfo().status===ParticipantStatus.Disconnected && p.getInfo().score > DEAD_LIMIT+2);

    reconnectParticipantByPid = (pid: string, rKey: string, ws: WebSocket) => {
        const ps = this.participants.filter((p) => p.getInfo().id===pid && p.getRKey() == rKey);
        if(ps.length == 0) return false;
        const p = ps[0];
        p.setSocket(ws);
        this.justReconnectedParticipants.push({
            id: pid,
            reason: "reconnected",
        });
        return true;
    }
    
    private populateWithBots(){
        return setTimeout(() => {
            console.log("populateWithBots timeout fired")
            //only populate when there are players, and only when there are vacancies
            if(this.getParticipantsCount()==0 || this.getParticipantsCount() == PARTICIPANTS_PER_GAME){
                return
            }
            let seed = Math.floor(Math.random()*10000)
            while(this.getParticipantsCount()<PARTICIPANTS_PER_GAME){
                this.participants.push(new Bot(seed))
                seed += 1
            }
            this.inProgress = true;
            this.gameBody();
        },POPULATE_BOTS_TIME_MS)
    }

    private getParticipantsSocket = (filterFn? : (p: Participant) => boolean) : WebSocket[] => {
        const ps = filterFn ? this.participants.filter(filterFn) : this.participants
        const wss = ps.map((p)=>p.getSocket()).filter((ws)=>ws!=null) as WebSocket[]
        return wss.filter((ws)=>ws.readyState===WebSocket.OPEN)
    }

    private getParticipantsInfo = () => {
        return this.participants.map((p)=>p.getInfo() as ParticipantInfo)
    }

    private getActiveCount = () => this.participants.filter((p)=>p.getInfo().status === ParticipantStatus.Active).length

    private getHumanActiveCount = () => this.participants.filter((p)=>p.getInfo().status === ParticipantStatus.Active && !p.getInfo().isBot).length

    private addBroadcastGameEvent = (ge: GameEvent) => {
        const sockets = this.getParticipantsSocket();
        this.gameEvents.push(ge);
        broadcastMsg(sockets,ge);
    }

    private gameBody = async () => {
        this.round = 1;
        this.roundStartTime = Date.now() + ROUND_ZERO_DIGEST_TIME_MS; //shorter digest time for round 0
        this.addBroadcastGameEvent({
            event: "gameStart",
            participants: this.getParticipantsInfo(),
            round: this.round,
            gameEnded: this.isEnded(),
            activeCount: this.getActiveCount(),
            roundStartTime: this.roundStartTime - Date.now(),
            roundEndTime: this.roundStartTime + ROUND_TIME_MS - Date.now(),
        } as GameStart);
        // repeat until game ends or when round number exceeds the limit to prevent infinite loops
        while(!this.isEnded() && this.round < ROUND_LIMIT){
            let justDiedParticipants : Dead[] = [];
            let justAppliedRules = new Set<number>()
            let justDisconnectedParticipants : Disconnected[] = [];
            this.justReconnectedParticipants = [];

            //a blank target just for obtaining the custom events
            const emitter = new EventEmitter();

            // get one message from every participant that is alive

            const activeParticipants = this.participants.filter((p)=>p.getInfo().status === ParticipantStatus.Active);

            const requests = await Promise.allSettled(
                activeParticipants
                    .map((p)=>p.makeGuess(
                        emitter,
                        this.roundStartTime,
                        this.handleClose,
                        this.addBroadcastGameEvent,
                        activeParticipants.length
                    ))
            )

            console.log("all requests received",requests);

            let reqs : {id: string, guess: number}[] = []
            for(let i=0;i<requests.length;i++){
                const request = requests[i] as any;
                if(request.status==="fulfilled"){
                    const value = request.value as {id: string, guess: number, stillAlive: boolean}
                    if(!value.stillAlive){
                        justDisconnectedParticipants.push({
                            id: value.id,
                            reason: "disconnected",
                        })
                    }
                    reqs.push(value)
                }else{
                    const reason = request.reason as {id: string}
                    justDisconnectedParticipants.push({
                        id: reason.id,
                        reason: "disconnectedMidgame"
                    })
                }
            }

            const target = reqs.map((req)=>req.guess).reduce((xs,x)=>x+xs,0) / reqs.length * 0.8;

            //helper function
            const calDiff = (x: number) => Math.abs(x - target)

            let winners : string[] = [];
            let winnersDiff : number | null = null; 

            if(reqs.length==0){
                console.log("no one is in the game, game ended");
                return;
            }else if(reqs.length==1){
                console.log("one person is in the game, that person wins");
                winners = [reqs[0].id]
                winnersDiff = null;
            }else if(reqs.length==2 && reqs[0].guess === 0 && reqs[1].guess === 100){
                // * 2 players remaining: If someone chooses 0, a player who chooses 100 automatically wins the round.
                winners = [reqs[1].id]
                winnersDiff = null;
                justAppliedRules.add(2);
            }else if(reqs.length==2 && reqs[1].guess === 0 && reqs[0].guess === 100){
                winners = [reqs[0].id]
                winnersDiff = null;
                justAppliedRules.add(2);
            }else{
                for(let i=0;i<reqs.length;i++){
                    const req = reqs[i];

                    //* 4 players remaining: If two or more players choose the same number, the number is invalid and all players who selected the number will lose a point.
                    if(reqs.length<=4){
                        //check for duplicates
                        if(reqs.map((r)=>r.guess).filter((x)=>x===req.guess).length > 1){
                            justAppliedRules.add(4);
                            continue; //skip the updating process because they will never win
                        }
                    }

                    //update the winners array
                    const diff = calDiff(req.guess);
                    if(winnersDiff == null || diff < winnersDiff){
                        winners = [req.id];
                        winnersDiff = diff;
                    }else if(diff === winnersDiff) winners.push(req.id);
                }
            }

            //modify score and isDead
            reqs.forEach((req)=>{
                //get corresponding participant
                const p = this.participants.filter((pp) => pp.getInfo().id===req.id)[0];

                //if alive and not win: -1 score
                if(!winners.includes(p.getInfo().id)){
                    // * 3 players remaining: If a player chooses the exact correct number, they win the round and all other players lose two points.
                    // * Special treatment: This rule will not be activated if a player chooses 0 and the other chooses 1
                    if(!(reqs.length == 2 && req.guess==1)&&(reqs.length<=3 && winnersDiff && winnersDiff <= 0.5)){
                        if(p.changeScore(-2)){
                            justDiedParticipants.push({
                                id: p.getInfo().id,
                                reason: "deadLimit",
                            })
                        }
                        justAppliedRules.add(3);
                    }else{
                        if(p.changeScore(-1)){
                            justDiedParticipants.push({
                                id: p.getInfo().id,
                                reason: "deadLimit",
                            })
                        }
                    }
                }
            })
            
            //cannot just search for disconnected players, as their status can become reconnected again
            this.participants.filter((p)=>p.getInfo().status !== ParticipantStatus.Dead && !reqs.map(req=>req.id).includes(p.getInfo().id)).forEach((p)=>{
                if(p.changeScore(-2)){
                    justDiedParticipants.push({
                        id: p.getInfo().id,
                        reason: "deadLimit",
                    })
                }
            });

            //create new obj that includes the guesses
            let participantGuesses : ParticipantGuess[] = this.getParticipantsInfo().map((p)=>{
                const filteredReq = reqs.filter((req)=>p.id === req.id);
                assert(filteredReq.length <= 1);
                return {
                    guess: filteredReq.length > 0 ? filteredReq[0].guess : null,
                    ...p
                }
            });

            this.round += 1;
            if(justDiedParticipants.length > 0){
                // even more time to digest
                this.roundStartTime = Date.now() + ROUND_INFO_DIGEST_TIME_MS + DIGEST_TIME_MS;
            }else{
                this.roundStartTime = Date.now() + ROUND_INFO_DIGEST_TIME_MS;
            }

            // firestore
            createStatistic({
                createdAt: new Date(),
                target: target,
                numBots: this.getActiveCount()-this.getHumanActiveCount(),
                numPlayers: this.getHumanActiveCount(),
                round: this.round,
            })

            this.addBroadcastGameEvent({
                event: "gameInfo",
                participants: participantGuesses,
                round: this.round,
                roundStartTime: this.roundStartTime - Date.now(),
                roundEndTime: this.roundStartTime + ROUND_TIME_MS - Date.now(),
                gameEnded: this.isEnded(),
                activeCount: this.getActiveCount(),
                target: target,
                winners: winners,
                justDiedParticipants: justDiedParticipants,
                justAppliedRules: [...justAppliedRules],
                justDisconnectedParticipants: justDisconnectedParticipants,
                justReconnectedParticipants: this.justReconnectedParticipants,
            } as GameInfo);
        }
        console.log("game ended");
    }

    //disconnection handling
    //manualFire is for logging purposes only, to distinguish between manually calling onClose and the event listener
    private onClose = (event: WebSocket.CloseEvent) => {
        console.log("onClose fired in game.ts")
        const ws = event.target;
        this.handleClose(ws)
    }

    private handleClose = (ws: WebSocket) => {
        console.log("handleClose called in game.ts")

        const participantList = this.participants.filter((p)=>p.getSocket() === ws);

        if(participantList.length > 0){
            if(this.isInProgress()){
                const participant = participantList[0];
                console.log("handleClose: participant left, remove it from the reconnected array if it is there")
                this.justReconnectedParticipants = this.justReconnectedParticipants.filter((j)=>j.id != participant.getInfo().id);
            }else{
                console.log("handleClose: participant found and game hasn't started, just remove it")
                this.participants = this.participants.filter((p)=>p.getSocket() !== ws);

                //tell everyone
                broadcastMsg(this.getParticipantsSocket(), {
                    event: "updateParticipantsCount",
                    participantsCount: this.getParticipantsCount(),
                    participantsPerGame: PARTICIPANTS_PER_GAME,
                })
            }
        }else{
            console.error("handleClose: participant not found")
        }
    }

    private onError = (event: WebSocket.ErrorEvent) => {
        console.error("onError fired in game.ts")
        //instead of throwing an error, close connection 
        if(event.target.readyState !== WebSocket.CLOSED)
            event.target.close();
    }

    
}

export default Game;