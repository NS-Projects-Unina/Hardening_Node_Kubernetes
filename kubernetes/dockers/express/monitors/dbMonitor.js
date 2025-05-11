const EventEmitter = require('events');
const { prisma } = require('../prisma/prisma.js');

const intervalSec = parseInt(process.env.DB_MONITOR_INTERVAL_SEC || '30', 10);
const intervalMs = isNaN(intervalSec) ? 30000 : intervalSec * 1000;

class DBMonitor extends EventEmitter {
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
      if (req.path === '/health-db') return next();
      if (!this.isHealthy()) {
        return res
          .status(503)
          .json({ error: 'Server has closed the connection.' });
      }

      next();
    };
  }

  async runCheck() {
    try {
      await prisma.$queryRawUnsafe('SELECT 1');
      if (!this.healthy) {
        console.log('DB Online');
      }
      this.emit('statusChange', true);
      this.healthy = true;
    } catch (err) {
      if (this.healthy) {
        console.error('DB Offline');
      }
      this.emit('statusChange', false);
      this.healthy = false;
    }
  }
}

module.exports = DBMonitor;
