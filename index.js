const { WebClient } = require('@slack/client');
const https = require('https');

const axios = require('axios');

// Replace with your bot's token
const token = 'xoxb-4473380340213-4489040535905-OY3WHEDNv2sbnQDzWsEWGt8O';

// Create a new instance of the WebClient class
const web = new WebClient(token);

// Set the channel that the bot will post messages to
const channel = 'D04E2RBESNQ';

// Replace with the URL of the API you want to poll
const url = 'https://lunadas.prod.ci.sfdc.net/api/run/v1/q/get-recent-run';

const message = "checkin failed";

// Define a function that polls the API and posts the results to Slack
const pollApi = () => {
    //Make a GET request to the API
    axios.get(url, {
        params: {
            'autobuild-id': 34722,
            'page-number':1,
            'noOfRecords':5

        },
        httpsAgent: new https.Agent({ rejectUnauthorized: false })
    }).then(response => {
            // Process the response from the API
            //Use the chat.postMessage method to post the results to Slack
            // web.chat.postMessage({ channel, text: response.data.recentRunItems})
            //   .then(() => {
            //     console.log('Message posted successfully');
            //   })
            //   .catch(err => {
            //     console.log('Error posting message:', err);
            //   });
              console.log(response.data.recentRunItems.length);
           
        })
        .catch(err => {
            // Handle any errors that occurred when making the request
            console.log('Error polling API:', err);
        });


    /**web.chat.postMessage({ channel, text: message })
        .then(() => {
            console.log('Message posted successfully');
        })
        .catch(err => {
            console.log('Error posting message:', err);
        });**/
};
pollApi();
// Poll the API every 60 seconds
//setInterval(pollApi, 10000);
