const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');
const http = require('http');
const url = require('url');

const CREDENTIALS_PATH = path.join(__dirname, 'credentials.json');
const TOKEN_PATH = path.join(__dirname, 'token.json');

const SCOPES = ['https://www.googleapis.com/auth/documents.readonly'];

async function authorize() {
  // Lesa credentials
  if (!fs.existsSync(CREDENTIALS_PATH)) {
    console.error('❌ credentials.json finnst ekki!');
    console.log('   Settu credentials.json í audioland-verkefni möppuna.');
    process.exit(1);
  }

  const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH));
  const { client_id, client_secret } = credentials.installed || credentials.web;
  
  const oauth2Client = new google.auth.OAuth2(
    client_id,
    client_secret,
    'http://localhost:3001/oauth2callback'
  );

  // Ef token er til, erum við búin
  if (fs.existsSync(TOKEN_PATH)) {
    console.log('✅ Token er nú þegar til!');
    console.log('   Þú getur keyrt appið með: npm start');
    process.exit(0);
  }

  // Búa til auth URL
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
  });

  console.log('\n═══════════════════════════════════════════════════════');
  console.log('   GOOGLE DOCS TENGINGU');
  console.log('═══════════════════════════════════════════════════════\n');
  console.log('   Opna vafra á:', authUrl);
  console.log('\n   Bíð eftir að þú loggir inn...\n');

  // Opna vafra sjálfkrafa
  const open = await import('open');
  open.default(authUrl);

  // Ræsa smá server til að taka á móti callback
  const server = http.createServer(async (req, res) => {
    const queryObject = url.parse(req.url, true).query;
    
    if (queryObject.code) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end('<html><body style="font-family: system-ui; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #333; color: white;"><div style="text-align: center;"><h1>✅ Tenging tókst!</h1><p>Þú getur lokað þessum glugga.</p></div></body></html>');
      
      try {
        const { tokens } = await oauth2Client.getToken(queryObject.code);
        fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens));
        
        console.log('✅ Token vistað!');
        console.log('   Þú getur nú keyrt appið með: npm start');
        
        server.close();
        process.exit(0);
      } catch (err) {
        console.error('❌ Villa við að sækja token:', err.message);
        server.close();
        process.exit(1);
      }
    }
  });

  server.listen(3001, () => {
    console.log('   Hlustandi á callback á port 3001...');
  });
}

authorize();
