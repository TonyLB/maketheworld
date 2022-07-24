import {
    isTokenError,
    Token,
    TokenDescription,
    TokenTagClose,
    TokenTagOpenBegin,
    TokenTagOpenEnd,
    TokenWhitespace,
    TokenProperty,
    TokenLiteralValue,
    TokenKeyValue,
    TokenExpressionValue,
} from "./baseClasses"
import expressionValueTokenizer from "./expression"
import keyValueTokenizer from "./key"
import literalValueTokenizer from "./literal"
import SourceStream from "./sourceStream"
import tagCloseTokenizer from "./tagClose"
import descriptionTokenizer from "./description"

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
    let returnValue: Token[] = []

    let currentDescription: TokenDescription | undefined
    let currentWhitespace: TokenWhitespace | undefined
    while(!sourceStream.isEndOfSource) {
        if (mode === TokenizerMode.Contents) {
            //
            // TODO: Parse and buffer Descriptions, merging together whitespace as you go,
            // and checking for \-escaped characters, instead of regarding other data as an error.
            //
            const checkSubTokens = checkSubTokenizers<TokenWhitespace | TokenTagClose | TokenTagOpenBegin | TokenDescription>({
                sourceStream,
                subTokenizers: [whiteSpaceTokenizer, tagCloseTokenizer, tagOpenBeginTokenizer, descriptionTokenizer],
                callback: (token) => {
                    if (token.type === 'TagClose' || token.type === 'TagOpenBegin') {
                        if (currentDescription) {
                            returnValue.push(currentDescription)
                            currentDescription = undefined
                        }
                        if (currentWhitespace) {
                            returnValue.push(currentWhitespace)
                            currentWhitespace = undefined
                        }
                        returnValue.push(token)
                        if (token.type === 'TagOpenBegin') {
                            mode = TokenizerMode.Tag
                        }
                    }
                    if (token.type === 'Whitespace') {
                        if (currentDescription) {
                            currentDescription = {
                                type: 'Description',
                                startIdx: currentDescription.startIdx,
                                endIdx: token.endIdx,
                                source: sourceStream.source.slice(currentDescription.startIdx, token.endIdx)
                            }
                        }
                        else {
                            currentWhitespace = token
                        }
                    }
                    if (token.type === 'Description') {
                        if (currentDescription) {
                            currentDescription = {
                                type: 'Description',
                                startIdx: currentDescription.startIdx,
                                endIdx: token.endIdx,
                                source: sourceStream.source.slice(currentDescription.startIdx, token.endIdx)
                            }
                        }
                        else if (currentWhitespace) {
                            currentDescription = {
                                type: 'Description',
                                startIdx: currentWhitespace.startIdx,
                                endIdx: token.endIdx,
                                source: sourceStream.source.slice(currentWhitespace.startIdx, token.endIdx)
                            }
                            currentWhitespace = undefined
                        }
                        else {
                            currentDescription = token
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
                startIdx: sourceStream.position,
                endIdx: sourceStream.position,
                source: sourceStream.lookAhead(1),
                message: 'Unexpected token'
            }]
        }
        else {
            const checkSubTokens = checkSubTokenizers<TokenTagOpenEnd | TokenWhitespace | TokenProperty>({
                sourceStream,
                subTokenizers: [tagOpenEndTokenizer, whiteSpaceTokenizer, tagPropertyTokenizer],
                callback: (token) => {
                    returnValue.push(token)
                    if (token.type === 'TagOpenEnd') {
                        mode = TokenizerMode.Contents
                    }
                    if (token.type === 'Property' && !token.isBoolean) {
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
