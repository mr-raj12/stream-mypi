import { stat } from "node:fs/promises";
import { resolve } from "node:path";
import type { Tool } from "../types.ts";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes;
  let unit = -1;
  do {
    value /= 1024;
    unit++;
  } while (value >= 1024 && unit < units.length - 1);
  return `${value.toFixed(2)} ${units[unit]}`;
}

export const statTool: Tool = {
  name: "stat",
  description: "Get metadata for a file or directory: size, type, created/modified times, permissions.",
  parameters: {
    type: "object",
    properties: {
      path: { type: "string", description: "Path to the file or directory, relative to the current folder" },
    },
    required: ["path"],
  },
  async execute(args) {
    const target = resolve(process.cwd(), String(args.path));
    const s = await stat(target);
    const type = s.isDirectory() ? "directory" : s.isSymbolicLink() ? "symlink" : s.isFile() ? "file" : "other";
    const lines = [
      `path: ${target}`,
      `type: ${type}`,
      `size: ${s.size} bytes (${formatBytes(s.size)})`,
      `created: ${s.birthtime.toISOString()}`,
      `modified: ${s.mtime.toISOString()}`,
      `accessed: ${s.atime.toISOString()}`,
      `mode: ${(s.mode & 0o777).toString(8)}`,
    ];
    return lines.join("\n");
  },
};
