import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import Anthropic from "@anthropic-ai/sdk"
import { parseArgs } from "node:util";
import { getProvider } from "./providers/index.ts";
import type { Message } from "./types.ts";

// load the .env next to the code, so mypi works from any folder
config({ path: fileURLToPath(new URL("../.env", import.meta.url)), quiet: true });


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


for await(const event of provider.stream({messages,model})){
    if(event.type==="text_delta") process.stdout.write(event.delta);
    else {
        const {usage, stopReason}= event.message;
        console.log(`\n\n  ${provider.name} ... ${model} ... ${usage.input} ... ${usage.output} ... ${stopReason}`)
    }
}
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

