import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import Anthropic from "@anthropic-ai/sdk"
import { parseArgs } from "node:util";


// load the .env next to the code, so mypi works from any folder
config({ path: fileURLToPath(new URL("../.env", import.meta.url)), quiet: true });


const {values} = parseArgs({
    options:{
        prompt: {type:"string", short:"p"},
        model:{type:"string", default:"claude-sonnet-5"}
    }
})

if(!values.prompt){
    console.error("no prompt sirr");
    process.exit(1);
}

const client = new Anthropic();

const stream = client.messages.stream({
  max_tokens: 1024,
  messages: [{ content: values.prompt, role: "user" }],
  model: values.model
});

for await ( const event of stream){
    if(event.type==="content_block_delta" && event.delta.type==="text_delta"){
        process.stdout.write(event.delta.text);
    }
}

const final= await stream.finalMessage();
console.log(final);
console.log(final.usage.input_tokens)
console.log(final.usage.output_tokens)
console.log(final.stop_reason)

