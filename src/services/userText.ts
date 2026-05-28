export const DEFAULT_PLAYER_NAME = "Player";

export function normalizeChatMessage(
    value: unknown,
    maxLength: number,
): string {
    return limitLength(normalizeSingleLineText(value), maxLength);
}

export function normalizePlayerName(value: unknown): string {
    const normalized = normalizeSingleLineText(value);
    return normalized.length > 0 ? normalized : DEFAULT_PLAYER_NAME;
}

export function sanitizeRichText(value: string): string {
    return value.replace(/[<>]/g, (character) =>
        character === "<" ? "\uFF1C" : "\uFF1E",
    );
}

function normalizeSingleLineText(value: unknown): string {
    return String(value ?? "")
        .replace(/[\r\n\t]+/g, " ")
        .replace(/\s{2,}/g, " ")
        .trim();
}

function limitLength(value: string, maxLength: number): string {
    return maxLength > 0 ? value.slice(0, maxLength) : value;
}
