import OpenAI from "openai";
import type { ContentBlock, Message, Provider, StopReason, Usage } from "../types.ts";

// our messages -> OpenAI's wire format
function toOpenAI(messages: Message[]): OpenAI.ChatCompletionMessageParam[] {
  return messages.map((m): OpenAI.ChatCompletionMessageParam => {
    if (m.role === "user") return { role: "user", content: m.content };
    if (m.role === "assistant") {
      const text = m.content.filter((b) => b.type === "text").map((b) => b.text).join("");
      const calls = m.content.filter((b) => b.type === "toolCall");
      return {
        role: "assistant",
        content: text || null,
        // OpenAI wants the arguments as a JSON *string*
        tool_calls: calls.length
          ? calls.map((c) => ({
              id: c.id,
              type: "function" as const,
              function: { name: c.name, arguments: JSON.stringify(c.arguments) },
            }))
          : undefined,
      };
    }
    // toolResult -> its own message with role "tool"
    return { role: "tool", tool_call_id: m.toolCallId, content: m.content };
  });
}

// one adapter for every OpenAI-compatible API: only baseURL, key and model change
export function createOpenAICompat(name: string, baseURL: string, apiKey: string | undefined, defaultModel: string): Provider {
  const client = new OpenAI({ baseURL, apiKey });
  return {
    name,
    defaultModel,
    async *stream({ messages, model, system, tools = [] }) {
      const chat = toOpenAI(messages);
      const stream = await client.chat.completions.create({
        model,
        stream: true,
        stream_options: { include_usage: true }, // usage comes in the last chunk
        messages: system ? [{ role: "system", content: system }, ...chat] : chat,
        tools: tools.length
          ? tools.map((t) => ({
              type: "function" as const,
              function: { name: t.name, description: t.description, parameters: t.parameters },
            }))
          : undefined,
      });
      let text = "";
      const calls: { id: string; name: string; args: string }[] = []; // slot = tool_calls[].index
      let usage: Usage = { input: 0, output: 0 };
      let stopReason: StopReason = "stop";
      for await (const chunk of stream) {
        const choice = chunk.choices[0];
        if (choice?.delta?.content) {
          text += choice.delta.content;
          yield { type: "text_delta", delta: choice.delta.content };
        }
        for (const tc of choice?.delta?.tool_calls ?? []) {
          // the first piece of a call brings id + name, later pieces only bring more arguments
          calls[tc.index] ??= { id: tc.id ?? `call_${tc.index}`, name: tc.function?.name ?? "", args: "" };
          calls[tc.index].args += tc.function?.arguments ?? "";
        }
        if (choice?.finish_reason === "tool_calls") stopReason = "toolUse";
        else if (choice?.finish_reason === "length") stopReason = "length";
        if (chunk.usage) usage = { input: chunk.usage.prompt_tokens, output: chunk.usage.completion_tokens };
      }
      const content: ContentBlock[] = text ? [{ type: "text", text }] : [];
      for (const c of calls) {
        if (c) content.push({ type: "toolCall", id: c.id, name: c.name, arguments: c.args ? JSON.parse(c.args) : {} });
      }
      if (content.some((b) => b.type === "toolCall")) stopReason = "toolUse";
      yield { type: "done", message: { role: "assistant", content, usage, stopReason } };
    },
  };
}