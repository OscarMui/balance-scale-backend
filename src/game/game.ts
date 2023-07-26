import * as WebSocket from 'ws';
import {Participant, Req} from '../common/interface';
import { DEAD_LIMIT, PARTICIPANTS_PER_GAME } from '../common/constants';
import { broadcastMsg, recvMsg } from '../common/messaging';
import assert from '../common/assert';

class Game {
    private participants : Participant[] = [];
    private inProgress: boolean = false;
    private ended : boolean = false;

    constructor(){}
    
    getParticipantsCount = () => this.participants.length;

    addParticipantByInfo = ({socket,id,nickname}:{socket: WebSocket, id: string, nickname: string}) : void => {
        this.participants.push({
            id: id,
            nickname: nickname,
            socket: socket,
            guesses: [],
            score: 0,
            isDead: false,
        });

        if(this.getParticipantsCount()==PARTICIPANTS_PER_GAME){
            this.inProgress = true;
            this.gameBody();
            this.ended = true;
        }
    }

    isInProgress = () => this.inProgress;

    isEnded = () => this.ended;

    private getParticipantsSocket = (filterFn? : (p: Participant) => boolean) => {
        if(filterFn) return  this.participants.filter(filterFn).map((p)=>p.socket)
        else return this.participants.map((p)=>p.socket)
    }

    private getParticipantsInfo = () => {
        return this.participants.map((p)=>{return {
            id: p.id, 
            nickname: p.nickname, 
            guesses: p.guesses, 
            score: p.score, 
            isDead: p.isDead
        }})
    }

    private gameBody = async () => {
        let round = 0;
        let targets : number[] = [];
        let prevWinners : string[] = [];
        while(this.participants.filter((p)=>!p.isDead).length > 1){
            broadcastMsg(this.getParticipantsSocket(),{
                event: "gameInfo",
                participants: this.getParticipantsInfo(),
                round: round,
                gameEnded: this.participants.filter((p)=>!p.isDead).length === 1,
                targets: targets,
                prevWinners: prevWinners,
            });
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

            let winners : string[] = [reqs[0].id];
            let winnersDiff = calDiff(reqs[0].guess); 

            reqs.forEach((req)=>{
                //get corresponding participant object using the id
                const p = this.participants.filter((p)=>p.id === req.id)[0];
                assert(!p.isDead);
                p.guesses.push(req.guess);
            })
            targets.push(target);

            for(let i=1;i<reqs.length;i++){
                const req = reqs[i];
                //update the winners array
                const diff = calDiff(req.guess);
                if(diff === winnersDiff) winners.push(req.id);
                else if(diff < winnersDiff){
                    winners = [req.id];
                    winnersDiff = diff;
                }
            }

            //modify score and isDead
            this.participants.forEach((p)=>{
                //if alive and not win: -1 score
                if(!p.isDead && !winners.includes(p.id)){
                    p.score -= 1;
                }

                // dead if DEAD_LIMIT score or worse
                if(p.score <= DEAD_LIMIT){
                    p.score = DEAD_LIMIT; //display -10 instead of -11 or sth
                    p.isDead = true;
                }
            })

            prevWinners = winners;

            console.log(winners);
            round += 1;
        }
        //broadcast one last time
        broadcastMsg(this.getParticipantsSocket(),{
            event: "gameInfo",
            participants: this.getParticipantsInfo(),
            round: round,
            gameEnded: this.participants.filter((p)=>!p.isDead).length === 1,
            targets: targets,
            prevWinners: prevWinners,
        });
        console.log("game ended");
    }
}

export default Game;