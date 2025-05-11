const { getUserFromToken } = require('../libs/checkUserToken');

async function verifyToken(req, res, next) {
  const token = req.cookies?.accessToken || req.headers.authorization;

  const user = await getUserFromToken(token);

  if (!user) {
    return res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Missing or invalid authentication'
      }
    });
  }

  req.user = user;
  req.accessToken = token;
  next();
}

module.exports = verifyToken;
