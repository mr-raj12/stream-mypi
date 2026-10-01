import { resolve } from "node:path";
import type { Tool } from "../types.ts";
import { walk } from "./fsutil.ts";

export const lsTool: Tool = {
  name: "ls",
  description:
    "List files and directories recursively under a path. Skips common noise dirs (.git, node_modules, dist, build) and hidden files by default.",
  parameters: {
    type: "object",
    properties: {
      path: { type: "string", description: "Directory to list, relative to the current folder (default '.')" },
      maxDepth: { type: "number", description: "How many levels deep to recurse (default: unlimited)" },
      includeHidden: { type: "boolean", description: "Include dotfiles/dot-directories (default false)" },
      dirsOnly: { type: "boolean", description: "Only list directories (default false)" },
    },
  },
  async execute(args) {
    const root = resolve(process.cwd(), String(args.path ?? "."));
    const maxDepth = typeof args.maxDepth === "number" ? args.maxDepth : Infinity;
    const includeHidden = Boolean(args.includeHidden);
    const dirsOnly = Boolean(args.dirsOnly);

    const lines: string[] = [];
    let count = 0;
    const LIMIT = 5000;
    for await (const entry of walk(root, { maxDepth, includeHidden })) {
      if (dirsOnly && !entry.isDirectory) continue;
      lines.push(entry.isDirectory ? `${entry.relPath}/` : entry.relPath);
      count++;
      if (count >= LIMIT) {
        lines.push(`[truncated at ${LIMIT} entries]`);
        break;
      }
    }
    if (lines.length === 0) return "(empty)";
    return lines.join("\n");
  },
};
