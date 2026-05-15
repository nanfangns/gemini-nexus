/**
 * Sanitizes page context text for safe inclusion in prompts.
 * Strips excessive whitespace and normalizes content.
 */
export function sanitizePageContextText(text) {
    if (typeof text !== 'string') return '';
    return text
        .replace(/\t/g, '  ')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}
