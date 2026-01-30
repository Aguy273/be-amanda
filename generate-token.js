require('dotenv').config();
const { google } = require('googleapis');
const http = require('http');
const url = require('url');

const CLIENT_ID = process.env.GOOGLE_DRIVE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_DRIVE_CLIENT_SECRET;
const REDIRECT_URI = process.env.GOOGLE_DRIVE_REDIRECT_URI;

const oauth2Client = new google.auth.OAuth2(
    CLIENT_ID,
    CLIENT_SECRET,
    REDIRECT_URI
);

const SCOPES = ['https://www.googleapis.com/auth/drive.file'];

async function getRefreshToken() {
    return new Promise((resolve, reject) => {
        const authUrl = oauth2Client.generateAuthUrl({
            access_type: 'offline',
            scope: SCOPES,
            prompt: 'consent', // Force to get refresh token
        });

        console.log('\n🔐 OAuth Setup - Generate Refresh Token\n');
        console.log('Step 1: Opening browser for Google login...');
        console.log('If browser doesn\'t open, copy this URL:\n');
        console.log(authUrl);
        console.log('\n');

        const server = http.createServer(async (req, res) => {
            try {
                if (req.url.indexOf('/oauth/callback') > -1) {
                    const qs = new url.URL(req.url, REDIRECT_URI).searchParams;
                    const code = qs.get('code');

                    res.end('Authentication successful! You can close this window and return to terminal.');

                    server.close();

                    const { tokens } = await oauth2Client.getToken(code);

                    console.log('\nSuccess! Here is your refresh token:\n');
                    console.log('━'.repeat(80));
                    console.log(tokens.refresh_token);
                    console.log('━'.repeat(80));
                    console.log('\nCopy the token above and add to your .env file:');
                    console.log('\nGOOGLE_DRIVE_REFRESH_TOKEN=' + tokens.refresh_token);
                    console.log('GOOGLE_DRIVE_CLIENT_ID=' + CLIENT_ID);
                    console.log('GOOGLE_DRIVE_CLIENT_SECRET=' + CLIENT_SECRET);
                    console.log('\nThen remove these lines from .env:');
                    console.log('- GOOGLE_DRIVE_CLIENT_EMAIL');
                    console.log('- GOOGLE_DRIVE_PRIVATE_KEY');
                    console.log('\n');

                    resolve(tokens.refresh_token);
                }
            } catch (error) {
                reject(error);
            }
        });

        server.listen(4500, () => {
            console.log('Waiting for authentication...\n');
        });
    });
}

getRefreshToken().catch(console.error);
