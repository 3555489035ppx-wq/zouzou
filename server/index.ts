import 'dotenv/config'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import { getAIProviderConfig, sanitizeTripRequest, understandTripWithProvider } from './trip-intent'
import { analyzeTripMediaWithProvider, getVisionProviderConfig, sanitizeTripMediaRequest } from './trip-vision'
import { getGuideStats, inferGuideCity, searchTravelGuides } from './travel-guides'

const DEFAULT_PORT = 8787
const MAX_BODY_BYTES = 1_000_000
const MAX_MEDIA_BODY_BYTES = 24_000_000

class HttpError extends Error {
  constructor(public readonly statusCode: number, message: string) {
    super(message)
  }
}

function setCorsHeaders(response: ServerResponse, request: IncomingMessage) {
  const configuredOrigins = (process.env.CORS_ORIGIN ?? '').split(',').map((origin) => origin.trim()).filter(Boolean)
  const requestOrigin = request.headers.origin
  if (configuredOrigins.length === 0) response.setHeader('Access-Control-Allow-Origin', '*')
  else if (requestOrigin && configuredOrigins.includes(requestOrigin)) response.setHeader('Access-Control-Allow-Origin', requestOrigin)
  response.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  response.setHeader('Vary', 'Origin')
}

function setSecurityHeaders(response: ServerResponse) {
  response.setHeader('X-Content-Type-Options', 'nosniff')
  response.setHeader('X-Frame-Options', 'SAMEORIGIN')
  response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.setHeader('Permissions-Policy', 'geolocation=(self), camera=(), microphone=()')
  response.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'self'; base-uri 'none'")
  response.setHeader('Cache-Control', 'no-store')
}

function sendJson(response: ServerResponse, statusCode: number, payload: unknown) {
  response.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' })
  response.end(JSON.stringify(payload))
}

async function readJson(request: IncomingMessage, maxBytes = MAX_BODY_BYTES): Promise<unknown> {
  const chunks: Buffer[] = []
  let totalBytes = 0
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    totalBytes += buffer.byteLength
    if (totalBytes > maxBytes) throw new HttpError(413, `请求体不能超过 ${Math.round(maxBytes / 1_000_000)} MB。`)
    chunks.push(buffer)
  }

  if (chunks.length === 0) throw new HttpError(400, '请求体不能为空。')
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    throw new HttpError(400, '请求体必须是有效 JSON。')
  }
}

export async function handleRequest(request: IncomingMessage, response: ServerResponse) {
  setSecurityHeaders(response)
  setCorsHeaders(response, request)

  if (request.method === 'OPTIONS') {
    response.writeHead(204)
    response.end()
    return
  }

  if (request.method === 'GET' && request.url === '/api/health') {
    const providerConfig = getAIProviderConfig()
    const visionConfig = getVisionProviderConfig()
    sendJson(response, 200, {
      ok: true,
      service: 'zouzou-trip-intent',
      provider: providerConfig.provider,
      configured: providerConfig.configured,
      model: providerConfig.model,
      visionProvider: visionConfig.provider,
      visionConfigured: visionConfig.configured,
      visionModel: visionConfig.model,
      guideKnowledgeBase: getGuideStats(),
    })
    return
  }

  if (request.method === 'GET' && request.url?.startsWith('/api/guides')) {
    try {
      const url = new URL(request.url, `http://${request.headers.host ?? '127.0.0.1'}`)
      const query = url.searchParams.get('q')?.trim() || ''
      const city = url.searchParams.get('city')?.trim() || inferGuideCity(query)
      const limit = Number(url.searchParams.get('limit') || 8)
      sendJson(response, 200, searchTravelGuides(city, query, Number.isFinite(limit) ? limit : 8))
    } catch {
      sendJson(response, 400, { error: 'GUIDE_QUERY_FAILED', message: '攻略查询参数无效。' })
    }
    return
  }

  if (request.method === 'POST' && request.url === '/api/trips/understand') {
    try {
      const body = await readJson(request)
      const tripRequest = sanitizeTripRequest(body)
      const understanding = await understandTripWithProvider(tripRequest)
      sendJson(response, 200, understanding)
    } catch (error) {
      const statusCode = error instanceof HttpError ? error.statusCode : 502
      const message = error instanceof Error ? error.message : '文本理解服务暂时不可用。'
      sendJson(response, statusCode, { error: 'TRIP_INTENT_FAILED', message })
    }
    return
  }

  if (request.method === 'POST' && request.url === '/api/trips/media/analyze') {
    try {
      const body = await readJson(request, MAX_MEDIA_BODY_BYTES)
      const mediaRequest = sanitizeTripMediaRequest(body)
      const result = await analyzeTripMediaWithProvider(mediaRequest)
      sendJson(response, 200, result)
    } catch (error) {
      const statusCode = error instanceof HttpError ? error.statusCode : 400
      const message = error instanceof Error ? error.message : '截图识别请求无效。'
      sendJson(response, statusCode, { error: 'TRIP_MEDIA_FAILED', message })
    }
    return
  }

  sendJson(response, 404, { error: 'NOT_FOUND', message: '接口不存在。' })
}

export function createAppServer() {
  return createServer((request, response) => {
    void handleRequest(request, response)
  })
}

const server = createAppServer()
const isMainModule = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (isMainModule) {
  const port = Number(process.env.PORT ?? DEFAULT_PORT)
  server.listen(Number.isFinite(port) ? port : DEFAULT_PORT, '127.0.0.1', () => {
    console.log(`[zouzou] trip intent API listening on http://127.0.0.1:${Number.isFinite(port) ? port : DEFAULT_PORT}`)
    const providerConfig = getAIProviderConfig()
    console.log(`[zouzou] AI provider: ${providerConfig.configured ? `${providerConfig.provider} / ${providerConfig.model}` : 'local fallback'}`)
  })
}
