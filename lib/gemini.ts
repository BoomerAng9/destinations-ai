// Destinations AI — Shared Gemini Client
// Single GoogleGenerativeAI instance for NotebookLM, Veo 3.1, and image generation

import { GoogleGenerativeAI } from '@google/generative-ai';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY ?? '';

export const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

export function getGeminiApiKey(): string {
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not set');
  }
  return GEMINI_API_KEY;
}
