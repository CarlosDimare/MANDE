
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { AppConfig, ModelId } from "../types";

// Helper to get client using the injected environment key
const getClient = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

// Helper for exponential backoff delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// --- TEXT CHAT (STREAMING) ---
export const generateTextStream = async (
  history: { role: string; parts: any[] }[],
  prompt: string,
  config: AppConfig,
  imagePart?: { inlineData: { data: string; mimeType: string } }
) => {
  const ai = getClient();
  
  const mapKeywords = /mapa|ubicaci|dónde|donde|llegar|calle|ruta|ir a|localiza/i;
  const needsMaps = mapKeywords.test(prompt);

  // Seleccionamos gemini-3-flash-preview para tareas de texto básicas por su eficiencia
  let modelName = ModelId.FLASH;

  const tools: any[] = [];
  tools.push({ googleSearch: {} });

  if (needsMaps) {
    tools.push({ googleMaps: {} });
  }

  const modelConfig: any = {
    systemInstruction: config.systemInstruction,
    tools: tools.length > 0 ? tools : undefined,
  };

  const messageParts: any[] = [{ text: prompt }];
  if (imagePart) {
    messageParts.push(imagePart);
  }

  const runChat = async (attempt = 0): Promise<any> => {
    try {
      const chat = ai.chats.create({
        model: modelName,
        config: modelConfig,
        history: history.map(h => ({
          role: h.role,
          parts: h.parts
        }))
      });

      return await chat.sendMessageStream({
        message: messageParts 
      });
    } catch (e: any) {
      // Retry on 429 (Resource Exhausted) or 503 (Service Unavailable)
      const isQuotaError = e.status === 429 || e.code === 429 || e.message?.includes('429') || e.message?.includes('quota');
      const isServiceError = e.status === 503 || e.message?.includes('503');
      
      if ((isQuotaError || isServiceError) && attempt < 4) {
        const backoffTime = 2000 * Math.pow(2, attempt); // Stronger backoff starting at 2s
        console.warn(`Gemini API Error (Attempt ${attempt + 1}). Retrying in ${backoffTime/1000}s...`);
        await delay(backoffTime);
        return runChat(attempt + 1);
      }
      throw e;
    }
  };

  return runChat();
};

// --- IMAGE GENERATION ---
export const generateImage = async (prompt: string, config: AppConfig) => {
  const ai = getClient();
  const runGen = async (attempt = 0): Promise<any> => {
      try {
        return await ai.models.generateContent({
            model: ModelId.IMAGE_FLASH, 
            contents: { parts: [{ text: prompt }] },
            config: {
              imageConfig: {
                  aspectRatio: config.aspectRatio,
              }
            }
        });
      } catch (e: any) {
         if ((e.status === 429 || e.code === 429) && attempt < 4) {
            await delay(2000 * Math.pow(2, attempt));
            return runGen(attempt + 1);
         }
         throw e;
      }
  };
  return runGen();
};

// --- IMAGE EDITING ---
export const editImage = async (prompt: string, base64Image: string, mimeType: string) => {
  const ai = getClient();
  const runEdit = async (attempt = 0): Promise<any> => {
      try {
        return await ai.models.generateContent({
            model: ModelId.IMAGE_FLASH,
            contents: {
              parts: [
                  { inlineData: { data: base64Image, mimeType: mimeType } },
                  { text: prompt }
              ]
            }
        });
      } catch (e: any) {
         if ((e.status === 429 || e.code === 429) && attempt < 4) {
            await delay(2000 * Math.pow(2, attempt));
            return runEdit(attempt + 1);
         }
         throw e;
      }
  };
  return runEdit();
};

// --- NEWS FEED FETCH ---
export const fetchNewsFeed = async (source: string) => {
  const ai = getClient();
  
  const prompt = `
    Actúa como un agregador de noticias RSS. 
    1. Usa Google Search para buscar las noticias más recientes (últimas 24 horas) específicamente del medio: "${source}".
    2. Selecciona las 10 noticias más relevantes.
    3. Devuelve OBLIGATORIAMENTE un array JSON puro (sin bloques de código markdown, solo el raw json) con este formato para cada noticia:
    [
      {
        "title": "Titular exacto",
        "snippet": "Resumen breve de 1 o 2 frases",
        "url": "Enlace a la noticia",
        "source": "${source}",
        "date": "Hora o fecha aproximada"
      }
    ]
  `;

  const runFetch = async (attempt = 0): Promise<any> => {
    try {
      const response = await ai.models.generateContent({
        model: ModelId.FLASH, // Use Flash for agentic search tasks
        contents: { parts: [{ text: prompt }] },
        config: {
          tools: [{ googleSearch: {} }],
          responseMimeType: "application/json"
        }
      });

      const text = response.text || "[]";
      const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
      return JSON.parse(cleanText);
    } catch (e: any) {
      if ((e.status === 429 || e.code === 429) && attempt < 4) {
        await delay(2000 * Math.pow(2, attempt));
        return runFetch(attempt + 1);
      }
      console.error("News Fetch Error:", e);
      return [];
    }
  };

  return runFetch();
};

// --- TEXT TO SPEECH ---
export const generateSpeech = async (text: string) => {
  const ai = getClient();
  const runSpeech = async (attempt = 0): Promise<any> => {
    try {
      const response = await ai.models.generateContent({
        model: ModelId.TTS,
        contents: [{ parts: [{ text }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Fenrir' },
            },
          },
        },
      });
      return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    } catch (e: any) {
      if ((e.status === 429 || e.code === 429) && attempt < 4) {
        await delay(2000 * Math.pow(2, attempt));
        return runSpeech(attempt + 1);
      }
      return null;
    }
  };
  return runSpeech();
};
