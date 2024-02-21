export const escapeWMLCharacters = (value: string): string => {
    return value.replace(/[\\<>]/g, '\\$&')
}

export const deEscapeWMLCharacters = (value: string): string => {
    return value.replace(/(?<!\\)\\/g, '')
}