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
import { BaseConverter, composeConvertersHelper } from '../convert/functionMixins'
import ParseMiscellaneousMixin from '../convert/miscellaneous'
import ParseCharacterMixin from '../convert/character'
import ParseTaggedMessageMixin from '../convert/taggedMessage'
import ParseStateMixin from '../convert/state'
import ParseImportMixin from '../convert/import'
import ParseComponentsMixin from '../convert/components'
import ParseConditionsMixin from '../convert/conditions'

const isTypedParseTagOpen = <T extends string>(tag: T) => (props: ParseTagFactoryProps): props is ParseTagFactoryPropsLimited<T extends ParseTag["tag"] | 'Character' ? T : never> => (props.open.tag === tag)

// @ts-ignore
//
// TypeScript thinks this is at risk of being infinitely deep, but in actuality it's just _very_ deep.
//
class ParseConverter extends
    ParseCharacterMixin(
    ParseConditionsMixin(
    ParseMiscellaneousMixin(
    ParseImportMixin(
    ParseStateMixin(
    ParseComponentsMixin(
    ParseTaggedMessageMixin(
        BaseConverter
    ))))))) {}

const parseConverter = new ParseConverter()

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
        typeGuard: isTypedParseTagOpen('Character'),
        convert: (props) => (parseConverter.convert(props))
    },
    {
        typeGuard: isTypedParseTagOpen('Pronouns'),
        convert: (props) => (parseConverter.convert(props))
    },
    {
        typeGuard: isTypedParseTagOpen('Outfit'),
        convert: (props) => (parseConverter.convert(props))
    },
    {
        typeGuard: isTypedParseTagOpen('OneCoolThing'),
        convert: (props) => (parseConverter.convert(props))
    },
    {
        typeGuard: isTypedParseTagOpen('Image'),
        convert: (props) => (parseConverter.convert(props))
    },
    {
        typeGuard: isTypedParseTagOpen('Asset'),
        convert: parseAssetFactory
    },
    {
        typeGuard: isTypedParseTagOpen('Story'),
        convert: parseStoryFactory
    },
    {
        typeGuard: isTypedParseTagOpen('Room'),
        convert: (props) => (parseConverter.convert(props))
    },
    {
        typeGuard: isTypedParseTagOpen('Feature'),
        convert: (props) => (parseConverter.convert(props))
    },
    {
        typeGuard: isTypedParseTagOpen('If'),
        convert: (props) => (parseConverter.convert(props))
    },
    {
        typeGuard: isTypedParseTagOpen('ElseIf'),
        convert: (props) => (parseConverter.convert(props))
    },
    {
        typeGuard: isTypedParseTagOpen('Else'),
        convert: (props) => (parseConverter.convert(props))
    },
    {
        typeGuard: isTypedParseTagOpen('Link'),
        convert: (props) => (parseConverter.convert(props))
    },
    {
        typeGuard: isTypedParseTagOpen('Bookmark'),
        convert: (props) => (parseConverter.convert(props))
    },
    {
        typeGuard: isTypedParseTagOpen('br'),
        convert: (props) => (parseConverter.convert(props))
    },
    {
        typeGuard: isTypedParseTagOpen('Space'),
        convert: (props) => (parseConverter.convert(props))
    },
    {
        typeGuard: isTypedParseTagOpen('Description'),
        convert: (props) => (parseConverter.convert(props))
    },
    {
        typeGuard: isTypedParseTagOpen('Exit'),
        convert: (props) => (parseConverter.convert(props))
    },
    {
        typeGuard: isTypedParseTagOpen('Map'),
        convert: (props) => (parseConverter.convert(props))
    },
    {
        typeGuard: isTypedParseTagOpen('Use'),
        convert: (props) => (parseConverter.convert(props))
    },
    {
        typeGuard: isTypedParseTagOpen('Import'),
        convert: (props) => (parseConverter.convert(props))
    },
    {
        typeGuard: isTypedParseTagOpen('Variable'),
        convert: (props) => (parseConverter.convert(props))
    },
    {
        typeGuard: isTypedParseTagOpen('Computed'),
        convert: (props) => (parseConverter.convert(props))
    },
    {
        typeGuard: isTypedParseTagOpen('Action'),
        convert: (props) => (parseConverter.convert(props))
    },
    {
        typeGuard: isTypedParseTagOpen('Name'),
        convert: (props) => (parseConverter.convert(props))
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
