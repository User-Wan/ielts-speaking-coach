import http from 'node:http'
import fs from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()
const port = 43128

http.createServer(async (request, response) => {
  const requestPath = request.url === '/' ? '/demo/dashboard.html' : request.url
  const resolved = path.resolve(root, `.${requestPath.split('?')[0]}`)
  if (!resolved.startsWith(root + path.sep)) {
    response.writeHead(403).end('Forbidden')
    return
  }

  try {
    const body = await fs.readFile(resolved)
    const type = resolved.endsWith('.html') ? 'text/html; charset=utf-8' : 'application/octet-stream'
    response.writeHead(200, { 'Content-Type': type })
    response.end(body)
  } catch {
    response.writeHead(404).end('Not found')
  }
}).listen(port, '127.0.0.1', () => {
  console.log(`Static demo: http://127.0.0.1:${port}/demo/dashboard.html`)
})
