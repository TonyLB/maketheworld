import { unique } from "../../../list"
import SchemaTagTree from "../../../tagTree/schema"
import { GenericTree } from "@tonylb/mtw-base/ts/genericTree"
import StandardReference, { StandardReferenceReplace, StandardKey } from "../reference"
import { SchemaTag } from "@tonylb/mtw-base/ts/schema"
import { isSchemaLink } from "@tonylb/mtw-base/ts/schema/renderTree"
import { isSchemaRoom } from "@tonylb/mtw-base/ts/schema/components"
import { excludeUndefined } from "../../../lib/lists"
import { StandardExit, StandardExitPlain, StandardExitRemove, StandardExitReplace } from "../exit"

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
        .map(exit => {
            if (exit instanceof StandardExitPlain) {
                // StandardExitPlain: return reference to payload.to
                return exit.payload?.to ? [exit.payload.to] : []
            } else if (exit instanceof StandardExitRemove) {
                // StandardExitRemove: return reference to match.to
                return exit.match?.to ? [exit.match.to] : []
            } else if (exit instanceof StandardExitReplace) {
                // StandardExitReplace: return references from both match.to and payload.to
                return [
                    ...(exit.match?.to ? [exit.match.to] : []),
                    ...(exit.payload?.to ? [exit.payload.to] : [])
                ]
            }
            return []
        })
        .flat(1)
        .map((key) => (key.universalKey ?? key.key ?? ''))
        .filter(excludeUndefined)
    )
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
            })
    }

export const childReferenceFactory = (props: any): StandardReference => {
    const { tag, uuid, ...rest } = props.data
    // Pass tag explicitly to StandardReference constructor
    const reference = new StandardReference({ universalKey: uuid, tag, ...rest })
    if (reference._payload instanceof StandardReferenceReplace && reference._payload.match.equals(reference._payload.payload)) {
        // If the match and payload are the same, this is a reference to a child node that is being
        // modified, and *for this particular method* we include a plain reference (so that parents
        // will know to render the change)
        return new StandardReference(reference._payload.plain)
    }
    return reference
}

export default linkReferenceKeys

