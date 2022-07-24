import {
    isTokenError,
    Token,
    TokenDescription,
    TokenTagClose,
    TokenTagOpenBegin,
    TokenTagOpenEnd,
    TokenWhitespace,
    TokenProperty,
    TokenBooleanProperty,
    TokenLiteralValue,
    TokenKeyValue,
    TokenExpressionValue
} from "./baseClasses"
import booleanPropertyTokenizer from "./boolean"
import expressionValueTokenizer from "./expression"
import keyValueTokenizer from "./key"
import literalValueTokenizer from "./literal"
import SourceStream from "./sourceStream"
import tagCloseTokenizer from "./tagClose"

import { tagOpenBeginTokenizer, tagOpenEndTokenizer } from "./tagOpen"
import tagPropertyTokenizer from "./tagProperty"
import whiteSpaceTokenizer from "./whiteSpace"
import { checkSubTokenizers } from "./utils"

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
            const checkSubTokens = checkSubTokenizers<TokenWhitespace | TokenTagClose | TokenTagOpenBegin>({
                sourceStream,
                subTokenizers: [whiteSpaceTokenizer, tagCloseTokenizer, tagOpenBeginTokenizer],
                callback: (token) => {
                    returnValue.push(token)
                    if (token.type === 'TagOpenBegin') {
                        mode = TokenizerMode.Tag
                    }
                }
            })
            if (checkSubTokens) {
                if (checkSubTokens.success === false) {
                    return [checkSubTokens.error]
                }
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
            const checkSubTokens = checkSubTokenizers<TokenTagOpenEnd | TokenWhitespace | TokenProperty | TokenBooleanProperty>({
                sourceStream,
                subTokenizers: [tagOpenEndTokenizer, whiteSpaceTokenizer, tagPropertyTokenizer, booleanPropertyTokenizer],
                callback: (token) => {
                    returnValue.push(token)
                    if (token.type === 'TagOpenEnd') {
                        mode = TokenizerMode.Contents
                    }
                    if (token.type === 'Property') {
                        //
                        // Consume any whitespace first...
                        //
                        const checkWhitespace = whiteSpaceTokenizer(sourceStream)
                        if (checkWhitespace) {
                            if (isTokenError(checkWhitespace)) {
                                return {
                                    success: false,
                                    error: checkWhitespace
                                }
                            }
                            returnValue.push(checkWhitespace)
                        }
                        //
                        // ... and then confirm that a value follows the key
                        //
                        const checkValue = checkSubTokenizers<TokenLiteralValue | TokenKeyValue | TokenExpressionValue>({
                            sourceStream,
                            subTokenizers: [literalValueTokenizer, keyValueTokenizer, expressionValueTokenizer],
                            callback: (token) => {
                                returnValue.push(token)
                            }
                        })
                        if (checkValue) {
                            if (checkValue.success === false) {
                                return checkValue
                            }
                        }
                        else {
                            return {
                                success: false,
                                error: {
                                    type: 'Error',
                                    source: sourceStream.lookAhead(1),
                                    startIdx: sourceStream.position,
                                    endIdx: sourceStream.position,
                                    message: 'Unexpected token'
                                }
                            }
                        }
                    }
                }
            })
            if (checkSubTokens) {
                if (checkSubTokens.success === false) {
                    return [checkSubTokens.error]
                }
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
