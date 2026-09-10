import { AIProvider, ChatMessage, StreamCallback } from './provider';

export class GroqProvider extends AIProvider {
  name = 'groq';
  private apiKey: string;
  private modelName: string;
  private temperature: number;

  constructor(apiKey: string, modelName = 'groq/compound', temperature = 0.7) {
    super();
    this.apiKey = apiKey;
    let validModel = modelName;
    if (!validModel || validModel.includes('gemini') || validModel.includes('llama-3.3') || validModel.includes('llama-3.1') || validModel === 'default') {
      validModel = 'groq/compound';
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
      const fallbackMsg = `[System: Running in DEMO mode because Groq API Key is not set in Settings.]\n\nHello! Please enter your Groq API key in Settings to activate ultra-fast Groq inference.`;
      const words = fallbackMsg.split(' ');
      for (const word of words) {
        callback.onChunk(word + ' ');
        await new Promise(r => setTimeout(r, 60));
      }
      return fallbackMsg;
    }

    try {
      const messages: { role: string; content: string }[] = [];
      if (systemInstruction) {
        messages.push({ role: 'system', content: systemInstruction });
      }

      for (const msg of history) {
        const role = msg.role === 'assistant' ? 'assistant' : 'user';
        messages.push({ role, content: msg.content || ' ' });
      }

      messages.push({ role: 'user', content: prompt });

      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: this.modelName,
          messages,
          temperature: this.temperature,
          stream: true
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Groq API returned HTTP ${response.status}: ${errText}`);
      }

      if (!response.body) {
        throw new Error('Response body is empty from Groq API');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let fullText = '';
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed === 'data: [DONE]') continue;
          if (trimmed.startsWith('data: ')) {
            try {
              const data = JSON.parse(trimmed.slice(6));
              const chunk = data.choices?.[0]?.delta?.content || '';
              if (chunk) {
                fullText += chunk;
                callback.onChunk(chunk);
              }
            } catch (e) {
              // Ignore partial JSON chunks
            }
          }
        }
      }

      return fullText;
    } catch (error: any) {
      console.error("Groq Provider error:", error);
      const errorMsg = `Error communicating with Groq: ${error.message || error}`;
      callback.onChunk(`\n\n[Error: ${errorMsg}]`);
      return errorMsg;
    }
  }
}
