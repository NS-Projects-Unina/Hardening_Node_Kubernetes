const express = require('express');
const router = express.Router();
const axios = require('axios');

const { getAdminToken, getUserFromKeycloak } = require('../libs/auth');
const { sendMail, resetEmailLimiter, generateVerifyToken, checkVerifyToken, loadEmailTemplate } = require('../libs/email');
const { sendError, sendSuccess, sendErrorOTP } = require('../libs/helpers');

const { 
  KC_HOSTNAME, 
  KC_REALM, 
  KC_CLIENT_ID, 
  KC_CLIENT_SECRET, 
  FE_HOSTNAME,
  EMAIL_RESET_SECRET, 
  EMAIL_RESET_T_EXPIRE_MIN,
  EMAIL_VERIFY_SECRET,
  EMAIL_VERIFY_T_EXPIRE_MIN
} = process.env;

//Token Introspection
router.get('/introspect', async (req, res) => {
  const token = req.cookies.accessToken;

  if (!token)
    return sendError(res, 401, 'TOKEN_FIELD_EMPTY', 'Token is required');

  try {
    const response = await axios.post(
      `${KC_HOSTNAME}/realms/${KC_REALM}/protocol/openid-connect/token/introspect`,
      new URLSearchParams({
        token,
        client_id: KC_CLIENT_ID,
        client_secret: KC_CLIENT_SECRET,
      }),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      }
    );

    const data = response.data;

    if (!data.active)
      return sendError(res, 401, 'INVALID_TOKEN', 'Token is inactive or expired');

    return sendSuccess(res, 'Token introspection successful', {
      email: data.email,
    });
  } catch (err) {
    return sendError(res, 502, 'INTROSPECTION_ERROR', 'Failed to introspect token', `Request failed with status code ${502}`);
  }
});

// Refresh Access Token
router.get('/refresh', async (req, res) => {
  const refreshToken = req.cookies.refreshToken;

  if (!refreshToken)
    return sendError(res, 401, 'REFRESHTOKEN_COOKIE_EMPTY', 'Refresh token is required');

  try {
    const response = await axios.post(
      `${KC_HOSTNAME}/realms/${KC_REALM}/protocol/openid-connect/token`,
      new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: KC_CLIENT_ID,
        client_secret: KC_CLIENT_SECRET,
        refresh_token: refreshToken,
      }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    const { access_token, expires_in } = response.data;

    res.cookie('accessToken', access_token, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      path: '/',
      maxAge: expires_in * 1000,
    });

    return sendSuccess(res, 'Access token refreshed', { refreshed: true });
  } catch (err) {
    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');
    return sendError(res, 401, 'REFRESH_FAILED', 'Failed to refresh token', `Request failed with status code ${401}`);
  }
});


// Logout
router.post('/logout', async (req, res) => {
  const refreshToken = req.cookies.refreshToken;

  if (!refreshToken)
    return sendError(res, 401, 'REFRESHTOKEN_COOKIE_EMPTY', 'Refresh token is required');
  
  let revoked = false;
  try {
    await axios.post(
      `${KC_HOSTNAME}/realms/${KC_REALM}/protocol/openid-connect/logout`,
      new URLSearchParams({
        client_id: KC_CLIENT_ID,
        client_secret: KC_CLIENT_SECRET,
        refresh_token: refreshToken
      }),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      }
    );
    revoked = true;
  } catch (err) {
    revoked = false;
  }

  res.clearCookie('accessToken', { path: '/' });
  res.clearCookie('refreshToken', { path: '/' });
  return sendSuccess(res, 'Logout completed', { revoked });
});

// Signup
router.post('/signup', async (req, res) => {
  const { username, email, password, repeatPassword } = req.body;
  
  const errorDetails = {};
  if (!username) errorDetails.usernameField = 'Username is required';
  if (!email) errorDetails.email = 'Email is required';
  if (!password) errorDetails.password = 'Password is required';
  if (!repeatPassword) errorDetails.repeatPassword = 'Repeat password is required';

  if (Object.keys(errorDetails).length > 0)
    return sendError(res, 400, 'EMPTY_FIELDS', 'Required fields are missing', errorDetails);

  if( password !== repeatPassword )
    return sendError(res, 400, 'PASSWORD_MISMATCH', 'Passwords do not match');

  try {

    const tokenRes = await getAdminToken();
    if (!tokenRes.success)
      return sendError(res, 500, tokenRes.error, 'Unable to retrieve admin token', tokenRes.message);

    const userRes = await getUserFromKeycloak(email, null);
    if (!userRes.success)
      return sendError(res, 500, userRes.error, 'Error retrieving user info', userRes.message);

    if (userRes.user?.id)
      return sendError(res, 409, 'USER_EXISTS_EMAIL', 'User already registered');

    await axios.post(`${KC_HOSTNAME}/admin/realms/${KC_REALM}/users`, {
      username,
      email,
      enabled: true,
      emailVerified: false,
      credentials: [{
        type: 'password',
        value: password,
        temporary: false
      }],
      requiredActions: []
    }, {
      headers: { Authorization: `Bearer ${tokenRes.token}` },
    });

    return sendSuccess(res, 'User successfully registered');
  } catch (err) {
    console.log(err);
    if(err.response.data.errorMessage === "User exists with same username")
      return sendError(res, 409, 'USER_EXISTS_USERNAME', 'Failed to register user', err?.response?.data || err.message);
    return sendError(res, 502, 'USER_CREATION_FAILED', 'Failed to register user', err?.response?.data || err.message);
  }
});

