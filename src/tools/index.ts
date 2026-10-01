import { Tool } from "../types.ts"
import { bashTool } from "./bash.ts"
import { readTool } from "./read.ts"

export const tools:Tool[]=[bashTool,readTool]