export interface StreamCallback {
  onChunk: (text: string) => void;
  onToolCall?: (toolName: string, args: any) => void;
}

export interface ChatMessage {
  role: string;
  content: string;
}

export abstract class AIProvider {
  abstract name: string;
  abstract generateStream(
    prompt: string, 
    history: ChatMessage[], 
    systemInstruction: string, 
    callback: StreamCallback
  ): Promise<string>;
}
