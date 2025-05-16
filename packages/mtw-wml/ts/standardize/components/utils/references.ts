import { unique } from "../../../list"
import SchemaTagTree from "../../../tagTree/schema"
import { GenericTree } from "@tonylb/mtw-base/ts/genericTree"
import StandardReference, { StandardReferenceRemove, StandardReferenceReplace, StandardReferenceSimple, StandardReferenceSimpleBase } from "../reference"
import { ComponentUUID, isImportable, SchemaTag } from "@tonylb/mtw-base/ts/schema"
import { isSchemaLink } from "@tonylb/mtw-base/ts/schema/renderTree"
import { isSchemaConditionStatement } from "@tonylb/mtw-base/ts/schema/condition"
import { isSchemaExit, isSchemaRoom } from "@tonylb/mtw-base/ts/schema/components"
import { excludeUndefined } from "../../../lib/lists"
import { StandardReferenceData } from "../dataTypes/reference"

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
        .filter(excludeUndefined)
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

export const mergeUniqueReferences = (...referenceLists: (StandardReference)[][]): StandardReference[] => {
    const referencesById = referenceLists.reduce<StandardReference[]>((previous, references) => (
        references.reduce<StandardReference[]>((accumulator, reference) => {
            const matchReference = (a: StandardReference) => (b: StandardReference): boolean => (
                Boolean((a.key && b.key && (a.key === b.key)) ||
                (a.universalKey && b.universalKey && (a.universalKey === b.universalKey)))
            )
            const previousReferences = accumulator.filter(matchReference(reference))
            if (previousReferences.length) {
                const mergedValue = [...previousReferences, reference].reduce<StandardReference | undefined>((accumulator, reference) => (
                    accumulator ? accumulator.merge(reference) as StandardReference | undefined : reference
                ), undefined)
                return [
                    ...accumulator.filter((check) => (!matchReference(reference)(check))),
                    mergedValue
                ].filter(excludeUndefined)
            }
            return [
                ...accumulator,
                reference
            ]
        }, previous)
    ), [])
    return Object.values(referencesById).filter(excludeUndefined)
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
type ReferenceFormat = 'key' | 'universal' | 'both';

export const mapReferenceToFormat = (mappings: { key: string; universalKey: ComponentUUID }[], format: ReferenceFormat) =>
    (reference: StandardReference): StandardReference => {
        const mapKey = (reference: StandardReferenceData): { key: string; universalKey: ComponentUUID } | undefined => {
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
                global: reference.global,
                key: ['key', 'both'].includes(format) ? newKey.key : undefined,
                universalKey: ['universal', 'both'].includes(format) ? newKey.universalKey : undefined,
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

export default linkReferenceKeys

