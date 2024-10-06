import express from 'express';
import http from 'http';
import WebSocket from 'ws';
import Socket from './game/socket';

import lessMiddleware = require('less-middleware');

import admin from 'firebase-admin';

import apiGetToken from "./api/getToken";
import apiVersion from "./api/version";

import { ACCEPTED_CLIENT_VERSIONS, PREFERRED_CLIENT_VERSIONS } from './common/constants';

require('dotenv').config();

const app = express();

//initialize a simple http server
const server = http.createServer(app);

//initialize the WebSocket server instance
const wsServer = new WebSocket.Server({ 
    server,
    path: "/game",
});

const socket = new Socket(wsServer);

admin.initializeApp({
  credential: admin.credential.cert({
    "type": "service_account",
    "project_id": process.env.FIREBASE_PROJECT_ID,
    "private_key_id": process.env.FIREBASE_PROJECT_PRIVATE_KEY_ID,
    "private_key": process.env.FIREBASE_PROJECT_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    "client_email": process.env.FIREBASE_CLIENT_EMAIL,
    "client_id": process.env.FIREBASE_CLIENT_ID,
    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
    "token_uri": "https://oauth2.googleapis.com/token",
    "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
    "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-sqpmu%40tenbin-db.iam.gserviceaccount.com",
    "universe_domain": "googleapis.com"
  } as admin.ServiceAccount),
  databaseURL: process.env.FIREBASE_DATABASE_URL // Replace with your project ID

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