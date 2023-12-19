const fs = require('fs').promises;
const path = require('path');
const process = require('process');
const {authenticate} = require('@google-cloud/local-auth');
const {google} = require('googleapis');

// If modifying these scopes, delete token.json.
const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly','https://www.googleapis.com/auth/gmail.modify'];
// The file token.json stores the user's access and refresh tokens, and is
// created automatically when the authorization flow completes for the first
// time.
const TOKEN_PATH = path.join(process.cwd(), 'token.json');
const CREDENTIALS_PATH = path.join(process.cwd(), 'credentials.json');

/**
 * Reads previously authorized credentials from the save file.
 *
 * @return {Promise<OAuth2Client|null>}
 */
async function loadSavedCredentialsIfExist() {
  try {
    const content = await fs.readFile(TOKEN_PATH);
    const credentials = JSON.parse(content);
    return google.auth.fromJSON(credentials);
  } catch (err) {
    return null;
  }
}

/**
 * Serializes credentials to a file compatible with GoogleAUth.fromJSON.
 *
 * @param {OAuth2Client} client
 * @return {Promise<void>}
 */
async function saveCredentials(client) {
  const content = await fs.readFile(CREDENTIALS_PATH);
  const keys = JSON.parse(content);
  const key = keys.installed || keys.web;
  const payload = JSON.stringify({
    type: 'authorized_user',
    client_id: key.client_id,
    client_secret: key.client_secret,
    refresh_token: client.credentials.refresh_token,
  });
  await fs.writeFile(TOKEN_PATH, payload);
}

/**
 * Load or request or authorization to call APIs.
 *
 */
async function authorize() {
  let client = await loadSavedCredentialsIfExist();
  if (client) {
    return client;
  }
  client = await authenticate({
    scopes: SCOPES,
    keyfilePath: CREDENTIALS_PATH,
  });
  if (client.credentials) {
    await saveCredentials(client);
  }
  return client;
}

/**
 * Lists the labels in the user's account.
 *
 * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
 */
async function listLabels(auth) {
  const gmail = google.gmail({version: 'v1', auth});
  const res = await gmail.users.labels.list({
    userId: 'me',
  });
  const labels = res.data.labels;
  if (!labels || labels.length === 0) {
    console.log('No labels found.');
    return;
  }
  console.log('Labels:');
  labels.forEach((label) => {
    console.log(`- ${label.name}`);
  });
}

/**
 * Find the top 10 recent messages
 */
async function findMessages(auth) {
    var gmail = google.gmail('v1');
    gmail.users.messages.list({
    auth: auth,
    userId: 'me',
    maxResults: 1,
    q:""
  }, function(err, response) {
    console.log("##### All Messsages Count",response.data.messages.length);
    console.log("++++++++++++++++++++++++++");
    //printMessages(response.data.messages, auth);
    });
  }

async function findUnreadMessages(auth)  {
    const response = await google.gmail('v1').users.messages.list({
      auth: auth,
      userId: 'me',
      maxResults: 1,
      q:"is:unread"
    });

    return response.data.messages;
}

async function markAsRead(messages, auth) {
  google.gmail('v1').users.messages.modify({
    auth: auth,
    userId: 'me', 
    id: messages[0].id,
    resource: {
      removeLabelIds: ['UNREAD']
    }
  });
}
  
/**
 * Print each message. Currently sending only 1 message within messages.
 * TBD: Expand for bulk
 * 
 * @param {} messages
 * @param {} auth 
 */
async function handleMessages(messages, auth) {
    google.gmail('v1').users.messages.get({
    auth: auth,
    userId: 'me',
    id:messages[0].id
  }, function(err, response) {
      console.log("$$$$$ RESPONSE ",response);
      console.log("$$$$$$ RESPONSE SNIPPET ",response.data.snippet);
      console.log("$$$$$$$ RESPONSE PAYLOAD ",response.data.payload);
      if (response.data.payload.body.size === 0) { // Complex email w/ attachments or embedded HTML
        response.data.payload.parts.forEach(part => {
          console.log("$$$$$$$$ COMPLEX RESPONSE PAYLOAD BODY PARTID", part.partId)
          console.log("$$$$$$$$ COMPLEX RESPONSE PAYLOAD BODY CONTENT", (part.mimeType === 'text/plain' ? Buffer.from(part.body.data, 'base64').toString('utf8') : part.body.data))
        })
      } else { // Simple email w/ NO attachments or embedded HTML
        console.log("$$$$$$$$ SIMPLE RESPONSE PAYLOAD BODY DATA",Buffer.from(response.data.payload.body.data, 'base64').toString("utf8"));

      }
  });
}

//authorize().then(listLabels).catch(console.error);
//authorize().then(findMessages).catch(console.error)

async function handleUnreadMessage() {
  const auth = await authorize();
  const messages = await findUnreadMessages(auth);
  await handleMessages(messages, auth);
  await markAsRead(messages, auth);
}

handleUnreadMessage();