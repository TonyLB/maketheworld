import { Tokenizer, TokenTagClose, TokenizeException } from "./baseClasses"
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
            throw new TokenizeException('Tag closure requires tag label', startIdx, sourceStream.position - 1)
        }
        checkSubTokenizers({
            sourceStream,
            subTokenizers: [whiteSpaceTokenizer],
            callback: (token) => {}
        })
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
            throw new TokenizeException('Unexpected Token', startIdx, sourceStream.position - 1)
        }
    }
    return undefined
}

export default tagCloseTokenizer
