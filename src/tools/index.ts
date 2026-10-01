import { Tool } from "../types.ts";
import { bashTool } from "./bash.ts";
import { readTool } from "./read.ts";
import { lsTool } from "./ls.ts";
import { grepTool } from "./grep.ts";
import { statTool } from "./stat.ts";
import { findTool } from "./find.ts";

export const tools: Tool[] = [bashTool, readTool, lsTool, grepTool, statTool, findTool];
