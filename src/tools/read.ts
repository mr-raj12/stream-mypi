import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { Tool } from "../types.ts";

export const readTool: Tool = {
  name: "read",
  description: "Read a text file and returns its contents",
  parameters: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: "Path to the file, relative to the current folder",
      },
    },
    required: ["path"],
  },
  async execute(args) {
    return readFile(resolve(process.cwd(), String(args.path)), "utf8");
  },
};
