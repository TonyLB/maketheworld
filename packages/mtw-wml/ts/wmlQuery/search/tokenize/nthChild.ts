import { SearchTokenizer, SearchTokenNthChild } from "../baseClasses"
import { whiteSpaceTokenizer } from './whiteSpace'
import { checkSubTokenizers } from "./utils"
import { TokenizeException } from "../../../parser/tokenizer/baseClasses"

export const nthChildTokenizer: SearchTokenizer<SearchTokenNthChild> = (sourceStream) => {
    const startIdx = sourceStream.position
    let digits: string = ''
    if (sourceStream.lookAhead(':nthChild')) {
        sourceStream.consume(9)
        checkSubTokenizers({
            sourceStream,
            subTokenizers: [whiteSpaceTokenizer],
            callback: (token) => {}
        })
        if (!sourceStream.lookAhead('(')) {
            throw new TokenizeException('Unexpected token', sourceStream.position, sourceStream.position)
        }
        sourceStream.consume(1)
        checkSubTokenizers({
            sourceStream,
            subTokenizers: [whiteSpaceTokenizer],
            callback: (token) => {}
        })
        while(sourceStream.lookAhead(1).match(/[0-9]/)) {
            digits = digits + sourceStream.consume(1)
        }
        checkSubTokenizers({
            sourceStream,
            subTokenizers: [whiteSpaceTokenizer],
            callback: (token) => {}
        })
        if (!sourceStream.lookAhead(')')) {
            throw new TokenizeException('Unexpected token', sourceStream.position, sourceStream.position)
        }
        sourceStream.consume(1)
    }
    if (sourceStream.position !== startIdx) {
        return {
            type: 'NthChild',
            n: parseInt(digits),
            startIdx,
            endIdx: sourceStream.position - 1
        }
    }
    return undefined
}

export default nthChildTokenizer
