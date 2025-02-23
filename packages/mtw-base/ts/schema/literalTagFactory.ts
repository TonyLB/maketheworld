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
    }
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
        checkTypes({ required: { tag: CheckTypes.STRING }, values: { tag } })(value)
    )
    const tagRenderLiteral = (tag: any): PrintMapResult[] => (
        (typeGuard(tag))
            ? [{ printMode: PrintMode.naive, output: '' }]
            : [{ printMode: PrintMode.naive, output: '' }]
    )    
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
        }
    }
}