import WebSocket from 'ws';
import { GameEvent, Participant } from '../common/interfaces';
import { EventEmitter } from 'node:events';
import { v4 as uuidv4 } from 'uuid';
import { DEAD_LIMIT } from '../common/constants';
import sleep from '../common/sleep';
const BOT_NICKNAMES = ["Alice","Clara","Ellen","Iris","Kate","Nora","Sarah"]

class Bot implements Participant {
    private readonly id = uuidv4()
    private readonly nickname : string;
    private readonly isBot = true;
    private score = 0;
    private isDead = false;
    private upperLimit = 100

    constructor(seed: number){
        // seed given by caller to generate unique names for each game
        this.nickname = BOT_NICKNAMES[seed % BOT_NICKNAMES.length];
    }

    makeGuess = (
        emitter: EventEmitter,
        roundStartTime: number, 
        handleClose: (ws: WebSocket) => void,
        addBroadcastGameEvent: (ge: GameEvent) => void,
        getAliveCount: () => number,
    ) : Promise<Object> => {
        return new Promise(async (resolve, reject) => {
            
            await sleep(1000)
            console.log("BOT dispatching event custom:firstDecision from ",this.id)
            emitter.emit("custom:firstDecision",this.id,Date.now())

            resolve({
                id: this.id,
                guess: this.guess(getAliveCount()),
                stillAlive: true,
            })
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
        return null
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

    private guess(aliveCount: number){
        if(aliveCount == 2){
            const r = Math.floor(Math.random()*3)
            if(r == 2)
                return 100
            else 
                return r
        }else{
            const upperLimit = this.upperLimit
            this.upperLimit *= 0.8
            return Math.floor(Math.random()*(Math.floor(upperLimit)+1))
        }
    }

}

export default Bot;