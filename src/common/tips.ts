import { Tip } from "./interfaces";

const TIPS = [
    // {
    //     "message": "Tenbin is now available on iOS! Share the game with your friends with an iPhone! App Store link is on the home page.",
    // },
    {
        "message": "Would you like to give some feedback on the game? Or simply chat with others who are also interested in Tenbin? Join our Discord server! Link is on the home page.",
    },
    {
        "message": "Remember you can always review the rules by clicking the button on the top-right corner of the screen.",
    },
    {
        "message": "A new rule will be added when a player is eliminated. You can always review the new rules by clicking the rules button after this happens.",
    },
    {
        "message": "You can change your number anytime before the time runs out.",
    },
    {
        "message": "We recently reached 500 downloads on Google Play, thanks for all your support!",
        "showTo": new Date(2024,9-1,30,0,0,0),
    },
] as Tip[]

export const getTip = () => {
    const now = new Date();
    const eligibleTipsMsg = TIPS
        .filter((t)=>(t.showFrom==null || t.showFrom <= now) && (t.showTo == null || t.showTo >= now))
        .map((t)=>t.message)
    if(eligibleTipsMsg.length==0) return "";
    return eligibleTipsMsg[Math.floor(Math.random()*eligibleTipsMsg.length)]
}