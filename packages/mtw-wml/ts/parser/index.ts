import {
    Token,
    isStackTokenPropertyOrValue,
    TokenProperty,
    TokenExpressionValue,
    TokenKeyValue,
    TokenLiteralValue,
    isLegalBareToken,
    isTokenComment,
    isTokenWhitespace,
    isTokenDescription,
    ParseStackTokenEntry
} from './tokenizer/baseClasses'

import {
    ParseTag,
    ParseTagFactory,
    ParseStackEntry,
    ParseException,
    ParseStackTagOpenEntry,
    isParseStackTagOpenEntry
} from './baseClasses'

import parseAssetFactory, { parseStoryFactory } from './asset'
import parseRoomFactory from './room'
import parseFeatureFactory from './feature'
import parseMapFactory from './map'
import parseConditionFactory from './condition'
import parseLinkFactory from './link'
import parseLineBreakFactory from './lineBreak'
import parseDescriptionFactory from './description'
import parseExitFactory from './exit'
import parseUseFactory from './use'
import parseImportFactory from './import'
import parseDependFactory from './depend'
import parseVariableFactory from './variable'
import parseComputedFactory from './computed'
import parseActionFactory from './action'
import parseNameFactory from './name'
import parseCharacterFactory, { parsePronounsFactory, parseOutfitFactory, parseOneCoolThingFactory } from './character'
import parseImageFactory from './image'

export const createParseTag: ParseTagFactory<ParseTag> = (props) => {
    switch(props.open.tag) {
        case 'Character':
            return parseCharacterFactory(props)
        case 'Pronouns':
            return parsePronounsFactory(props)
        case 'Outfit':
            return parseOutfitFactory(props)
        case 'OneCoolThing':
            return parseOneCoolThingFactory(props)
        case 'Image':
            return parseImageFactory(props)
        case 'Asset':
            return parseAssetFactory(props)
        case 'Story':
            return parseStoryFactory(props)
        case 'Room':
            return parseRoomFactory(props)
        case 'Feature':
            return parseFeatureFactory(props)
        case 'Condition':
            return parseConditionFactory(props)
        case 'Link':
            return parseLinkFactory(props)
        case 'br':
            return parseLineBreakFactory(props)
        case 'Description':
            return parseDescriptionFactory(props)
        case 'Exit':
            return parseExitFactory(props)
        case 'Map':
            return parseMapFactory(props)
        case 'Use':
            return parseUseFactory(props)
        case 'Import':
            return parseImportFactory(props)
        case 'Depend':
            return parseDependFactory(props)
        case 'Variable':
            return parseVariableFactory(props)
        case 'Computed':
            return parseComputedFactory(props)
        case 'Action':
            return parseActionFactory(props)
        case 'Name':
            return parseNameFactory(props)
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

export const parse = (tokens: Token[]): ParseTag[] => {
    let returnValue: ParseTag[] = []
    let stack: ParseStackEntry[] = []
    let context: ParseStackTagOpenEntry[] = []
    tokens.forEach((token, index) => {
        switch(token.type) {
            case 'TagOpenBegin':
                stack.push({
                    type: 'TagOpenPending',
                    tag: token.tag,
                    startTagToken: index
                })
                break
            case 'TagOpenEnd':
                let propertyTags: ParseStackTokenEntry<TokenProperty | TokenExpressionValue | TokenKeyValue | TokenLiteralValue>[] = []
                while(stack.length > 0) {
                    const stackItem = stack.pop()
                    if (stackItem.type === 'Tag') {
                        throw new ParseException('Unexpected tag-end', index, index)
                    }
                    if (stackItem.type === 'TagOpen') {
                        throw new ParseException('Illegal nested tag opening', index, index)
                    }
                    if (stackItem.type === 'Token') {
                        if (isStackTokenPropertyOrValue(stackItem)) {
                            propertyTags.push(stackItem)
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
                            if (firstTag.token.type !== 'Property') {
                                throw new ParseException('Unexpected value token', firstTag.index, firstTag.index)
                            }
                            //
                            // TODO: Validate that no key is assigned twice
                            //
                            if (firstTag.token.isBoolean) {
                                properties[firstTag.token.key] = firstTag.token.value
                            }
                            else {
                                const secondTag = propertyTags.pop()
                                if (secondTag.token.type === 'Property') {
                                    throw new ParseException('Unexpected property token', secondTag.index, secondTag.index)
                                }
                                else {
                                    properties[firstTag.token.key] = secondTag.token
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
                                context: stack.filter(isParseStackTagOpenEntry),
                                contents: [],
                                endTagToken: index
                            })
                            if (stack.length > 0) {
                                stack.push(stackTag)
                            }
                            else {
                                returnValue.push(stackTag.tag)
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
                        throw new ParseException('Unexpected tag-close', index, index)
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
                            context: stack.filter(isParseStackTagOpenEntry),
                            contents,
                            endTagToken: index
                        })
                        if (stack.length > 0) {
                            stack.push(stackTag)
                        }
                        else {
                            returnValue.push(stackTag.tag)
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
    return returnValue
}

export default parse
