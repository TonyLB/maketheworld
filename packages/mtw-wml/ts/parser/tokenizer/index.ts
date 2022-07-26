import {
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
    TokenComment,
    TokenizeException
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
import commentTokenizer from "./comments"

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
            const checkSubTokens = checkSubTokenizers<TokenComment | TokenWhitespace | TokenTagClose | TokenTagOpenBegin | TokenDescription>({
                sourceStream,
                subTokenizers: [commentTokenizer, whiteSpaceTokenizer, tagCloseTokenizer, tagOpenBeginTokenizer, descriptionTokenizer],
                callback: (token) => {
                    if (token.type === 'TagClose' || token.type === 'TagOpenBegin' || token.type === 'Comment') {
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
                                value: sourceStream.source.slice(currentDescription.startIdx, token.endIdx)
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
                                value: sourceStream.source.slice(currentDescription.startIdx, token.endIdx)
                            }
                        }
                        else if (currentWhitespace) {
                            currentDescription = {
                                type: 'Description',
                                startIdx: currentWhitespace.startIdx,
                                endIdx: token.endIdx,
                                value: sourceStream.source.slice(currentWhitespace.startIdx, token.endIdx)
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
                continue
            }
            return [{
                type: 'Error',
                startIdx: sourceStream.position,
                endIdx: sourceStream.position,
                message: 'Unexpected token'
            }]
        }
        else {
            const checkSubTokens = checkSubTokenizers<TokenTagOpenEnd | TokenComment | TokenWhitespace | TokenProperty>({
                sourceStream,
                subTokenizers: [tagOpenEndTokenizer, commentTokenizer, whiteSpaceTokenizer, tagPropertyTokenizer],
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
                        if (!checkValue) {
                            throw new TokenizeException('Unexpected token', sourceStream.position, sourceStream.position)
                        }
                    }
                }
            })
            if (!checkSubTokens) {
                throw new TokenizeException('Unexpected token', sourceStream.position, sourceStream.position)
            }
        }
    }
    return returnValue
}

export default tokenizer
