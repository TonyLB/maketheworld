import { Tokenizer, TokenWhitespace } from "./baseClasses"

export const whiteSpaceTokenizer: Tokenizer<TokenWhitespace> = (sourceStream) => {
    let returnValue = ''
    const startIdx = sourceStream.position
    while([' ', '\t', '\n'].includes(sourceStream.lookAhead(1))) {
        returnValue = returnValue + sourceStream.consume(1)
    }
    if (returnValue) {
        return {
            type: 'Whitespace',
            source: returnValue,
            startIdx,
            endIdx: sourceStream.position - 1
        }
    }
    return undefined
}

export default whiteSpaceTokenizer
