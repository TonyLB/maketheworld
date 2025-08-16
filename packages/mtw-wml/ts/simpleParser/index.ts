import { AssetUUID, isSchemaAssetUUID } from "@tonylb/mtw-base/ts/schema"
import { Token, TokenProperty, TokenKeyValue } from "../parser/tokenizer/baseClasses"
import { ParseItem, ParsePropertyTypes, ParsePropertyAssetList, ParseTagOpen, ParseTypes } from "./baseClasses"

enum ParseExpectation {
    Tags,
    Properties,
    PropertyValue
}

export const deIndentParse = (wml: string): string => {
    const deIndentAmount = wml.split('\n').slice(1).reduce<number>((previous, line) => {
        if (!line.trim()) {
            return previous
        }
        const lineIndent = line.length - line.trimStart().length
        return Math.min(lineIndent, previous)
    }, Infinity)
    if (deIndentAmount === Infinity || deIndentAmount === 0) {
        return wml
    }
    return [
        wml.split('\n')[0],
        ...wml
            .split('\n')
            .slice(1)
            .map((line) => (line.slice(deIndentAmount)))
    ].join('\n')
}

export const parse = (tokens: Token[]): ParseItem[] => {
    let accumulator: ParseItem[] = []
    let expecting: ParseExpectation = ParseExpectation.Tags
    let currentTag: ParseTagOpen | undefined
    let currentProperty: TokenProperty | undefined
    let firstTag: boolean = true
    let currentText: string | undefined

    // Helper function to handle comma-separated AssetUUID parsing
    const handleCommaSeparatedAssetList = (token: TokenKeyValue, propertyKey?: string) => {
        if (token.type === 'KeyValue' && token.value.includes(',')) {
            // Split by comma and trim whitespace from each value
            const assetList = token.value.split(',').map(item => item.trim())
            if (assetList.some(item => !isSchemaAssetUUID(item))) {
                throw new Error('Invalid asset list')
            }
            return {
                key: propertyKey,
                type: ParsePropertyTypes.AssetList,
                value: assetList as AssetUUID[]
            } as ParsePropertyAssetList
        }
        return null
    }

    for (const token of tokens) {
        switch (expecting) {
            case ParseExpectation.Properties:
                switch (token.type) {
                    case 'TagOpenEnd':
                        if (!currentTag) {
                            throw new Error('Parse error on closing open tag')
                        }
                        accumulator.push({ ...currentTag, type: token.selfClosing ? ParseTypes.SelfClosure : ParseTypes.Open })
                        currentTag = undefined
                        expecting = ParseExpectation.Tags
                        firstTag = !token.selfClosing
                        currentText = undefined
                        break
                    case 'Property':
                        if (token.isBoolean) {
                            if (!currentTag) {
                                throw new Error('Parse error on property assignment')
                            }
                            currentTag.properties.push({
                                key: token.key,
                                type: ParsePropertyTypes.Boolean,
                                value: true
                            })
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
                    case 'KeyValue':
                    case 'ExpressionValue':
                    case 'LiteralValue':
                        if (!currentTag) {
                            throw new Error('Parse error on property assignment')
                        }
                        
                        // If we have a currentProperty, this is a value for a property with a key
                        // Check if this is a KeyValue that might be a comma-separated list
                        if (token.type === 'KeyValue') {
                            const assetListProperty = handleCommaSeparatedAssetList(token, currentProperty?.key)
                            if (assetListProperty) {
                                currentTag.properties.push(assetListProperty)
                                currentProperty = undefined
                            } else if (currentProperty) {
                                // Handle as before for single values
                                currentTag.properties.push({
                                    key: currentProperty.key,
                                    type: ParsePropertyTypes.Key,
                                    value: deIndentParse(token.value)
                                })
                                currentProperty = undefined
                            } else {
                                // This is a property without a key
                                currentTag.properties.push({
                                    type: ParsePropertyTypes.Key,
                                    value: deIndentParse(token.value)
                                })
                            }
                        } else {
                            // Handle non-KeyValue tokens
                            currentTag.properties.push({
                                key: currentProperty?.key,
                                type: token.type === 'LiteralValue'
                                    ? ParsePropertyTypes.Literal
                                    : ParsePropertyTypes.Expression,
                                value: deIndentParse(token.value)
                            })
                        }
                        currentProperty = undefined
                        expecting = ParseExpectation.Properties
                        break;
                    default:
                        throw new Error('Invalid parse token')
                }
                break
            case ParseExpectation.PropertyValue:
                switch(token.type) {
                    case 'Whitespace':
                    case 'Comment':
                        break
                    case 'KeyValue':
                    case 'ExpressionValue':
                    case 'LiteralValue':
                        if (!currentTag) {
                            throw new Error('Parse error on property assignment')
                        }
                        if (!currentProperty) {
                            throw new Error('Parse error on property value assignment')
                        }
                        
                        // Check if this is a KeyValue that might be a comma-separated list
                        if (token.type === 'KeyValue') {
                            const assetListProperty = handleCommaSeparatedAssetList(token, currentProperty.key)
                            if (assetListProperty) {
                                currentTag.properties.push(assetListProperty)
                            } else {
                                // Handle as before for single values
                                currentTag.properties.push({
                                    key: currentProperty.key,
                                    type: ParsePropertyTypes.Key,
                                    value: deIndentParse(token.value)
                                })
                            }
                        } else {
                            // Handle non-KeyValue tokens (LiteralValue, ExpressionValue)
                            currentTag.properties.push({
                                key: currentProperty.key,
                                type: token.type === 'LiteralValue'
                                    ? ParsePropertyTypes.Literal
                                    : ParsePropertyTypes.Expression,
                                value: deIndentParse(token.value)
                            })
                        }
                        
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
                        if (typeof currentText !== 'undefined') {
                            accumulator.push({
                                type: ParseTypes.Text,
                                text: currentText
                            })
                        }
                        currentText = undefined
                        currentTag = {
                            type: ParseTypes.Open,
                            tag: token.tag,
                            properties: []
                        }
                        expecting = ParseExpectation.Properties
                        firstTag = true
                        break
                    case 'TagClose':
                        if ((currentText || '').trimEnd()) {
                            accumulator.push({
                                type: ParseTypes.Text,
                                text: (currentText || '').trimEnd()
                            })
                        }
                        currentText = undefined
                        accumulator.push({
                            type: ParseTypes.Close,
                            tag: token.tag
                        })
                        firstTag = false
                        break
                    case 'Description':
                        currentText = `${currentText || ''}${token.value}`
                        firstTag = false
                        break
                    case 'Whitespace':
                    case 'Comment':
                        if (!firstTag) {
                            currentText = `${(currentText || '').trimEnd()} `
                        }
                        break
                    default:
                        throw new Error('Invalid parse token')
                }
        }
    }
    if (currentText) {
        accumulator.push({
            type: ParseTypes.Text,
            text: currentText.trim()
        })
    }
    return accumulator
}

export default parse