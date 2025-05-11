const express = require('express');
const router = express.Router();
const axios = require('axios');
const base64url = require('base64url');
const { getAdminToken, getUserFromKeycloak } = require('../libs/auth');
const { sendMail, generateVerifyToken, loadEmailTemplate } = require('../libs/email');
const { sendError } = require('../libs/helpers');

const { KC_HOSTNAME, KC_REALM, KC_CLIENT_ID_WAN, KC_CLIENT_SECRET_WAN, FE_HOSTNAME, EMAIL_VERIFY_SECRET, EMAIL_VERIFY_T_EXPIRE_MIN } = process.env;

// 📦 Genera le opzioni per registrare una credenziale
router.get('/options', async (req, res) => {
  const accessToken = req.cookies.accessToken || req.headers.authorization?.split(' ')[1];

  if (!accessToken) {
    return res.status(401).json({ error: 'missing_token' });
  }

  try {
    const response = await axios.get(
      `${KC_HOSTNAME}/realms/${KC_REALM}/khode-webauthn/webauthn/passwordless/registration/options`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    return res.json(response.data);
  } catch (err) {
    console.error('❌ Errore chiamando WebAuthn options:', err?.response?.data || err.message);
    return res.status(502).json({ error: 'webauthn_options_fetch_failed' });
  }
});

// 📦 Invia la credenziale per registrarla
router.post('/register', async (req, res) => {
  const accessToken = req.cookies.accessToken || req.headers.authorization?.split(' ')[1];

  if (!accessToken) {
    console.warn('🔐 Nessun token fornito. Accesso negato.');
    return res.status(401).json({ error: 'missing_token' });
  }

  console.log('🛂 Token ricevuto, avvio registrazione WebAuthn...');

  try {
    // Log iniziale del payload ricevuto dal client (attenzione a non loggare dati sensibili)
    console.log('📦 Payload ricevuto:', {
      id: req.body.id,
      label: req.body.label,
      type: req.body.type,
    });

    const response = await axios.post(
      `${KC_HOSTNAME}/realms/${KC_REALM}/khode-webauthn/webauthn/passwordless/register`,
      req.body,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log('✅ Dispositivo registrato con successo!', response.data);
    res.json(response.data);
  } catch (err) {
    console.error('❌ Errore durante la registrazione WebAuthn:');
    console.error(err?.response?.data || err.message);
    res.status(502).json({ error: 'registration_failed' });
  }
});

// Il client chiama questa rotta per generare le opzioni di autenticazione
router.post('/generate-authentication-options', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email richiesta' });

    // 🔐 Recupera utente da Keycloak
    const userRes = await getUserFromKeycloak(email, null);
    if (!userRes.success)
      return sendError(res, 500, userRes.error, 'Error retrieving user info', userRes.message);

    const userId = userRes.user?.id;

    // 🎟️ Token admin per chiamare SPI
    const tokenRes = await getAdminToken();
    if (!tokenRes.success)
      return sendError(res, 500, tokenRes.error, 'Unable to retrieve admin token', tokenRes.message);

    // 🔁 Chiama il tuo SPI per ottenere le opzioni
    const response = await axios.get(
      `${KC_HOSTNAME}/realms/${KC_REALM}/khode-webauthn/webauthn/passwordless/authentication/options/${userId}`,
      {
        headers: {
          Authorization: `Bearer ${tokenRes.token}`,
        },
      }
    );

    return res.json({ options: response.data });
  } catch (err) {
    console.error('Errore generazione opzioni autenticazione:', err?.response?.data || err.message);
    return res.status(502).json({ error: 'internal_error' });
  }
});



