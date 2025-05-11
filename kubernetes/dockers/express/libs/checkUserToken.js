const jwt =  require('jsonwebtoken');
const  jwksClient = require('jwks-rsa');

const { KC_HOSTNAME, KC_REALM } = process.env;

const client = jwksClient({
  jwksUri: `${KC_HOSTNAME}/realms/${KC_REALM}/protocol/openid-connect/certs`
});

function getKey(header, callback) {
    client.getSigningKey(header.kid, (err, key) => {
      if (err || !key) {
        return callback(err);
      }
  
      const signingKey = key.getPublicKey?.() || key.rsaPublicKey;
      if (!signingKey) {
        return callback(new Error('Public Key not found'));
      }
  
      callback(null, signingKey);
    });
  }

  async function getUserFromToken(tokenInput) {
    if (!tokenInput) return null;
    const token = tokenInput.startsWith('Bearer ')
      ? tokenInput.replace('Bearer ', '')
      : tokenInput;
  
    return new Promise((resolve) => {
      jwt.verify(
        token,
        getKey,
        (err, decoded) => {
          if (err) {
            return resolve(err);
          }
          resolve(decoded);
        }
      );
    });
  }
  

module.exports = {
    getUserFromToken
};
