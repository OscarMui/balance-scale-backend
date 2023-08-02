import * as WebSocket from 'ws';
import {Dead, GameEvent, GameInfo, GameStart, Participant, ParticipantGuess, ParticipantInfo, Req} from '../common/interfaces';
import { DEAD_LIMIT, NETWORK_DELAY_MS, PARTICIPANTS_PER_GAME, ROUND_TIME_MS, SHORTENED_TIME_MS } from '../common/constants';
import { broadcastMsg, recvMsg, sendMsg } from '../common/messaging';
import assert from '../common/assert';
import { EventEmitter } from 'node:events';

class Game {
    private participants : Participant[] = [];
    private inProgress: boolean = false;
    private gameEvents : GameEvent[] = [];
    //TODO: put justDiedParticipants back to local variable of game body loop
    private justDiedParticipants : Dead[] = [];

    constructor(){}
    
    getParticipantsCount = () => this.participants.length;

    addParticipantByInfo = ({socket,id,nickname}:{socket: WebSocket, id: string, nickname: string}) : void => {
        this.participants.push({
            id: id,
            nickname: nickname,
            socket: socket,
            score: 0,
            isDead: false,
        });

        socket.addEventListener('close', this.onClose);
        socket.addEventListener('error', this.onError);

        if(this.getParticipantsCount()==PARTICIPANTS_PER_GAME){
            this.inProgress = true;
            this.gameBody();
        }
    }

    isInProgress = () => this.inProgress;

    isEnded = () => this.inProgress && this.getAliveCount() <= 1;

    private getParticipantsSocket = (filterFn? : (p: Participant) => boolean) => {
        if(filterFn) return  this.participants.filter(filterFn).filter((p)=>p.socket && p.socket.readyState===WebSocket.OPEN).map((p)=>p.socket)
        else return this.participants.filter((p)=>p.socket && p.socket.readyState===WebSocket.OPEN).map((p)=>p.socket)
    }

    private getParticipantsInfo = () => {
        return this.participants.map((p)=>{return {
            id: p.id, 
            nickname: p.nickname, 
            score: p.score, 
            isDead: p.isDead,
        } as ParticipantInfo})
    }

    private getAliveCount = () => this.participants.filter((p)=>!p.isDead).length

    private addBroadcastGameEvent = (ge: GameEvent) => {
        const sockets = this.getParticipantsSocket();
        this.gameEvents.push(ge);
        broadcastMsg(sockets,ge);
    }

    // private addAllListeners = () => {
    //     this.getParticipantsSocket().forEach((ws)=>{
    //         ws.addListener('close', this.onClose);
    //         ws.addListener('error', this.onError);
    //     })
    // }

    // private removeAllListeners = () => {
    //     this.getParticipantsSocket().forEach((ws)=>{
    //         ws.removeListener('close', this.onClose);
    //         ws.removeListener('error', this.onError);
    //     })
    // }

    //
    private handleGuesses = (ws: WebSocket, pid: string, aliveCount: number) : Promise<Object> => {
        return new Promise((resolve, reject) => {
            let myGuess : {id: string, guess: number} | undefined = undefined;
            let numDecided = 0; //number of players who guessed a number/ disconnected, if this number == aliveCount we will shorten the time 

            let hasShortenedTimeout = false;

            //a blank target just for obtaining the custom events
            const emitter = new EventEmitter();
            
            const rejectWrapper = () => {
                //remove ALL established listeners 
                ws.removeEventListener('message', onMessage);
                ws.removeEventListener('close', onClose);
                ws.removeEventListener('error', onError);
                emitter.removeListener('custom:firstGuess',onFirstGuess);
                emitter.removeListener('custom:participantDisconnected',onParticipantDisconnected);

                //need to execute that close code, as due to concurrency issues, that close code will not execute until the next game loop
                this.handleClose(ws); 
                if(ws.readyState !== WebSocket.CLOSED)
                    ws.close();
                reject();
            }

            const onMessage = (event: WebSocket.MessageEvent) => {
                console.log("received: ",event.data.toString());
                
                try{
                    const r = JSON.parse(event.data.toString()) as Req;
                    assert(r.method==="submitGuess") //check method name
                    assert(r.id===pid) //check id
                    const guess = Number(r.guess) //check if the number is within range and is an integer 
                    assert(Number.isInteger(guess)&&guess>=0&&guess<=100)
                    
                    if(!myGuess){
                        console.log("dispatching event custom:firstGuess")
                        emitter.emit("custom:firstGuess",pid,Date.now())
                    }
                    
                    myGuess = {
                        id: r.id,
                        guess: r.guess,
                    }
                }catch(e){
                    console.log("Error with submitGuess event",e)
                    rejectWrapper()
                }
                
                sendMsg(ws,{
                    result: "success",
                });
            }
            
            const onClose = (event: WebSocket.CloseEvent) => {
                console.log("onClose fired in handleGuesses")
                rejectWrapper()
            }
        
            const onError = (event : WebSocket.ErrorEvent) => {
                console.log("onError fired in handleGuesses")
                rejectWrapper()
            }

            const onParticipantDisconnected = (event : any) => {
                console.log("onParticipantDisconnected")
                console.log(event)
                if(hasShortenedTimeout){
                    shortenTimeout();
                }else{
                    numDecided += 1;
                    if(numDecided === aliveCount){
                        shortenTimeout();
                    }
                }
            }
            
            const onFirstGuess = (event : any) => {
                console.log("onFirstGuess")
                console.log(event)
                numDecided += 1;
                if(numDecided === aliveCount){
                    shortenTimeout();
                }
            }

            ws.addEventListener('close', onClose);
            ws.addEventListener('message', onMessage);
            ws.addEventListener('error', onError);
            emitter.addListener('custom:firstGuess',onFirstGuess);
            emitter.addListener('custom:participantDisconnected',onParticipantDisconnected);

            let currentTimeout = setTimeout(()=>{
                if(myGuess && numDecided == aliveCount){
                    //if everyone made a decision and we guessed a number
                    ws.removeEventListener('message', onMessage);
                    ws.removeEventListener('close', onClose);
                    ws.removeEventListener('error', onError);
                    emitter.removeListener('custom:firstGuess',onFirstGuess);
                    emitter.removeListener('custom:participantDisconnected',onParticipantDisconnected);
                    resolve(myGuess);
                }else if(myGuess){
                    shortenTimeout();
                }else{
                    rejectWrapper();
                }
            },ROUND_TIME_MS + NETWORK_DELAY_MS);

            const shortenTimeout = () => {
                hasShortenedTimeout = true;
                clearTimeout(currentTimeout);
                currentTimeout = setTimeout(()=>{
                    ws.removeEventListener('message', onMessage);
                    ws.removeEventListener('close', onClose);
                    ws.removeEventListener('error', onError);
                    emitter.removeListener('custom:firstGuess',onFirstGuess);
                    emitter.removeListener('custom:participantDisconnected',onParticipantDisconnected);
                    //@ts-ignore - PRE-CONDITION: on call to shortenTimeout, myGuess should be not undefined
                    resolve(myGuess);
                }, SHORTENED_TIME_MS + NETWORK_DELAY_MS)
            }
        });
    }

