import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({
    vespaUrl: process.env.VESPA_URL ?? '',
    feedUrl: process.env.FEED_URL ?? '',
    configUrl: process.env.CONFIG_URL ?? '',
  })
}
