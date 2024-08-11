import { Request, Response } from 'express';
import {ACCEPTED_CLIENT_VERSIONS, NETWORK_DELAY_MS, TIPS} from "../common/constants";

export default (req : Request,res : Response) => {
    res.send({
        result: "success",
        acceptedClientVersions: ACCEPTED_CLIENT_VERSIONS,
        currentTime: Date.now(),
        allowedNetworkDelay: NETWORK_DELAY_MS,
        tip: TIPS[Math.floor(Math.random()*TIPS.length)],
    })
};