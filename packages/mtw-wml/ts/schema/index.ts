import { SchemaTag } from "./baseClasses"
import { ParseItem, ParseTypes } from "../simpleParser/baseClasses"
import { SchemaContextItem } from "./baseClasses"
import converterMap, { printMap } from "./converters"
import { PrintMapEntry } from "./converters/baseClasses"
import { optionsFactory, validateContents } from "./converters/utils"
import { GenericTree, GenericTreeNode, TreeId } from "../tree/baseClasses"
import SourceStream from "../parser/tokenizer/sourceStream"
import tokenizer from "../parser/tokenizer"
import parse from "../simpleParser"
import { genericIDFromTree } from "../tree/genericIDTree"
import standardizeSchema from "./standardize"

export const schemaFromParse = (items: ParseItem[]): GenericTree<SchemaTag> => {
    let contextStack: SchemaContextItem[] = []
    let returnValue: GenericTree<SchemaTag> = []
    const addSchemaTag = (toAdd: GenericTreeNode<SchemaTag>) => {
        if (contextStack.length) {
            const [priorStack, parentItem] = [contextStack.slice(0, -1), contextStack.slice(-1)[0]]
            contextStack = [
                ...priorStack,
                {
                    ...parentItem,
                    children: [...parentItem.children, toAdd]
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
                    data: {
                        tag: 'String',
                        value: item.text
                    },
                    children: []
                })
                break
            case ParseTypes.SelfClosure:
                addSchemaTag({ data: converterMap[item.tag].initialize({ parseOpen: item, contextStack }), children: [] })
                break
            case ParseTypes.Open:
                contextStack.push({
                    tag: converterMap[item.tag].initialize({ parseOpen: item, contextStack }),
                    children: []
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
                // TODO: When all typeCheckContents items are implemented, refactor the below to throw an error whenever there is
                // not a typeCheckContents function (and there are contents)
                //
                const converter = converterMap[closingItem.tag.tag]
                if (!converter) {
                    throw new Error(`No converter available for '${closingItem.tag.tag}' parse tag`)
                }
                const illegalTag = closingItem.children.map(({ data }) => (data)).find((item) => (converter.typeCheckContents && !converter.typeCheckContents(item, contextStack)))
                if (illegalTag) {
                    throw new Error(`Illegal tag ('${illegalTag.tag}') in '${closingItem.tag.tag}' item contents`)
                }
                if (converter.validateContents) {
                    if (!validateContents(converter.validateContents)(closingItem.children)) {
                        throw new Error(`Illegal contents in '${closingItem.tag.tag}' item`)
                    }
                }
                addSchemaTag(
                    converter.finalize
                        ? converter.finalize(closingItem.tag, closingItem.children, contextStack)
                        : { data: closingItem.tag, children: closingItem.children }
                )
                break
        }
    })
    return returnValue
}

export const printSchemaTag: PrintMapEntry = (args) => {
    const { tag } = args
    if (tag.data.tag in printMap) {
        return printMap[tag.data.tag](args)
    }
    else {
        throw new Error(`Invalid tag ('${tag.data.tag}') in schemaToWML`)
    }
}

export const schemaToWML = (tags: GenericTree<SchemaTag>): string => {
    const { returnValue } = tags.reduce<{ returnValue: string[]; siblings: GenericTree<SchemaTag> }>((previous, tag) => {
        return {
            returnValue: [
                ...previous.returnValue,
                printSchemaTag({ tag, options: { indent: 0, siblings: previous.siblings, context: [] }, schemaToWML: printSchemaTag, optionsFactory })
            ],
            siblings: [
                ...previous.siblings,
                tag
            ]
        }
    }, { returnValue: [], siblings: [] })
    return returnValue.join('\n')
}

export const defaultSchemaTag = <T extends SchemaTag["tag"]>(tag: T): SchemaTag => {
    switch(tag) {
        case 'Room':
        case 'Feature':
        case 'Knowledge':
        case 'Bookmark':
        case 'Image':
        case 'Map':
        case 'Moment':
            return {
                tag,
                key: ''
            }
        case 'Action':
            return {
                tag,
                key: '',
                src: '',
            }
        case 'Computed':
            return {
                tag,
                key: '',
                src: ''
            }
        case 'Variable':
            return {
                tag,
                key: '',
                default: ''
            }
        case 'If':
            return {
                tag,
                key: '',
                conditions: []
            }
        case 'After':
        case 'Before':
        case 'Replace':
        case 'Description':
            return {
                tag,
            }
        case 'Exit':
            return {
                tag,
                key: '',
                name: '',
                to: '',
                from: '',
            }
        case 'Message':
            return {
                tag,
                key: '',
                rooms: [],
            }
        default:
            return {
                tag: 'String',
                value: ''
            }
    }
}

export class Schema {
    _schema: GenericTree<SchemaTag, TreeId> = [];

    loadWML(wml: string): void {
        const bareSchema = schemaFromParse(parse(tokenizer(new SourceStream(wml))))
        this._schema = genericIDFromTree(bareSchema)
    }

    get schema() { return this._schema }

    //
    // TODO: Copy standardize functionality from normalize to schema structure, and refactor
    //
}