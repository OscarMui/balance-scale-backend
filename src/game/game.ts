import * as WebSocket from 'ws';
import {GameEvent, GameInfo, GameStart, Participant, ParticipantGuess, ParticipantInfo} from '../common/interface';
import { DEAD_LIMIT, PARTICIPANTS_PER_GAME } from '../common/constants';
import { broadcastMsg, recvMsg } from '../common/messaging';
import assert from '../common/assert';

class Game {
    private participants : Participant[] = [];
    private inProgress: boolean = false;
    private gameEvents : GameEvent[] = [];

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

        if(this.getParticipantsCount()==PARTICIPANTS_PER_GAME){
            this.inProgress = true;
            this.gameBody();
        }
    }

    isInProgress = () => this.inProgress;

    isEnded = () => this.getAliveCount() <= 1;

    private getParticipantsSocket = (filterFn? : (p: Participant) => boolean) => {
        if(filterFn) return  this.participants.filter(filterFn).map((p)=>p.socket)
        else return this.participants.map((p)=>p.socket)
    }

    private getParticipantsInfo = () => {
        return this.participants.map((p)=>{return {
            id: p.id, 
            nickname: p.nickname, 
            score: p.score, 
            isDead: p.isDead
        } as ParticipantInfo})
    }

    private getAliveCount = () => this.participants.filter((p)=>!p.isDead).length

    private addBroadcastGameEvent = (ge: GameEvent) => {
        const sockets = this.getParticipantsSocket();
        this.gameEvents.push(ge);
        broadcastMsg(sockets,ge);
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
            let justDiedParticipants : string[] = []
            let justAppliedRules = new Set<number>()

            // get one message from every participant that is alive
            const requests = await Promise.all(this.getParticipantsSocket((p : Participant)=>!p.isDead).map((ws)=>recvMsg(ws)))
            
            const reqs = requests.map((request)=>{ return {
                //@ts-ignore
                method: request.method,
                //@ts-ignore
                id: request.id,
                //@ts-ignore
                guess: Number(request.guess),
            }})


            console.log("all res received",reqs);

            const target = reqs.map((req)=>req.guess).reduce((xs,x)=>x+xs,0) / reqs.length * 0.8;

            //helper function
            const calDiff = (x: number) => Math.abs(x - target)

            let winners : string[] = [];
            let winnersDiff : number | null = null; 

            // * 2 players remaining: If someone chooses 0, a player who chooses 100 automatically wins the round.
            if(this.getAliveCount()<=2 && reqs[0].guess === 0 && reqs[1].guess === 100){
                winners = [reqs[1].id]
                winnersDiff = null;
                justAppliedRules.add(2);
            }else if(this.getAliveCount()<=2 && reqs[1].guess === 0 && reqs[0].guess === 100){
                winners = [reqs[0].id]
                winnersDiff = null;
                justAppliedRules.add(2);
            }else{
                for(let i=0;i<reqs.length;i++){
                    const req = reqs[i];

                    //* 4 players remaining: If two or more players choose the same number, the number is invalid and all players who selected the number will lose a point.
                    if(this.getAliveCount()<=4){
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
                    if(this.getAliveCount()<=3 && winnersDiff && winnersDiff <= 0.5){
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
                    justDiedParticipants.push(p.id)
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
                justDiedParticipants: justDiedParticipants,
                justAppliedRules: [...justAppliedRules],
            } as GameInfo);
        }
        //broadcast one last time
        
        console.log("game ended");
    }
}

export default Game;