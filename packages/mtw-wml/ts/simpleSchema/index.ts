import { SchemaTag } from "../schema/baseClasses"
import { ParseItem, ParseTypes } from "../simpleParser/baseClasses"
import { SchemaContextItem } from "./baseClasses"
import converterMap from "./converters"
import { compressWhitespace } from "./utils"

export const schemaFromParse = (items: ParseItem[]): SchemaTag[] => {
    let contextStack: SchemaContextItem[] = []
    let returnValue: SchemaTag[] = []
    const addSchemaTag = (toAdd: SchemaTag) => {
        if (contextStack.length) {
            const [priorStack, parentItem] = [contextStack.slice(0, -1), contextStack.slice(-1)[0]]
            contextStack = [
                ...priorStack,
                {
                    ...parentItem,
                    contents: [...parentItem.contents, toAdd]
                }
            ]
        }
        else {
            returnValue.push(toAdd)
        }
    }
    items.forEach((item) => {
        switch(item.type) {
            case ParseTypes.Text:
                addSchemaTag({
                    tag: 'String',
                    value: item.text
                })
                break
            case ParseTypes.SelfClosure:
                addSchemaTag(converterMap[item.tag].initialize({ parseOpen: item, contextStack }))
                break
            case ParseTypes.Open:
                contextStack.push({
                    tag: converterMap[item.tag].initialize({ parseOpen: item, contextStack }),
                    contents: []
                })
                break
            case ParseTypes.Close:
                if (contextStack.length === 0) {
                    throw new Error(`Mismatched tag closure ('${item.tag}' matches nothing)`)
                }
                const [priorStack, closingItem] = [contextStack.slice(0, -1), contextStack.slice(-1)[0]]
                if (closingItem.tag.tag !== item.tag && !(['ElseIf', 'Else'].includes(item.tag) && closingItem.tag.tag === 'If')) {
                    throw new Error(`Mismatched tag closure ('${item.tag}') does not match '${closingItem.tag.tag}'`)
                }
                contextStack = priorStack
                //
                // TODO: When all legalContents items are implemented, refactor the below to throw an error whenever there is
                // not a legalContents function (and there are contents)
                //
                const converter = converterMap[closingItem.tag.tag]
                if (!converter) {
                    throw new Error(`No converter available for '${closingItem.tag.tag}' parse tag`)
                }
                const illegalTag = closingItem.contents.find((item) => (converter.legalContents && !converter.legalContents(item, contextStack)))
                if (illegalTag) {
                    throw new Error(`Illegal tag ('${illegalTag.tag}') in '${closingItem.tag.tag}' item contents`)
                }
                addSchemaTag(
                    converter.finalize
                        ? converter.finalize(closingItem.tag, closingItem.contents, contextStack)
                        : closingItem.tag
                    )
                break
        }
    })
    return returnValue
}
