import { GenericTree, GenericTreeNodeFiltered } from "../genericTree";
import checkTypes, { CheckTypes } from "../utils/checkTypes";
import { PrintMapResult, PrintMode } from "./printMap";
import { isSchemaString } from "./renderTree";
import { SchemaTagType } from "./tagType";

export type SchemaLiteralTag<D extends SchemaTagType> = {
    tag: D;
    value: string;
}

export type LiteralTagFactoryOutput<D extends SchemaTagType> = {
    typeGuard: (value: any) => value is SchemaLiteralTag<D>;
    converter: {
        initialize: ({ parseOpen }: { parseOpen: any}) => SchemaLiteralTag<D>;
        typeCheckContents: (value: any) => boolean;
        finalize: (initialTag: any, children: GenericTree<any>) => GenericTreeNodeFiltered<SchemaLiteralTag<D>, never>;
    },
    printMap: (args: { tag: any, options: { indent: number } }) => PrintMapResult[];
}

//
// The literalTagFactory function is a factory function that creates a new tag type.
// That type will accept string literal as its children/contents. The return value
// for the function is an object with all the necessary functions to establish the
// new tag type in both the Schema parser and the StandardComponents that accept the
// tag as a child input.
//
export const literalTagFactory = <D extends SchemaTagType>(tag: D): LiteralTagFactoryOutput<D> => {
    const typeGuard = (value: any): value is SchemaLiteralTag<D> => (
        checkTypes({ required: { tag: CheckTypes.STRING, value: CheckTypes.STRING }, values: { tag } })(value)
    )
    const tagRenderLiteral = ({ tag, options }: { tag: { data: any }, options: { indent: number } }): PrintMapResult[] => {
        if (!typeGuard(tag.data)) {
            return [{ printMode: PrintMode.naive, output: '' }]
        }
        const naive = `<${tag.data.tag}>${tag.data.value}</${tag.data.tag}>`
        if (naive.length + Math.min(10, options.indent * 4) > 80) {
            const prettyPrintedLines = tag.data.value.split('\n').join(' ').split(' ').reduce<string[]>((previous, word) => {
                if (previous.length === 0) {
                    return [word]
                }
                const lastLine = previous[previous.length - 1]
                if (lastLine.length + word.length + 1 > 80 - (options.indent * 4)) {
                    return [...previous, word]
                }
                previous[previous.length - 1] = `${lastLine} ${word}`
                return previous
            }, [])
            return [
                { printMode: PrintMode.nested, output: `<${tag.data.tag}>` },
                ...prettyPrintedLines.map((line) => ({ printMode: PrintMode.nested, output: `    ${line}` })),
                { printMode: PrintMode.nested, output: `</${tag.data.tag}>` }
            ]
        }
        else {
            return [{ printMode: PrintMode.naive, output: `<${tag.data.tag}>${tag.data.value}</${tag.data.tag}>` }]
        }
    }
    return {
        typeGuard,
        converter: {
            initialize: ({ parseOpen }: { parseOpen: any}): SchemaLiteralTag<D> => {
                if (!(parseOpen && typeof parseOpen === 'object' && 'properties' in parseOpen && Array.isArray(parseOpen.properties))) {
                    throw new Error('Invalid parseOpen object')
                }
                const unmatchedKey = parseOpen.properties[0]
                if (unmatchedKey) {
                    throw new Error(`Property '${unmatchedKey.key}' is not allowed in '${tag}' items.`)
                }            
                return {
                    tag,
                    value: ''
                }
            },
            typeCheckContents: isSchemaString,
            finalize: (initialTag: any, children: GenericTree<any>): GenericTreeNodeFiltered<SchemaLiteralTag<D>, never> => {
                return {
                    data: {
                        tag,
                        value: children.map(({ data }) => (data)).filter(isSchemaString).map(({ value }) => (value)).join('')
                    },
                    children: []
                }
            }    
        },
        printMap: tagRenderLiteral
    }
}