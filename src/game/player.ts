import WebSocket from 'ws';
import {ChangeCountdown, GameEvent, Participant, ParticipantDisconnectedMidgame, Req} from '../common/interfaces';
import { EventEmitter } from 'node:events';
import { v4 as uuidv4 } from 'uuid';
import assert from '../common/assert';
import { DEAD_LIMIT, DIGEST_TIME_MS, NETWORK_DELAY_MS, ROUND_TIME_MS, SHORTENED_TIME_AMEND_MS, SHORTENED_TIME_MS } from '../common/constants';
import { sendMsg } from '../common/messaging';

class Player implements Participant {
    private readonly id = uuidv4()
    private readonly socket : WebSocket;
    private readonly nickname : string;
    private readonly isBot = false;
    private score = 0;
    private isDead = false;

    constructor(ws: WebSocket,nickname: string){
        this.socket = ws
        this.nickname = nickname
    }

    makeGuess = (
        emitter: EventEmitter,
        roundStartTime: number, 
        handleClose: (ws: WebSocket) => void,
        addBroadcastGameEvent: (ge: GameEvent) => void,
        getAliveCount: () => number,
    ) : Promise<Object> => {
        return new Promise((resolve, reject) => {
            let myGuess : {id: string, guess: number} | undefined = undefined;
            let numDecided = 0; //number of players who guessed a number/ disconnected, if this number == aliveCount we will shorten the time 
            let numDisconnected = 0; //number of players disconnected
            const aliveCount = getAliveCount() //get a local copy of aliveCount for some calculations below
            let hasShortenedCountdown = false;
            
            //this will be called when there are problems with the current connection
            const errorWrapper = () => {
                //remove ALL established listeners 
                this.socket.removeEventListener('message', onMessage);
                this.socket.removeEventListener('close', onClose);
                this.socket.removeEventListener('error', onError);
                emitter.removeListener('custom:firstDecision',onFirstDecision);
                emitter.removeListener('custom:participantDisconnectedMidgame',onParticipantDisconnectedMidgame);
                
                clearTimeout(currentTimeout);
                
                //need to execute that close code, as due to concurrency issues, that close code will not execute until the next game loop
                handleClose(this.socket); 
                if(this.socket.readyState !== WebSocket.CLOSED)
                    this.socket.close();

                //still use participant's old guess if they have submitted a valid guess before
                if(myGuess){
                    resolve({
                        ...myGuess,
                        stillAlive: false,
                    });
                }else{
                    //no guess, need to inform all other participants, including those who died
                    addBroadcastGameEvent({
                        event: "participantDisconnectedMidgame",
                        aliveCount: getAliveCount(),
                        id: this.id,
                    } as ParticipantDisconnectedMidgame);
                    emitter.emit("custom:participantDisconnectedMidgame",this.id,Date.now())
                    reject({id: this.id})
                }
            }

            const successWrapper = (res: Object) => {
                this.socket.removeEventListener('message', onMessage);
                this.socket.removeEventListener('close', onClose);
                this.socket.removeEventListener('error', onError);
                emitter.removeListener('custom:firstDecision',onFirstDecision);
                emitter.removeListener('custom:participantDisconnectedMidgame',onParticipantDisconnectedMidgame);
                resolve(res);
            }

            const onMessage = (event: WebSocket.MessageEvent) => {
                console.log("received: ",event.data.toString());
                const eventTime = Date.now();

                if(eventTime < roundStartTime){
                    //update: in rare occasions messages might be sent during this time due to unstable network
                    //TODO: clients should send the round number in when submitting the guesses
                    //indicate a potential malicious client
                    // errorWrapper();
                    // return;
                }
        
                try{
                    const r = JSON.parse(event.data.toString()) as Req;
                    assert(r.method==="submitGuess") //check method name
                    assert(r.id===this.id) //check id
                    const guess = Number(r.guess) //check if the number is within range and is an integer 
                    assert(Number.isInteger(guess)&&guess>=0&&guess<=100)
                    
                    if(!myGuess){
                        console.log("dispatching event custom:firstDecision from ",this.id)
                        emitter.emit("custom:firstDecision",this.id,eventTime)
                    }
                    
                    myGuess = {
                        id: r.id,
                        guess: r.guess,
                    }
                }catch(e){
                    console.log("Error with submitGuess event",e)
                    errorWrapper()
                }
                
                sendMsg(this.socket,{
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

            const onParticipantDisconnectedMidgame = (eventId : string, eventTime: number) => {
                console.log("onParticipantDisconnectedMidgame",eventId,eventTime)
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
                            id: this.id,
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
            
            const onFirstDecision = (eventId : string, eventTime: number) => {
                // console.log("onFirstDecision fired in ", this.id , eventTime)
                numDecided += 1;
                if(numDecided === aliveCount){
                    changeCountdown(eventTime,"allDecided");
                }
            }

            this.socket.addEventListener('close', onClose);
            this.socket.addEventListener('message', onMessage);
            this.socket.addEventListener('error', onError);
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
                                SHORTENED_TIME_AMEND_MS + DIGEST_TIME_MS + eventTime: 
                                SHORTENED_TIME_MS + eventTime;
                const internalEndTime = endTime + NETWORK_DELAY_MS;

                //For all decided: not do anything if original end time ends sooner
                if(reason==="allDecided" && internalEndTime > internalOrigEndTime) return;

                //For participantDisconnectedMidgame: also not to do anything if the original end time is later
                if(reason==="participantDisconnectedMidgame" && internalEndTime < internalOrigEndTime) return;
                
                hasShortenedCountdown = true;
                sendMsg(this.socket,{
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

    getInfo(){
        return {
            id: this.id,
            nickname: this.nickname,
            isBot: this.isBot,
            score: this.score,
            isDead: this.isDead,
        }
    };

    changeScore(delta : number){
        this.score += delta
        // dead if DEAD_LIMIT score or worse
        if(this.score <= DEAD_LIMIT){
            this.score = DEAD_LIMIT; //display -10 instead of -11 or sth
            if(!this.isDead){
                this.isDead = true;
                return true
            }
        }
        return false
    };

    getSocket(){
        return this.socket
    };

    getId(){
        return this.id
    }
    getNickname(){
        return this.nickname
    }
    getScore(){
        return this.score
    }
    getIsDead(){
        return this.isDead
    }
    getIsBot(){
        return this.isBot
    }
    setIsDead(isDead: boolean){
        this.isDead = isDead
    }

}

export default Player;