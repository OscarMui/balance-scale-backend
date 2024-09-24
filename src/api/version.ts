import { Request, Response } from 'express';
import {ACCEPTED_CLIENT_VERSIONS, NETWORK_DELAY_MS, PREFERRED_CLIENT_VERSIONS} from "../common/constants";
import { getNews } from '../news/news';

export default (req : Request,res : Response) => {
    res.send({
        result: "success",
        acceptedClientVersions: ACCEPTED_CLIENT_VERSIONS,
        preferredClientVersions: PREFERRED_CLIENT_VERSIONS,
        news: getNews(),
    })
};