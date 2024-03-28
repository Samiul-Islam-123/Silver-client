const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const socketIO = require('socket.io');
const OpenAi = require("openai")

const io = socketIO(server, {
    cors: {
        origin: '*',
        methods: ["GET", "POST"]
    }
});

require('dotenv').config();



const openai = new OpenAi({
    apiKey: process.env.API_KEY
})

var thread;

//creating a thread
const CreateThread = async () => {
    thread = await openai.beta.threads.create();
}

CreateThread();

io.on('connection', socket => {
    console.log("Client ID : " + socket.id),

        socket.emit('message', {
            value: "Hellow there"
        })

    socket.on('user-prompt', async data => {

        console.log(data)
        const message = await openai.beta.threads.messages.create(
            thread.id,
            {
                role: "user",
                content: data.prompt
            }
        );


        const currentTime =  new Date().getTime()

            var response = "";

        const run = openai.beta.threads.runs.createAndStream(thread.id, {
            assistant_id: process.env.ASSISTANT_ID,
            instructions : "Your name is Silver. My name is Samiul, you can call me Sam. Talk like a real human . Use words like aaaaa, ummmm to give more natural feel"
        })
            .on('textCreated', (text) => {
                socket.emit('text-created', {
                    text : text,
                    prompt : data.prompt,
                    time :currentTime
                })
            })
            .on('textDelta', (textDelta) => {
                response += textDelta.value;
                socket.emit("textDelta", {
                    data : textDelta,
                    time : currentTime
                })
            })
            .on('end', () => {
                socket.emit('end', response);
            })


    })

    socket.on('disconnect', () => {
        console.log('client of ID : ' + socket.id + ' disconnected');
    })
})

const PORT = process.env.PORT || 5500;

server.listen(PORT, () => {
    console.log("Server is up and running on PORT : " + PORT)
})