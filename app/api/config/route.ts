import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json({
    vespaUrl: process.env.VESPA_URL ?? 'http://localhost:8081',
    feedUrl: process.env.FEED_URL ?? 'http://localhost:8080',
    configUrl: process.env.CONFIG_URL ?? 'http://localhost:19071',
  })
}
