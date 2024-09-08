import { SchemaTag, SchemaToWMLTopLevelOptions, isSchemaString } from "./baseClasses"
import { ParseItem, ParseTagClose, ParseTagOpen, ParseTagSelfClosure, ParseTypes } from "../simpleParser/baseClasses"
import converterMap, { printMap } from "./converters"
import { PrintMapEntry } from "./converters/baseClasses"
import { optionsFactory, validateContents } from "./converters/utils"
import { GenericTree, GenericTreeNode } from "../tree/baseClasses"
import SourceStream from "../parser/tokenizer/sourceStream"
import tokenizer from "../parser/tokenizer"
import parse from "../simpleParser"
import { lineLengthAfterIndent } from "./converters/printUtils"
import { maxLineLength } from "./converters/quantumRender/freeText"

class SchemaAggregator {
    contextStack: GenericTree<SchemaTag> = [];
    returnValue: GenericTree<SchemaTag> = [];

    addSchemaTag (toAdd: GenericTreeNode<SchemaTag>) {
        if (this.contextStack.length) {
            const [priorStack, parentItem] = [this.contextStack.slice(0, -1), this.contextStack.slice(-1)[0]]
            this.contextStack = [
                ...priorStack,
                {
                    ...parentItem,
                    children: [...parentItem.children, toAdd]
                }
            ]
        }
        else {
            this.returnValue.push(toAdd)
        }
    }

    get nearestSibling(): GenericTreeNode<SchemaTag> | undefined {
        if (this.contextStack.length === 0) {
            return undefined
        }
        const parentContext = this.contextStack.slice(-1)[0]
        return parentContext.children.reduceRight<GenericTreeNode<SchemaTag> | undefined>((previous, node) => {
            if (previous) {
                return previous
            }
            const { data } = node
            if (isSchemaString(data) && !data.value.trim()) {
                return undefined
            }
            return node
        }, undefined)
    }

    get currentOpenItem(): GenericTreeNode<SchemaTag> | undefined {
        if (this.contextStack.length === 0) {
            return undefined
        }
        return this.contextStack.slice(-1)[0]
    }

    removeTrailingWhitespace(): void {
        if (this.contextStack.length === 0) {
            return
        }
        const parentContext = this.contextStack.slice(-1)[0]
        const revisedChildren = parentContext.children.reduceRight<GenericTree<SchemaTag>>((previous, node) => {
            if (previous.length) {
                return [node, ...previous]
            }
            const { data } = node
            if (isSchemaString(data) && !data.value.trim()) {
                return []
            }
            return [node]
        }, [])
        this.contextStack = [...this.contextStack.slice(0, -1), { ...parentContext, children: revisedChildren }]
    }

    closeContext(options?: {
        validateItem?: (value: GenericTreeNode<SchemaTag>) => void;
        finalize?: (initialTag: SchemaTag, contents: GenericTree<SchemaTag>, contextStack: GenericTree<SchemaTag>) => GenericTreeNode<SchemaTag>;
    }): void {
        const { validateItem, finalize } = options ?? {}
        const [priorStack, closingItem] = [this.contextStack.slice(0, -1), this.contextStack.slice(-1)[0]]
        this.contextStack = priorStack
        if (validateItem) {
            validateItem(closingItem)
        }
        const finalItem = finalize ? finalize(closingItem.data, closingItem.children, priorStack) : closingItem
        this.addSchemaTag(finalItem)
    }

    openContext(node: GenericTreeNode<SchemaTag>): void {
        this.contextStack.push(node)
    }

    reopenSibling(): void {
        if (this.contextStack.length === 0) {
            throw new Error('Empty stack on reopenSibling')
        }
        const parentContext = this.contextStack.slice(-1)[0]
        if (parentContext.children.length === 0) {
            throw new Error('No siblings on reopenSibling')
        }
        const [revisedChildren, sibling] = [parentContext.children.slice(0, -1), parentContext.children.slice(-1)[0]]
        this.contextStack = [...this.contextStack.slice(0, -1), { ...parentContext, children: revisedChildren }, sibling]
    }

    aggregateToSibling(aggregator: (previous: GenericTreeNode<SchemaTag>, node: GenericTreeNode<SchemaTag>) => GenericTreeNode<SchemaTag>): void {
        if (this.contextStack.length === 0) {
            throw new Error('Empty stack on reopenSibling')
        }
        const parentContext = this.contextStack.slice(-1)[0]
        if (parentContext.children.length === 0) {
            throw new Error('No siblings on reopenSibling')
        }
        const [previous, node] = [parentContext.children.slice(0, -1), parentContext.children.slice(-1)[0]]
        this.contextStack = [...this.contextStack.slice(0, -1), aggregator({ ...parentContext, children: previous }, node)]
    }

    validateClosure(tag: string): void {
        if (this.contextStack.length === 0) {
            throw new Error(`Mismatched tag closure ('${tag}' matches nothing)`)
        }
        const closingItem = this.contextStack.slice(-1)[0]
        if (closingItem.data.tag !== tag) {
            if (!(
                (['If', 'ElseIf'].includes(tag) && closingItem.data.tag === 'Statement') ||
                (tag === 'Else' && closingItem.data.tag === 'Fallthrough') ||
                (tag === 'Replace' && closingItem.data.tag === 'ReplaceMatch') ||
                (tag === 'With' && closingItem.data.tag === 'ReplacePayload')
            )) {
                throw new Error(`Mismatched tag closure ('${tag}') does not match '${closingItem.data.tag}'`)
            }
        }
    }

