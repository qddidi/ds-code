import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import type { AddressInfo } from 'node:net'

export interface MockApiRequest {
  method: string
  url: string
  body: unknown
  headers: IncomingMessage['headers']
}

export interface MockApiServer {
  baseUrl: string
  requests: MockApiRequest[]
  close: () => Promise<void>
}

export async function createMockApiServer(responses: unknown[]): Promise<MockApiServer> {
  const requests: MockApiRequest[] = []
  let responseIndex = 0

  const server = createServer(async (req, res) => {
    const bodyText = await readBody(req)
    requests.push({
      method: req.method ?? 'GET',
      url: req.url ?? '/',
      body: bodyText ? JSON.parse(bodyText) : null,
      headers: req.headers,
    })

    const response = responses[Math.min(responseIndex, responses.length - 1)] ?? {}
    responseIndex++
    sendJson(res, response)
  })

  await listen(server)

  const address = server.address() as AddressInfo
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    requests,
    close: () => close(server),
  }
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = ''
    req.setEncoding('utf-8')
    req.on('data', (chunk: string) => {
      body += chunk
    })
    req.on('end', () => resolve(body))
    req.on('error', reject)
  })
}

function sendJson(res: ServerResponse, body: unknown): void {
  res.writeHead(200, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(body))
}

function listen(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => resolve())
  })
}

function close(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((err) => {
      if (err) reject(err)
      else resolve()
    })
  })
}