// Login
router.post('/login', async (req, res) => {
  const { email, password, remember, otpCode } = req.body;

  const errorDetails = {};
  if (!email) errorDetails.email = 'Email is required';
  if (!password) errorDetails.password = 'Password is required';

  if (Object.keys(errorDetails).length > 0)
    return sendError(res, 400, 'EMPTY_FIELDS', 'Required fields are missing', errorDetails);

  try {
    const response = await axios.post(
      `${KC_HOSTNAME}/realms/${KC_REALM}/protocol/openid-connect/token`,
      new URLSearchParams({
        grant_type: 'password',
        client_id: KC_CLIENT_ID,
        client_secret: KC_CLIENT_SECRET,
        username: email,
        password,
        otp: otpCode || ''
      }),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      }
    );

    const { access_token, refresh_token, expires_in, refresh_expires_in } = response.data;

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
      ...(remember ? { maxAge: refresh_expires_in * 1000 } : {}),
    });

    return sendSuccess(res, 'User successfully logged');
  } catch (err) {
    if(err?.response?.data?.error_description === 'Account is not fully set up'){

      const tokenRes = await getAdminToken();
      if (!tokenRes.success)
        return sendError(res, 500, tokenRes.error, 'Unable to retrieve admin token', tokenRes.message);
  
      const userRes = await getUserFromKeycloak(email, null);
      if (!userRes.success || !userRes.user?.id)
        return sendError(res, 500, userRes.error, 'Error retrieving user info', userRes.message);
      
      //Required Action: Configure OTP
      if (userRes.user.requiredActions.includes('CONFIGURE_TOTP')) {
        try{
        const setupRes = await axios.post(`${KC_HOSTNAME}/realms/${KC_REALM}/khode-2fa/totp/setup/${userRes.user.id}`, {}, {
          headers: { Authorization: `Bearer ${tokenRes.token}` },
        });
        return sendSuccess(res, 'configure_otp_required', {
          qrCode: setupRes.data.qrCode, 
          secret: setupRes.data.secret, 
          expire: setupRes.data.policy.period
        });
        }catch(err){
          return sendErrorOTP(res, err.response.data.code);
        }
      }

      //Required Action: Verify Email
      if (userRes.user.requiredActions.includes('VERIFY_EMAIL')) {
        const tokenRes = generateVerifyToken(email, EMAIL_VERIFY_SECRET, EMAIL_VERIFY_T_EXPIRE_MIN);
        if (!tokenRes.success) {
          return sendError(res, 401, tokenRes.error, 'Failed to generate email verification token', tokenRes.message);
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
          return sendError(res, 401, 'EMAIL_VERIFY_FILED', 'Failed to send verify email');
        }
      }
    }
    return sendError(res, 401, 'USER_LOGIN_FAILED', 'Failed to login user', err?.response?.data);
    
  }
});

// Verify OTP
router.post('/otp/verify', async (req, res) => {
  const { code, email } = req.body;

  const errorDetails = {};
  if (!code) errorDetails.email = 'Code is required';
  if (!email) errorDetails.password = 'Email is required';

  if (Object.keys(errorDetails).length > 0)
    return sendError(res, 400, 'EMPTY_FIELDS', 'Required fields are missing', errorDetails);

  try {
    
    const userRes = await getUserFromKeycloak(email, null);
    if (!userRes.success || !userRes.user?.id)
      return sendError(res, 500, userRes.error, 'Error retrieving user info', userRes.message);

    const tokenRes = await getAdminToken();
    if (!tokenRes.success)
      return sendError(res, 500, tokenRes.error, 'Unable to retrieve admin token', tokenRes.message);

    await axios.post(`${KC_HOSTNAME}/realms/${KC_REALM}/khode-2fa/totp/verify/${userRes.user?.id}`, { code }, {
      headers: { Authorization: `Bearer ${tokenRes.token}` }
    });

    await axios.put(`${KC_HOSTNAME}/admin/realms/${KC_REALM}/users/${userRes.user?.id}`, {
      requiredActions: userRes.user.requiredActions.filter(
        action => action !== 'CONFIGURE_TOTP'
      ),
    }, {
      headers: { Authorization: `Bearer ${tokenRes.token}` }
    });

    return sendSuccess(res, 'OTP configured and activated');

  } catch (err) {

    if(err?.response?.data?.code)
      return sendErrorOTP(res, err.response.data.code);
    return sendError(res, 400, 'ERROR_REMOVE_REQUIRED_ACTION', 'Setup user in auth failed', err?.response?.data || err.message );

  }
});

