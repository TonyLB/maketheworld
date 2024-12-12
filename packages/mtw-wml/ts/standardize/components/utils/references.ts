import { unique } from "../../../list"
import { isImportable, isSchemaExit, isSchemaLink, isSchemaRoom, SchemaTag } from "../../../schema/baseClasses"
import SchemaTagTree from "../../../tagTree/schema"
import { GenericTree } from "../../../tree/baseClasses"

export const linkReferenceKeys = (tree: GenericTree<SchemaTag>): string[] => {
    return unique(tree
        .map(({ data, children }) => {
            if (isSchemaLink(data)) {
                return [
                    data.to,
                    ...linkReferenceKeys(children)
                ]
            }
            else {
                return linkReferenceKeys(children)
            }
        })
        .flat(1)
    )
}

export const directReferenceKeys = (tree: GenericTree<SchemaTag>): string[] => {
    return unique(tree
        .map(({ data, children }) => {
            if (isImportable(data)) {
                return [
                    data.key,
                    ...linkReferenceKeys(children)
                ]
            }
            else {
                return linkReferenceKeys(children)
            }
        })
        .flat(1)
    )
}

export const positionReferenceKeys = (tree: GenericTree<SchemaTag>): string[] => {
    const tagTree = new SchemaTagTree(tree)
    const rooms = tagTree
        .filter(({ and: [{ match: 'Room' }, { match: 'Position' }] }))
        .prune({ not: { match: 'Room' } })
        .tree
    return unique(rooms
        .map(({ data }) => (data))
        .filter(isSchemaRoom)
        .map(({ key }) => (key)))
}

export const exitReferenceKeys = (tree: GenericTree<SchemaTag>): string[] => {
    const tagTree = new SchemaTagTree(tree)
    const exits = tagTree
        .filter(({ match: 'Exit' }))
        .prune({ not: { match: 'Exit' } })
        .tree
    return unique(exits
        .map(({ data }) => (data))
        .filter(isSchemaExit)
        .map(({ to }) => (to)))
}

export default linkReferenceKeys
