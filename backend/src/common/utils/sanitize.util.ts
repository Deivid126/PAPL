const HTML_TAGS = /<\/?[a-z][\s\S]*?>/gi;
const SCRIPT = /<script[\s\S]*?<\/script>/gi;
const JS_EVENTS = /\son[a-z]+\s*=/gi;

/**
 * Remove conteúdo HTML/scripts e eventos inline de strings fornecidas
 * pelo usuário antes de persistir. Preserva acentos e pontuação comum.
 */
export function sanitizeString(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  return String(value)
    .replace(SCRIPT, '')
    .replace(JS_EVENTS, ' ')
    .replace(HTML_TAGS, '')
    .trim();
}

export function sanitizeOptional(value: string | null | undefined): string | null {
  const clean = sanitizeString(value);
  return clean && clean.length > 0 ? clean : null;
}