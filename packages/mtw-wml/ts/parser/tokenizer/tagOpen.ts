import { Tokenizer, TokenTagOpenBegin, TokenTagOpenEnd } from "./baseClasses"

export const tagOpenBeginTokenizer: Tokenizer<TokenTagOpenBegin> = (sourceStream) => {
    if (sourceStream.lookAhead('<')) {
        const startIdx = sourceStream.position
        let returnValue = sourceStream.consume(1)
        let tag = ''
        while(sourceStream.lookAhead(1).match(/[A-Za-z]/)) {
            tag = tag + sourceStream.consume(1)
        }
        returnValue = returnValue + tag
        if (returnValue) {
            return {
                type: 'TagOpenBegin',
                source: returnValue,
                tag: tag,
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
        return {
            type: 'TagOpenEnd',
            source: sourceStream.consume(1),
            startIdx,
            endIdx: sourceStream.position - 1,
            selfClosing: false
        }
    }
    if (sourceStream.lookAhead('/>')) {
        return {
            type: 'TagOpenEnd',
            source: sourceStream.consume(2),
            startIdx,
            endIdx: sourceStream.position - 1,
            selfClosing: true
        }
    }
    return undefined
}
