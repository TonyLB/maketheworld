import { Tokenizer, TokenKeyValue } from "./baseClasses"
import whiteSpaceTokenizer from "./whiteSpace"
import { checkSubTokenizer } from "./utils"

export const keyValueTokenizer: Tokenizer<TokenKeyValue> = (sourceStream) => {
    const firstChar = sourceStream.lookAhead(1)
    if (firstChar === '(') {
        const startIdx = sourceStream.position
        let returnValue = sourceStream.consume(1)
        let value = ''
        const checkWhitespaceOne = checkSubTokenizer({
            currentBuffer: returnValue,
            startIdx,
            subTokenizer: whiteSpaceTokenizer,
            sourceStream
        })
        if (checkWhitespaceOne.error) {
            return checkWhitespaceOne.error
        }
        if (checkWhitespaceOne.returnBuffer) {
            returnValue = checkWhitespaceOne.returnBuffer
        }
        if (sourceStream.lookAhead(1).match(/[A-Za-z\_]/)) {
            value = value + sourceStream.consume(1)
            while(sourceStream.lookAhead(1).match(/[A-Za-z0-9\_]/)) {
                value = value + sourceStream.consume(1)
            }    
        }
        returnValue = returnValue + value
        const checkWhitespaceTwo = checkSubTokenizer({
            currentBuffer: returnValue,
            startIdx,
            subTokenizer: whiteSpaceTokenizer,
            sourceStream
        })
        if (checkWhitespaceTwo.error) {
            return checkWhitespaceTwo.error
        }
        if (checkWhitespaceTwo.returnBuffer) {
            returnValue = checkWhitespaceTwo.returnBuffer
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
        returnValue = returnValue + sourceStream.consume(1)
        if (returnValue) {
            return {
                type: 'KeyValue',
                source: returnValue,
                value,
                startIdx,
                endIdx: sourceStream.position - 1
            }
        }
    }
    return undefined
}

export default keyValueTokenizer
