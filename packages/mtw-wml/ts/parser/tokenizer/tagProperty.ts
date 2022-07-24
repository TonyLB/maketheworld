import { Tokenizer, TokenProperty } from "./baseClasses"
import whiteSpaceTokenizer from "./whiteSpace"
import { checkSubTokenizers } from "./utils"

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
        const checkWhitespace = checkSubTokenizers({
            sourceStream,
            subTokenizers: [whiteSpaceTokenizer],
            callback: (token) => {
                returnValue = returnValue + token.source
            }
        })
        if (checkWhitespace && (checkWhitespace.success === false)) {
            return checkWhitespace.error
        }
        if (!sourceStream.lookAhead('=')) {
            return {
                type: 'Property',
                isBoolean: true,
                source: returnValue,
                key,
                value: true,
                startIdx,
                endIdx: sourceStream.position - 1
            }
        }
        returnValue = returnValue + sourceStream.consume(1)
        if (returnValue) {
            return {
                type: 'Property',
                isBoolean: false,
                source: returnValue,
                key,
                startIdx,
                endIdx: sourceStream.position - 1
            }
        }
    }
    if (firstChar === '!') {
        const startIdx = sourceStream.position
        let returnValue = sourceStream.consume(1)
        let key = ''
        while(sourceStream.lookAhead(1).match(/[A-Za-z]/)) {
            key = key + sourceStream.consume(1)
        }
        returnValue = returnValue + key
        return {
            type: 'Property',
            isBoolean: true,
            source: returnValue,
            key,
            value: false,
            startIdx,
            endIdx: sourceStream.position - 1
        }
    }
    return undefined
}

export default tagPropertyTokenizer
