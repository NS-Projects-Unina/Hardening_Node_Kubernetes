const express = require('express');
const router = express.Router();
const axios = require('axios');
const { prisma } = require('../prisma/prisma');

const verifyToken = require('../middlewares/verifyToken');
const { getAdminToken, getUserFromKeycloak } = require('../libs/auth');
const { sendError, sendSuccess, sendErrorOTP } = require('../libs/helpers');

const { KC_HOSTNAME, KC_REALM } = process.env;

// Edit username
router.post('/edit-username', verifyToken, async (req, res) => {
  const { username } = req.body;
  if (!username) 
    return sendError(res, 400, 'USERNAME_FIELD_EMPTY', 'Username field is required');

  try {

    const userRes = await getUserFromKeycloak(null, req.user?.id);
    if (!userRes.success || !userRes.user?.id)
      return sendError(res, 500, userRes.error, 'Error retrieving user info', userRes.message);


    if(username === userRes.user?.username)
      return sendError(res, 400, 'USERNAME_NOT_CHANGED', 'New username is the same as the current one');

    const userId = req.user.sub;

    const tokenRes = await getAdminToken();
    if (!tokenRes.success)
      return sendError(res, 500, tokenRes.error, 'Unable to retrieve admin token', tokenRes.message);

    try {
      await axios.put(`${KC_HOSTNAME}/admin/realms/${KC_REALM}/users/${userId}`, 
        { username },
        {
        headers: {
          Authorization: `Bearer ${tokenRes.token}`,
          'Content-Type': 'application/json'
        }
      });
      return sendSuccess(res, 'Username updated', {username});
    } catch (err) {
      return sendError(res, 500, 'AUTH_USERNAME_UPDATE_FAILED', 'Failed to update username in auth', err.message);
    }

  }catch(err){
    return sendError(res, 502, 'USERNAME_UPDATE_FAILED', 'Failed to update username', err.message);
  }

});

// Edit email
router.post('/edit-email', verifyToken, async (req, res) => {
  const { email } = req.body;
  if (!email) 
    return sendError(res, 400, 'EMAIL_FIELD_EMPTY', 'Email field is required');

  try{

    const userRes = await getUserFromKeycloak(null, req.user?.id);
    if (!userRes.success || !userRes.user?.id)
      return sendError(res, 500, userRes.error, 'Error retrieving user info', userRes.message);

    if(email === userRes.user?.email) 
      return sendError(res, 400, 'EMAIL_NOT_CHANGED', 'New email is the same as the current one');

    const userId = req.user.sub;

    const tokenRes = await getAdminToken();
    if (!tokenRes.success)
      return sendError(res, 500, tokenRes.error, 'Unable to retrieve admin token', tokenRes.message);


    const updatedActions = userRes.user.requiredActions.includes('VERIFY_EMAIL')
      ? userRes.user.requiredActions
      : [...userRes.user.requiredActions, 'VERIFY_EMAIL'];

    try {
      await axios.put(`${KC_HOSTNAME}/admin/realms/${KC_REALM}/users/${userId}`, 
        { email, requiredActions: updatedActions, emailVerified: false },
        {
        headers: {
          Authorization: `Bearer ${tokenRes.token}`,
          'Content-Type': 'application/json'
        }
      });
      return sendSuccess(res, 'Email updated', { email });
    } catch (err) {
      return sendError(res, 500, 'AUTH_EMAIL_UPDATE_FAILED', 'Failed to update email in auth', err.message);
    }

  }catch(err){
    return sendError(res, 502, 'EMAIL_UPDATE_FAILED', 'Failed to update email', err.message);
  }

});

// Configure OTP
router.get('/configure-otp', verifyToken, async (req, res) => {

  try {
    const response = await axios.post(
      `${KC_HOSTNAME}/realms/${KC_REALM}/khode-2fa/totp/setup/${req.user.sub}`,
      {},
      { headers: { Authorization: `Bearer ${req.accessToken}` } }
    );

    return sendSuccess(res, 'configure_otp', {
      qrCode: response.data.qrCode, 
      secret: response.data.secret, 
      expire: response.data.policy.period
    });
  } catch (err) {
    if(err.response.data.code === 4) {
      await prisma.user.update({
        where: { id: req.user.sub },
        data: { otpEnabled: true, updated_at: new Date() }
      });
    }
    return sendErrorOTP(res, err.response.data.code);
  }
});

