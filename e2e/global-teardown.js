const fs = require('fs')

const PID_FILE = '/tmp/vespa-e2e-server.pid'

module.exports = async function globalTeardown() {
  if (fs.existsSync(PID_FILE)) {
    try {
      const pid = parseInt(fs.readFileSync(PID_FILE, 'utf-8').trim(), 10)
      process.kill(-pid, 'SIGTERM')
    } catch (e) {
      if (e.code !== 'ESRCH') {
        // ESRCH は「プロセスが既に存在しない」を意味するため無視する
        console.warn('[E2E teardown] プロセス終了中にエラーが発生しました:', e.message)
      }
    }
    fs.unlinkSync(PID_FILE)
    console.log('\nE2Eテスト用サーバーを停止しました')
  }
}
