export type Usage = { input: number; output: number };
export type StopReason = "stop" | "length" | "toolUse";


export type TextBlock = {type:"text", text:string};
export type ToolCallBlock = {type:"toolCall", id:string, name:string, arguments:Record<string, unknown>};
export type ContentBlock = TextBlock|ToolCallBlock;

export type UserMessage = { role: "user"; content: string };
export type AssistantMessage = {
  role: "assistant";
  content:ContentBlock[],
  usage: Usage;
  stopReason: StopReason;
};

export type ToolResultMessage = {role:"toolResult",toolCallId:string, toolName:string, content:string, isError:boolean}

export type Message = UserMessage | AssistantMessage | ToolResultMessage;

export type ToolSpec = {name:string, description:string, parameters:Record<string,unknown>}
export type Tool = ToolSpec & {execute(args:Record<string,unknown>):Promise<string>}

export type StreamEvent =
  | { type: "text_delta"; delta: string }
  | { type: "done"; message: AssistantMessage };

export type StreamOptions = {
  messages: Message[];
  model: string;
  system?: string;
  tools?:ToolSpec[]
};

export interface Provider {
  name: string;
  defaultModel: string;
  stream(opts: StreamOptions): AsyncIterable<StreamEvent>;
}
