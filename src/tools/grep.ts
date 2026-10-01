import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { Tool } from "../types.ts";
import { walk } from "./fsutil.ts";

const MAX_MATCHES = 500;
const MAX_FILE_BYTES = 5 * 1024 * 1024; // skip files bigger than 5MB

export const grepTool: Tool = {
  name: "grep",
  description:
    "Search for a regex pattern inside files under a directory (recursively). Returns matching file:line:text, like grep -rn.",
  parameters: {
    type: "object",
    properties: {
      pattern: { type: "string", description: "Regex pattern to search for" },
      path: { type: "string", description: "Directory or file to search in, relative to the current folder (default '.')" },
      glob: { type: "string", description: "Only search files whose relative path matches this glob, e.g. '**/*.ts'" },
      ignoreCase: { type: "boolean", description: "Case-insensitive search (default false)" },
      maxMatches: { type: "number", description: `Max number of matches to return (default ${MAX_MATCHES})` },
    },
    required: ["pattern"],
  },
  async execute(args) {
    const root = resolve(process.cwd(), String(args.path ?? "."));
    const patternStr = String(args.pattern);
    const ignoreCase = Boolean(args.ignoreCase);
    const maxMatches = typeof args.maxMatches === "number" ? args.maxMatches : MAX_MATCHES;
    const globPattern = args.glob ? String(args.glob) : undefined;

    let globRe: RegExp | undefined;
    if (globPattern) {
      const { globToRegExp } = await import("./fsutil.ts");
      globRe = globToRegExp(globPattern);
    }

    let re: RegExp;
    try {
      re = new RegExp(patternStr, ignoreCase ? "i" : "");
    } catch (e) {
      return `invalid regex: ${e instanceof Error ? e.message : String(e)}`;
    }

    const results: string[] = [];
    let matchCount = 0;

    outer: for await (const entry of walk(root)) {
      if (entry.isDirectory) continue;
      if (globRe && !globRe.test(entry.relPath)) continue;

      let content: string;
      try {
        const buf = await readFile(entry.absPath);
        if (buf.length > MAX_FILE_BYTES) continue;
        if (buf.includes(0)) continue; // skip binary files
        content = buf.toString("utf8");
      } catch {
        continue;
      }

      const lines = content.split("\n");
      for (let i = 0; i < lines.length; i++) {
        if (re.test(lines[i])) {
          results.push(`${entry.relPath}:${i + 1}:${lines[i]}`);
          matchCount++;
          if (matchCount >= maxMatches) {
            results.push(`[truncated at ${maxMatches} matches]`);
            break outer;
          }
        }
      }
    }

    if (results.length === 0) return "(no matches)";
    return results.join("\n");
  },
};
