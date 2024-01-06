//
// normalSubset takes a standardized NormalForm and a set of keys for Rooms, Features, Bookmarks,
// and Maps, and returns a *subset* list of SchemaTags that contains a listing of only those things
// needed in order to render the structure of the object specified by the given keys
//

import { unique } from "@tonylb/mtw-utilities/dist/lists"
import Normalizer from "@tonylb/mtw-wml/dist/normalize"
import { isNormalAction, isNormalExit, isNormalFeature, NormalForm, NormalItem } from "@tonylb/mtw-wml/dist/normalize/baseClasses"
import {
    isSchemaAfter,
    isSchemaBefore,
    isSchemaCondition,
    isSchemaLink,
    isSchemaReplace,
    SchemaConditionTag,
    SchemaTaggedMessageLegalContents,
    isSchemaFeature,
    isSchemaRoom,
    isSchemaExit,
    SchemaTag
} from "@tonylb/mtw-wml/dist/simpleSchema/baseClasses"
import { GenericTree, GenericTreeNode } from "@tonylb/mtw-wml/ts/sequence/tree/baseClasses"
import { SchemaTagTree } from "@tonylb/mtw-wml/ts/tagTree/schema"

//
// RecursiveRoomContentsFilter filters all contents of a room to include only the exits that are relevant to the
// slice of the asset being examined. It dives into conditions to do this, and excludes conditions that have
// no contents
//
const recursiveRoomContentsFilter = ({ children, keys }: { children: GenericTree<SchemaTag>, keys: string[] }): GenericTree<SchemaTag> => {
    return children.map((item) => {
        if (isSchemaExit(item.data)) {
            if (keys.includes(item.data.from) || keys.includes(item.data.to)) {
                return [item]
            }
        }
        if (isSchemaCondition(item.data)) {
            const conditionContents = recursiveRoomContentsFilter({ children: item.children, keys })
            if (conditionContents.length) {
                const conditionRecurse: SchemaConditionTag = {
                    tag: 'If',
                    conditions: item.data.conditions
                }
                return [{
                    data: conditionRecurse,
                    children: conditionContents
                }]
            }
        }
        return []
    }).flat(1)
}

export const normalSubset = ({ normal, keys, stubKeys }: { normal: NormalForm, keys: string[], stubKeys: string[] }): { newStubKeys: string[]; schema: GenericTree<SchemaTag> } => {
    const normalizer = new Normalizer()
    normalizer.loadNormal(normal)
    //
    // Extend the incoming stubKeys with any that need to be added because of connection to first-class
    // keys
    //
    const newStubKeys = Object.values(normal)
        .filter(isNormalExit)
        .filter(({ from, to }) => (keys.includes(from) || keys.includes(to)))
        .map(({ from, to }) => [from, to])
        .flat()
        .filter((key) => (!keys.includes(key)))
    const allStubKeys = unique([...stubKeys, ...newStubKeys]) as string[]

    //
    // Identify tags for all the keys, to facilitate looking them up by reference
    //
    const keyTags: Record<string, NormalItem["tag"]> = [...keys, ...allStubKeys].reduce((previous, key) => {
        const tag = normal[key]?.tag
        return tag ? { ...previous, [key]: tag } : previous
    }, {})
    //
    // Generate the full schema items for keys and stubs that match against this asset
    //
    const allItems: Record<string, GenericTreeNode<SchemaTag>> = Object.assign({}, ...[...keys, ...allStubKeys]
        .map((key): [string, NormalItem["tag"]] => ([key, keyTags[key]]))
        .filter(([_, tag]) => (tag))
        .map(([key, tag]) => ({ [key]: normalizer.referenceToSchema({ key, tag, index: 0 }) }))
    )
        
    //
    // Redact the schema items for stubs that match against this asset (since we won't need their
    // renders, or exits to non-key items)
    //
    const stubItems = allStubKeys
        .map((key) => (allItems[key]))
        .filter((value) => (value))
        .map((item) => {
            if (isSchemaRoom(item.data)) {
                return [{
                    ...item,
                    children: recursiveRoomContentsFilter({ children: item.children, keys })
                }]
            }
            else if (isSchemaFeature(item.data)) {
                return [item]
            }
            else {
                return []
            }
        }).flat(1)

    const keyItems: GenericTree<SchemaTag> = Object.entries(allItems)
        .filter(([key]) => (keys.includes(key)))
        .map(([_, item]) => (item))

    //
    // Use TagTree to extract just the Link nodes that are descendants of rooms
    //
    const tagTree = new SchemaTagTree(keyItems)
    const linksOnly = tagTree.filter([{ match: 'Room' }, { match: 'Link' }]).prune([{ not: ['Link'] }]).tree

    const linkTargets = linksOnly
        .map(({ data }) => (isSchemaLink(data) ? [data.to] : [])).flat(1)
        .filter((target) => (!keys.includes(target)))

    const linkItems = linkTargets
        .map((key) => (normal[key]))
        .filter((value) => (value))
        .map((item): GenericTree<SchemaTag> => {
            if (isNormalFeature(item)) {
                return [{ data: { tag: 'Feature', key: item.key }, children: [] }]
            }
            if (isNormalAction(item)) {
                return [{ data: { tag: 'Action', key: item.key, src: '' }, children: [] }]
            }
            return []
        }).flat(1)

    return { newStubKeys, schema: [...keyItems, ...stubItems, ...linkItems] }
}

export default normalSubset
