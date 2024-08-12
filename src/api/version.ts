import { Request, Response } from 'express';
import {ACCEPTED_CLIENT_VERSIONS, NETWORK_DELAY_MS} from "../common/constants";
import { getTip } from '../common/tips';

export default (req : Request,res : Response) => {
    res.send({
        result: "success",
        acceptedClientVersions: ACCEPTED_CLIENT_VERSIONS,
        currentTime: Date.now(),
        allowedNetworkDelay: NETWORK_DELAY_MS,
        tip: getTip(),
    })
};