import { Tokenizer, TokenDescription } from "./baseClasses"

export const descriptionTokenizer: Tokenizer<TokenDescription> = (sourceStream) => {
    const startIdx = sourceStream.position
    while (![' ', '\n', '\t', '<'].includes(sourceStream.lookAhead(1))) {
        if (sourceStream.isEndOfSource) {
            break
        }
        if (sourceStream.lookAhead(1) === '\\') {
            sourceStream.consume(2)
        }
        else {
            sourceStream.consume(1)
        }
    }
    const endIdx = sourceStream.position
    if (startIdx === endIdx) {
        return undefined
    }
    else {
        return {
            type: 'Description',
            source: sourceStream.source.slice(startIdx, endIdx),
            startIdx,
            endIdx
        }
    }
}

export default descriptionTokenizer
