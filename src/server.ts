import * as express from 'express';
import * as http from 'http';
import * as WebSocket from 'ws';
import Socket from './game/socket';

import lessMiddleware = require('less-middleware');
import apiVersion from "./api/version";
import { ACCEPTED_CLIENT_VERSIONS } from './common/constants';

const app = express();

//initialize a simple http server
const server = http.createServer(app);

//initialize the WebSocket server instance
const wsServer = new WebSocket.Server({ 
    server,
    path: "/game",
});

new Socket(wsServer);

//to allow POST request 
app.use(express.json());
app.use(express.urlencoded({extended: true}));

//ROUTING
//views
app.get('/',(req,res)=>{res.render("index");});

//api
app.get('/api/version',apiVersion);
//app.set, app.use
app.set("view engine","pug");
app.set('views','templates/views/');

//css, js
app.use(lessMiddleware('public'));
app.use(express.static('public'));

//start our server
server.listen(process.env.PORT || 8999, () => {
    // @ts-ignore
    console.log(`Server started on port ${server.address().port} :)`);
    console.log(`Accepted client versions: ${ACCEPTED_CLIENT_VERSIONS}`)
});