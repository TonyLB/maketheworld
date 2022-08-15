import { Tokenizer, TokenWhitespace } from "./baseClasses"

export const whiteSpaceTokenizer: Tokenizer<TokenWhitespace> = (sourceStream) => {
    const startIdx = sourceStream.position
    while([' ', '\t', '\n', '\r'].includes(sourceStream.lookAhead(1))) {
        sourceStream.consume(1)
    }
    if (sourceStream.position !== startIdx) {
        return {
            type: 'Whitespace',
            startIdx,
            endIdx: sourceStream.position - 1
        }
    }
    return undefined
}

export default whiteSpaceTokenizer
