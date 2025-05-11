const EventEmitter = require('events');
const axios = require('axios');

const { KC_MONITOR_INTERVAL_SEC, KC_HOSTNAME, KC_REALM } = process.env;
const intervalSec = parseInt(KC_MONITOR_INTERVAL_SEC || '30', 10);
const intervalMs = isNaN(intervalSec) ? 30000 : intervalSec * 1000;

const KEYCLOAK_HEALTH_URL = `${KC_HOSTNAME}/realms/${KC_REALM}/.well-known/openid-configuration`;

class AUTHMonitor extends EventEmitter {
  constructor(checkIntervalMs = intervalMs) {
    super();
    this.checkIntervalMs = checkIntervalMs;
    this.interval = null;
    this.healthy = false;
  }

  start() {
    this.runCheck();
    this.interval = setInterval(() => this.runCheck(), this.checkIntervalMs);
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  isHealthy() {
    return this.healthy;
  }

  middleware() {
    return (req, res, next) => {
      if (req.path === '/health-keycloak') return next();

      if (!this.isHealthy()) {
        return res.status(503).json({ error: 'Server has closed the connection.' });
      }

      next();
    };
  }

  async runCheck() {
    try {
      await axios.get(KEYCLOAK_HEALTH_URL);
      if (!this.healthy) {
        console.log('AUTH Online');
      }
      this.emit('statusChange', true);
      this.healthy = true;
    } catch (err) {
      if (this.healthy) {
        console.error('AUTH Offline');
      }
      this.emit('statusChange', false);
      this.healthy = false;
    }
  }

}

module.exports = AUTHMonitor;
