import { Tokenizer, TokenKeyValue } from "./baseClasses"
import whiteSpaceTokenizer from "./whiteSpace"
import { checkSubTokenizers } from "./utils"

export const keyValueTokenizer: Tokenizer<TokenKeyValue> = (sourceStream) => {
    const firstChar = sourceStream.lookAhead(1)
    if (firstChar === '(') {
        const startIdx = sourceStream.position
        sourceStream.consume(1)
        const checkWhitespaceOne = checkSubTokenizers({
            sourceStream,
            subTokenizers: [whiteSpaceTokenizer],
            callback: (token) => {}
        })
        if (checkWhitespaceOne && (checkWhitespaceOne.success === false)) {
            return checkWhitespaceOne.error
        }
        const valueStartIdx = sourceStream.position
        if (sourceStream.lookAhead(1).match(/[A-Za-z\_]/)) {
            sourceStream.consume(1)
            while(sourceStream.lookAhead(1).match(/[A-Za-z0-9\_]/)) {
                sourceStream.consume(1)
            }    
        }
        const value = sourceStream.source.slice(valueStartIdx, sourceStream.position)
        const checkWhitespaceTwo = checkSubTokenizers({
            sourceStream,
            subTokenizers: [whiteSpaceTokenizer],
            callback: (token) => {}
        })
        if (checkWhitespaceTwo && (checkWhitespaceTwo.success === false)) {
            return checkWhitespaceTwo.error
        }
        if (!sourceStream.lookAhead(')')) {
            return {
                type: 'Error',
                source: sourceStream.lookAhead(1),
                startIdx: sourceStream.position,
                endIdx: sourceStream.position,
                message: 'Unexpected token'
            }
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
