import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    status: 'healthy',
    service: 'destinations-ai',
    timestamp: new Date().toISOString(),
  });
}
