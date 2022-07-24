import { liftContents } from "../../semantics/schema/processUp"
import { isTokenError, Token, TokenDescription } from "./baseClasses"
import booleanPropertyTokenizer from "./boolean"
import expressionValueTokenizer from "./expression"
import keyValueTokenizer from "./key"
import literalValueTokenizer from "./literal"
import SourceStream from "./sourceStream"
import tagCloseTokenizer from "./tagClose"

import { tagOpenBeginTokenizer, tagOpenEndTokenizer } from "./tagOpen"
import tagPropertyTokenizer from "./tagProperty"
import whiteSpaceTokenizer from "./whiteSpace"

enum TokenizerMode {
    Contents,
    Tag
}

export const tokenizer = (sourceStream: SourceStream): Token[] => {
    let mode: TokenizerMode = TokenizerMode.Contents
    let currentDescription: TokenDescription | undefined
    let returnValue: Token[] = []

    while(!sourceStream.isEndOfSource) {
        if (mode === TokenizerMode.Contents) {
            const checkWhitespace = whiteSpaceTokenizer(sourceStream)
            if (checkWhitespace) {
                if (isTokenError(checkWhitespace)) {
                    return [checkWhitespace]
                }
                returnValue.push(checkWhitespace)
                continue
            }
            const checkTagClose = tagCloseTokenizer(sourceStream)
            if (checkTagClose) {
                if (isTokenError(checkTagClose)) {
                    return [checkTagClose]
                }
                returnValue.push(checkTagClose)
                continue
            }
            const checkTagOpen = tagOpenBeginTokenizer(sourceStream)
            if (checkTagOpen) {
                if (isTokenError(checkTagOpen)) {
                    return [checkTagOpen]
                }
                returnValue.push(checkTagOpen)
                mode = TokenizerMode.Tag
                continue
            }
            return [{
                type: 'Error',
                startIdx: sourceStream.position,
                endIdx: sourceStream.position,
                source: sourceStream.lookAhead(1),
                message: 'Unexpected token'
            }]
        }
        else {
            const checkTagEnd = tagOpenEndTokenizer(sourceStream)
            if (checkTagEnd) {
                if (isTokenError(checkTagEnd)) {
                    return [checkTagEnd]
                }
                returnValue.push(checkTagEnd)
                mode = TokenizerMode.Contents
                continue
            }
            const checkWhitespace = whiteSpaceTokenizer(sourceStream)
            if (checkWhitespace) {
                if (isTokenError(checkWhitespace)) {
                    return [checkWhitespace]
                }
                returnValue.push(checkWhitespace)
                continue
            }
            const checkTagProp = tagPropertyTokenizer(sourceStream)
            if (checkTagProp) {
                if (isTokenError(checkTagProp)) {
                    return [checkTagProp]
                }
                returnValue.push(checkTagProp)
                const checkWhitespace = whiteSpaceTokenizer(sourceStream)
                if (checkWhitespace) {
                    if (isTokenError(checkWhitespace)) {
                        return [checkWhitespace]
                    }
                    returnValue.push(checkWhitespace)
                }
                const checkLiteral = literalValueTokenizer(sourceStream)
                if (checkLiteral) {
                    if (isTokenError(checkLiteral)) {
                        return [checkLiteral]
                    }
                    returnValue.push(checkLiteral)
                    continue
                }
                const checkKey = keyValueTokenizer(sourceStream)
                if (checkKey) {
                    if (isTokenError(checkKey)) {
                        return [checkKey]
                    }
                    returnValue.push(checkKey)
                    continue
                }
                const checkExpression = expressionValueTokenizer(sourceStream)
                if (checkExpression) {
                    if (isTokenError(checkExpression)) {
                        return [checkExpression]
                    }
                    returnValue.push(checkExpression)
                    continue
                }
                return [{
                    type: 'Error',
                    source: sourceStream.lookAhead(1),
                    startIdx: sourceStream.position,
                    endIdx: sourceStream.position,
                    message: 'Unexpected token'
                }]
            }
            const checkBooleanProp = booleanPropertyTokenizer(sourceStream)
            if (checkBooleanProp) {
                if (isTokenError(checkBooleanProp)) {
                    return [checkBooleanProp]
                }
                returnValue.push(checkBooleanProp)
                continue
            }
            return [{
                type: 'Error',
                source: sourceStream.lookAhead(1),
                startIdx: sourceStream.position,
                endIdx: sourceStream.position,
                message: 'Unexpected token'
            }]
        }
    }
    return returnValue
}

export default tokenizer
