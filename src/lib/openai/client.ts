import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const BRIEFING_MODEL = 'gpt-4o';
export const BRIEFING_TOKENS = 2000;
export const BRIEFING_TEMP = 0.5;

export default openai;
