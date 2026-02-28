const { spawn } = require('child_process')
const http = require('http')
const fs = require('fs')

const PORT = 3001
const BASE_URL = `http://localhost:${PORT}`
const PID_FILE = '/tmp/vespa-e2e-server.pid'

function waitForServer(url, timeout = 60000) {
  return new Promise((resolve, reject) => {
    const start = Date.now()
    const check = () => {
      http
        .get(url, () => {
          resolve()
        })
        .on('error', () => {
          if (Date.now() - start > timeout) {
            reject(new Error(`サーバーが ${timeout}ms 以内に起動しませんでした`))
          } else {
            setTimeout(check, 1000)
          }
        })
    }
    check()
  })
}

module.exports = async function globalSetup() {
  const server = spawn('npx', ['next', 'dev', '--port', String(PORT)], {
    cwd: process.cwd(),
    stdio: 'pipe',
    detached: true,
  })

  if (server.pid) {
    fs.writeFileSync(PID_FILE, String(server.pid))
  }

  process.env.E2E_BASE_URL = BASE_URL

  console.log(`\nE2Eテスト用サーバーを起動中... (port ${PORT})`)
  await waitForServer(BASE_URL)
  console.log(`E2Eテスト用サーバーが起動しました: ${BASE_URL}`)
}
