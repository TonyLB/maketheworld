import { Tokenizer, TokenBeginTagOpen } from "./baseClasses"

export const beginTagOpenTokenizer: Tokenizer<TokenBeginTagOpen> = (sourceStream) => {
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
                type: 'BeginTagOpen',
                source: returnValue,
                tag: tag,
                startIdx,
                endIdx: sourceStream.position - 1
            }
        }
    }
    return undefined
}
