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

const getMovieRatings = (name) => {
    console.log("MOIVE NAME RECEIVED  :  " + name)
    return (10);
}

const CreateAssistant = async () => {
    const assistant = await openai.beta.assistants.create({
        instructions: "You bot. Use the provided functions to answer questions.",
        model: "gpt-3.5-turbo-0125",
        tools: [{
            "type": "function",
            "function": {
                "name": "getMovieRatings",
                "description": "Movie Ratings",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "name": { "type": "string", "description": "Movie Name" },
                        "unit": { "type": "string" }
                    },
                    "required": ["name"]
                }
            }
        }, {
            "type": "function",
            "function": {
                "name": "getNickname",
                "description": "Get the nickname of a city",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "location": { "type": "string", "description": "The city and state e.g. San Francisco, CA" },
                    },
                    "required": ["location"]
                }
            }
        }]
    });

    console.log(assistant)
}

const getCurrentWeather = () => {
    const weatherData = {
        temperature: "27",
        humidity: "80",
        storm: false,
        windDirection: "NE",
        city: "Kolkata",
        rain: false
    }

    console.log(weatherData)

    return weatherData;
}





io.on('connection', socket => {
    console.log("Client ID : " + socket.id),

        socket.emit('message', {
            value: "Hellow there"
        })

    socket.on('create-assistant', async () => {
        await CreateAssistant();
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


        const currentTime = new Date().getTime()

        var response = "";

        // We use the createAndStream SDK helper to create a run with
        // streaming. The SDK provides helpful event listeners to handle 
        // the streamed response.

        let run = await openai.beta.threads.runs.create(
            thread.id,
            {
                assistant_id: process.env.ASSISTANT_ID,
                instructions: "Please address the user as Jane Doe. The user has a premium account."
            }
        );

        while (['queued', 'in_progress', 'cancelling'].includes(run.status)) {
            await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for 1 second
            run = await openai.beta.threads.runs.retrieve(
                run.thread_id,
                run.id
            );
        }

        if (run.status === 'completed') {
            const messages = await openai.beta.threads.messages.list(
                run.thread_id
            );
            for (const message of messages.data.reverse()) {
                console.log(`${message.role} > ${message.content[0].text.value}`);
            }
        } else {
            console.log("requires action")
            let toolOutput = [];
            const requiredActions = (run.required_action.submit_tool_outputs.tool_calls);
            for (const actions of requiredActions) {
                const functionName = actions.function.name;
                const functionArguments = actions.function.arguments

                if(functionName === 'getMovieRatings'){
                    const functionOutput = getMovieRatings(functionArguments);
                    toolOutput.push({
                        tool_call_id : actions.id,
                        output : JSON.stringify(functionOutput)
                    })
                }

                else{
                    console.log("Unkown functions")
                }

            }

            await openai.beta.threads.runs.submitToolOutputs(
                thread.id,
                run.id,
                { tool_outputs: toolOutput }
            );

            console.log(toolOutput)

            

        }







    })

    socket.on('disconnect', () => {
        console.log('client of ID : ' + socket.id + ' disconnected');
    })
})

const PORT = process.env.PORT || 5500;

server.listen(PORT, () => {
    console.log("Server is up and running on PORT : " + PORT)
})