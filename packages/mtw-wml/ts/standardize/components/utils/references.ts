import { unique } from "../../../list"
import SchemaTagTree from "../../../tagTree/schema"
import { GenericTree } from "@tonylb/mtw-base/ts/genericTree"
import StandardReference, { StandardReferenceRemove, StandardReferenceReplace, StandardReferenceSimple, StandardKey } from "../reference"
import { SchemaTag } from "@tonylb/mtw-base/ts/schema"
import { isSchemaLink } from "@tonylb/mtw-base/ts/schema/renderTree"
import { isSchemaConditionStatement } from "@tonylb/mtw-base/ts/schema/condition"
import { isSchemaRoom } from "@tonylb/mtw-base/ts/schema/components"
import { excludeUndefined } from "../../../lib/lists"
import { StandardReferenceData } from "../dataTypes/reference"
import { StandardExit } from "../exit"

export const linkReferenceKeys = (mappings: StandardKey[]) => (tree: GenericTree<SchemaTag>): StandardKey[] => {
    return unique(tree
        .map(({ data, children }) => {
            if (isSchemaLink(data)) {
                const mapping = mappings.find((mapping) => mapping.key === data.to || mapping.universalKey === data.to)
                if (mapping) {
                    return [
                        mapping,
                        ...linkReferenceKeys(mappings)(children)
                    ]
                }
            }
            return linkReferenceKeys(mappings)(children)
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

// export const directReferenceKeys = (tree: GenericTree<SchemaTag>): string[] => {
//     return unique(tree
//         .map(({ data, children }) => {
//             if (isImportable(data)) {
//                 return [
//                     data.key,
//                     ...linkReferenceKeys(children)
//                 ]
//             }
//             else {
//                 return linkReferenceKeys(children)
//             }
//         })
//         .flat(1)
//         .filter(excludeUndefined)
//     )
// }

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
        .filter(excludeUndefined)
}

export const exitReferenceKeys = (list: StandardExit[]): string[] => {
    return unique(list
        .map((exit) => (exit._payload.plain.to))
        .map((key) => (key.key ?? key.universalKey ?? ''))
    )
}

export const assureItemInReferenceList = (previous: StandardReference[], item: StandardReference): StandardReference[] => {
    const withoutContext = item.clone()
    withoutContext._payload.plain.context = undefined
    const findMatch = previous.findIndex((check) => (check._payload.plain.equals(withoutContext._payload.plain)))
    if (findMatch !== -1) {
        return [
            ...previous.slice(0, findMatch),
            withoutContext,
            ...previous.slice(findMatch + 1)
        ]
    }
    return [
        ...previous,
        withoutContext
    ]
}

//
// mapReferenceToFormat accepts a StandardReference, StandardRemove (of a reference) or StandardReplace (of a reference) and returns
// a StandardReference, StandardRemove or StandardReplace of the same type, but with the key mapped to the new format.
// It is used to convert references from one format to another.
//
// The differente references types are:
// - key: A reference that inclueds the local (to the Asset) key of the reference, and NOT the universal key
// - universal: A reference that includes the universal key of the reference, and NOT the local (to the Asset) key
// - both: A reference that includes both the local (to the Asset) key and the universal key of the reference
//
// mapReferenceToFormat is a curried function which accepts (as its first argument) a list of mapping between the local (to the Asset)
// key and the universal key of the reference. The second argument is the reference to be mapped.
//
export type ReferenceFormat = 'key' | 'universal' | 'both';

export const mapKeyToFormat = (format: ReferenceFormat) =>
    (key: StandardKey): StandardKey => {
        return new StandardKey({
                tag: key.tag,
                key: ['key', 'both'].includes(format) ? key.key : undefined,
                universalKey: ['universal', 'both'].includes(format) ? key.universalKey : undefined,
                context: key.context?.map(mapKeyToFormat(format))
            })
    }

export const mapReferenceToFormat = (mappings: StandardKey[], format: ReferenceFormat) =>
    (reference: StandardReference): StandardReference => {
        const mapKey = (reference: StandardReferenceData): StandardKey | undefined => {
            if (typeof reference === 'string') {
                return mappings.find(({ universalKey }) => (universalKey === reference))
            }
            if (reference.key) {
                return mappings.find(({ key }) => (key === reference.key))
            }
            if (reference.universalKey) {
                return mappings.find(({ universalKey }) => (universalKey === reference.universalKey))
            }
            return undefined
        }

        const payload = reference._payload
        if (payload instanceof StandardReferenceSimple) {
            const newKey = mapKey(reference.toJSON() as StandardReferenceData)
            if (!newKey) {
                throw new Error(`Could not find mapping for reference ${JSON.stringify(reference.toJSON())}`)
            }
            return new StandardReference({
                tag: reference.tag,
                key: ['key', 'both'].includes(format) ? newKey.key : undefined,
                universalKey: ['universal', 'both'].includes(format) ? newKey.universalKey : undefined,
                context: newKey.context?.map(mapKeyToFormat(format))
            })
        }

        if (payload instanceof StandardReferenceRemove) {
            return new StandardReference(new StandardReferenceRemove(mapReferenceToFormat(mappings, format)(new StandardReference(payload.match))._payload.plain))
        }

        if (payload instanceof StandardReferenceReplace) {
            return new StandardReference(new StandardReferenceReplace(
                mapReferenceToFormat(mappings, format)(new StandardReference(payload.match))._payload.plain,
                mapReferenceToFormat(mappings, format)(new StandardReference(payload.payload))._payload.plain
            ))
        }
        
        throw new Error('Unsupported reference type')
    }

export const childReferenceFactory = (props: any): StandardReference => {
    const reference = new StandardReference(props)
    if (reference._payload instanceof StandardReferenceReplace && reference._payload.match.equals(reference._payload.payload)) {
        // If the match and payload are the same, this is a reference to a child node that is being
        // modified, and *for this particular method* we include a plain reference (so that parents
        // will know to render the change)
        return new StandardReference(reference._payload.plain)
    }
    return reference
}

export default linkReferenceKeys