// Send Email Reset Password
router.post('/reset-password-email', resetEmailLimiter, async (req, res) => {
  const { email } = req.body;

  if(!email)
    return sendError(res, 400, 'EMAIL_FIELD_EMPTY', 'Email is required');

  try {

    const userRes = await getUserFromKeycloak(email, null);
    if (!userRes.success || !userRes.user?.id)
      return sendError(res, 500, 'USER_NOT_FOUND', 'Error retrieving user info', userRes.message);

    const tokenRes = generateVerifyToken(email, EMAIL_RESET_SECRET, EMAIL_RESET_T_EXPIRE_MIN);
    if (!tokenRes.success) {
      return sendError(res, 500, tokenRes.error, 'Failed to generate email verification token', tokenRes.message);
    }

    const subject = 'ExpSharing: Reset Password';
    const html = loadEmailTemplate(
      'emailTemplates/resetPassword.html',
      { resetLink: `${FE_HOSTNAME}/auth/reset-password?token=${tokenRes.token}` }
    );

    const emailRes = await sendMail(email, subject, html);
    if (!emailRes.success) {
      return sendError(res, 502, emailRes.error, 'Failed to send email', emailRes.message);
    }
    
    return sendSuccess(res, 'verify_email_required', {
      email
    });

  } catch (err) {
    return sendError(res, 502, 'ERROR_RESET_PASSWORD', 'Reset password failed', err?.response?.data || err.message );
  }
});

// Verify Email Reset Password
router.post('/reset-password-email-verify', async (req, res) => {
  const { newPassword, token } = req.body;

  const errorDetails = {};
  if (!newPassword) errorDetails.newPassword = 'Password is required';
  if (!token) errorDetails.token = 'Token is required';

  if (Object.keys(errorDetails).length > 0)
    return sendError(res, 400, 'EMPTY_FIELDS', 'Required fields are missing', errorDetails);

  try {

    const checkTokenRes = checkVerifyToken(token, EMAIL_RESET_SECRET);
    if (!checkTokenRes.success) {
      return sendError(res, 401, checkTokenRes.error, 'Wmail verification token not valid', checkTokenRes.message);
    }

    const email = checkTokenRes.email;

    const userRes = await getUserFromKeycloak(email, null);
    if (!userRes.success || !userRes.user?.id)
      return sendError(res, 500, 'USER_NOT_FOUND', 'Error retrieving user info', userRes.message);

    const tokenRes = await getAdminToken();
    if (!tokenRes.success)
      return sendError(res, 500, tokenRes.error, 'Unable to retrieve admin token', tokenRes.message);

    await axios.put(
      `${KC_HOSTNAME}/admin/realms/${KC_REALM}/users/${userRes.user?.id}/reset-password`,
      {
        type: 'password',
        temporary: false,
        value: newPassword
      },
      {
        headers: {
          Authorization: `Bearer ${tokenRes.token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    return sendSuccess(res, 'verify_email_success', {
      email
    });
    
  } catch (err) {
    return sendError(res, 401, 'ERROR_RESET_PASSWORD_VERIFY', 'Reset password verify failed', err?.response?.data || err.message );
  }
});

// Verify Email (Required Action)
router.post('/email-verify', async (req, res) => {
  const { token } = req.body;

  if(!token)
    return sendError(res, 401, 'TOKEN_FIELD_EMPTY', 'Token is required');

  try {

    const checkTokenRes = checkVerifyToken(token, EMAIL_VERIFY_SECRET);
    if (!checkTokenRes.success) {
      return sendError(res, 401, checkTokenRes.error, 'Email verification token not valid', checkTokenRes.message);
    }

    const email = checkTokenRes.email;

    const userRes = await getUserFromKeycloak(email, null);
    if (!userRes.success || !userRes.user?.id)
      return sendError(res, 500, 'USER_NOT_FOUND', 'Error retrieving user info', userRes.message);

    const { emailVerified } = userRes.user;

    const tokenRes = await getAdminToken();
    if (!tokenRes.success)
      return sendError(res, 500, tokenRes.error, 'Unable to retrieve admin token', tokenRes.message);

    if(!emailVerified){
      await axios.put(
        `${KC_HOSTNAME}/admin/realms/${KC_REALM}/users/${userRes.user?.id}`,
        {
          emailVerified: true
        },
        {
          headers: {
            Authorization: `Bearer ${tokenRes.token}`,
            'Content-Type': 'application/json'
          }
        }
      );
    }

    await axios.put(`${KC_HOSTNAME}/admin/realms/${KC_REALM}/users/${userRes.user?.id}`, {
      requiredActions: userRes.user.requiredActions.filter(
        action => action !== 'VERIFY_EMAIL'
      ),
    }, {
      headers: { Authorization: `Bearer ${tokenRes.token}` }
    });

    return sendSuccess(res, 'verify_email_success', {
      email
    });
  } catch (err) {
    return sendError(res, 502, 'ERROR_VERIFY_EMAIL', 'Verify email failed', err?.response?.data || err.message );
  }
});

module.exports = router;
