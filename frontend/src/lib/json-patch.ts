/**
 * Minimal JSON Patch (RFC 6902) implementation for applying
 * server-sent patches to local state.
 */

export interface JsonPatch {
  op: 'add' | 'remove' | 'replace';
  path: string;
  value?: unknown;
}

/**
 * Apply a list of JSON patches to an object, returning a new object.
 * Only supports flat/shallow paths for our use case (resource graph updates).
 */
export function applyPatches<T extends Record<string, unknown>>(
  target: T,
  patches: JsonPatch[]
): T {
  let result = { ...target };

  for (const patch of patches) {
    const segments = parsePath(patch.path);
    if (segments.length === 0) continue;

    if (segments.length === 1) {
      const key = segments[0];
      switch (patch.op) {
        case 'add':
        case 'replace':
          result = { ...result, [key]: patch.value };
          break;
        case 'remove':
          result = { ...result };
          delete (result as Record<string, unknown>)[key];
          break;
      }
    } else {
      // Nested path — deep clone the path
      result = applyNestedPatch(result, segments, patch);
    }
  }

  return result;
}

function applyNestedPatch<T extends Record<string, unknown>>(
  obj: T,
  segments: string[],
  patch: JsonPatch
): T {
  if (segments.length === 0) return obj;

  const [head, ...rest] = segments;
  const current = (obj as Record<string, unknown>)[head];

  if (rest.length === 0) {
    switch (patch.op) {
      case 'add':
      case 'replace':
        return { ...obj, [head]: patch.value };
      case 'remove': {
        const copy = { ...obj };
        delete (copy as Record<string, unknown>)[head];
        return copy;
      }
    }
  }

  if (typeof current === 'object' && current !== null) {
    return {
      ...obj,
      [head]: applyNestedPatch(
        current as Record<string, unknown>,
        rest,
        patch
      ),
    };
  }

  return obj;
}

function parsePath(path: string): string[] {
  if (!path.startsWith('/')) return [];
  return path.slice(1).split('/').map(unescapePathSegment);
}

function unescapePathSegment(segment: string): string {
  return segment.replace(/~1/g, '/').replace(/~0/g, '~');
}
