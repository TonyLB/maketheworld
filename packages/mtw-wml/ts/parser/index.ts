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
    isParseStackTagOpenEntry,
    parseTagDefaultProps,
    isParseLegalTag,
    ParseConditionTag,
    isLegalParseConditionContextTag,
    ParseTagFactoryProps,
    ParseTagFactoryPropsLimited,
    ParseCommentTag,
    ParseStackTagEntry
} from './baseClasses'

import parseAssetFactory, { parseStoryFactory } from './asset'
import parseRoomFactory from './room'
import parseFeatureFactory from './feature'
import parseMapFactory from './map'
import parseConditionFactory from './condition'
import parseLinkFactory from './link'
import parseLineBreakFactory from './lineBreak'
import parseSpacerFactory from './spacer'
import parseDescriptionFactory from './description'
import parseExitFactory from './exit'
import parseUseFactory from './use'
import parseImportFactory from './import'
import parseVariableFactory from './variable'
import parseComputedFactory from './computed'
import parseActionFactory from './action'
import parseNameFactory from './name'
import parseCharacterFactory, { parsePronounsFactory, parseOutfitFactory, parseOneCoolThingFactory } from './character'
import parseImageFactory from './image'
import parseElseFactory from './else'
import parseElseIfFactory from './elseif'
import parseBookmarkFactory from './bookmark'
import { composeConvertersHelper } from '../functionMixins'

const wrapConditionalContext = (props: ParseTagFactoryProps) => {
    //
    // Provide context so that Conditionals can parse different legal contents depending upon what
    // is legal for the tag they are nested inside
    //
    const contextTagRaw = props.context.reduce<ParseConditionTag["contextTag"]>((previous, item) => {
        const tag = item.tag
        if (isLegalParseConditionContextTag(tag)) {
            return tag
        }
        return previous
    }, undefined)
    const contextTag = contextTagRaw === 'Bookmark' ? 'Description' : contextTagRaw
    switch(props.open.tag) {
        case 'If':
            return parseConditionFactory(contextTag)(props)
        case 'Else':
            return parseElseFactory(contextTag)(props)
        case 'ElseIf':
            return parseElseIfFactory(contextTag)(props)
    }
}

const isTypedParseTagOpen = <T>(tag: T) => (props: ParseTagFactoryProps): props is ParseTagFactoryPropsLimited<T extends ParseTag["tag"] | 'Character' ? T : never> => (props.open.tag === tag)

const createParseTag = composeConvertersHelper(
    {
        fallback: (props) => ({
            type: 'Tag',
            tag: {
                tag: 'Comment',
                startTagToken: props.open.startTagToken,
                endTagToken: props.endTagToken
            }
        } as ParseStackTagEntry<ParseCommentTag>)
    },
    {
        typeGuard: isTypedParseTagOpen('Character' as 'Character'),
        convert: parseCharacterFactory
    },
    {
        typeGuard: isTypedParseTagOpen('Pronouns' as 'Pronouns'),
        convert: parsePronounsFactory
    },
    {
        typeGuard: isTypedParseTagOpen('Outfit' as 'Outfit'),
        convert: parseOutfitFactory
    },
    {
        typeGuard: isTypedParseTagOpen('OneCoolThing' as 'OneCoolThing'),
        convert: parseOneCoolThingFactory
    },
    {
        typeGuard: isTypedParseTagOpen('Image' as 'Image'),
        convert: parseImageFactory
    },
    {
        typeGuard: isTypedParseTagOpen('Asset' as 'Asset'),
        convert: parseAssetFactory
    },
    {
        typeGuard: isTypedParseTagOpen('Story' as 'Story'),
        convert: parseStoryFactory
    },
    {
        typeGuard: isTypedParseTagOpen('Room' as 'Room'),
        convert: parseRoomFactory
    },
    {
        typeGuard: isTypedParseTagOpen('Feature' as 'Feature'),
        convert: parseFeatureFactory
    },
    {
        typeGuard: isTypedParseTagOpen('If' as 'If'),
        convert: wrapConditionalContext
    },
    {
        typeGuard: isTypedParseTagOpen('ElseIf' as 'ElseIf'),
        convert: wrapConditionalContext
    },
    {
        typeGuard: isTypedParseTagOpen('Else' as 'Else'),
        convert: wrapConditionalContext
    },
    {
        typeGuard: isTypedParseTagOpen('Link' as 'Link'),
        convert: parseLinkFactory
    },
    {
        typeGuard: isTypedParseTagOpen('Bookmark' as 'Bookmark'),
        convert: parseBookmarkFactory
    },
    {
        typeGuard: isTypedParseTagOpen('br' as 'br'),
        convert: parseLineBreakFactory
    },
    {
        typeGuard: isTypedParseTagOpen('Space' as 'Space'),
        convert: parseSpacerFactory
    },
    {
        typeGuard: isTypedParseTagOpen('Description' as 'Description'),
        convert: parseDescriptionFactory
    },
    {
        typeGuard: isTypedParseTagOpen('Exit' as 'Exit'),
        convert: parseExitFactory
    },
    {
        typeGuard: isTypedParseTagOpen('Map' as 'Map'),
        convert: parseMapFactory
    },
    {
        typeGuard: isTypedParseTagOpen('Use' as 'Use'),
        convert: parseUseFactory
    },
    {
        typeGuard: isTypedParseTagOpen('Import' as 'Import'),
        convert: parseImportFactory
    },
    {
        typeGuard: isTypedParseTagOpen('Variable' as 'Variable'),
        convert: parseVariableFactory
    },
    {
        typeGuard: isTypedParseTagOpen('Computed' as 'Computed'),
        convert: parseComputedFactory
    },
    {
        typeGuard: isTypedParseTagOpen('Action' as 'Action'),
        convert: parseActionFactory
    },
    {
        typeGuard: isTypedParseTagOpen('Name' as 'Name'),
        convert: parseNameFactory
    },
)

export const parse = (tokens: Token[]): ParseTag[] => {
    let returnValue: ParseTag[] = []
    let stack: ParseStackEntry[] = []
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
                                if (parseTagDefaultProps[stackItem.tag]) {
                                    properties[parseTagDefaultProps[stackItem.tag]] = firstTag.token
                                }
                                else {
                                    throw new ParseException('Unexpected value token', firstTag.index, firstTag.index)
                                }
                            }
                            else {
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
                        }
                        const tag = stackItem.tag
                        if (!isParseLegalTag(tag)) {
                            throw new ParseException(`Illegal parse tag: ${tag}`, stackItem.startTagToken, stackItem.startTagToken)
                        }
                        if (token.selfClosing) {
                            const stackTag = createParseTag({
                                open: {
                                    type: 'TagOpen',
                                    tag,
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
                                tag,
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
