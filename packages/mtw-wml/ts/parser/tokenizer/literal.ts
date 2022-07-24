import {
    Tokenizer,
    TokenLiteralValue
} from "./baseClasses"

export const expressionStringLiteralSubTokenizer: Tokenizer<TokenLiteralValue> = (sourceStream) => {
    const firstChar = sourceStream.lookAhead(1)
    if ([`'`, `"`].includes(firstChar)) {
        const startIdx = sourceStream.position
        sourceStream.consume(1)
        const valueStartIdx = sourceStream.position
        while(!sourceStream.lookAhead(firstChar)) {
            const nextChar = sourceStream.lookAhead(1)
            if (nextChar === '\\') {
                sourceStream.consume(2)
            }
            else {
                sourceStream.consume(1)
            }
            if (sourceStream.isEndOfSource) {
                return {
                    type: 'Error',
                    message: 'Unbounded string literal',
                    startIdx,
                    endIdx: sourceStream.position - 1
                }
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

export const literalValueTokenizer: Tokenizer<TokenLiteralValue> = (sourceStream) => {
    if (sourceStream.lookAhead('"')) {
        return expressionStringLiteralSubTokenizer(sourceStream)
    }
    return undefined
}

export default literalValueTokenizer
