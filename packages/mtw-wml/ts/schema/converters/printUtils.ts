export const indentSpacing = (indent: number): string => {
    return '    '.repeat(indent >= 0 ? indent : 0)
}

export const lineLengthAfterIndent = (indent: number): number => (Math.max(40, 80 - indent * 4))
