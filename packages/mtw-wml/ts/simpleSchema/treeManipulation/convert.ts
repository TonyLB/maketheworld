import { GenericTree } from "@tonylb/mtw-sequence/ts/tree/baseClasses"
import { SchemaTag, isSchemaWithContents } from "../baseClasses"

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

export const deconvertFromTree = (tree: GenericTree<SchemaTag>): SchemaTag[] => {
    //
    // TODO: Invent an elegant way to deal with denormalization of schema children
    // data into the properties of a schema tag
    //
    return tree.map(({ data, children }) => {
        if (isSchemaWithContents(data)) {
            return {
                ...data,
                contents: deconvertFromTree(children)
            }
        }
        else {
            if (children.length) {
                throw new Error('Tree children present in tag forbidden children')
            }
            return data
        }
    })
}