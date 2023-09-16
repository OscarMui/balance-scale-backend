import * as WebSocket from 'ws';
import {Dead, GameEvent, GameInfo, GameStart, Participant, ParticipantGuess, ParticipantInfo } from '../common/interfaces';
import { DIGEST_TIME_MS, PARTICIPANTS_PER_GAME, POPULATE_BOTS_TIME_MS, ROUND_INFO_DIGEST_TIME_MS, ROUND_TIME_MS, ROUND_ZERO_DIGEST_TIME_MS } from '../common/constants';
import { broadcastMsg } from '../common/messaging';
import assert from '../common/assert';
import { EventEmitter } from 'node:events';
import Bot from './bot';
import Player from './player';

class Game {
    private participants : Participant[] = [];
    private inProgress: boolean = false;
    private gameEvents : GameEvent[] = [];
    private populateTimeout : NodeJS.Timeout | null = null

    constructor(){}
    
    getParticipantsCount = () => this.participants.length;

    addPlayer(p: Player){
        this.participants.push(p)
        
        const socket = p.getSocket()

        socket.addEventListener('close', this.onClose);
        socket.addEventListener('error', this.onError);

        if(this.getParticipantsCount()==PARTICIPANTS_PER_GAME){
            this.inProgress = true;
            this.gameBody();
        }
        if(this.populateTimeout) clearTimeout(this.populateTimeout)
        this.populateTimeout = this.populateWithBots()
    }

    isInProgress = () => this.inProgress;

    isEnded = () => this.inProgress && this.getAliveCount() <= 1 && this.getOnlineAliveCount();

    private populateWithBots(){
        return setTimeout(() => {
            console.log("populateWithBots timeout fired")
            //only populate when there are players
            if(this.getParticipantsCount()==0){
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

    private getAliveCount = () => this.participants.filter((p)=>!p.getInfo().isDead).length

    private getOnlineAliveCount = () => this.participants.filter((p)=>!p.getInfo().isDead && !p.getInfo().isBot).length

    private addBroadcastGameEvent = (ge: GameEvent) => {
        const sockets = this.getParticipantsSocket();
        this.gameEvents.push(ge);
        broadcastMsg(sockets,ge);
    }

    private gameBody = async () => {
        let round = 1;
        let roundStartTime = Date.now() + ROUND_ZERO_DIGEST_TIME_MS; //shorter digest time for round 0
        this.addBroadcastGameEvent({
            event: "gameStart",
            participants: this.getParticipantsInfo(),
            round: round,
            gameEnded: this.isEnded(),
            aliveCount: this.getAliveCount(),
            roundStartTime: roundStartTime - Date.now(),
            roundEndTime: roundStartTime + ROUND_TIME_MS - Date.now(),
        } as GameStart);
        while(!this.isEnded()){
            let justDiedParticipants : Dead[] = [];
            let justAppliedRules = new Set<number>()

            //a blank target just for obtaining the custom events
            const emitter = new EventEmitter();

            // get one message from every participant that is alive
            const requests = await Promise.allSettled(
                this.participants
                    //@ts-ignore       
                    .filter((p)=>p.getSocket()==null || p.getSocket().readyState===WebSocket.OPEN)
                    .filter((p)=>!p.getInfo().isDead)
                    .map((p)=>p.makeGuess(
                        emitter,
                        roundStartTime,
                        this.handleClose,
                        this.addBroadcastGameEvent,
                        this.getAliveCount,
                    ))
            )

            console.log("all requests received",requests);

            let reqs : {id: string, guess: number}[] = []
            for(let i=0;i<requests.length;i++){
                const request = requests[i] as any;
                if(request.status==="fulfilled"){
                    const value = request.value as {id: string, guess: number, stillAlive: boolean}
                    if(!value.stillAlive){
                        justDiedParticipants.push({
                            id: value.id,
                            reason: "disconnected",
                        })
                    }
                    reqs.push(value)
                }else{
                    const reason = request.reason as {id: string}
                    justDiedParticipants.push({
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
                    if(!winnersDiff || diff < winnersDiff){
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
                    if(reqs.length<=3 && winnersDiff && winnersDiff <= 0.5){
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

            //create new obj that includes the guesses
            let participantGuesses : ParticipantGuess[] = this.getParticipantsInfo().map((p)=>{
                const filteredReq = reqs.filter((req)=>p.id === req.id);
                assert(filteredReq.length <= 1);
                return {
                    guess: filteredReq.length > 0 ? filteredReq[0].guess : null,
                    ...p
                }
            });

            round += 1;
            if(justDiedParticipants.filter((d)=>d.reason!="disconnectedMidgame").length > 0){
                // even more time to digest
                roundStartTime = Date.now() + ROUND_INFO_DIGEST_TIME_MS + DIGEST_TIME_MS;
            }else{
                roundStartTime = Date.now() + ROUND_INFO_DIGEST_TIME_MS;
            }
            

            this.addBroadcastGameEvent({
                event: "gameInfo",
                participants: participantGuesses,
                round: round,
                roundStartTime: roundStartTime - Date.now(),
                roundEndTime: roundStartTime + ROUND_TIME_MS - Date.now(),
                gameEnded: this.isEnded(),
                aliveCount: this.getAliveCount(),
                target: target,
                winners: winners,
                justDiedParticipants: justDiedParticipants,
                justAppliedRules: [...justAppliedRules],
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

        //instead of throwing an error, just treat the client as game over
        const participantList = this.participants.filter((p)=>p.getSocket() === ws);
        // console.log(participantList);
        if(participantList.length > 0){
            if(this.isInProgress()){
                const participant = participantList[0];
                if(!participant.getInfo().isDead){
                    console.log("handleClose: participant found and game in progress, modifying its parameters")
                    participant.getInfo().isDead = true;
                }else{
                    console.log("handleClose: participant found and game in progress, its parameters were modified by a previous call already")
                }
                
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
            console.log("handleClose: participant not found")
        }
    }

    private onError = (event: WebSocket.ErrorEvent) => {
        console.log("onError fired in game.ts")
        //instead of throwing an error, close connection 
        if(event.target.readyState !== WebSocket.CLOSED)
            event.target.close();
    }

    
}

export default Game;