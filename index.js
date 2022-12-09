const { WebClient } = require('@slack/client');
require('dotenv').config();
const https = require('https');
const axios = require('axios');
const { debug } = require('console');

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

//MinChangeList numbers
let main_minChangeList = undefined;
let patch242_minChangeList = undefined;

// Fetch API for all autobuilds, to fetch new records and keep saving it in Map
const FetchNewChangeLists = () => {
    //fetchMainPrecheckinCLs();
    fetch242PatchPrecheckinCLs();
}

// Define a function that keeps fetching new records and put it in map (queue)
const fetchMainPrecheckinCLs = () => {
    //Make a GET request to the API
    axios.get(url, {
        params: {
            'autobuild-id': main_precheckin,
            'minChangeList': main_minChangeList == undefined ? main_minChangeList : main_minChangeList + 1,
            'owners': 'jagdish.kumar',
            'noOfRecords': 1
        },
        httpsAgent: new https.Agent({ rejectUnauthorized: false })
    }).then(response => {
        // Process the response from the API
        console.log("No Changelists scanned: ", response.data.recentRunItems.length);
        let isSetMinChangeList = false;
        response.data.recentRunItems.forEach((item) => {
            if (!isSetMinChangeList) {
                isSetMinChangeList = true;
                main_minChangeList = item.changelist;
            }
            main_map.set(item.changelist, item.status);
        });
        console.log(main_map);
    })
        .catch(err => {
            // Handle any errors that occurred when making the request
            console.log('Error polling API:', err);
        });
    setTimeout(FetchNewChangeLists, 120000);
};

const fetch242PatchPrecheckinCLs = () => {
    //Make a GET request to the API
    axios.get(url, {
        params: {
            'autobuild-id': patch242_precheckin,
            'minChangeList': patch242_minChangeList == undefined ? patch242_minChangeList : patch242_minChangeList + 1,
            'owners': 'aashishgoel',
            'noOfRecords': 1
        },
        httpsAgent: new https.Agent({ rejectUnauthorized: false })
    }).then(response => {
        console.log("No of Changelists scanned: ", response.data.recentRunItems.length);
        let isSetMinChangeList = false
        response.data.recentRunItems.forEach((item) => {
            if (!isSetMinChangeList) {
                isSetMinChangeList = true;
                patch242_minChangeList = item.changelist;
            }
            patch242_map.set(item.changelist, item.status);
        });
        console.log(patch242_map);

        response.data.recentRunItems.forEach((item) => {
            if (item.status == "RUNNING") {
                sendSlackNotification(item.changelist, item.buildFailed, item.owner, item.origOwner, item.autobuildId);
            }
        });

    })
        .catch(err => {
            // Handle any errors that occurred when making the request
            console.log('Error polling API:', err);
        });
    setTimeout(FetchNewChangeLists, 120000);
};

//Function to process the map/queue to query the status and send out the slack notification for finished builds
const ProcessQueueForBuildStatus = () => {
    //processMainQueueBuildStatus();
    process242PatchQueueBuildStatus();
}

const processMainQueueBuildStatus = () => {
    // Status will be either RUNNING OR FINISHED
    // If a build is failed/successful, status will always be FINISHED
    // Hence we need to compare "buildFailed" value to check if a build is failed/successful

    const CLs = Array.from(main_map.keys()).join(",");
    console.log("ChangeLists to be processed in the queue:", CLs);
    axios.get(url, {
        params: {
            'autobuild-id': main_precheckin,
            'changelist-ids': CLs
        },
        httpsAgent: new https.Agent({ rejectUnauthorized: false })
    }).then(response => {
        // Process the response from the API
        response.data.recentRunItems.forEach((item) => {
            if (main_map.get(item.changelist) !== undefined && item.status === 'FINISHED') {
                //Status changed, send out a slack notification here and Remove the entry from map
                sendSlackNotification(item.changelist, item.buildFailed, item.owner, item.origOwner, item.autobuildId);
                main_map.delete(item.changelist);
            }
        });
    })
        .catch(err => {
            // Handle any errors that occurred when making the request
            console.log('Error Updating Status API:', err);
        });
    console.log("========================================")
    setTimeout(ProcessQueueForBuildStatus, 60000);
}

const process242PatchQueueBuildStatus = () => {
    const CLs = Array.from(patch242_map.keys()).join(",");
    console.log("ChangeLists in the to be processed queue:", CLs);
    axios.get(url, {
        params: {
            'autobuild-id': patch242_precheckin,
            'changelist-ids': CLs
        },
        httpsAgent: new https.Agent({ rejectUnauthorized: false })
    }).then(response => {
        // Process the response from the API
        response.data.recentRunItems.forEach((item) => {
            if (patch242_map.get(item.changelist) !== undefined && item.status === 'FINISHED') {
                //Status changed, send out a slack notification here and Remove the entry from map
                sendSlackNotification(item.changelist, item.buildFailed, item.owner, item.origOwner, item.autobuildId);
                patch242_map.delete(item.changelist);
            }
        });
    })
        .catch(err => {
            // Handle any errors that occurred when making the request
            console.log('Error Updating Status API:', err);
        });
    console.log("========================================")
    setTimeout(ProcessQueueForBuildStatus, 60000);
}

const sendSlackNotification = (changelist, status, owner, origOwner, autoBuildId) => {
    let username;
    if (origOwner != null) {
        username = origOwner;
    } else {
        username = owner;
    }
    let buildStatus;
    if (status == 'y') {
        buildStatus = 'failed';
    } else if (status == 'n') {
        buildStatus = 'succeeded';
    } else {
        buildStatus = 'running';
    }
    const autobuildUrl = `https://luna.prod.ci.sfdc.net/build/Autobuild/recent_runs?autobuild_id=${autoBuildId}&users=${username}`;
    const emailAddress = username + "@salesforce.com";
    web.users.lookupByEmail({ email: emailAddress }).then(response => {
        console.log(response.user.id);
        const userId = response.user.id;
        web.chat.postMessage({
            channel: userId,
            blocks: [
                {
                    "type": "header",
                    "text": {
                        "type": "plain_text",
                        "text": `Checkin ${buildStatus}`
                    }
                },
                {
                    "type": "section",
                    "fields": [
                        {
                            "type": "mrkdwn",
                            "text": `*Changelist:*\n${changelist}`
                        },
                        {
                            "type": "mrkdwn",
                            "text": `*Owner:*\n${username}`
                        }
                    ]
                },
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": `<${autobuildUrl}|View in Luna>`
                    }
                }
            ]
        })
            .then(() => {
                console.log('Message posted successfully');
            })
            .catch(err => {
                console.log('Error posting message:', err);
            });
    })
}

// Fetch New Records every 2 minutes, initially start with 1 second delay
setTimeout(FetchNewChangeLists, 1000);

// Process Queue to update build status every 1 minute, initially start with 5 second delay
setTimeout(ProcessQueueForBuildStatus, 5000);