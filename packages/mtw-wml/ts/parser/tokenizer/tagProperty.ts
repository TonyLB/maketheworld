import { Tokenizer, TokenProperty } from "./baseClasses"
import whiteSpaceTokenizer from "./whiteSpace"
import { checkSubTokenizers } from "./utils"

export const tagPropertyTokenizer: Tokenizer<TokenProperty> = (sourceStream) => {
    const firstChar = sourceStream.lookAhead(1)
    if (firstChar.match(/[A-Za-z]/)) {
        const startIdx = sourceStream.position
        while(sourceStream.lookAhead(1).match(/[A-Za-z]/)) {
            sourceStream.consume(1)
        }
        const key = sourceStream.source.slice(startIdx, sourceStream.position)
        const checkWhitespace = checkSubTokenizers({
            sourceStream,
            subTokenizers: [whiteSpaceTokenizer],
            callback: (token) => {}
        })
        if (checkWhitespace && (checkWhitespace.success === false)) {
            return checkWhitespace.error
        }
        if (!sourceStream.lookAhead('=')) {
            return {
                type: 'Property',
                isBoolean: true,
                key,
                value: true,
                startIdx,
                endIdx: sourceStream.position - 1
            }
        }
        sourceStream.consume(1)
        return {
            type: 'Property',
            isBoolean: false,
            key,
            startIdx,
            endIdx: sourceStream.position - 1
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
