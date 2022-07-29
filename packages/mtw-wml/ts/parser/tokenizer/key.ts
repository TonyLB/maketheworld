import { Tokenizer, TokenKeyValue, TokenizeException } from "./baseClasses"
import whiteSpaceTokenizer from "./whiteSpace"
import { checkSubTokenizers } from "./utils"

export const keyValueTokenizer: Tokenizer<TokenKeyValue> = (sourceStream) => {
    const firstChar = sourceStream.lookAhead(1)
    if (firstChar === '(') {
        const startIdx = sourceStream.position
        sourceStream.consume(1)
        checkSubTokenizers({
            sourceStream,
            subTokenizers: [whiteSpaceTokenizer],
            callback: (token) => {}
        })
        const valueStartIdx = sourceStream.position
        if (sourceStream.lookAhead(1).match(/[A-Za-z\_]/)) {
            sourceStream.consume(1)
            while(sourceStream.lookAhead(1).match(/[A-Za-z0-9\_]/)) {
                sourceStream.consume(1)
            }    
        }
        const value = sourceStream.source.slice(valueStartIdx, sourceStream.position)
        checkSubTokenizers({
            sourceStream,
            subTokenizers: [whiteSpaceTokenizer],
            callback: (token) => {}
        })
        if (!sourceStream.lookAhead(')')) {
            throw new TokenizeException('Unexpected token', sourceStream.position, sourceStream.position)
        }
        sourceStream.consume(1)
        if (sourceStream.position !== startIdx) {
            return {
                type: 'KeyValue',
                value,
                startIdx,
                endIdx: sourceStream.position - 1
            }
        }
    }
    return undefined
}

export default keyValueTokenizer
