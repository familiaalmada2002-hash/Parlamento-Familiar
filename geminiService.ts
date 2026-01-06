import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const geminiAssistant = {
  async summarizeAsamblea(text: string) {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Eres el secretario digital del Parlamento Familiar. Tu función es resumir de forma profesional, jurídica y clara los puntos tratados en esta sesión parlamentaria soberana: ${text}`,
    });
    return response.text;
  },

  async evaluateProposal(proposal: string) {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: `Como asesor jurídico del Parlamento Familiar, evalúa la viabilidad institucional de la siguiente propuesta legislativa y sugiere mejoras siguiendo el Estatuto Supremo: ${proposal}`,
    });
    return response.text;
  }
};