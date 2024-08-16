import { Request, Response } from 'express';
import {ACCEPTED_CLIENT_VERSIONS, NETWORK_DELAY_MS} from "../common/constants";

export default (req : Request, res : Response) => {
    //POST REQUEST
    const query = req.body;
    
    if(!ACCEPTED_CLIENT_VERSIONS.includes(query.version)){
        res.send({
            result: "error",
            errorMsg: "VERSION ERROR: Incompatible version with server. You need to update the app in order to play online.",
        })
    }

    res.send({
        result: "success",
    })
};