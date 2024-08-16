import { Request, Response } from 'express';
import {ACCEPTED_CLIENT_VERSIONS, NETWORK_DELAY_MS} from "../common/constants";

export default (req : Request, res : Response) => {
    //POST REQUEST
    const query = req.body;
    
    if(!ACCEPTED_CLIENT_VERSIONS.includes(query.version)){
        res.send({
            result: "error",
            errorMsg: "VERSION ERROR: Incompatible version with server. Please obtain the latest version of the game.",
        })
    }

    res.send({
        result: "success",
    })
};