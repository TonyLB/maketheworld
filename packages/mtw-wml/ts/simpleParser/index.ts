import { Token, TokenProperty } from "../parser/tokenizer/baseClasses"
import { ParseItem, ParsePropertyTypes, ParseTagOpen, ParseTypes } from "./baseClasses"

enum ParseExpectation {
    Tags,
    Properties,
    PropertyValue
}

export const parse = (tokens: Token[]): ParseItem[] => {
    let accumulator: ParseItem[] = []
    let expecting: ParseExpectation = ParseExpectation.Tags
    let currentTag: ParseTagOpen | undefined
    let currentProperty: TokenProperty | undefined
    for (const token of tokens) {
        switch (expecting) {
            case ParseExpectation.Properties:
                switch (token.type) {
                    case 'TagOpenEnd':
                        accumulator.push({ ...currentTag, type: token.selfClosing ? ParseTypes.SelfClosure : ParseTypes.Open })
                        currentTag = undefined
                        expecting = ParseExpectation.Tags
                        break
                    case 'Property':
                        if (token.isBoolean) {
                            // currentTag.properties.push({ })
                            currentProperty = undefined
                        }
                        else {
                            currentProperty = token
                            expecting = ParseExpectation.PropertyValue
                        }
                        break
                    case 'Whitespace':
                    case 'Comment':
                        break
                    default:
                        throw new Error('Invalid parse token')
                }
                break
            case ParseExpectation.PropertyValue:
                if (typeof currentProperty === 'undefined') {
                    throw new Error('Parse failure at property value')
                }
                switch(token.type) {
                    case 'KeyValue':
                    case 'ExpressionValue':
                    case 'LiteralValue':
                        currentTag.properties.push({
                            key: currentProperty.key,
                            type: token.type === 'KeyValue'
                                ? ParsePropertyTypes.Key
                                : token.type === 'LiteralValue'
                                    ? ParsePropertyTypes.Literal
                                    : ParsePropertyTypes.Expression,
                            value: token.value
                        })
                        currentProperty = undefined
                        expecting = ParseExpectation.Properties
                        break;
                    default:
                        throw new Error('Invalid parse token')
                }
                break
            case ParseExpectation.Tags:
                switch(token.type) {
                    case 'TagOpenBegin':
                        currentTag = {
                            type: ParseTypes.Open,
                            tag: token.tag,
                            properties: []
                        }
                        expecting = ParseExpectation.Properties
                        break
                    case 'TagClose':
                        accumulator.push({
                            type: ParseTypes.Close,
                            tag: token.tag
                        })
                        break
                    case 'Description':
                        accumulator.push({
                            type: ParseTypes.Text,
                            text: token.value
                        })
                        break
                    case 'Whitespace':
                    case 'Comment':
                        break
                    default:
                        throw new Error('Invalid parse token')
                }
        }
    }
    return accumulator
}