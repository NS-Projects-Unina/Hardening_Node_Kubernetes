const fs = require('fs');
const { execSync } = require('child_process');
const path = '/mnt/runtime-secrets';

const readSecret = (name) => {
  const fullPath = `${path}/${name}`;
  if (fs.existsSync(fullPath)) {
    const value = fs.readFileSync(fullPath, 'utf8').trim();
    try {
      fs.unlinkSync(fullPath); // ✅ elimina dopo lettura
    } catch (err) {
      console.warn(`[Vault-CSI] Could not delete ${fullPath}:`, err.message);
    }
    return value;
  }
  console.warn(`[Vault-CSI] Secret ${name} not found at ${fullPath}`);
  return null;
};

const secretsMap = {
  MAILGUN_DOMAIN: 'MAILGUN_DOMAIN',
  EMAIL_RESET_SECRET: 'EMAIL_RESET_SECRET',
  MAILGUN_API_KEY: 'MAILGUN_API_KEY',
  EMAIL_VERIFY_SECRET: 'EMAIL_VERIFY_SECRET',
  KC_CLIENT_SECRET: 'KC_CLIENT_SECRET',
  GOOGLE_CLIENT_ID: 'GOOGLE_CLIENT_ID',
  GOOGLE_CLIENT_SECRET: 'GOOGLE_CLIENT_SECRET',
  PASSWORD_SECRET: 'PASSWORD_SECRET',
  KC_HOSTNAME: 'KC_HOSTNAME',
  APP_DB_NAME: 'APP_DB_NAME',
  APP_DB_USER: 'APP_DB_USER',
  APP_DB_PASSWORD: 'APP_DB_PASSWORD',
  KC_CLIENT_ID: 'KC_CLIENT_ID',
  KC_CLIENT_ID_WAN: 'KC_CLIENT_ID_WAN',
  KC_CLIENT_SECRET_WAN: 'KC_CLIENT_SECRET_WAN',
  KC_CLIENT_ID_FED: 'KC_CLIENT_ID_FED',
  KC_CLIENT_SECRET_FED: 'KC_CLIENT_SECRET_FED'
};

Object.entries(secretsMap).forEach(([fileName, envName]) => {
  const value = readSecret(fileName);
  if (value) { 
    process.env[envName] = value;
    //console.log(envName, value);
    }
});

const { APP_DB_HOST, APP_DB_PORT, APP_DB_NAME, APP_DB_USER, APP_DB_PASSWORD } = process.env;

if (APP_DB_HOST && APP_DB_PORT && APP_DB_NAME && APP_DB_USER && APP_DB_PASSWORD) {
  process.env.DB_URL = `postgresql://${APP_DB_USER}:${APP_DB_PASSWORD}@${APP_DB_HOST}:${APP_DB_PORT}/${APP_DB_NAME}`;
  execSync('npx prisma db push', { stdio: 'inherit', env: process.env });
}