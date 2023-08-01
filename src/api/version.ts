import { Request, Response } from 'express';
import {ACCEPTED_CLIENT_VERSIONS} from "../common/constants";

export default (req : Request,res : Response) => {
    res.send({
        result: "success",
        acceptedClientVersions: ACCEPTED_CLIENT_VERSIONS,
    })
};