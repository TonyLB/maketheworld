import { Tokenizer, TokenKeyValue } from "./baseClasses"
import whiteSpaceTokenizer from "./whiteSpace"
import { checkSubTokenizers } from "./utils"

export const keyValueTokenizer: Tokenizer<TokenKeyValue> = (sourceStream) => {
    const firstChar = sourceStream.lookAhead(1)
    if (firstChar === '(') {
        const startIdx = sourceStream.position
        let returnValue = sourceStream.consume(1)
        let value = ''
        const checkWhitespaceOne = checkSubTokenizers({
            sourceStream,
            subTokenizers: [whiteSpaceTokenizer],
            callback: (token) => {
                returnValue = returnValue + token.source
            }
        })
        if (checkWhitespaceOne && (checkWhitespaceOne.success === false)) {
            return checkWhitespaceOne.error
        }
        if (sourceStream.lookAhead(1).match(/[A-Za-z\_]/)) {
            value = value + sourceStream.consume(1)
            while(sourceStream.lookAhead(1).match(/[A-Za-z0-9\_]/)) {
                value = value + sourceStream.consume(1)
            }    
        }
        returnValue = returnValue + value
        const checkWhitespaceTwo = checkSubTokenizers({
            sourceStream,
            subTokenizers: [whiteSpaceTokenizer],
            callback: (token) => {
                returnValue = returnValue + token.source
            }
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
