const { syncUsers } = require('./syncUsers');

class RecoveryManager {
  constructor(dbMonitor, authMonitor) {
    this.dbMonitor = dbMonitor;
    this.authMonitor = authMonitor;
    this.alreadySynced = false;

    this.dbMonitor.on('statusChange', () => this.checkAndSync());
    this.authMonitor.on('statusChange', () => this.checkAndSync());
  }

  async checkAndSync() {

    const dbOk = this.dbMonitor.isHealthy();
    const kcOk = this.authMonitor.isHealthy();

    if (dbOk && kcOk && !this.alreadySynced) {
      this.alreadySynced = true;
      await syncUsers();
    }

    if (!dbOk || !kcOk) {
      this.alreadySynced = false;
    }
  }
}

module.exports = RecoveryManager;