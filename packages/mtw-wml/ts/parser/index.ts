import {
    Token,
    isTokenPropertyOrValue,
    TokenProperty,
    TokenExpressionValue,
    TokenKeyValue,
    TokenLiteralValue,
    isLegalBareToken,
    isTokenComment,
    isTokenWhitespace,
    isTokenDescription,
    isTokenError
} from './tokenizer/baseClasses'

import {
    ParseTag,
    ParseError,
    ParseTagFactory,
    ParseStackEntry,
    isParseStackTagError
} from './baseClasses'

import parseAssetFactory from './asset'
import parseRoomFactory from './room'

export const createParseTag: ParseTagFactory<ParseTag> = (props) => {
    switch(props.open.tag) {
        case 'Asset':
            return parseAssetFactory(props)
        case 'Room':
            return parseRoomFactory(props)
        default:
            return {
                type: 'Tag',
                tag: {
                    tag: 'Comment',
                    startTagToken: props.open.startTagToken,
                    endTagToken: props.endTagToken
                }
            }
    }
}

export const parse = (tokens: Token[]): (ParseTag | ParseError)[] => {
    let returnValue: (ParseTag | ParseError)[] = []
    let stack: ParseStackEntry[] = []
    let error: ParseError | undefined = undefined
    tokens.forEach((token, index) => {
        if (error) {
            return
        }
        switch(token.type) {
            case 'TagOpenBegin':
                stack.push({
                    type: 'TagOpenPending',
                    tag: token.tag,
                    startTagToken: index
                })
                break
            case 'TagOpenEnd':
                let propertyTags: (TokenProperty | TokenExpressionValue | TokenKeyValue | TokenLiteralValue)[] = []
                while(stack.length > 0) {
                    const stackItem = stack.pop()
                    if (stackItem.type === 'Tag') {
                        error = {
                            tag: 'Error',
                            message: 'Unexpected tag-end',
                            token
                        }
                        break
                    }
                    if (stackItem.type === 'TagOpen') {
                        error = {
                            tag: 'Error',
                            message: 'Illegal nested tag opening',
                            token
                        }
                        break
                    }
                    if (stackItem.type === 'Token') {
                        if (isTokenPropertyOrValue(stackItem.token)) {
                            propertyTags.push(stackItem.token)
                        }
                        continue
                    }
                    if (stackItem.type === 'TagOpenPending') {
                        //
                        // Assemble the tag open (possibly self-closing) from the open token, all
                        // the property tokens, and the close.
                        //
                        let properties: Record<string, (TokenExpressionValue | TokenKeyValue | TokenLiteralValue | boolean)> = {}
                        while(propertyTags.length > 0) {
                            const firstTag = propertyTags.pop()
                            if (firstTag.type !== 'Property') {
                                error = {
                                    tag: 'Error',
                                    message: 'Unexpected value token',
                                    token: firstTag
                                }
                                break
                            }
                            //
                            // TODO: Validate that no key is assigned twice
                            //
                            if (firstTag.isBoolean) {
                                properties[firstTag.key] = firstTag.value
                            }
                            else {
                                const secondTag = propertyTags.pop()
                                if (secondTag.type === 'Property') {
                                    error = {
                                        tag: 'Error',
                                        message: 'Unexpected property token',
                                        token: secondTag
                                    }
                                    break
                                }
                                else {
                                    properties[firstTag.key] = secondTag
                                }
                            }
                        }
                        if (token.selfClosing) {
                            const stackTag = createParseTag({
                                open: {
                                    type: 'TagOpen',
                                    tag: stackItem.tag,
                                    startTagToken: stackItem.startTagToken,
                                    properties
                                },
                                contents: [],
                                endTagToken: index
                            })
                            if (isParseStackTagError(stackTag)) {
                                error = stackTag.tag
                            }
                            else {
                                if (stack.length > 0) {
                                    stack.push(stackTag)
                                }
                                else {
                                    returnValue.push(stackTag.tag)
                                }    
                            }
                        }
                        else {
                            stack.push({
                                type: 'TagOpen',
                                tag: stackItem.tag,
                                startTagToken: stackItem.startTagToken,
                                properties
                            })
                        }
                        break
                    }
                }
                break
            case 'TagClose':
                let contents: ParseTag[] = []
                while(stack.length > 0) {
                    const stackItem = stack.pop()
                    if (stackItem.type === 'TagOpenPending') {
                        error = {
                            tag: 'Error',
                            message: 'Unexpected tag-close',
                            token
                        }
                        break
                    }
                    if (stackItem.type === 'Token') {
                        if (isLegalBareToken(stackItem.token)) {
                            if (isTokenComment(stackItem.token)) {
                                contents.unshift({
                                    tag: 'Comment',
                                    startTagToken: stackItem.index,
                                    endTagToken: stackItem.index
                                })
                            }
                            if (isTokenWhitespace(stackItem.token)) {
                                contents.unshift({
                                    tag: 'Whitespace',
                                    startTagToken: stackItem.index,
                                    endTagToken: stackItem.index
                                })
                            }
                            if (isTokenDescription(stackItem.token)) {
                                contents.unshift({
                                    tag: 'String',
                                    startTagToken: stackItem.index,
                                    endTagToken: stackItem.index,
                                    value: stackItem.token.value
                                })
                            }
                        }
                        continue
                    }
                    if (stackItem.type === 'Tag') {
                        contents.unshift(stackItem.tag)
                        continue
                    }
                    if (stackItem.type === 'TagOpen') {
                        const stackTag = createParseTag({
                            open: stackItem,
                            contents,
                            endTagToken: index
                        })
                        if (isParseStackTagError(stackTag)) {
                            error = stackTag.tag
                        }
                        else {
                            if (stack.length > 0) {
                                stack.push(stackTag)
                            }
                            else {
                                returnValue.push(stackTag.tag)
                            }
                        }
                        break
                    }
                }
                break

            default:
                //
                // Ignore whitespace outside of tags
                //
                if (!isTokenWhitespace(token) || stack.length) {
                    stack.push({
                        type: 'Token',
                        token,
                        index
                    })
                }
        }
    })
    if (error) {
        return [error]
    }
    return returnValue
}

export default parse
