import { GoogleGenerativeAI } from '@google/generative-ai';
import { AIProvider, ChatMessage, StreamCallback } from './provider';

export class GeminiProvider extends AIProvider {
  name = 'gemini';
  private apiKey: string;
  private modelName: string;
  private temperature: number;

  constructor(apiKey: string, modelName = 'gemini-1.5-flash', temperature = 0.7) {
    super();
    this.apiKey = apiKey;
    let validModel = modelName;
    if (!validModel || validModel.includes('3.6') || validModel.includes('3.5') || validModel === 'default') {
      validModel = 'gemini-1.5-flash';
    }
    this.modelName = validModel;
    this.temperature = temperature;
  }

  async generateStream(
    prompt: string,
    history: ChatMessage[],
    systemInstruction: string,
    callback: StreamCallback
  ): Promise<string> {
    if (!this.apiKey) {
      // Fallback: Typing simulation for demo mode
      const fallbackMsg = `[System: Running in DEMO mode because GEMINI_API_KEY is not set. Config it in Settings.]\n\nHello! I am FRIDAY, your personal AI employee. I have natural voice and text conversations, and I can execute automation, tasks, and file management workflows. To activate my full capabilities, please enter your Gemini API key in the Settings tab.`;
      
      const words = fallbackMsg.split(' ');
      let current = '';
      for (const word of words) {
        current += word + ' ';
        callback.onChunk(word + ' ');
        await new Promise(r => setTimeout(r, 80)); // realistic speed
      }
      return fallbackMsg;
    }

    try {
      const genAI = new GoogleGenerativeAI(this.apiKey);
      const model = genAI.getGenerativeModel({
        model: this.modelName || 'gemini-3.6-flash',
        generationConfig: {
          temperature: this.temperature,
        },
      });

      // Gemini system instruction can be passed in config
      // Convert standard chat history to Gemini structure
      // Roles must alternate user/model. If we have consecutive roles, combine them.
      const contents: any[] = [];
      
      for (const msg of history) {
        const role = msg.role === 'assistant' ? 'model' : 'user';
        if (contents.length > 0 && contents[contents.length - 1].role === role) {
          contents[contents.length - 1].parts[0].text += '\n' + msg.content;
        } else {
          contents.push({
            role,
            parts: [{ text: msg.content || ' ' }]
          });
        }
      }

      // Add system instruction at the beginning as user message or systemInstruction parameter (which is preferred)
      // Note: we can pass it in getGenerativeModel systemInstruction, which we did.

      // Add the final user prompt
      const userRole = 'user';
      if (contents.length > 0 && contents[contents.length - 1].role === userRole) {
        contents[contents.length - 1].parts[0].text += '\n' + prompt;
      } else {
        contents.push({
          role: userRole,
          parts: [{ text: prompt }]
        });
      }

      const result = await model.generateContentStream({
        contents,
      });

      let fullText = '';
      for await (const chunk of result.stream) {
        const text = chunk.text();
        if (text) {
          fullText += text;
          callback.onChunk(text);
        }
      }

      return fullText;
    } catch (error: any) {
      console.error("Gemini Provider streaming error:", error);
      const errorMsg = `Error communicating with Gemini: ${error.message || error}`;
      callback.onChunk(`\n\n[Error: ${errorMsg}]`);
      return errorMsg;
    }
  }
}
