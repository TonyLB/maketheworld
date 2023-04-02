export const escapeWMLCharacters = (value: string): string => {
    return value.replace(/[\\<>]/g, '\\$&')
}
