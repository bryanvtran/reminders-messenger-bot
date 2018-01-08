'use strict';

// Imports dependencies and set up http server
const
  express = require('express'),
  bodyParser = require('body-parser'),
  app = express().use(bodyParser.json()); // creates express http server

// request
const request = require('request');

// .env
require('dotenv').load();

// page token
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
// verify token, should be a random string
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;

// Mongoose
var mongoose = require('mongoose');
const mongoDB = process.env.MONGO_URL;

mongoose.connect(mongoDB, {
    useMongoClient: true
});
// Get Mongoose to use the global promise library
mongoose.Promise = global.Promise;
//Get the default connection
var db = mongoose.connection;

//Bind connection to error event (to get notification of connection errors)
db.on('error', console.error.bind(console, 'MongoDB connection error:'));

// create task schema
var Schema = mongoose.Schema;

var TaskSchema = new Schema({
    sender_psid: String,
    task: String,
    dt: Date
});

// Compile model from schema
var TaskModel = mongoose.model('TaskModel', TaskSchema );

// Sets server port and logs message on success
app.listen(process.env.PORT || 1337, () => console.log('webhook is listening'));

// Index page
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

// Add task
app.post('/task/create', (req, res) => {
    let body = req.body;
    let psid = body.psid;
    let task = body.task;
    let dt = new Date();

    if (!psid || !task || !dt) {
        return res.status(200).send({ status: 'fail', msg: 'All fields are required' });
    }

    // Create an instance of model
    var task_instance = new TaskModel({ 
        sender_psid: psid,
        task: task,
        dt: dt
    });

    // Save the new model instance, passing a callback
    task_instance.save(function (err) {
        if (err) { return res.status(200).send({ status: 'fail' }); }

        // saved!
        console.log('Saved!');
        return res.status(200).send({ status: 'success' });
    });
});

app.get('/task/all', (req, res) => {
    TaskModel.find(function (err, tasks) {
        if (err) return console.error(err);
        res.send(tasks);
    });
});

app.get('/task/get', (req, res) => {
    let psid = req.query['psid'];
    if (!psid) {
        return res.status(200).send({ status: 'fail', msg: 'PSID is required.' });
    }

    TaskModel.find({ sender_psid: psid }, function (err, tasks) {
        if (err) return console.error(err);
        res.send(tasks);
    });
});

// Creates the endpoint for our webhook 
app.post('/webhook', (req, res) => {  
    let body = req.body;

    // Checks this is an event from a page subscription
    if (body.object === 'page') {

        // Iterates over each entry - there may be multiple if batched
        body.entry.forEach(function(entry) {
            // Gets the body of the webhook event
            let webhook_event = entry.messaging[0];
            console.log(webhook_event);

            // Get the sender PSID
            let sender_psid = webhook_event.sender.id;
            console.log('Sender PSID: ' + sender_psid);

            // Check if the event is a message or postback and
            // pass the event to the appropriate handler function
            if (webhook_event.message) {
                handleMessage(sender_psid, webhook_event.message);        
            } else if (webhook_event.postback) {
                handlePostback(sender_psid, webhook_event.postback);
            }
        });

        // Returns a '200 OK' response to all requests
        res.status(200).send('EVENT_RECEIVED');
    } else {
        // Returns a '404 Not Found' if event is not from a page subscription
        res.sendStatus(404);
    }

});

// Adds support for GET requests to our webhook
app.get('/webhook', (req, res) => {

    // Parse the query params
    let mode = req.query['hub.mode'];
    let token = req.query['hub.verify_token'];
    let challenge = req.query['hub.challenge'];
        
    // Checks if a token and mode is in the query string of the request
    if (mode && token) {

        // Checks the mode and token sent is correct
        if (mode === 'subscribe' && token === VERIFY_TOKEN) {
        
            // Responds with the challenge token from the request
            console.log('WEBHOOK_VERIFIED');
            res.status(200).send(challenge);
        
        } else {
            // Responds with '403 Forbidden' if verify tokens do not match
            res.sendStatus(403);      
        }
    }
});

// for nlp
function firstEntity(nlp, name) {
    return nlp && nlp.entities && nlp.entities[name] && nlp.entities[name][0];
}

// Handles messages events
function handleMessage(sender_psid, received_message) {
    let response;

    console.log(received_message);

    // Checks if the message contains text
    if (received_message.text) {
        
        // Creates the payload for a basic text message, which
        // will be added to the body of our request to the Send API
        response = {
            "text": `You sent the message: "${received_message.text}". Now send me an attachment!`
        }

    } else if (received_message.attachments) {

        // Gets the URL of the message attachment
        let attachment_url = received_message.attachments[0].payload.url;

        response = {
            "attachment": {
                "type": "template",
                "payload": {
                    "template_type": "generic",
                    "elements": [{
                        "title": "Is this the right picture?",
                        "subtitle": "Tap a button to answer.",
                        "image_url": attachment_url,
                        "buttons": [
                            {
                                "type": "postback",
                                "title": "Yes!",
                                "payload": "yes",
                            },
                            {
                                "type": "postback",
                                "title": "No!",
                                "payload": "no",
                            }
                        ],
                    }]
                }
            }
        }
    } 

    // Sends the response message
    callSendAPI(sender_psid, response);    
}

// Handles messaging_postbacks events
function handlePostback(sender_psid, received_postback) {
    let response;
  
    // Get the payload for the postback
    let payload = received_postback.payload;
  
    // Set the response based on the postback payload
    if (payload === 'yes') {
      response = { "text": "Thanks!" }
    } else if (payload === 'no') {
      response = { "text": "Oops, try sending another image." }
    }
    // Send the message to acknowledge the postback
    callSendAPI(sender_psid, response);
}

// Sends response messages via the Send API
function callSendAPI(sender_psid, response) {
    // Construct the message body
    let request_body = {
        "recipient": {
        "id": sender_psid
        },
        "message": response
    }

    // Send the HTTP request to the Messenger Platform
    request({
        "uri": "https://graph.facebook.com/v2.6/me/messages",
        "qs": { "access_token": PAGE_ACCESS_TOKEN },
        "method": "POST",
        "json": request_body
    }, (err, res, body) => {
        if (!err) {
        console.log('message sent!')
        } else {
        console.error("Unable to send message:" + err);
        }
    }); 
}