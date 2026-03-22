// Destinations AI — Veo 3.1 Video Generation
// Google Veo models for property walkthrough and neighborhood flyover videos
//
// Supported models:
// - veo-3.1-fast-generate-001  (fast, ~$0.15/sec)
// - veo-3.1-generate-001       (quality, ~$0.40/sec)
// - veo-3.0-generate-001       (legacy)
//
// Auth: x-goog-api-key header (same GEMINI_API_KEY)
// Pattern: submit → poll → inline base64 video

import { getGeminiApiKey } from './gemini';
import type { VideoRequest, VideoResult } from './types';

const BASE_URL = 'https://generativelanguage.googleapis.com';
const DEFAULT_MODEL = 'veo-3.1-generate-001';
const POLL_INTERVAL_MS = 10_000;
const MAX_POLL_ATTEMPTS = 60; // 10 min max

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function apiHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'x-goog-api-key': getGeminiApiKey(),
  };
}

interface VeoOperation {
  name: string;
  done?: boolean;
  response?: {
    videos?: Array<{
      bytesBase64Encoded?: string;
      mimeType?: string;
    }>;
  };
  error?: { code: number; message: string; status: string };
}

// ── Submit ──

async function submitGeneration(
  model: string,
  prompt: string,
  aspectRatio?: string,
  duration?: number,
): Promise<VeoOperation> {
  const url = `${BASE_URL}/v1beta/models/${model}:predictLongRunning`;

  const body: Record<string, unknown> = {
    instances: [{ prompt }],
  };

  const parameters: Record<string, unknown> = {};
  if (aspectRatio) parameters.aspectRatio = aspectRatio;
  if (duration) parameters.durationSeconds = duration;
  if (Object.keys(parameters).length > 0) body.parameters = parameters;

  const res = await fetch(url, {
    method: 'POST',
    headers: apiHeaders(),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Veo submit failed (${res.status}): ${text}`);
  }

  return res.json() as Promise<VeoOperation>;
}

// ── Poll ──

async function pollOperation(
  model: string,
  operationName: string,
): Promise<VeoOperation> {
  const url = `${BASE_URL}/v1beta/models/${model}:fetchPredictOperation`;

  const res = await fetch(url, {
    method: 'POST',
    headers: apiHeaders(),
    body: JSON.stringify({ operationName }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Veo poll failed (${res.status}): ${text}`);
  }

  return res.json() as Promise<VeoOperation>;
}

// ── Public API ──

export async function generateVideo(request: VideoRequest): Promise<VideoResult> {
  const model = request.model ?? DEFAULT_MODEL;

  // 1. Submit
  const operation = await submitGeneration(
    model,
    request.prompt,
    request.aspectRatio,
    request.duration,
  );

  if (!operation.name) {
    throw new Error('Veo returned operation without name');
  }

  // 2. Poll until done
  let current = operation;
  let pollCount = 0;
  while (!current.done) {
    if (pollCount >= MAX_POLL_ATTEMPTS) {
      throw new Error('Video generation timed out (10 min)');
    }
    await delay(POLL_INTERVAL_MS);
    current = await pollOperation(model, current.name);
    pollCount++;
  }

  // 3. Check for errors
  if (current.error) {
    throw new Error(`Veo failed: ${current.error.code} — ${current.error.message}`);
  }

  // 4. Extract inline base64 video
  const videos = current.response?.videos;
  if (!videos || videos.length === 0) {
    throw new Error('Veo returned no generated videos');
  }

  const first = videos[0];
  if (!first.bytesBase64Encoded) {
    throw new Error('Veo returned video entry without data');
  }

  const mimeType = first.mimeType || 'video/mp4';

  return {
    videoBase64: first.bytesBase64Encoded,
    mimeType,
    model,
    durationSeconds: request.duration ?? 8,
  };
}

/** Test connectivity — validates API key with a lightweight models list call */
export async function testVeoConnectivity(): Promise<{
  ok: boolean;
  message: string;
}> {
  try {
    const res = await fetch(`${BASE_URL}/v1beta/models?key=${getGeminiApiKey()}`, {
      method: 'GET',
    });
    if (res.ok) return { ok: true, message: 'Connected to Veo' };
    return { ok: false, message: `Veo auth failed (${res.status})` };
  } catch (err) {
    return {
      ok: false,
      message: `Network error: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}
