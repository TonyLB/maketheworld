import { Tokenizer, TokenTagClose } from "./baseClasses"
import whiteSpaceTokenizer from "./whiteSpace"
import { checkSubTokenizers } from "./utils"

export const tagCloseTokenizer: Tokenizer<TokenTagClose> = (sourceStream) => {
    if (sourceStream.lookAhead('</')) {
        const startIdx = sourceStream.position
        sourceStream.consume(2)
        const tagStartIdx = sourceStream.position
        while(sourceStream.lookAhead(1).match(/[A-Za-z]/)) {
            sourceStream.consume(1)
        }
        const tag = sourceStream.source.slice(tagStartIdx, sourceStream.position)
        if (tag === '') {
            return {
                type: 'Error',
                startIdx,
                endIdx: sourceStream.position - 1,
                message: 'Tag closure requires tag label'
            }
        }
        const checkWhitespace = checkSubTokenizers({
            sourceStream,
            subTokenizers: [whiteSpaceTokenizer],
            callback: (token) => {}
        })
        if (checkWhitespace && (checkWhitespace.success === false)) {
            return checkWhitespace.error
        }
        if (sourceStream.lookAhead('>')) {
            sourceStream.consume(1)
            return {
                type: 'TagClose',
                tag: tag,
                startIdx,
                endIdx: sourceStream.position - 1
            }
        }
        else {
            return {
                type: 'Error',
                startIdx,
                endIdx: sourceStream.position - 1,
                message: 'Unexpected token'
            }
        }
    }
    return undefined
}

export default tagCloseTokenizer