router.post('/verify-authentication', async (req, res) => {
  try {
    const { email, id, response } = req.body;

    if (!email || !id || !response) {
      return res.status(400).json({ error: 'missing_fields' });
    }

    const payload = {
      id,
      authenticatorData: response.authenticatorData,
      clientDataJSON: response.clientDataJSON,
      signature: response.signature,
      userHandle: response.userHandle,
    };

    const encodedPayload = base64url.encode(JSON.stringify(payload));
    const password = encodedPayload;

    const userRes = await getUserFromKeycloak(email, null);
    if (!userRes.success || !userRes.user?.id)
        return sendError(res, 500, 'USER_NOT_FOUND', 'Error retrieving user info', userRes.message);
    
    try {
      const tokenResponse = await axios.post(
        `${KC_HOSTNAME}/realms/${KC_REALM}/protocol/openid-connect/token`,
        new URLSearchParams({
          grant_type: 'password',
          client_id: KC_CLIENT_ID_WAN,
          client_secret: KC_CLIENT_SECRET_WAN,
          username: email,
          password,
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      const { access_token, refresh_token, expires_in, refresh_expires_in } = tokenResponse.data;

      res.cookie('accessToken', access_token, {
        httpOnly: true,
        secure: true,
        sameSite: 'none',
        maxAge: expires_in * 1000,
      });

      res.cookie('refreshToken', refresh_token, {
        httpOnly: true,
        secure: true,
        sameSite: 'none',
        maxAge: refresh_expires_in * 1000,
      });

      return res.json({
        authenticated: true,
        access_token,
        refresh_token,
        expires_in,
        message: '✅ Login WebAuthn riuscito',
      });

    } catch (errLogin) {
      if (errLogin?.response?.data?.error_description === 'Account is not fully set up') {

        try {

          const tokenRes = await getAdminToken();
          if (!tokenRes.success)
          return sendError(res, 500, tokenRes.error, 'Unable to retrieve admin token', tokenRes.message);

          if (userStatus.requiredActions.includes('CONFIGURE_TOTP')) {
            const setupRes = await axios.post(
              `${KC_HOSTNAME}/realms/${KC_REALM}/khode-2fa/totp/setup/${userStatus.id}`,
              {},
              {
                headers: { Authorization: `Bearer ${tokenRes.token}` },
              }
            );
            return res.json({ ...setupRes.data, message: 'Configure_otp_Required' });
          }

          if (userStatus.requiredActions.includes('VERIFY_EMAIL')) {
            const tokenRes = generateVerifyToken(email, EMAIL_VERIFY_SECRET, EMAIL_VERIFY_T_EXPIRE_MIN);
            if (!tokenRes.success) {
              return sendError(res, 502, tokenRes.error, 'Failed to generate email verification token', tokenRes.message);
            }
    
            const subject = 'ExpSharing: Verify Email';
            const html = loadEmailTemplate(
              'emailTemplates/verifyEmail.html',
              { verifyLink: `${FE_HOSTNAME}/auth/verify-email?token=${tokenRes.token}` }
            );

            try {
              const emailRes = await sendMail(email, subject, html);
              if (!emailRes.success) {
                return sendError(res, 502, emailRes.error, 'Failed to send email', emailRes.message);
              }
    
              return sendSuccess(res, 'verify_email_required', {
                email
              });
            } catch (error) {
              return sendError(res, 502, 'EMAIL_VERIFY_FILED', 'Failed to send verify email');
            }
          }

        } catch (setupErr) {
          return res.status(502).send('Errore durante il setup delle required actions');
        }
      }

      console.warn('❌ Login WebAuthn fallito:', errLogin?.response?.data);
      return res.status(401).json({
        error: 'auth_failed',
        details: errLogin?.response?.data || errLogin.message,
      });
    }

  } catch (err) {
    console.error('❌ Errore login WebAuthn:', err);
    return res.status(500).json({
      error: 'internal_error',
      details: err.message,
    });
  }
});

// 📦 Recupera credenziali registrate dall'utente
router.get('/devices', async (req, res) => {
  const accessToken = req.cookies.accessToken;
  if (!accessToken) return res.status(401).json({ error: 'missing_token' });

  try {
    const response = await axios.get(
      `${KC_HOSTNAME}/realms/${KC_REALM}/khode-webauthn/webauthn/passwordless/devices`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    return res.json(response.data);
  } catch (err) {
    console.error('❌ Errore recupero dispositivi:', err?.response?.data || err.message);
    return res.status(500).json({ error: 'fetch_failed' });
  }
});

// 🗑️ Cancella una credenziale WebAuthn
router.delete('/devices/:id', async (req, res) => {
  const accessToken = req.cookies.accessToken;
  if (!accessToken) return res.status(401).json({ error: 'missing_token' });

  const credentialId = req.params.id;

  try {
    const response = await axios.delete(
      `${KC_HOSTNAME}/realms/${KC_REALM}/khode-webauthn/webauthn/passwordless/devices/${credentialId}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    return res.json(response.data);
  } catch (err) {
    console.error('❌ Errore cancellazione dispositivo:', err?.response?.data || err.message);
    return res.status(500).json({ error: 'delete_failed' });
  }
});

// 🔄 Modifica label di un dispositivo WebAuthn
router.patch('/devices/:id', async (req, res) => {
  const accessToken = req.cookies.accessToken;
  if (!accessToken) return res.status(401).json({ error: 'missing_token' });

  const credentialId = req.params.id;
  const { label } = req.body;
  console.log('🔄Modifica label per: ',credentialId,label);
  try {
    const response = await axios.patch(
      `${KC_HOSTNAME}/realms/${KC_REALM}/khode-webauthn/webauthn/devices/${credentialId}`,
      { label },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    return res.json(response.data);
  } catch (err) {
    console.error('❌ Errore modifica label:', err?.response?.data || err.message);
    return res.status(502).json({ error: 'update_failed' });
  }
});

module.exports = router;