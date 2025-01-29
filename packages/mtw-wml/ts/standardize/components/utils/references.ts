import { unique } from "../../../list"
import SchemaTagTree from "../../../tagTree/schema"
import { GenericTree } from "@tonylb/mtw-base/ts/genericTree"
import StandardReference from "../reference"
import { isImportable, SchemaTag } from "@tonylb/mtw-base/ts/schema"
import { isSchemaLink } from "@tonylb/mtw-base/ts/schema/renderTree"
import { isSchemaConditionStatement } from "@tonylb/mtw-base/ts/schema/condition"
import { isSchemaExit, isSchemaRoom } from "@tonylb/mtw-base/ts/schema/components"
import { StandardRemove, StandardReplace } from "../edits"
import { excludeUndefined } from "../../../lib/lists"
import { deepEqual } from "../../../lib/objects"

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

export const dependencyReferenceKeys = (tree: GenericTree<SchemaTag>): string[] => {
    return unique(tree
        .map(({ data, children }) => {
            if (isSchemaConditionStatement(data)) {
                return [
                    ...(data.dependencies ?? []),
                    ...dependencyReferenceKeys(children)
                ]
            }
            else {
                return dependencyReferenceKeys(children)
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

export const mergeUniqueReferences = (...referenceLists: (StandardReference | StandardRemove | StandardReplace)[][]): (StandardReference | StandardRemove | StandardReplace)[] => {
    const referencesById = referenceLists.reduce<Record<string, (StandardReference | StandardRemove | StandardReplace | undefined)>>((previous, references) => (
        references.reduce<Record<string, StandardReference | StandardRemove | StandardReplace | undefined>>((accumulator, reference) => {
            const previousReference = accumulator[reference.key]
            if (previousReference) {
                if (reference instanceof StandardRemove) {
                    if (!deepEqual(previousReference.toJSON(), reference._match.toJSON())) {
                        throw new Error(`Mismatched references in mergeUniqueReferences`)
                    }
                    return {
                        ...accumulator,
                        [reference.key]: undefined
                    }
                }
                else {
                    return {
                        ...accumulator,
                        [reference.key]: previousReference.merge(reference) as StandardReference | StandardRemove | undefined
                    }
                }
            }
            return {
                ...accumulator,
                [reference.key]: reference
            }
        }, previous)
    ), {})
    return Object.values(referencesById).filter(excludeUndefined)
}

export default linkReferenceKeys

