/**
 * Argument Substitution Engine for Skills
 *
 * Replaces placeholders in skill content with actual argument values.
 * Supports four levels of substitution, following Claude Code's convention:
 *
 *   1. Named arguments:  $foo → argumentNames[0] maps to parsedArgs[0]
 *   2. Indexed arguments: $ARGUMENTS[0], $ARGUMENTS[1] → by position
 *   3. Shorthand indexed:  $0, $1 → same as $ARGUMENTS[0], $ARGUMENTS[1]
 *   4. Full arguments:    $ARGUMENTS → the raw argument string
 *
 * If no placeholders are found and appendIfNoPlaceholder is true,
 * appends "ARGUMENTS: {args}" to the end of the content.
 */

import type { SkillArg } from '../types/skill';

/**
 * Parse an arguments string into an array of individual arguments.
 * Handles double-quoted and single-quoted strings.
 *
 * Examples:
 *   "foo bar baz"          => ["foo", "bar", "baz"]
 *   'foo "hello world" baz' => ["foo", "hello world", "baz"]
 */
export function parseArguments(args: string): string[] {
  if (!args || !args.trim()) return [];

  const result: string[] = [];
  let current = '';
  let inSingle = false;
  let inDouble = false;

  for (let i = 0; i < args.length; i++) {
    const ch = args[i];

    if (ch === "'" && !inDouble) {
      inSingle = !inSingle;
      continue;
    }
    if (ch === '"' && !inSingle) {
      inDouble = !inDouble;
      continue;
    }

    if (ch === ' ' && !inSingle && !inDouble) {
      if (current) {
        result.push(current);
        current = '';
      }
      continue;
    }

    current += ch;
  }

  if (current) result.push(current);
  return result;
}

/**
 * Parse argument names from the SkillArg[] or a space-separated string.
 *
 * Examples:
 *   [{ name: "foo" }, { name: "bar" }] => ["foo", "bar"]
 *   "foo bar baz" => ["foo", "bar", "baz"]
 */
export function parseArgumentNames(
  argumentNames: SkillArg[] | string | undefined,
): string[] {
  if (!argumentNames) return [];

  if (Array.isArray(argumentNames)) {
    return argumentNames
      .map(a => a.name)
      .filter(name => name.trim() !== '' && !/^\d+$/.test(name));
  }

  if (typeof argumentNames === 'string') {
    return argumentNames
      .split(/\s+/)
      .filter(name => name.trim() !== '' && !/^\d+$/.test(name));
  }

  return [];
}

/**
 * Generate a progressive argument hint showing remaining unfilled args.
 * Useful for autocomplete UI.
 *
 * @param argNames - Argument names from skill definition
 * @param typedArgs - Arguments the user has typed so far
 * @returns Hint string like "[arg2] [arg3]" or undefined if all filled
 */
export function generateProgressiveArgumentHint(
  argNames: string[],
  typedArgs: string[],
): string | undefined {
  const remaining = argNames.slice(typedArgs.length);
  if (remaining.length === 0) return undefined;
  return remaining.map(name => `[${name}]`).join(' ');
}

/**
 * Substitute $ARGUMENTS placeholders in content with actual argument values.
 *
 * @param content - The content containing placeholders
 * @param args - The raw arguments string (may be undefined/null)
 * @param appendIfNoPlaceholder - If true and no placeholders found, appends args to content
 * @param argumentNames - Optional array of named arguments mapping to positions
 * @returns The content with placeholders substituted
 */
export function substituteArguments(
  content: string,
  args: string | undefined,
  appendIfNoPlaceholder = true,
  argumentNames: string[] = [],
): string {
  // No args provided — return content unchanged
  if (args === undefined || args === null) return content;

  const parsedArgs = parseArguments(args);
  const originalContent = content;

  // 1. Replace named arguments: $foo → parsedArgs[i]
  for (let i = 0; i < argumentNames.length; i++) {
    const name = argumentNames[i];
    if (!name) continue;

    // Match $name but not $name[...] or $nameXxx (word boundary)
    content = content.replace(
      new RegExp(`\\$${name}(?![\\[\\w])`, 'g'),
      parsedArgs[i] ?? '',
    );
  }

  // 2. Replace indexed arguments: $ARGUMENTS[0], $ARGUMENTS[1], etc.
  content = content.replace(/\$ARGUMENTS\[(\d+)\]/g, (_, indexStr: string) => {
    const index = parseInt(indexStr, 10);
    return parsedArgs[index] ?? '';
  });

  // 3. Replace shorthand indexed arguments: $0, $1, etc.
  content = content.replace(/\$(\d+)(?!\w)/g, (_, indexStr: string) => {
    const index = parseInt(indexStr, 10);
    return parsedArgs[index] ?? '';
  });

  // 4. Replace $ARGUMENTS with the full arguments string
  content = content.replaceAll('$ARGUMENTS', args);

  // 5. If no placeholders were found and appendIfNoPlaceholder is true, append
  if (content === originalContent && appendIfNoPlaceholder && args) {
    content = content + `\n\nARGUMENTS: ${args}`;
  }

  return content;
}

/**
 * Build the argument hint string from SkillArg definitions.
 * E.g., "[file] [mode] [--verbose]"
 */
export function buildArgumentHint(args: SkillArg[]): string {
  return args
    .map(a => (a.required ? `<${a.name}>` : `[${a.name}]`))
    .join(' ');
}