    private gameBody = async () => {
        let round = 0;
        this.addBroadcastGameEvent({
            event: "gameStart",
            participants: this.getParticipantsInfo(),
            round: round,
            gameEnded: this.isEnded(),
            aliveCount: this.getAliveCount(),
        } as GameStart);
        while(!this.isEnded()){
            this.justDiedParticipants = [];
            let justAppliedRules = new Set<number>()

            //TODO: Notify people when a player disconnected during the turn
            //TODO: Allow players to modify their choice during the turn
            //TODO: Three-minute timeout
            // get one message from every participant that is alive
            const requests = await Promise.allSettled(
                this.participants                    
                    .filter((p)=>p.socket && p.socket.readyState===WebSocket.OPEN)
                    .filter((p)=>!p.isDead)
                    .map((p)=>this.handleGuesses(p.socket,p.id,this.getAliveCount()))
            )

            console.log("all requests received",requests);

            let reqs : {id: string, guess: number}[] = []
            for(let i=0;i<requests.length;i++){
                const request = requests[i] as any;
                if(request.status==="fulfilled"){
                    reqs.push(request.value)
                }
            }

            assert(reqs.length===this.getAliveCount())

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
            this.participants.filter((p)=>!p.isDead).forEach((p)=>{
                //if alive and not win: -1 score
                if(!winners.includes(p.id)){
                    // * 3 players remaining: If a player chooses the exact correct number, they win the round and all other players lose two points.
                    if(reqs.length<=3 && winnersDiff && winnersDiff <= 0.5){
                        p.score -= 2;
                        justAppliedRules.add(3);
                    }else{
                        p.score -= 1;
                    }
                }

                // dead if DEAD_LIMIT score or worse
                if(p.score <= DEAD_LIMIT){
                    p.score = DEAD_LIMIT; //display -10 instead of -11 or sth
                    p.isDead = true;
                    this.justDiedParticipants.push({
                        id: p.id,
                        reason: "deadLimit",
                    })
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

            this.addBroadcastGameEvent({
                event: "gameInfo",
                participants: participantGuesses,
                round: round,
                gameEnded: this.participants.filter((p)=>!p.isDead).length === 1,
                aliveCount: this.getAliveCount(),
                target: target,
                winners: winners,
                justDiedParticipants: this.justDiedParticipants,
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
        const participantList = this.participants.filter((p)=>p.socket === ws);
        // console.log(participantList);
        if(participantList.length > 0){
            if(this.isInProgress()){
                console.log("handleClose: participant found and game in progress, modifying its parameters")
                const participant = participantList[0];
                if(!participant.isDead){
                    participant.isDead = true;
                    //TODO: put justDiedParticipants back to local variable of game body loop
                    this.justDiedParticipants.push({
                        id: participant.id,
                        reason: "disconnected",
                    });
                }
                
            }else{
                console.log("handleClose: participant found and game hasn't started, just remove it")
                this.participants = this.participants.filter((p)=>p.socket !== ws);
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