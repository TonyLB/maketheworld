import {
    TokenBase,
    Tokenizer,
    TokenExpressionValue,
    TokenLiteralValue,
    TokenizeException
} from "./baseClasses"
import { expressionStringLiteralSubTokenizer } from "./literal"
import { checkSubTokenizers } from "./utils"

type TokenTemplateString = {
    type: 'TemplateString'
} & TokenBase

export const expressionTemplateStringSubTokenizer: Tokenizer<TokenTemplateString> = (sourceStream) => {
    const firstChar = sourceStream.lookAhead(1)
    if (firstChar === "`") {
        const startIdx = sourceStream.position
        sourceStream.consume(1)
        while(!sourceStream.lookAhead(firstChar)) {
            const nextChar = sourceStream.lookAhead(1)
            if (nextChar === '\\') {
                sourceStream.consume(2)
            }
            else {
                sourceStream.consume(1)
                if (nextChar === '$') {
                    const checkExpressionToken = checkSubTokenizers({
                        subTokenizers: [expressionValueTokenizer],
                        sourceStream,
                        callback: (token) => {}
                    })
                    if (!checkExpressionToken) {
                        sourceStream.consume(1)
                    }
                }
            }
            if (sourceStream.isEndOfSource) {
                throw new TokenizeException('Unbounded template string', startIdx, sourceStream.position - 1)
            }
        }
        sourceStream.consume(1)
        return {
            type: 'TemplateString',
            startIdx,
            endIdx: sourceStream.position - 1
        }
    }
    else {
        return undefined
    }
}

export const expressionValueTokenizer: Tokenizer<TokenExpressionValue> = (sourceStream) => {
    if (!sourceStream.lookAhead('{')) {
        return undefined
    }
    const startIdx = sourceStream.position
    sourceStream.consume(1)
    while(!sourceStream.lookAhead('}')) {
        const checkSubTokens = checkSubTokenizers<TokenLiteralValue | TokenTemplateString | TokenExpressionValue>({
            sourceStream,
            subTokenizers: [expressionStringLiteralSubTokenizer, expressionTemplateStringSubTokenizer, expressionValueTokenizer],
            callback: (token) => {}
        })
        if (checkSubTokens) {
            continue
        }
        sourceStream.consume(1)
    }
    sourceStream.consume(1)
    return {
        type: 'ExpressionValue',
        startIdx,
        endIdx: sourceStream.position,
        value: sourceStream.source.slice(startIdx + 1, sourceStream.position - 1)
    }
}

export default expressionValueTokenizer
