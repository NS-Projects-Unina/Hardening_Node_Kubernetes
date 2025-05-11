const axios = require('axios');
const jwt = require('jsonwebtoken');

let adminToken = null;

const { 
  KC_HOSTNAME, 
  KC_REALM,
  KC_CLIENT_ID,
  KC_CLIENT_SECRET
} = process.env;

function isTokenExpired(token) {
  const decoded = jwt.decode(token);

  if (!decoded || !decoded.exp) {
    return true;
  }

  const now = Math.floor(Date.now() / 1000);
  return decoded.exp < now;
}

async function getAdminToken() {
  if (adminToken && !isTokenExpired(adminToken)) {
    return { success: true, token: adminToken };
  }

  try {
    const res = await axios.post(
      `${KC_HOSTNAME}/realms/${KC_REALM}/protocol/openid-connect/token`,
      new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: KC_CLIENT_ID,
        client_secret: KC_CLIENT_SECRET,
      }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    adminToken = res.data.access_token;
    return { success: true, token: adminToken };

  } catch (err) {
    console.log(err);
    return {
      success: false,
      error: 'ADMIN_TOKEN_FETCH_FAILED',
      message: 'Internal server error',
    };
  }
}


async function getUserFromKeycloak(email, id) {
  const { success, token, message } = await getAdminToken();
  if (!success) return { success: false, error: 'TOKEN_FETCH_FAILED', message };

  try {
    let res;

    if (email) {
      res = await axios.get(`${KC_HOSTNAME}/admin/realms/${KC_REALM}/users?email=${email}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
    } else {
      res = await axios.get(`${KC_HOSTNAME}/admin/realms/${KC_REALM}/users?id=${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
    }

    return { success: true, user: res.data[0] };
  } catch (err) {
    console.log(err);
    return {
      success: false,
      error: 'USER_LOOKUP_FAILED',
      message: 'User not found in auth',
    };
  }
}


module.exports = {
    getAdminToken,
    getUserFromKeycloak
};