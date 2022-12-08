const { WebClient } = require('@slack/client');
require('dotenv').config();
const https = require('https');
const axios = require('axios');

// Replace with your bot's token
const token = process.env.SLACK_BOT_TOKEN;

// Create a new instance of the WebClient class
const web = new WebClient(token);

// Set the channel that the bot will post messages to
const channel = 'D04EHGBCG8H';

// Replace with the URL of the API you want to poll
const url = 'https://lunadas.prod.ci.sfdc.net/api/run/v1/q/get-recent-run';

const message = "checkin failed";

/*AutoBuild IDs
* main_precheckin = 4869
* 242_patch_precheckin = 34722
*/
const main_precheckin = 4869;
const patch242_precheckin = 34722;

//Hashmaps for autobuild CLs
const main_map = new Map();
const patch242_map = new Map();

// Poll API for all autobuilds
const pollApi = () => {
    pollMainPrecheckin();
    poll242PatchPrecheckin();
}

// Define a function that polls the API and posts the results to Slack
const pollMainPrecheckin = () => {
    //Make a GET request to the API
    axios.get(url, {
        params: {
            'autobuild-id': main_precheckin,
            'page-number':1,
            'noOfRecords':5
        },
        httpsAgent: new https.Agent({ rejectUnauthorized: false })
    }).then(response => {
            // Process the response from the API
            console.log(response.data.recentRunItems.length);
            response.data.recentRunItems.forEach(processMainCheckinResults);
        })
        .catch(err => {
            // Handle any errors that occurred when making the request
            console.log('Error polling API:', err);
        });
};

const processMainCheckinResults = (item) => {
    // Status will be either UNDEFINED for new entries
    // Status will be (RUNNING, FINISHED) for existing entries
    // If a build is failed/successful, status will always be FINISHED
    // Hence we need to compare "buildFailed" value to check if a build is failed/successful
    if (main_map.get(item.changelist) === undefined) {
        // New entry, put it in map if status is RUNNING, Otherwise send notification and ignore
        if (item.status === 'RUNNING') {
            main_map.set(item.changelist, item.status);
            console.log(main_map);
        } else {
            sendSlackNotification(item.changelist, item.status, item.owner, item.origOwner);
        }
    } else if (main_map.get(item.changelist) !== item.status) {
        //Status changed, send out a slack notification here and Remove the entry from map
        sendSlackNotification(item.changelist, item.status, item.owner, item.origOwner);
        main_map.delete(item.changelist);
    }
}

const sendSlackNotification = (changelist, status, owner, origOwner) => {
    console.log("Send out a notification here");
    //Use the chat.postMessage method to post the results to Slack
            // web.chat.postMessage({ channel, text: response.data.recentRunItems})
            //   .then(() => {
            //     console.log('Message posted successfully');
            //   })
            //   .catch(err => {
            //     console.log('Error posting message:', err);
            //   });
}

const poll242PatchPrecheckin = () => {
    //Make a GET request to the API
    axios.get(url, {
        params: {
            'autobuild-id': patch242_precheckin,
            'page-number':1,
            'noOfRecords':5

        },
        httpsAgent: new https.Agent({ rejectUnauthorized: false })
    }).then(response => {
        response.data.recentRunItems.forEach(process242PatchCheckinResults);
        })
        .catch(err => {
            // Handle any errors that occurred when making the request
            console.log('Error polling API:', err);
        });
};

const process242PatchCheckinResults = (item) => {
    // Status will be either UNDEFINED for new entries
    // Status will be (RUNNING, FINISHED) for existing entries
    // If a build is failed/successful, status will always be FINISHED
    // Hence we need to compare "buildFailed" value to check if a build is failed/successful
    if (patch242_map.get(item.changelist) === undefined) {
        // New entry, put it in map if status is RUNNING, Otherwise send notification and ignore
        if (item.status === 'RUNNING') {
            patch242_map.set(item.changelist, item.status);
            console.log(patch242_map);
        } else {
            sendSlackNotification(item.changelist, item.status, item.owner, item.origOwner);
        }
    } else if (patch242_map.get(item.changelist) !== item.status) {
        //Status changed, send out a slack notification here and Remove the entry from map
        sendSlackNotification(item.changelist, item.status, item.owner, item.origOwner);
        patch242_map.delete(item.changelist);
    }
}

pollApi();
// Poll the API every 60 seconds
//setInterval(pollApi, 10000);
