import { Tokenizer, TokenProperty } from "./baseClasses"
import whiteSpaceTokenizer from "./whiteSpace"
import { checkSubTokenizer } from "./utils"

export const tagPropertyTokenizer: Tokenizer<TokenProperty> = (sourceStream) => {
    const firstChar = sourceStream.lookAhead(1)
    if (firstChar.match(/[A-Za-z]/)) {
        const startIdx = sourceStream.position
        let returnValue = ''
        let key = sourceStream.consume(1)
        while(sourceStream.lookAhead(1).match(/[A-Za-z]/)) {
            key = key + sourceStream.consume(1)
        }
        returnValue = returnValue + key
        const checkWhitespace = checkSubTokenizer({
            currentBuffer: returnValue,
            startIdx,
            subTokenizer: whiteSpaceTokenizer,
            sourceStream
        })
        if (checkWhitespace.error) {
            return checkWhitespace.error
        }
        if (checkWhitespace.returnBuffer) {
            returnValue = checkWhitespace.returnBuffer
        }
        if (!sourceStream.lookAhead('=')) {
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
                type: 'Property',
                source: returnValue,
                key,
                startIdx,
                endIdx: sourceStream.position - 1
            }
        }
    }
    return undefined
}

export default tagPropertyTokenizer
