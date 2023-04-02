import { Tokenizer, TokenDescription } from "./baseClasses"

export const descriptionTokenizer: Tokenizer<TokenDescription> = (sourceStream) => {
    const startIdx = sourceStream.position
    let value = ''
    while (![' ', '\n', '\t', '\r', '<'].includes(sourceStream.lookAhead(1))) {
        if (['/*', '//'].includes(sourceStream.lookAhead(2))) {
            break
        }
        if (sourceStream.isEndOfSource) {
            break
        }
        if (sourceStream.lookAhead(1) === '\\') {
            sourceStream.consume(1)
        }
        value = `${value}${sourceStream.consume(1)}`
    }
    const endIdx = sourceStream.position
    if (startIdx === endIdx) {
        return undefined
    }
    else {
        return {
            type: 'Description',
            startIdx,
            endIdx,
            value
        }
    }
}

export default descriptionTokenizer
