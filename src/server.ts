import express from 'express';
import http from 'http';
import WebSocket from 'ws';
import Socket from './game/socket';

import lessMiddleware = require('less-middleware');

import admin from 'firebase-admin';

import apiGetToken from "./api/getToken";
import apiVersion from "./api/version";

import { ACCEPTED_CLIENT_VERSIONS, PREFERRED_CLIENT_VERSIONS } from './common/constants';

const app = express();

//initialize a simple http server
const server = http.createServer(app);

//initialize the WebSocket server instance
const wsServer = new WebSocket.Server({ 
    server,
    path: "/game",
});

const socket = new Socket(wsServer);

// Replace with your Firebase project's service account key file path
import serviceAccount from './firebaseKey.json';

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
  databaseURL: 'https://tenbin-b0279.firebaseio.com' // Replace with your project ID
});

//to allow POST request 
app.use(express.json());
app.use(express.urlencoded({extended: true}));


//css, js
app.use(lessMiddleware('public'));
app.use(express.static('public'));

//ROUTING
//views
app.get('/',(req,res)=>{res.render("index");});

//api
app.get('/api/version',apiVersion);
app.post('/api/getToken',apiGetToken);
app.post('/api/gamesStatus',socket.gamesStatus);

//app.set, app.use
app.set("view engine","pug");
app.set('views','templates/views/');

//start our server
server.listen(process.env.PORT || 8999, () => {
    // @ts-ignore
    console.log(`Server started on port ${server.address().port} :)`);
    console.log(`Accepted client versions: ${ACCEPTED_CLIENT_VERSIONS}`)
    console.log(`Preferred client versions: ${PREFERRED_CLIENT_VERSIONS}`)
});