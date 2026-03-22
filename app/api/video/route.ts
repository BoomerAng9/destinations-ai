import { NextRequest, NextResponse } from 'next/server';
import { generateVideo, testVeoConnectivity } from '@/lib/veo';
import type { VideoRequest } from '@/lib/types';

export async function POST(req: NextRequest) {
  try {
    const body: VideoRequest = await req.json();

    if (!body.prompt) {
      return NextResponse.json(
        { error: 'Missing required field: prompt' },
        { status: 400 }
      );
    }

    const result = await generateVideo(body);

    return NextResponse.json({
      video: `data:${result.mimeType};base64,${result.videoBase64}`,
      mimeType: result.mimeType,
      model: result.model,
      durationSeconds: result.durationSeconds,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Video generation failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET() {
  const status = await testVeoConnectivity();
  return NextResponse.json(status, { status: status.ok ? 200 : 503 });
}
