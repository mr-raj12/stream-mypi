import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import Anthropic from "@anthropic-ai/sdk"
import { parseArgs } from "node:util";
import { getProvider } from "./providers/index.ts";
import type { AssistantMessage, Message } from "./types.ts";
import { readTool } from "./tools/read.ts";

// load the .env next to the code, so mypi works from any folder
config({ path: fileURLToPath(new URL("../.env", import.meta.url)), quiet: true });
const tools = [readTool]

const {values} = parseArgs({
    options:{
        prompt: {type:"string", short:"p"},
        provider:{type:"string", default:"groq"},
        model:{type:"string"}
    }
})

if(!values.prompt){
    console.error(`no prompt sirr, mypi -p "prompt" --provider anthropic OR groq `);
    process.exit(1);
}


const provider = getProvider(values.provider);
const model= values.model ?? provider.defaultModel;
const messages:Message[]=[{role:"user", content:values.prompt}]

async function callModel(): Promise<AssistantMessage> {
  for await (const event of provider.stream({ messages, model,tools })) {
    if (event.type === "text_delta") process.stdout.write(event.delta);
    else {
      const { usage, stopReason } = event.message;
      console.log(
        `\n\n  ${provider.name} ... ${model} ... ${usage.input} ... ${usage.output} ... ${stopReason}`,
      );
      
    return event.message;
    }
  }
  throw new Error("stream ended without a done event");
}


const first = await callModel();
messages.push(first);
// console.log(`####### ${first.stopReason}`);

if (first.stopReason === "toolUse") {
  for (const block of first.content) {
    if (block.type !== "toolCall") continue;
    console.log(`-> ${block.name}(${JSON.stringify(block.arguments)})`);
    const result = await readTool.execute(block.arguments);
    messages.push({ role: "toolResult", toolCallId: block.id, toolName: block.name, content: result, isError: false });
  }
  // round 2: the model sees the tool result and answers
  messages.push(await callModel());
}

// for await(const event of provider.stream({messages,model})){
//     if(event.type==="text_delta") process.stdout.write(event.delta);
//     else {
//         const {usage, stopReason}= event.message;
//         console.log(`\n\n  ${provider.name} ... ${model} ... ${usage.input} ... ${usage.output} ... ${stopReason}`)
//     }
// }




// const client = new Anthropic();

// const stream = client.messages.stream({
//   max_tokens: 1024,
//   messages: [{ content: values.prompt, role: "user" }],
//   model: values.model
// });

// for await ( const event of stream){
//     if(event.type==="content_block_delta" && event.delta.type==="text_delta"){
//         process.stdout.write(event.delta.text);
//     }
// }

// const final= await stream.finalMessage();
// console.log(final);
// console.log(final.usage.input_tokens)
// console.log(final.usage.output_tokens)
// console.log(final.stop_reason)

