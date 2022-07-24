import { Tokenizer, TokenTagClose } from "./baseClasses"
import whiteSpaceTokenizer from "./whiteSpace"
import { checkSubTokenizers } from "./utils"

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