// Verify OTP
router.post('/verify-otp', verifyToken, async (req, res) => {
  const { code } = req.body;
  if (!code) 
    return sendError(res, 400, 'CODE_FIELD_EMPTY', 'OTP code is required');

  let response;
  try {
    response = await axios.post(
      `${KC_HOSTNAME}/realms/${KC_REALM}/khode-2fa/totp/verify/${req.user.sub}`,
      { code },
      { headers: { Authorization: `Bearer ${req.accessToken}` } }
    );

    await prisma.user.update({
      where: { id: req.user.sub },
      data: { otpEnabled: true, updated_at: new Date() }
    });

    return sendSuccess(res, response.data.message);
  } catch (err) {
    if(err.response.data.code === 6) {
      const userRes = await getUserFromKeycloak(null, req.user.sub);
      if(!userRes.user?.totp){
        await prisma.user.update({
          where: { id: req.user.sub },
          data: { otpEnabled: false, updated_at: new Date() }
        });
      }
    }
    return sendErrorOTP(res, err.response.data.code);
  }
});

// Delete OTP
router.post('/disable-otp', verifyToken, async (req, res) => {
  const { code } = req.body;
  if (!code) 
    return sendError(res, 400, 'CODE_FIELD_EMPTY', 'OTP code is required');

  try {
    const response = await axios.post(
      `${KC_HOSTNAME}/realms/${KC_REALM}/khode-2fa/totp/disable-with-validation/${req.user.sub}`,
      { code },
      { headers: { Authorization: `Bearer ${req.accessToken}` } }
    );

    await prisma.user.update({
      where: { id: req.user.sub },
      data: { otpEnabled: false, updated_at: new Date() }
    });
    return sendSuccess(res, response.data.message);
  } catch (err) {
    return sendErrorOTP(res, err.response.data.code);
  }
});

// Change Password
router.post('/edit-password', verifyToken, async (req, res) => {
  const { password, repeatPassword } = req.body;

  const errorDetails = {};
  if (!password) errorDetails.email = 'Password is required';
  if (!repeatPassword) errorDetails.password = 'Repeat password is required';

  if (Object.keys(errorDetails).length > 0)
    return sendError(res, 400, 'EMPTY_FIELDS', 'Required fields are missing', errorDetails);

  const userId = req.user.sub;

  try {

    const tokenRes = await getAdminToken();
    if (!tokenRes.success)
      return sendError(res, 500, tokenRes.error, 'Unable to retrieve admin token', tokenRes.message);

    await axios.put(
      `${KC_HOSTNAME}/admin/realms/${KC_REALM}/users/${userId}/reset-password`,
      { 
        type: 'password',
        value: password,
        temporary: false
      },
      { headers: { Authorization: `Bearer ${tokenRes.token}` } }
    );
    return sendSuccess(res, 'Password updated');
  } catch (err) {
    return sendError(res, 502, 'PASSWORD_CHANGE_FAILED', 'Failed to change password in auth', err.message);
  }
});

// Get Sessions
router.get('/sessions', verifyToken, async (req, res) => {
  try {
    const tokenRes = await getAdminToken();
    if (!tokenRes.success)
      return sendError(res, 500, tokenRes.error, 'Unable to retrieve admin token', tokenRes.message);

    const sessionsRes = await axios.get(
      `${KC_HOSTNAME}/admin/realms/${KC_REALM}/users/${req.user.sub}/sessions`,
      {
        headers: { Authorization: `Bearer ${tokenRes.token}` }
      }
    );

    const currentSessionId = req.user.sid;

    const filteredSessions = sessionsRes.data.map(session => ({
      sessionId: session.id,
      ipAddress: session.ipAddress,
      start: session.start,
      lastAccess: session.lastAccess,
      rememberMe: session.rememberMe,
      isCurrent: session.id === currentSessionId
    }));

    return sendSuccess(res, 'User sessions retrieved', { sessions: filteredSessions });

  } catch (err) {
    return sendError(res, 502, 'SESSION_RETRIEVAL_FAILED', 'Error retrieving user sessions', err?.message);
  }
});

// Delete Session
router.delete('/delete-session', verifyToken, async (req, res) => {
  const { sessionId } = req.body;

  if(sessionId === req.user.sid)
    return sendError(res, 502, 'CURRENT_SESSION', 'Can not delete current session');

  try{

    const tokenRes = await getAdminToken();
    if (!tokenRes.success)
      return sendError(res, 500, tokenRes.error, 'Unable to retrieve admin token', tokenRes.message);

    await axios.delete(
      `${KC_HOSTNAME}/admin/realms/${KC_REALM}/sessions/${sessionId}`,
      {
        headers: { Authorization: `Bearer ${tokenRes.token}` },
      }
    );

    return sendSuccess(res, 'Session deleted');

  } catch (err) {
    return sendError(res, 502, 'DELETE_SESSION_FAILED', 'Error deleting user session', err?.message);
  }
});


module.exports = router;
