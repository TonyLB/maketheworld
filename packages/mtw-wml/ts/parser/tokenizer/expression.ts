import {
    TokenBase,
    Tokenizer,
    TokenExpressionValue
} from "./baseClasses"
import { expressionStringLiteralSubTokenizer } from "./literal"
import { checkSubTokenizer } from "./utils"

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
                    const checkExpressionToken = checkSubTokenizer({
                        currentBuffer: returnValue,
                        startIdx,
                        subTokenizer: expressionValueTokenizer,
                        sourceStream
                    })
                    if (checkExpressionToken.error) {
                        return checkExpressionToken.error
                    }
                    else if (checkExpressionToken.returnBuffer) {
                        returnValue = checkExpressionToken.returnBuffer
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
        const checkLiteral = checkSubTokenizer({
            currentBuffer: returnValue,
            startIdx,
            subTokenizer: expressionStringLiteralSubTokenizer,
            sourceStream
        })
        if (checkLiteral.error) {
            return checkLiteral.error
        }
        if (checkLiteral.returnBuffer) {
            returnValue = checkLiteral.returnBuffer
            continue
        }
        const checkTemplate = checkSubTokenizer({
            currentBuffer: returnValue,
            startIdx,
            subTokenizer: expressionTemplateStringSubTokenizer,
            sourceStream
        })
        if (checkTemplate.error) {
            return checkTemplate.error
        }
        if (checkTemplate.returnBuffer) {
            returnValue = checkTemplate.returnBuffer
            continue
        }
        const checkExpression = checkSubTokenizer({
            currentBuffer: returnValue,
            startIdx,
            subTokenizer: expressionValueTokenizer,
            sourceStream
        })
        if (checkExpression.error) {
            return checkExpression.error
        }
        if (checkExpression.returnBuffer) {
            returnValue = checkExpression.returnBuffer
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
