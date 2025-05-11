require('dotenv').config();
require('./libs/loadSecrets.js');
const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const { createYoga } = require('graphql-yoga');

const { schema } = require('./graphql/schema.js');
const { getUserFromToken } = require('./libs/checkUserToken.js');
const DBMonitor = require('./monitors/dbMonitor.js');
const AUTHMonitor = require('./monitors/authMonitor.js');
const RecoveryManager = require('./monitors/recoveryManager.js');

//Yoga Graphql
const yoga = createYoga({
    schema,
    context: async ({ request }) => {
    const cookieHeader = request.headers.get('cookie') || '';
    const cookies = Object.fromEntries(cookieHeader.split(';').map(c => {
      const [key, value] = c.trim().split('=');
      return [key, decodeURIComponent(value)];
    }));
    const token = cookies['accessToken'];
    const user = await getUserFromToken(token);
    return { user };
    },
    graphiql: false
  });

//Express
const app = express();
const port = process.env.EXPRESS_PORT || 4000;
app.set('trust proxy', true);
app.use(express.json());
app.use(cookieParser());
app.use(cors({
  origin: process.env.FE_HOSTNAME, 
  credentials: true,              
}));

// Security headers middleware
app.use((req, res, next) => {
  res.setHeader('Content-Security-Policy', 'default-src \'none\'');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('X-Download-Options', 'noopen');
  res.removeHeader('X-Powered-By'); 
  next();
});

//DB Monitor Health Check
const dbMonitor = new DBMonitor();
dbMonitor.start();
app.use(dbMonitor.middleware());

app.get('/health-db', (req, res) => {
  if (dbMonitor.isHealthy()) {
    res.status(200).json({ status: 'ok', db: 'online' });
  } else {
    res.status(503).json({ status: 'degraded', db: 'offline' });
  }
});

//AUTH Moditor Health Check
const authMonitor = new AUTHMonitor();
authMonitor.start();
app.use(authMonitor.middleware());

app.get('/health-auth', (req, res) => {
  if (authMonitor.isHealthy()) {
    res.status(200).json({ status: 'ok', auth: 'online' });
  } else {
    res.status(503).json({ status: 'degraded', auth: 'offline' });
  }
});

//Sync Users Over DB and Auth
new RecoveryManager(dbMonitor, authMonitor);

//Routes
app.use('/graphql', yoga);
app.use('/auth', require('./services/auth'));
app.use('/fedauth', require('./services/fedauth'));
app.use('/user', require('./services/user'));
app.use('/webauthn', require('./services/webauthn'));

//Start Express
app.listen(port, () => {
 console.log(`Server HTTP in ascolto su http://localhost:${port}`);
});