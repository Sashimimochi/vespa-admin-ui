import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({
    vespaUrl: process.env.VESPA_URL ?? 'http://localhost:8080',
    configUrl: process.env.CONFIG_URL ?? 'http://localhost:19071',
  })
}
