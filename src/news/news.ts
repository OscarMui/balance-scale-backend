import { Announcement, ClientAnnouncement, ServerAnnouncement, Tip } from "../common/interfaces";

const ANNOUNCEMENTS = [
    // {
    //     "announcement": "app-store-launch",
    // },
    // {
    //     "announcement": "google-play-launch",
    // },
    {
        "shortCode": "discord-gaming-session",
        "type": "client",
        "eventTime": new Date(2024,10-1,10,15,0,0).getTime(), //10 Oct 2024 4PM BST,
        "showTo": new Date(2024,10-1,10,15,30,0), //10 Oct 2024 4PM BST,
    } as ClientAnnouncement,
    {
        "type": "server",
        "title": "New Update!",
        "body": "Thank you for all your support, our game has recently reached 1000+ downloads.\n\nThis update brings you with new features fundamental to a smooth game experience, including\n1. the ability to reconnect in the middle of the game\n2. the ability to view the scores of players after the match\n3. the ability to view the player list at the start of the match \n4. the announcement system that you are reading right now\n5. small UI improvements\n\nAs you may know, hosting the server requires quite some money, I have decided to add a small amount of ads in the game. Thank you for your understanding.\n\nMy next goal is to work on major UI improvements, stayed tuned.",
        "showTo": new Date(2024,10-1,20,0,0,0), 
    } as ServerAnnouncement,
    {
        "type": "server",
        "title": "This is a test title 2",
        "body": "This is a test body 2",
        "showTo": new Date(2024,10-1,10,15,30,0), //10 Oct 2024 4PM BST,
    } as ServerAnnouncement,
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
        "message": "To clarify, this is an actual online game. Try joining with your friends at the same time and you will be in the same game!",
    },
    // {
    //     "message": "To clarify, this is an actual online game. However, the game may not be popular enough at the moment for there to be a constant flow of players.",
    // },
    {
        "message": "We recently reached 1000 downloads on Google Play, thanks for all your support!",
        "showTo": new Date(2024,10-1,15,0,0,0),
    },
    {
        "message": "NEW: As an experiment, we shortened the time per round to 1 minute. Let me know if this is better on Discord. The link is on the home page.",
        "showTo": new Date(2024,9-1,30,0,0,0),
    },
    {
        "message": "NEW: As an experiment, we shortened the time per round to 1 minute. Let me know if this is better on Discord. The link is on the home page.",
        "showTo": new Date(2024,9-1,30,0,0,0),
    },
    {
        "message": "NEW: As an experiment, we shortened the time per round to 1 minute. Let me know if this is better on Discord. The link is on the home page.",
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