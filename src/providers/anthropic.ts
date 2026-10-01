import Anthropic from "@anthropic-ai/sdk";
import type { Provider, StreamOptions, StopReason, Message, ContentBlock } from "../types.ts";


function toAnthropic(messages: Message[]): Anthropic.MessageParam[] {
  return messages.map((m): Anthropic.MessageParam => {
    if (m.role === "user") return { role: "user", content: m.content };
    if (m.role === "assistant") {
      return {
        role: "assistant",
        content: m.content.map((b): Anthropic.ContentBlockParam =>
          b.type === "text"
            ? { type: "text", text: b.text }
            : { type: "tool_use", id: b.id, name: b.name, input: b.arguments },
        ),
      };
    }
    // toolResult -> Anthropic wants it inside a USER message
    return {
      role: "user",
      content: [{ type: "tool_result", tool_use_id: m.toolCallId, content: m.content, is_error: m.isError }],
    };
  });
}

export function createAnthropic(): Provider {
  const client = new Anthropic();
  return {
    name: "anthropic",
    defaultModel: "claude-sonnet-5",
    async *stream({ messages, model, system,tools=[] }) {
      const stream = client.messages.stream({
        model,
        max_tokens: 4096,
        system,
        messages: toAnthropic(messages),
        tools:tools.map((t)=>({
          name:t.name,
          description:t.description,
          input_schema:t.parameters as Anthropic.Tool.InputSchema
        }))
      });
      let text = "";
      const content:ContentBlock[]=[];
      let json="";
      for await (const event of stream) {
        if(event.type==="content_block_start"){
          const b=event.content_block;
          if(b.type==="text") content.push({type:"text",text:""})
          else if(b.type==="tool_use"){
            content.push({type:"toolCall",id:b.id,name:b.name,arguments:{}})
            json=""
          }
        } else if(event.type==="content_block_delta"){
          const block=content.at(-1);
          if(event.delta.type==="text_delta" && block?.type==="text"){
            block.text+=event.delta.text
            yield{type:"text_delta",delta:event.delta.text}
          } else if(event.delta.type==="input_json_delta"){
            json+=event.delta.partial_json
          }
        } else if(event.type==="content_block_stop"){
          const block=content.at(-1);
          if(block?.type==="toolCall") block.arguments=json?JSON.parse(json) :{};
        }
        // if (
        //   event.type === "content_block_delta" &&
        //   event.delta.type === "text_delta"
        // ) {
        //     text+=event.delta.text;
        //     yield{type:"text_delta", delta:event.delta.text};
        // }
      }
      const final= await stream.finalMessage();
      const stopReason:StopReason = 
        final.stop_reason ==="tool_use"? "toolUse": final.stop_reason==="max_tokens"?"length":"stop";
      yield {
        type:"done",
        message:{
            role:"assistant",
            content,
            usage:{input:final.usage.input_tokens,output: final.usage.output_tokens},
            stopReason
        }
      }
    },
  };
}