    acceptOpenTag(item: ParseTagOpen | ParseTagSelfClosure): void {
        const converterWrapper = converterMap[item.tag]?.wrapper
        const nearestSibling = this.nearestSibling
        if (converterWrapper) {
            const aggregateFunction = converterMap[item.tag]?.aggregate
            if (aggregateFunction) {
                if (nearestSibling?.data?.tag !== converterWrapper) {
                    throw new Error(`${item.tag} must be part of a group of tags`)
                }
                this.removeTrailingWhitespace()
                this.reopenSibling()
            }
            else {
                this.openContext({
                    data: { tag: converterWrapper },
                    children: []
                })
            }
        }
        this.openContext({
            data: converterMap[item.tag].initialize({ parseOpen: item, contextStack: this.contextStack }),
            children: []
        })
    }

    acceptCloseTag(item: ParseTagClose | ParseTagSelfClosure): void {
        const converterWrapper = converterMap[item.tag]?.wrapper
        const nearestSibling = this.nearestSibling
        this.validateClosure(item.tag)
        //
        // TODO: When all typeCheckContents items are implemented, refactor the below to throw an error whenever there is
        // not a typeCheckContents function (and there are contents)
        //
        const currentOpenItem = this.currentOpenItem
        if (!currentOpenItem) {
            throw new Error(`Mismatched tag closure ('${item.tag}' matches nothing)`)
        }
        const converter = converterMap[currentOpenItem.data.tag]
        if (!converter) {
            throw new Error(`No converter available for '${currentOpenItem.data.tag}' parse tag`)
        }
        this.closeContext({
            validateItem: (closingItem) => {
                const illegalTag = closingItem.children.map(({ data }) => (data)).find((item) => (converter.typeCheckContents && !converter.typeCheckContents(item, this.contextStack)))
                if (illegalTag) {
                    throw new Error(`Illegal tag ('${illegalTag.tag}') in '${closingItem.data.tag}' item contents`)
                }
                if (converter.validateContents) {
                    if (!validateContents(converter.validateContents)(closingItem.children)) {
                        throw new Error(`Illegal contents in '${closingItem.data.tag}' item`)
                    }
                }
            },
            finalize: converter.finalize
        })
        const aggregateFunction = converter.aggregate
        if (aggregateFunction) {
            this.removeTrailingWhitespace()
            this.aggregateToSibling(aggregateFunction)
            this.closeContext()
        }
    }
}

export const schemaFromParse = (items: ParseItem[]): GenericTree<SchemaTag> => {
    const aggregator = new SchemaAggregator()
    items.forEach((item) => {
        switch(item.type) {
            case ParseTypes.Text:
                aggregator.addSchemaTag({
                    data: {
                        tag: 'String',
                        value: item.text
                    },
                    children: []
                })
                break
            case ParseTypes.SelfClosure:
                aggregator.acceptOpenTag(item)
                aggregator.acceptCloseTag(item)
                break
            case ParseTypes.Open:
                aggregator.acceptOpenTag(item)
                break
            case ParseTypes.Close:
                aggregator.acceptCloseTag(item)
                break
        }
    })
    return aggregator.returnValue
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

export const schemaToWML = (tags: GenericTree<SchemaTag>, options: SchemaToWMLTopLevelOptions = {}): string => {
    const { returnValue } = tags.reduce<{ returnValue: string[]; siblings: GenericTree<SchemaTag> }>((previous, tag) => {
        const printOptions = printSchemaTag({ tag, options: { indent: 0, siblings: previous.siblings, context: [], ...options }, schemaToWML: printSchemaTag, optionsFactory })
        const { optimalIndex } = printOptions.reduce<{ optimalIndex: number; currentLength: number }>(
            (previous, output, index) => {
                if (previous.currentLength <= lineLengthAfterIndent(0)) {
                    return previous
                }
                const currentLength = maxLineLength(0, output.output)
                if (currentLength < previous.currentLength) {
                    return {
                        optimalIndex: index,
                        currentLength
                    }
                }
                return previous
            }, { optimalIndex: -1, currentLength: Infinity })
        if (optimalIndex === -1) {
            throw new Error('No print options found in schemaToWML')
        }
        return {
            returnValue: [
                ...previous.returnValue,
                printOptions[optimalIndex].output
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
        case 'Message':
        case 'Moment':
            return {
                tag,
                key: ''
            }
        case 'Action':
        case 'Computed':
            return {
                tag,
                key: '',
                src: '',
            }
        case 'Variable':
            return {
                tag,
                key: '',
                default: ''
            }
        case 'If':
        case 'Replace':
        case 'Description':
            return { tag }
        case 'Exit':
            return {
                tag,
                key: '',
                to: '',
                from: '',
            }
        default:
            return {
                tag: 'String',
                value: ''
            }
    }
}

export class Schema {
    _schema: GenericTree<SchemaTag> = [];

    loadWML(wml: string): void {
        this._schema = schemaFromParse(parse(tokenizer(new SourceStream(wml))))
    }

    get schema() { return this._schema }

}