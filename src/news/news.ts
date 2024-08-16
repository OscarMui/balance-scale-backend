import { Announcement, Tip } from "../common/interfaces";

const ANNOUNCEMENTS = [
    // {
    //     "announcement": "app-store-launch",
    // },
    // {
    //     "announcement": "google-play-launch",
    // },
    // {
    //     "announcement": "testflight-launch",
    // },
    // {
    //     "announcement": "on-the-hour",
    // },
] as Announcement[]

const TIPS = [
    // {
    //     "message": "Tenbin is now available on iOS! Share the game with your friends with an iPhone! App Store link is on the home page.",
    // },
    {
        "message": "Want to play with others on the internet? Join our Discord server! The link is on the home page.",
    },
    {
        "message": "Would you like to give feedback on the game? Or chat with others who are also interested in Tenbin? Join our Discord server! The link is on the home page.",
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
        "message": "To clarify, this is an actual online game. Try joining with your friends at the same time and you will be in the same game!",
    },
    {
        "message": "To clarify, this is an actual online game. However, the game may not be popular enough at the moment for there to be a constant flow of players.",
    },
    {
        "message": "We recently reached 500 downloads on Google Play, thanks for all your support!",
        "showTo": new Date(2024,9-1,30,0,0,0),
    },
] as Tip[]

export const getNews = () => {
    const now = new Date();
    return  {
        announcements: ANNOUNCEMENTS
            .filter((t)=>(t.showFrom==null || t.showFrom <= now) && (t.showTo == null || t.showTo >= now)),
        tips: TIPS
            .filter((t)=>(t.showFrom==null || t.showFrom <= now) && (t.showTo == null || t.showTo >= now))
            .map((t)=>t.message),
    }
}