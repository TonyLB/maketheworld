import {
    TokenBase,
    Tokenizer,
    TokenExpressionValue,
    TokenLiteralValue,
    TokenKeyValue
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
        let returnValue = sourceStream.consume(1)
        while(!sourceStream.lookAhead(firstChar)) {
            const nextChar = sourceStream.lookAhead(1)
            if (nextChar === '\\') {
                returnValue = returnValue + sourceStream.consume(2)
            }
            else {
                returnValue = returnValue + sourceStream.consume(1)
                if (nextChar === '$') {
                    const checkExpressionToken = checkSubTokenizers({
                        subTokenizers: [expressionValueTokenizer],
                        sourceStream,
                        callback: (token) => {
                            returnValue = returnValue + token.source
                        }
                    })
                    if (checkExpressionToken) {
                        if (checkExpressionToken.success === false) {
                            return checkExpressionToken.error
                        }
                    }
                    else {
                        returnValue = returnValue + sourceStream.consume(1)
                    }
                }
            }
            if (sourceStream.isEndOfSource) {
                return {
                    type: 'Error',
                    message: 'Unbounded template string',
                    source: returnValue,
                    startIdx,
                    endIdx: sourceStream.position - 1
                }
            }
        }
        returnValue = returnValue + sourceStream.consume(1)
        return {
            type: 'TemplateString',
            source: returnValue,
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
    let returnValue = ''
    const startIdx = sourceStream.position
    returnValue = returnValue + sourceStream.consume(1)
    while(!sourceStream.lookAhead('}')) {
        const checkSubTokens = checkSubTokenizers<TokenLiteralValue | TokenTemplateString | TokenExpressionValue>({
            sourceStream,
            subTokenizers: [expressionStringLiteralSubTokenizer, expressionTemplateStringSubTokenizer, expressionValueTokenizer],
            callback: (token) => {
                returnValue = returnValue + token.source
            }
        })
        if (checkSubTokens) {
            if (checkSubTokens.success === false) {
                return checkSubTokens.error
            }
            continue
        }
        returnValue = returnValue + sourceStream.consume(1)
    }
    returnValue = returnValue + sourceStream.consume(1)
    return {
        type: 'ExpressionValue',
        source: returnValue,
        startIdx,
        endIdx: sourceStream.position - 1
    }
}

export default expressionValueTokenizer
