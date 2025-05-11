const express = require('express');
const router = express.Router();
const axios = require('axios');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const { OAuth2Client } = require('google-auth-library');
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const { getAdminToken, getUserFromKeycloak } = require('../libs/auth');
const { getUserFromToken } = require('../libs/checkUserToken');

const { 
  KC_HOSTNAME, 
  KC_REALM, 
  KC_CLIENT_ID_FED, 
  KC_CLIENT_SECRET_FED, 
  FE_HOSTNAME, 
  GOOGLE_CLIENT_ID, 
  GOOGLE_CLIENT_SECRET
} = process.env;

passport.use(new GoogleStrategy({
  clientID: GOOGLE_CLIENT_ID,
  clientSecret: GOOGLE_CLIENT_SECRET,
  callbackURL: '/fedauth/google/callback',
  passReqToCallback: true,
  scope: ['profile', 'email', 'openid'],
  accessType: 'offline',
  prompt: 'consent',
}, async (req, accessToken, refreshToken, params, profile, done) => {
  try {
    const idToken = params.id_token;
    if (!idToken) {
      return done(new Error('❌ ID Token mancante nei parametri OAuth'));
    }
    // ✅ Verifica ufficiale con Google
    const ticket = await client.verifyIdToken({
      idToken,
      audience: GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();

    if (!payload.email_verified) {
      return done(new Error('❌ Email non verificata su Google'));
    }

    console.log('🔐 ID Token verificato correttamente con Google');
    const federatedToken = JSON.stringify({
      access_token: accessToken,
      id_token: idToken,
      token_type: 'Bearer',
      expires_in: 3600
    });
    

    // 🔐 Autenticazione diretta con Keycloak
    const tokenRes = await axios.post(`${KC_HOSTNAME}/realms/${KC_REALM}/protocol/openid-connect/token`,
      new URLSearchParams({
        client_id: KC_CLIENT_ID_FED,
        client_secret: KC_CLIENT_SECRET_FED,
        grant_type: 'password',
        username: 'google', // alias dell'IdentityProvider
        google_token: federatedToken,
      }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    console.log(tokenRes.data);
    profile.keycloakToken = tokenRes.data;
    return done(null, profile);

  } catch (err) {
    console.error('❌ Federated login error:', err?.response?.data || err.message);

    return done(err);
  }
}));


  // Passport serialize/deserialize
passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));
  
  // Middleware di inizializzazione
router.use(passport.initialize());


router.get('/google', passport.authenticate('google', {
    scope: ['profile', 'email'],
    session: false,
}));


router.get('/google/callback', (req, res, next) => {
  passport.authenticate('google', { session: false }, async (err, user, info) => {
    if (err) {
      console.error('❌ Google callback error:', err.message, err);
      return res.redirect(`${FE_HOSTNAME}/login?error=oauth_error&desc=${encodeURIComponent(err.message)}`);
    }

    // 🔒 LOGIN PARZIALE: required actions o otp
    if (!user) {
      const actions = info?.actions || [];

      // ✅ OTP richiesto → vai alla schermata OTP
      if (actions.includes('OTP_REQUIRED')) {
        return res.redirect(`${FE_HOSTNAME}/otp-login`);
      }

      // ⚙️ Setup OTP → redirect con QR code
      if (actions.includes('CONFIGURE_TOTP')) {
        const qrcode = info?.otpSetupData?.qrcode;
        const otpAuthUrl = info?.otpSetupData?.otpAuthUrl;

        if (!qrcode || !otpAuthUrl) {
          console.warn('⚠️ OTP setup info mancante');
          return res.redirect(`${FE_HOSTNAME}/login?error=otp_setup_missing`);
        }

        const params = new URLSearchParams({
          qrcode: encodeURIComponent(qrcode),
          otpauth: encodeURIComponent(otpAuthUrl),
        }).toString();

        return res.redirect(`${FE_HOSTNAME}/otp-setup?${params}`);
      }

      // 📧 Verifica email richiesta → vai alla pagina verifica
      if (actions.includes('VERIFY_EMAIL')) {
        return res.redirect(`${FE_HOSTNAME}/verify-email?pending=1`);
      }

      // ❌ Altri errori
      return res.redirect(`${FE_HOSTNAME}/login?error=login_failed`);
    }

    // ✅ LOGIN COMPLETO: imposta i cookie
    const { access_token, refresh_token, expires_in } = user.keycloakToken;

    res.cookie('accessToken', access_token, {
      httpOnly: true,
      secure: true, // 🔒 metti true se sei in HTTPS
      sameSite: 'none',
      maxAge: expires_in * 1000,
    });

    res.cookie('refreshToken', refresh_token, {
      httpOnly: true,
      secure: true, // 🔒 metti true se sei in HTTPS
      sameSite: 'none',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 giorni
    });

    console.log('✅ Federated login success:', user.emails?.[0]?.value);
    return res.redirect(`${FE_HOSTNAME}/`);
  })(req, res, next);
});

router.get('/federated-identities', async (req, res) => {
  const accessToken = req.cookies.accessToken;

  if (!accessToken) {
    return res.status(401).json({ error: 'missing_token' });
  }

  try {

    // 🔍 Verifica token localmente (senza introspection)
    const decoded = await getUserFromToken(accessToken);

    if (!decoded) {
      console.warn('❌ Token JWT non valido o scaduto');
      return res.status(401).json({ error: 'invalid_token' });
    }

    const username = decoded.preferred_username || decoded.email || decoded.sub;

    if (!username) {
      return res.status(400).json({ error: 'missing_username' });
    }

    // 👤 Ottieni utente
    const users = await getUserFromKeycloak(username);
    const userId = users[0]?.id;

    if (!userId) {
      return res.status(404).json({ error: 'user_not_found' });
    }

    const adminToken = await getAdminToken();

    // 🔗 Recupera identità federate
    const { data } = await axios.get(
      `${KC_HOSTNAME}/admin/realms/${KC_REALM}/users/${userId}/federated-identity`,
      {
        headers: { Authorization: `Bearer ${adminToken}` },
      }
    );

    return res.json({ federatedIdentities: data });

  } catch (err) {
    console.error('❌ Errore federated identity:', err?.response?.data || err.message);
    return res.status(500).json({ error: 'fetch_failed', details: err.message });
  }
});

router.post('/test-link-federated-identity', async (req, res) => {
  const accessToken = req.cookies.accessToken || req.headers.authorization?.replace('Bearer ', '');
  const { googleSub, googleEmail } = req.body;

  if (!accessToken) return res.status(401).json({ error: 'missing_token' });
  if (!googleSub || !googleEmail) {
    return res.status(400).json({ error: 'missing_google_data', message: 'Fornisci sub e email di Google' });
  }

  try {
    const decoded = await getUserFromToken(accessToken);
    if (!decoded) return res.status(401).json({ error: 'invalid_token' });

    const username = decoded.preferred_username || decoded.email;
    const users = await getUserFromKeycloak(username);
    const userId = users[0]?.id;

    if (!userId) return res.status(404).json({ error: 'user_not_found' });

    const adminToken = await getAdminToken();

    // 🔗 Prova a linkare
    await axios.post(
      `${KC_HOSTNAME}/admin/realms/${KC_REALM}/users/${userId}/federated-identity/google`,
      {
        userId: googleSub,
        userName: googleEmail
      },
      {
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    return res.json({ message: '✅ Federated identity collegata con successo.' });

  } catch (err) {
    if (err.response?.status === 409) {
      return res.status(409).json({ error: 'already_linked', message: 'Questa identità Google è già collegata a un altro account.' });
    }

    console.error('❌ Errore durante link federazione:', err?.response?.data || err.message);
    return res.status(500).json({ error: 'link_failed', details: err.message });
  }
});



router.get('/federated-identities/check-google/:sub', async (req, res) => {
  const { sub } = req.params;
  const adminToken = await getAdminToken();

  try {
    // Cerca tutti gli utenti
    const { data: users } = await axios.get(
      `${KC_HOSTNAME}/admin/realms/${KC_REALM}/users`,
      {
        headers: { Authorization: `Bearer ${adminToken}` },
        params: {
          max: 1000 // puoi aumentare se ne hai di più
        }
      }
    );

    // Per ciascun utente, controlla le federated identity
    for (const user of users) {
      const { data: federated } = await axios.get(
        `${KC_HOSTNAME}/admin/realms/${KC_REALM}/users/${user.id}/federated-identity`,
        { headers: { Authorization: `Bearer ${adminToken}` } }
      );

      if (federated.some(fi => fi.identityProvider === 'google' && fi.userId === sub)) {
        return res.status(200).json({
          linked: true,
          userId: user.id,
          username: user.username,
          email: user.email,
        });
      }
    }

    return res.status(404).json({ linked: false });

  } catch (err) {
    console.error('❌ Errore check federated:', err.message);
    return res.status(500).json({ error: 'check_failed' });
  }
});

module.exports = router;