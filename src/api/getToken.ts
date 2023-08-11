import { Request, Response } from 'express';
import {ACCEPTED_CLIENT_VERSIONS, NETWORK_DELAY_MS} from "../common/constants";

export default (req : Request, res : Response) => {
    //POST REQUEST
    const query = req.body;
    console.log(query);
    console.log(req.session)
    if (req.session.views) {
        req.session.views++
    } else {
        req.session.views = 1
    }
    res.send({
        result: "success",
        views: req.session.views,
    })
};