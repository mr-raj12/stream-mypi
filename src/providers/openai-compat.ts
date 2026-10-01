import OpenAI from "openai";
import type { Provider, StopReason, Usage } from "../types.ts";

export function createOpenAICompat(
name: string,
baseURL: string,
apiKey: string,
defaultModel: string,
): Provider {
const client = new OpenAI({ baseURL, apiKey });
return {
    name,
    defaultModel,
    async *stream({ messages, model, system }) {
    const chat: OpenAI.ChatCompletionMessageParam[] = messages.map((m) => ({
        role: m.role,
        content: m.content,
    }));
    const stream = await client.chat.completions.create({
        model,
        stream: true,
        stream_options: { include_usage: true }, // usage comes in the last chunk
        messages: system
        ? [{ role: "system", content: system }, ...chat]
        : chat,
    });
    let text="";
    let usage:Usage={input:0,output:0};
    let stopReason:StopReason="stop";
    for await(const chunk of stream){
        const choice=chunk.choices[0];
        if(choice?.delta?.content){
            text+=choice.delta.content;
            yield{ type:"text_delta",delta:choice.delta.content}
        }
        if(choice?.finish_reason==="length") stopReason="length";
        if(chunk.usage){
            usage={input:chunk.usage.prompt_tokens, output:chunk.usage.completion_tokens}
        }
    }
    yield {type:"done", message:{role:"assistant", content:text,usage, stopReason}}
    },
};
}
