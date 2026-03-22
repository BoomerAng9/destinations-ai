// Destinations AI — NotebookLM Client (Gemini API)
// Creates notebooks, adds sources, generates audio overviews
// Uses the NotebookLM API via generativelanguage.googleapis.com
// Auth: x-goog-api-key header (same GEMINI_API_KEY)

import { getGeminiApiKey } from './gemini';
import type { NotebookRequest, NotebookResult, NotebookSource } from './types';

const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';

function apiHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'x-goog-api-key': getGeminiApiKey(),
  };
}

async function notebookFetch(path: string, body: unknown): Promise<Response> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: apiHeaders(),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`NotebookLM API error (${res.status}): ${err}`);
  }

  return res;
}

/** Create a new notebook */
export async function createNotebook(title: string): Promise<string> {
  const res = await notebookFetch('/notebooks', {
    displayName: title,
  });
  const data = await res.json();
  return data.name?.split('/')?.pop() ?? data.notebookId ?? data.id;
}

/** Add text or URL sources to a notebook */
export async function addSources(notebookId: string, sources: NotebookSource[]): Promise<void> {
  const formattedSources = sources.map((s) => {
    if (s.type === 'url') {
      return { sourceType: 'URL', url: s.content, title: s.title };
    }
    return { sourceType: 'TEXT', text: s.content, title: s.title };
  });

  await notebookFetch(`/notebooks/${notebookId}:addSources`, {
    sources: formattedSources,
  });
}

/** Trigger audio overview generation (podcast-style) */
export async function generateAudioOverview(notebookId: string): Promise<string> {
  const res = await notebookFetch(`/notebooks/${notebookId}:generateAudio`, {
    audioFormat: 'AUDIO_OVERVIEW',
  });
  const data = await res.json();

  // The API may return an operation for long-running audio gen
  if (data.name && !data.done) {
    return await pollAudioOperation(data.name);
  }

  return data.audioUrl ?? data.audio?.uri ?? '';
}

/** Poll a long-running audio generation operation */
async function pollAudioOperation(operationName: string): Promise<string> {
  const maxAttempts = 30; // 5 min max (10s intervals)
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((r) => setTimeout(r, 10_000));

    const res = await fetch(`${BASE_URL}/${operationName}`, {
      method: 'GET',
      headers: apiHeaders(),
    });

    if (!res.ok) continue;

    const data = await res.json();
    if (data.done) {
      return data.response?.audioUrl ?? data.response?.audio?.uri ?? '';
    }
    if (data.error) {
      throw new Error(`Audio generation failed: ${data.error.message}`);
    }
  }
  throw new Error('Audio generation timed out');
}

/** Full pipeline: create notebook, add sources, optionally generate audio */
export async function createPropertyNotebook(
  request: NotebookRequest
): Promise<NotebookResult> {
  const notebookId = await createNotebook(
    `Destinations AI — ${request.propertyAddress}`
  );

  await addSources(notebookId, request.sources);

  let audioUrl: string | undefined;
  if (request.generateAudio) {
    audioUrl = await generateAudioOverview(notebookId);
  }

  return {
    notebookId,
    notebookUrl: `https://notebooklm.google.com/notebook/${notebookId}`,
    audioUrl,
    status: audioUrl ? 'ready' : 'created',
  };
}
