import { GenericTree } from "@tonylb/mtw-sequence/ts/tree/baseClasses"
import { SchemaContextItem, SchemaTag, isSchemaWithContents } from "../baseClasses"
import converterMap from "../converters"

export const convertToTree = (tags: SchemaTag[]): GenericTree<SchemaTag> => {
    return tags.map((tag) => {
        if (isSchemaWithContents(tag)) {
            return {
                data: {
                    ...tag,
                    contents: []
                },
                children: convertToTree(tag.contents)
            }
        }
        else {
            return {
                data: tag,
                children: []
            }
        }
    })
}

export const deconvertFromTree = (tree: GenericTree<SchemaTag>, options?: { contextStack: SchemaContextItem[] }): SchemaTag[] => {
    const { contextStack = [] } = options || {}
    //
    // TODO: Figure out how to assemble an ongoing SchemaContextItem contextStack as
    // the Schema is re-assembled (in order to support finalize)
    //

    //
    // TODO: Re-execute the schema-converter finalize when reassembling a schema
    // with contents
    //
    return tree.reduce<SchemaTag[]>((previous, { data, children }) => {
        if (isSchemaWithContents(data)) {
            const converter = converterMap[data.tag]
            const updatedContextStack = contextStack.length ? [...contextStack.slice(0, -1), { ...contextStack.slice(-1)[0], contents: previous }] : []
            const contents = deconvertFromTree(children, { contextStack: [...updatedContextStack, { tag: data, contents: [] }] })
            return [
                ...previous,
                {
                    ...(converter.finalize
                        ? converter.finalize(data, contents, updatedContextStack)
                        : data),
                    contents
                }
            ]
        }
        else {
            if (children.length) {
                throw new Error('Tree children present in tag forbidden children')
            }
            return [...previous, data]
        }
    }, [])
}