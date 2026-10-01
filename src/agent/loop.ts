import type {
  AssistantMessage,
  Message,
  Provider,
  Tool,
  ToolCallBlock,
} from "../types.ts";

export type AgentEvent =
  | { type: "text"; delta: string }
  | { type: "tool_start"; call: ToolCallBlock }
  | { type: "tool_end"; call: ToolCallBlock; result: string; isError: boolean }
  | { type: "turn_end"; message: AssistantMessage }
  | { type: "message"; message: Message };

export type AgentOptions = {
  provider: Provider;
  model: string;
  system?: string;
  tools: Tool[];
  messages: Message[];
  maxTurns?: number;
  onEvent: (event: AgentEvent) => void;
};

export async function runAgent(opts: AgentOptions): Promise<void> {
  const { provider, model, system, tools, messages, onEvent } = opts;
  const maxTurns = opts.maxTurns ?? 20;
  const push = (message: Message) => {
    messages.push(message);
    onEvent({ type: "message", message });
  };
  
  for(let turn=1; turn<=maxTurns; ++turn){
        let assistant:AssistantMessage|undefined
        for await(const event of provider.stream({messages,model,system,tools})){
            if(event.type==="text_delta") onEvent({type:"text", delta:event.delta})
            else assistant = event.message
        }
        if(!assistant) throw new Error('assistant khali h ')
        push(assistant);
        onEvent({type:"turn_end",message:assistant})

        if(assistant.stopReason!=="toolUse") return;

        for(const call of assistant.content){
            if(call.type!== "toolCall") continue;
            onEvent({type:"tool_start",call});
            let result:string;
            let isError=false;

            try {
                const tool=tools.find((t)=>t.name===call.name);
                if(!tool) throw new Error(`unknown tool name ${tool}`)
                result = await tool.execute(call.arguments)
            } catch (e) {
                result=`Error ${e instanceof Error?e.message:String(e)}`
                isError=true
            }
            onEvent({type:"tool_end",call,result,isError})
            push({role:"toolResult",toolCallId:call.id,toolName:call.name, content:result, isError})
        }
  }
  throw new Error(`stopped after ${maxTurns} khtm`)
}
