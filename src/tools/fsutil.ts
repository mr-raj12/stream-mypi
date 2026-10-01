import { readdir, stat as fsStat } from "node:fs/promises";
import { join, relative, sep } from "node:path";

export const DEFAULT_IGNORES = [".git", "node_modules", "dist", "build", ".next", "coverage"];

// turn a glob pattern (supports *, ?, **) into a RegExp that matches a relative,
// forward-slash-normalized path
export function globToRegExp(pattern: string): RegExp {
  const normalized = pattern.split(sep).join("/");
  let out = "";
  for (let i = 0; i < normalized.length; i++) {
    const c = normalized[i];
    if (c === "*") {
      if (normalized[i + 1] === "*") {
        // "**" matches across path segments (including none)
        i++;
        if (normalized[i + 1] === "/") i++;
        out += "(?:.*\/)?";
      } else {
        out += "[^/]*";
      }
    } else if (c === "?") {
      out += "[^/]";
    } else if (".+^${}()|[]\\".includes(c)) {
      out += "\\" + c;
    } else {
      out += c;
    }
  }
  return new RegExp(`^${out}$`);
}

export function shouldIgnore(name: string, ignores: string[]): boolean {
  return ignores.includes(name);
}

export type WalkEntry = {
  absPath: string;
  relPath: string;
  isDirectory: boolean;
};

export type WalkOptions = {
  maxDepth?: number;
  includeHidden?: boolean;
  ignores?: string[];
};

// recursively walk a directory tree, yielding files and directories (depth-first)
export async function* walk(root: string, opts: WalkOptions = {}): AsyncGenerator<WalkEntry> {
  const ignores = opts.ignores ?? DEFAULT_IGNORES;
  const maxDepth = opts.maxDepth ?? Infinity;
  const includeHidden = opts.includeHidden ?? false;

  async function* recurse(dir: string, depth: number): AsyncGenerator<WalkEntry> {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      if (!includeHidden && entry.name.startsWith(".") && !ignores.includes(entry.name)) {
        // hidden files are skipped unless explicitly requested, but still check ignore list below
      }
      if (shouldIgnore(entry.name, ignores)) continue;
      if (!includeHidden && entry.name.startsWith(".")) continue;

      const absPath = join(dir, entry.name);
      const relPath = relative(root, absPath).split(sep).join("/");
      const isDirectory = entry.isDirectory();
      yield { absPath, relPath, isDirectory };
      if (isDirectory && depth < maxDepth) {
        yield* recurse(absPath, depth + 1);
      }
    }
  }

  yield* recurse(root, 1);
}

export async function pathExists(p: string): Promise<boolean> {
  try {
    await fsStat(p);
    return true;
  } catch {
    return false;
  }
}
