import { SearchTokenizer, SearchTokenProperty, SearchTokenPropertyLegal } from "../baseClasses"
import { whiteSpaceTokenizer } from './whiteSpace'
import { checkSubTokenizers } from "./utils"
import { TokenizeException } from "../../../parser/tokenizer/baseClasses"
import literalValueTokenizer from "../../../parser/tokenizer/literal"

export type SearchTokenLiteralValue = {
    type: 'LiteralValue';
    value: string;
}

const expressionStringLiteralSubTokenizer: SearchTokenizer<SearchTokenLiteralValue> = (sourceStream) => {
    if (sourceStream.lookAhead('"')) {
        const startIdx = sourceStream.position
        sourceStream.consume(1)
        const valueStartIdx = sourceStream.position
        while(!sourceStream.lookAhead('"')) {
            const nextChar = sourceStream.lookAhead(1)
            if (nextChar === '\\') {
                sourceStream.consume(2)
            }
            else {
                sourceStream.consume(1)
            }
            if (sourceStream.isEndOfSource) {
                throw new TokenizeException('Unbounded string literal', startIdx, sourceStream.position - 1)
            }
        }
        const value = sourceStream.source.slice(valueStartIdx, sourceStream.position)
        sourceStream.consume(1)
        return {
            type: 'LiteralValue',
            value,
            startIdx,
            endIdx: sourceStream.position - 1
        }
    }
    else {
        return undefined
    }
}
export const propertyTokenizer: SearchTokenizer<SearchTokenProperty> = (sourceStream) => {
    const startIdx = sourceStream.position
    let key: SearchTokenPropertyLegal

    if (!sourceStream.lookAhead('[')) {
        return undefined
    }
    sourceStream.consume(1)
    if (sourceStream.lookAhead('to')) {
        sourceStream.consume(2)
        key = 'to'
    }
    else if (sourceStream.lookAhead('key')) {
        sourceStream.consume(3)
        key = 'key'
    }
    else if (sourceStream.lookAhead('from')) {
        sourceStream.consume(4)
        key = 'from'
    }
    else {
        throw new TokenizeException('Unexpected token', sourceStream.position, sourceStream.position)
    }
    checkSubTokenizers({
        sourceStream,
        subTokenizers: [whiteSpaceTokenizer],
        callback: (token) => {}
    })
    if (!sourceStream.lookAhead('=')) {
        throw new TokenizeException('Unexpected token', sourceStream.position, sourceStream.position)
    }
    sourceStream.consume(1)
    checkSubTokenizers({
        sourceStream,
        subTokenizers: [whiteSpaceTokenizer],
        callback: (token) => {}
    })
    let value: string = ''
    if (!checkSubTokenizers({
        sourceStream,
        subTokenizers: [expressionStringLiteralSubTokenizer],
        callback: (token) => {
            value = token.value
        }
    })) {
        throw new TokenizeException('Unexpected token', sourceStream.position, sourceStream.position)
    }
    checkSubTokenizers({
        sourceStream,
        subTokenizers: [whiteSpaceTokenizer],
        callback: (token) => {}
    })
    if (!sourceStream.lookAhead(']')) {
        throw new TokenizeException('Unexpected token', sourceStream.position, sourceStream.position)
    }
    sourceStream.consume(1)
    return {
        type: 'Property',
        startIdx,
        endIdx: sourceStream.position - 1,
        key,
        value
    }
}

export default propertyTokenizer
