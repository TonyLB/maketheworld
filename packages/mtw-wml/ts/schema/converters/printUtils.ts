export const indentSpacing = (indent: number): string => {
    return '    '.repeat(indent)
}

export const lineLengthAfterIndent = (indent: number): number => (Math.max(40, 80 - indent * 4))
