import * as express from 'express';
import * as http from 'http';
import * as WebSocket from 'ws';

const app = express();

//initialize a simple http server
const server = http.createServer(app);

//initialize the WebSocket server instance
const wss = new WebSocket.Server({ 
    server,
    path: "/game",
 });

wss.on('connection', (ws: WebSocket) => {
    // internal ID used for logging purposes only
    const id = (new Date()).getTime().toString();

    console.log(`User ${id} connected`);
    // Start sending ping messages every 5 seconds
    let pingTimeout : NodeJS.Timeout;

    const sendPing = () => {
        ws.pong();
        pingTimeout = setTimeout(() => {
            console.log(`No ping received, terminating connection with ${id}...`);
            ws.terminate();
        }, 10000);
    }

    ws.on('ping', () => {
        // console.log('Received ping message from client');
        clearTimeout(pingTimeout);
        sendPing();
    });

    sendPing();

    //connection is up, let's add a simple simple event
    ws.on('message', (message: string) => {

        //log the received message and send it back to the client
        console.log(`received from ${id}: %s`, message);

        const broadcastRegex = /^broadcast\:/;

        if (broadcastRegex.test(message)) {
            message = message.toString().replace(broadcastRegex, '');

            //send back the message to the other clients
            wss.clients
                .forEach(client => {
                    if (client != ws) {
                        client.send(`Hello, broadcast message -> ${message}`);
                    }    
                });
            
        } else {
            ws.send(`Hello, you sent -> ${message}`);
        }
    });

    ws.on('close', () => {
        console.log(`User ${id} disconnected`);
    });

    //send immediatly a feedback to the incoming connection    
    ws.send('Hi there, I am a WebSocket server');
});

//start our server
server.listen(process.env.PORT || 8999, () => {
    // @ts-ignore
    console.log(`Server started on port ${server.address().port} :)`);
});