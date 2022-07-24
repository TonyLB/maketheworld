import {
    Tokenizer,
    TokenLiteralValue
} from "./baseClasses"

export const expressionStringLiteralSubTokenizer: Tokenizer<TokenLiteralValue> = (sourceStream) => {
    const firstChar = sourceStream.lookAhead(1)
    if ([`'`, `"`].includes(firstChar)) {
        const startIdx = sourceStream.position
        let returnValue = sourceStream.consume(1)
        let value = ''
        while(!sourceStream.lookAhead(firstChar)) {
            const nextChar = sourceStream.lookAhead(1)
            if (nextChar === '\\') {
                value = value + sourceStream.consume(2)
            }
            else {
                value = value + sourceStream.consume(1)
            }
            if (sourceStream.isEndOfSource) {
                return {
                    type: 'Error',
                    message: 'Unbounded string literal',
                    source: returnValue + value,
                    startIdx,
                    endIdx: sourceStream.position - 1
                }
            }
        }
        returnValue = returnValue + value + sourceStream.consume(1)
        return {
            type: 'LiteralValue',
            source: returnValue,
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
