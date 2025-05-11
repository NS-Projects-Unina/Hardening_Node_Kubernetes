const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const FormData = require('form-data');
const Mailgun = require('mailgun.js');
const fs = require('fs');
const path = require('path');

const { 
  MAILGUN_API_KEY,
  MAILGUN_DOMAIN,
  EMAIL_RESET_LIMIT_TIME_SEC, 
  EMAIL_RESET_ATTEMPTS, 
} = process.env;

const resetEmailLimiter = rateLimit({
  windowMs: parseInt(EMAIL_RESET_LIMIT_TIME_SEC, 10) * 60 * 1000,
  max: parseInt(EMAIL_RESET_ATTEMPTS, 10),
  keyGenerator: (req) => {
    return req.body.to?.toLowerCase().trim() || req.ip;
  },
  message: 'Too many requests.',
  standardHeaders: true,
  legacyHeaders: false
});

function loadEmailTemplate(filePath, variables) {
  let template = fs.readFileSync(path.join(__dirname, filePath), 'utf-8');
  for (const key in variables) {
    const pattern = new RegExp(`{{${key}}}`, 'g');
    template = template.replace(pattern, variables[key]);
  }
  return template;
}

async function sendMail(to, subject, html) {
  if (!MAILGUN_API_KEY || !MAILGUN_DOMAIN) {
    return {
      success: false,
      error: 'EMAIL_CONFIG_MISSING',
      message: 'Missing MAILGUN_API_KEY or MAILGUN_DOMAIN',
    };
  }

  const mailgun = new Mailgun(FormData);
  const mg = mailgun.client({
    username: 'api',
    key: MAILGUN_API_KEY,
    url: 'https://api.eu.mailgun.net',
  });

  try {
    const data = await mg.messages.create(MAILGUN_DOMAIN, {
      from: `Experiences App <no-reply@${MAILGUN_DOMAIN}>`,
      to: [to],
      subject,
      html,
    });

    return {
      success: true,
      messageId: data.id,
    };
  } catch (err) {
    return {
      success: false,
      error: 'EMAIL_SEND_FAILED',
      message: err.message || 'Unknown error',
    };
  }
}

function generateVerifyToken(email, secret, expireMin) {

  if (!secret || !expireMin) {
    return {
      success: false,
      error: 'MISSING_ENV_VARIABLES',
      message: 'Env variables is not set',
    };
  }

  const expiresIn = `${expireMin}m`;

  try {
    const token = jwt.sign({ email }, secret, { expiresIn });
    return {
      success: true,
      token,
    };
  } catch (err) {
    return {
      success: false,
      error: 'JWT_SIGN_FAILED',
      message: err.message,
    };
  }
}

function checkVerifyToken(token, secret) {
  if (!secret) {
    return {
      success: false,
      error: 'MISSING_ENV_VARIABLES',
      message: 'Env variables is not set',
    };
  }

  try {
    const decoded = jwt.verify(token, secret);
    return {
      success: true,
      email: decoded.email,
    };
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return {
        success: false,
        error: 'TOKEN_EXPIRED',
        message: 'The verification token has expired',
      };
    } else if (err.name === 'JsonWebTokenError') {
      return {
        success: false,
        error: 'INVALID_TOKEN',
        message: 'The verification token is invalid or has been tampered with',
      };
    } else {
      return {
        success: false,
        error: 'TOKEN_VERIFICATION_ERROR',
        message: err.message,
      };
    }
  }
}


module.exports = {
  resetEmailLimiter,
  sendMail,
  loadEmailTemplate,
  generateVerifyToken,
  checkVerifyToken
};