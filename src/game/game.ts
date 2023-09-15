import * as WebSocket from 'ws';
import {Dead, GameEvent, GameInfo, GameStart, Participant, ParticipantDisconnectedMidgame, ParticipantGuess, ParticipantInfo, Req, ChangeCountdown} from '../common/interfaces';
import { DEAD_LIMIT, DIGEST_TIME_MS, NETWORK_DELAY_MS, PARTICIPANTS_PER_GAME, ROUND_INFO_DIGEST_TIME_MS, ROUND_TIME_MS, ROUND_ZERO_DIGEST_TIME_MS, SHORTENED_TIME_MS } from '../common/constants';
import { broadcastMsg, recvMsg, sendMsg } from '../common/messaging';
import assert from '../common/assert';
import { EventEmitter } from 'node:events';
import sleep from '../common/sleep';

class Game {
    private participants : Participant[] = [];
    private inProgress: boolean = false;
    private gameEvents : GameEvent[] = [];

    constructor(){}
    
    getParticipantsCount = () => this.participants.length;

    addParticipantByInfo = ({socket,id,nickname}:{socket: WebSocket, id: string, nickname: string}) : void => {
        //note that the new joiner would not get this message
        broadcastMsg(this.getParticipantsSocket(), {
            event: "updateParticipantsCount",
            participantsCount: this.getParticipantsCount()+1,
            participantsPerGame: PARTICIPANTS_PER_GAME,
        })
        
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
    private handleGuesses = (
        ws: WebSocket, 
        emitter: EventEmitter,
        pid: string, 
        roundStartTime: number, 
        aliveCount: number
    ) : Promise<Object> => {
        return new Promise((resolve, reject) => {
            let myGuess : {id: string, guess: number} | undefined = undefined;
            let numDecided = 0; //number of players who guessed a number/ disconnected, if this number == aliveCount we will shorten the time 
            let numDisconnected = 0; //number of players disconnected

            let hasShortenedCountdown = false;
            
            //this will be called when there are problems with the current connection
            const errorWrapper = () => {
                //remove ALL established listeners 
                ws.removeEventListener('message', onMessage);
                ws.removeEventListener('close', onClose);
                ws.removeEventListener('error', onError);
                emitter.removeListener('custom:firstDecision',onFirstDecision);
                emitter.removeListener('custom:participantDisconnectedMidgame',onParticipantDisconnectedMidgame);
                
                clearTimeout(currentTimeout);
                
                //need to execute that close code, as due to concurrency issues, that close code will not execute until the next game loop
                this.handleClose(ws); 
                if(ws.readyState !== WebSocket.CLOSED)
                    ws.close();

                //still use participant's old guess if they have submitted a valid guess before
                if(myGuess){
                    resolve({
                        ...myGuess,
                        stillAlive: false,
                    });
                }else{
                    //no guess, need to inform all other participants, including those who died
                    this.addBroadcastGameEvent({
                        event: "participantDisconnectedMidgame",
                        aliveCount: this.getAliveCount(),
                        id: pid,
                    } as ParticipantDisconnectedMidgame);
                    emitter.emit("custom:participantDisconnectedMidgame",pid,Date.now())
                    reject({id: pid})
                }
            }

            const successWrapper = (res: Object) => {
                ws.removeEventListener('message', onMessage);
                ws.removeEventListener('close', onClose);
                ws.removeEventListener('error', onError);
                emitter.removeListener('custom:firstDecision',onFirstDecision);
                emitter.removeListener('custom:participantDisconnectedMidgame',onParticipantDisconnectedMidgame);
                resolve(res);
            }

            const onMessage = (event: WebSocket.MessageEvent) => {
                console.log("received: ",event.data.toString());
                const eventTime = Date.now();

                if(eventTime < roundStartTime){
                    //indicate a potential malicious client
                    errorWrapper();
                    return;
                }
        
                try{
                    const r = JSON.parse(event.data.toString()) as Req;
                    assert(r.method==="submitGuess") //check method name
                    assert(r.id===pid) //check id
                    const guess = Number(r.guess) //check if the number is within range and is an integer 
                    assert(Number.isInteger(guess)&&guess>=0&&guess<=100)
                    
                    if(!myGuess){
                        console.log("dispatching event custom:firstDecision from ",pid)
                        emitter.emit("custom:firstDecision",pid,eventTime)
                    }
                    
                    myGuess = {
                        id: r.id,
                        guess: r.guess,
                    }
                }catch(e){
                    console.log("Error with submitGuess event",e)
                    errorWrapper()
                }
                
                sendMsg(ws,{
                    result: "success",
                });
            }
            
            const onClose = (event: WebSocket.CloseEvent) => {
                console.log("onClose fired in handleGuesses")
                errorWrapper()
            }
        
            const onError = (event : WebSocket.ErrorEvent) => {
                console.log("onError fired in handleGuesses")
                errorWrapper()
            }

            const onParticipantDisconnectedMidgame = (eventPid : string, eventTime: number) => {
                console.log("onParticipantDisconnectedMidgame",eventPid,eventTime)
                //if this event is fired, that person has not made a first guess, else it would have been resolved
                assert(!hasShortenedCountdown);

                numDisconnected += 1;
                if(numDisconnected === aliveCount - 1){ //only we are alive, resolve immediately
                    if(myGuess){
                        successWrapper({
                            ...myGuess,
                            stillAlive: true,
                        })
                    }else{
                        successWrapper({
                            id: pid,
                            guess: 0, //dummy value
                            stillAlive: true,
                        })
                    }
                }

                //disconnecting before making a first guess is considered as a form of decision
                numDecided += 1;
                if(numDecided === aliveCount){
                    changeCountdown(eventTime,"participantDisconnectedMidgame");
                }
            }
            
            const onFirstDecision = (eventPid : string, eventTime: number) => {
                // console.log("onFirstDecision fired in ", pid , eventTime)
                numDecided += 1;
                if(numDecided === aliveCount){
                    changeCountdown(eventTime,"allDecided");
                }
            }

            ws.addEventListener('close', onClose);
            ws.addEventListener('message', onMessage);
            ws.addEventListener('error', onError);
            emitter.addListener('custom:firstDecision',onFirstDecision);
            emitter.addListener('custom:participantDisconnectedMidgame',onParticipantDisconnectedMidgame);

            const internalOrigEndTime = roundStartTime + ROUND_TIME_MS + NETWORK_DELAY_MS;

            let currentTimeout = setTimeout(()=>{
                console.log("Round timeout fired")
                
                if(myGuess && numDecided == aliveCount){
                    //if everyone made a decision and we guessed a number
                    successWrapper({
                        ...myGuess,
                        stillAlive: true,
                    })
                }else if(!myGuess){
                    errorWrapper();
                }
                //if myGuess, no need to do anything, the logic is handled when the thread without myGuess calls the errorWrapper, calling the onParticipantDisconnectedMidgame event
            },internalOrigEndTime - Date.now());

            const changeCountdown = (eventTime : number, reason: "participantDisconnectedMidgame" | "allDecided") => {
                const endTime = reason=="participantDisconnectedMidgame" ? 
                                SHORTENED_TIME_MS + DIGEST_TIME_MS + eventTime: 
                                SHORTENED_TIME_MS + eventTime;
                const internalEndTime = endTime + NETWORK_DELAY_MS;

                //For all decided: not do anything if original end time ends sooner
                if(reason==="allDecided" && internalEndTime > internalOrigEndTime) return;

                //For participantDisconnectedMidgame: also not to do anything if the original end time is later
                if(reason==="participantDisconnectedMidgame" && internalEndTime < internalOrigEndTime) return;
                
                hasShortenedCountdown = true;
                sendMsg(ws,{
                    event: "changeCountdown",
                    reason: reason,
                    startTime: reason==="participantDisconnectedMidgame" ? eventTime + DIGEST_TIME_MS - Date.now() : undefined,
                    endTime: endTime - Date.now(),
                } as ChangeCountdown);

                clearTimeout(currentTimeout);
                currentTimeout = setTimeout(()=>{
                    console.log("Round shortened timeout fired")
                    successWrapper({
                        ...myGuess,
                        stillAlive: true,
                    });
                }, internalEndTime - Date.now())
            }
        });
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
                    .filter((p)=>p.socket && p.socket.readyState===WebSocket.OPEN)
                    .filter((p)=>!p.isDead)
                    .map((p)=>this.handleGuesses(
                        p.socket,
                        emitter,
                        p.id,
                        roundStartTime,
                        this.getAliveCount()
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
                const p = this.participants.filter((pp) => pp.id===req.id)[0];

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
                    if(!p.isDead){
                        p.isDead = true;
                        justDiedParticipants.push({
                            id: p.id,
                            reason: "deadLimit",
                        })
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
        const participantList = this.participants.filter((p)=>p.socket === ws);
        // console.log(participantList);
        if(participantList.length > 0){
            if(this.isInProgress()){
                const participant = participantList[0];
                if(!participant.isDead){
                    console.log("handleClose: participant found and game in progress, modifying its parameters")
                    participant.isDead = true;
                }else{
                    console.log("handleClose: participant found and game in progress, its parameters were modified by a previous call already")
                }
                
            }else{
                console.log("handleClose: participant found and game hasn't started, just remove it")
                this.participants = this.participants.filter((p)=>p.socket !== ws);

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