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

const CreateAssistant = async()=>{
    const assistant = await openai.beta.assistants.create({
        instructions: "You are a weather bot. Use the provided functions to answer questions.",
        model: "gpt-3.5-turbo-0125",
        tools: [{
          "type": "function",
          "function": {
            "name": "getCurrentWeather",
            "description": "Get the weather in location",
            "parameters": {
              "type": "object",
              "properties": {
                "location": {"type": "string", "description": "The city and state e.g. San Francisco, CA"},
                "unit": {"type": "string", "enum": ["c", "f"]}
              },
              "required": ["location"]
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
                "location": {"type": "string", "description": "The city and state e.g. San Francisco, CA"},
              },
              "required": ["location"]
            }
          }
        }]
      });

      //console.log(assistant)
}

const getCurrentWeather = ()=>{
    const weatherData = {
        temperature : "27",
        humidity : "80",
        storm : false,
        windDirection : "NE",
        city : "Kolkata",
        rain : false
    }

    console.log(weatherData)

    return weatherData;
}

const getMovieRatings = (name)=>{
    return (10);
}

const openWebsite = (name)=>{
    const websiteName = JSON.parse(name)
    return (`https://www.${websiteName.name.toLowerCase()}.com`);
}


io.on('connection', socket => {
    console.log("Client ID : " + socket.id),

        socket.emit('message', {
            value: "Hellow there"
        })

        socket.on('create-assistant', async()=>{
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


        socket.emit('text-created', {
            prompt : data.prompt
        })
        //run
        const run = await openai.beta.threads.runs.create(thread.id, {
            assistant_id: process.env.ASSISTANT_ID,
            instructions: "Your name is Silver. My full name is MD Samiul Islam, you can call me Sam. You are a very funny character who keeps the user entertained. Try to  use some words like aaa, ummm, okayyy",    
        });

        //run status
        const checkStatusAndPrintMessages = async (threadId, runId) => {
            let runStatus = await openai.beta.threads.runs.retrieve(threadId, runId);
           // console.log(runStatus)    
           
           if(runStatus.status === "completed"){
            //socket.emit('speechRes', "Got it!");
            let messages = await openai.beta.threads.messages.list(threadId);
            let lastMessage;
        
            for(let i = messages.data.length - 1; i >= 0; i--) {
                const msg = messages.data[i];
                const role = msg.role;
                const content = msg.content[0].text.value; 
        
                if(role === 'assistant')
                {
                    lastMessage = `${content}`;
                    
                }
            }
        
            if(lastMessage) {
                socket.emit('speechRes', lastMessage);
                socket.emit('textRes', lastMessage);
                
                //console.log(lastMessage);
            }
        
            console.log("Run is completed.");
            clearInterval(intervalId);
        }
        
           
           else if (runStatus.status === 'requires_action') {
            socket.emit('speechRes', ("Working on it sir!"))
                console.log("Requires action");
            
                const requiredActions = runStatus.required_action.submit_tool_outputs.tool_calls;
                //console.log(requiredActions);
            
                let toolsOutput = [];
            
                for (const action of requiredActions) {
                    const funcName = action.function.name;
                    const functionArguments = (action.function.arguments);

                    //console.log("Function arguments : "+arguments)
                    
                    if (funcName === "getMovieRatings") {
                        const output =  getMovieRatings(functionArguments);
                        toolsOutput.push({
                            tool_call_id: action.id,
                            output: JSON.stringify(output)  
                        });
                    } 

                    if (funcName === "openWebsite") {
                        const output =  openWebsite(functionArguments);
                        socket.emit('open-website', output)
                        toolsOutput.push({
                            tool_call_id: action.id,
                            output: JSON.stringify(output)  
                        });
                    } 
                    
                    if (funcName === "getNickname") {
                        const output =  getMovieRatings(functionArguments);
                        toolsOutput.push({
                            tool_call_id: action.id,
                            output: JSON.stringify(output)  
                        });
                    } 

                    else {
                        console.log("Function not found");
                    }
                }
            
                // Submit the tool outputs to Assistant API
                await openai.beta.threads.runs.submitToolOutputs(
                    thread.id,
                    run.id,
                    { tool_outputs: toolsOutput }
                );
            } 
            else {
                console.log("Run is not completed yet.");
            }  
        };

        const intervalId = setInterval(() => {
            checkStatusAndPrintMessages(thread.id, run.id)
        }, 5000);
            
        
    })

    socket.on('disconnect', () => {
        console.log('client of ID : ' + socket.id + ' disconnected');
    })
})

const PORT = process.env.PORT || 5500;

server.listen(PORT, () => {
    console.log("Server is up and running on PORT : " + PORT)
})