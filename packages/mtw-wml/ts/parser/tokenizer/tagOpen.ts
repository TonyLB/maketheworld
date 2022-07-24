import { Tokenizer, TokenTagOpenBegin, TokenTagOpenEnd } from "./baseClasses"

export const tagOpenBeginTokenizer: Tokenizer<TokenTagOpenBegin> = (sourceStream) => {
    if (sourceStream.lookAhead('<')) {
        const startIdx = sourceStream.position
        sourceStream.consume(1)
        const tagStartIdx = sourceStream.position
        while(sourceStream.lookAhead(1).match(/[A-Za-z]/)) {
            sourceStream.consume(1)
        }
        const tag = sourceStream.source.slice(tagStartIdx, sourceStream.position)
        if (sourceStream.position !== tagStartIdx) {
            return {
                type: 'TagOpenBegin',
                tag,
                startIdx,
                endIdx: sourceStream.position - 1
            }
        }
    }
    return undefined
}

export const tagOpenEndTokenizer: Tokenizer<TokenTagOpenEnd> = (sourceStream) => {
    const startIdx = sourceStream.position
    if (sourceStream.lookAhead('>')) {
        sourceStream.consume(1)
        return {
            type: 'TagOpenEnd',
            startIdx,
            endIdx: sourceStream.position - 1,
            selfClosing: false
        }
    }
    if (sourceStream.lookAhead('/>')) {
        sourceStream.consume(2)
        return {
            type: 'TagOpenEnd',
            startIdx,
            endIdx: sourceStream.position - 1,
            selfClosing: true
        }
    }
    return undefined
}
