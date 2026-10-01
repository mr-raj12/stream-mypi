import { resolve } from "node:path";
import type { Tool } from "../types.ts";
import { globToRegExp, walk } from "./fsutil.ts";

const LIMIT = 2000;

export const findTool: Tool = {
  name: "find",
  description:
    "Find files/directories by name, matching a substring, glob pattern (e.g. '**/*.test.ts') or regex, recursively under a path.",
  parameters: {
    type: "object",
    properties: {
      name: { type: "string", description: "Substring to match against file/directory names" },
      glob: { type: "string", description: "Glob pattern to match against the relative path, e.g. '**/*.ts'" },
      regex: { type: "string", description: "Regex to match against the relative path" },
      path: { type: "string", description: "Directory to search under, relative to the current folder (default '.')" },
      type: { type: "string", description: "Filter by 'file' or 'dir' (default: both)" },
      includeHidden: { type: "boolean", description: "Include dotfiles/dot-directories (default false)" },
    },
  },
  async execute(args) {
    const root = resolve(process.cwd(), String(args.path ?? "."));
    const name = args.name ? String(args.name) : undefined;
    const globPattern = args.glob ? String(args.glob) : undefined;
    const regexPattern = args.regex ? String(args.regex) : undefined;
    const typeFilter = args.type ? String(args.type) : undefined;
    const includeHidden = Boolean(args.includeHidden);

    if (!name && !globPattern && !regexPattern) {
      return "error: provide at least one of 'name', 'glob', or 'regex'";
    }

    let globRe: RegExp | undefined;
    if (globPattern) globRe = globToRegExp(globPattern);
    let regexRe: RegExp | undefined;
    if (regexPattern) {
      try {
        regexRe = new RegExp(regexPattern);
      } catch (e) {
        return `invalid regex: ${e instanceof Error ? e.message : String(e)}`;
      }
    }

    const results: string[] = [];
    for await (const entry of walk(root, { includeHidden })) {
      if (typeFilter === "file" && entry.isDirectory) continue;
      if (typeFilter === "dir" && !entry.isDirectory) continue;

      const baseName = entry.relPath.split("/").pop() ?? entry.relPath;
      if (name && !baseName.toLowerCase().includes(name.toLowerCase())) continue;
      if (globRe && !globRe.test(entry.relPath)) continue;
      if (regexRe && !regexRe.test(entry.relPath)) continue;

      results.push(entry.isDirectory ? `${entry.relPath}/` : entry.relPath);
      if (results.length >= LIMIT) {
        results.push(`[truncated at ${LIMIT} results]`);
        break;
      }
    }

    if (results.length === 0) return "(no matches)";
    return results.join("\n");
  },
};
