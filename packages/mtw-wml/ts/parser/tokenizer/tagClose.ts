import { Tokenizer, TokenTagClose } from "./baseClasses"
import whiteSpaceTokenizer from "./whiteSpace"
import { checkSubTokenizer } from "./utils"

export const tagCloseTokenizer: Tokenizer<TokenTagClose> = (sourceStream) => {
    if (sourceStream.lookAhead('</')) {
        const startIdx = sourceStream.position
        let returnValue = sourceStream.consume(2)
        let tag = ''
        while(sourceStream.lookAhead(1).match(/[A-Za-z]/)) {
            tag = tag + sourceStream.consume(1)
        }
        if (tag === '') {
            return {
                type: 'Error',
                source: returnValue,
                startIdx,
                endIdx: sourceStream.position - 1,
                message: 'Tag closure requires tag label'
            }
        }
        returnValue = returnValue + tag
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
        if (sourceStream.lookAhead('>')) {
            returnValue = returnValue + sourceStream.consume(1)
            return {
                type: 'TagClose',
                source: returnValue,
                tag: tag,
                startIdx,
                endIdx: sourceStream.position - 1
            }
        }
        else {
            return {
                type: 'Error',
                source: returnValue,
                startIdx,
                endIdx: sourceStream.position - 1,
                message: 'Unexpected token'
            }
        }
    }
    return undefined
}

export default tagCloseTokenizer
