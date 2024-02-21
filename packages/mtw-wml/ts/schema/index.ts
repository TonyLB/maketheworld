import { SchemaTag, isSchemaString } from "./baseClasses"
import { ParseItem, ParseTypes } from "../simpleParser/baseClasses"
import converterMap, { printMap } from "./converters"
import { PrintMapEntry } from "./converters/baseClasses"
import { optionsFactory, validateContents } from "./converters/utils"
import { GenericTree, GenericTreeNode, TreeId } from "../tree/baseClasses"
import SourceStream from "../parser/tokenizer/sourceStream"
import tokenizer from "../parser/tokenizer"
import parse from "../simpleParser"
import { genericIDFromTree } from "../tree/genericIDTree"
import standardizeSchema from "./standardize"
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
        if (closingItem.data.tag !== tag && !((['If', 'ElseIf'].includes(tag) && closingItem.data.tag === 'Statement') || (tag === 'Else' && closingItem.data.tag === 'Fallthrough'))) {
            throw new Error(`Mismatched tag closure ('${tag}') does not match '${closingItem.data.tag}'`)
        }
    }

}

export const schemaFromParse = (items: ParseItem[]): GenericTree<SchemaTag> => {
    const aggregator = new SchemaAggregator()
    items.forEach((item) => {
        const nearestSibling = aggregator.nearestSibling
        const converterWrapper = item.type === ParseTypes.Text ? undefined : converterMap[item.tag]?.wrapper
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
                if (converterWrapper && nearestSibling?.data?.tag === converterWrapper) {
                    aggregator.removeTrailingWhitespace()
                    aggregator.reopenSibling()
                    aggregator.addSchemaTag({ data: converterMap[item.tag].initialize({ parseOpen: item, contextStack: aggregator.contextStack }), children: [] })
                    const aggregateFunction = converterMap[item.tag]?.aggregate
                    if (aggregateFunction) {
                        aggregator.aggregateToSibling(aggregateFunction)
                    }
                    aggregator.closeContext()
                }
                else {
                    aggregator.addSchemaTag({ data: converterMap[item.tag].initialize({ parseOpen: item, contextStack: aggregator.contextStack }), children: [] })
                }
                break
            case ParseTypes.Open:
                if (converterWrapper) {
                    const aggregateFunction = converterMap[item.tag]?.aggregate
                    if (aggregateFunction) {
                        if (nearestSibling?.data?.tag !== converterWrapper) {
                            throw new Error(`${item.tag} must be part of a group of tags`)
                        }
                        aggregator.removeTrailingWhitespace()
                        aggregator.reopenSibling()
                    }
                    else {
                        aggregator.openContext({
                            data: { tag: converterWrapper },
                            children: []
                        })
                    }
                }
                aggregator.openContext({
                    data: converterMap[item.tag].initialize({ parseOpen: item, contextStack: aggregator.contextStack }),
                    children: []
                })
                break
            case ParseTypes.Close:
                aggregator.validateClosure(item.tag)
                //
                // TODO: When all typeCheckContents items are implemented, refactor the below to throw an error whenever there is
                // not a typeCheckContents function (and there are contents)
                //
                const currentOpenItem = aggregator.currentOpenItem
                if (!currentOpenItem) {
                    throw new Error(`Mismatched tag closure ('${item.tag}' matches nothing)`)
                }
                const converter = converterMap[currentOpenItem.data.tag]
                if (!converter) {
                    throw new Error(`No converter available for '${currentOpenItem.data.tag}' parse tag`)
                }
                aggregator.closeContext({
                    validateItem: (closingItem) => {
                        const illegalTag = closingItem.children.map(({ data }) => (data)).find((item) => (converter.typeCheckContents && !converter.typeCheckContents(item, aggregator.contextStack)))
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
                    aggregator.removeTrailingWhitespace()
                    aggregator.aggregateToSibling(aggregateFunction)
                    aggregator.closeContext()
                }
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

export const schemaToWML = (tags: GenericTree<SchemaTag>): string => {
    const { returnValue } = tags.reduce<{ returnValue: string[]; siblings: GenericTree<SchemaTag> }>((previous, tag) => {
        const printOptions = printSchemaTag({ tag, options: { indent: 0, siblings: previous.siblings, context: [] }, schemaToWML: printSchemaTag, optionsFactory })
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
        case 'After':
        case 'Before':
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