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
    SchemaExitTag,
    SchemaTaggedMessageLegalContents,
    SchemaFeatureTag,
    isSchemaFeature,
    isSchemaRoom,
    SchemaRoomTag,
    isSchemaExit,
    SchemaTag
} from "@tonylb/mtw-wml/dist/simpleSchema/baseClasses"

//
// RecursiveRoomContentsFilter filters all contents of a room to include only the exits that are relevant to the
// slice of the asset being examined. It dives into conditions to do this, and excludes conditions that have
// no contents
//
const recursiveRoomContentsFilter = ({ contents, keys }: { contents: SchemaTag[], keys: string[] }): SchemaTag[] => {
    return contents.map((item) => {
        if (isSchemaExit(item)) {
            if (keys.includes(item.from) || keys.includes(item.to)) {
                return [item as SchemaExitTag]
            }
        }
        if (isSchemaCondition(item)) {
            const conditionContents = recursiveRoomContentsFilter({ contents: item.contents, keys })
            if (conditionContents.length) {
                const conditionRecurse: SchemaConditionTag = {
                    tag: 'If',
                    conditions: item.conditions,
                    contents: conditionContents
                }
                return [conditionRecurse]
            }
        }
        return []
    }).flat(1)
}

//
// extractLinksFromRoomDescription recursively parses the room description and returns the list of "to" keys
// in all links present
//
const extractLinksFromRoomDescription = (contents: SchemaTaggedMessageLegalContents[]): string[] => {
    return contents.reduce<string[]>((previous, item) => {
        if (isSchemaBefore(item) || isSchemaAfter(item) || isSchemaReplace(item) || isSchemaCondition(item)) {
            return unique(previous, extractLinksFromRoomDescription(item.contents as SchemaTaggedMessageLegalContents[])) as string[]
        }
        if (isSchemaLink(item)) {
            return unique(previous, [item.to]) as string[]
        }
        return previous
    }, [])
}

export const normalSubset = ({ normal, keys, stubKeys }: { normal: NormalForm, keys: string[], stubKeys: string[] }): { newStubKeys: string[]; schema: SchemaTag[] } => {
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
    const allItems: Record<string, SchemaTag> = Object.assign({}, ...[...keys, ...allStubKeys]
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
        .filter((item: SchemaTag): item is SchemaFeatureTag | SchemaRoomTag => (isSchemaFeature(item) || isSchemaRoom(item)))
        .map((item) => {
            if (isSchemaRoom(item)) {
                return {
                    ...item,
                    render: [],
                    contents: recursiveRoomContentsFilter({ contents: item.contents, keys })
                }
            }
            else {
                return {
                    ...item,
                    render: [],
                    contents: []
                }
            }
        })

    const keyItems = Object.entries(allItems)
        .filter(([key]) => (keys.includes(key)))
        .map(([_, item]) => (item))

    //
    // Tree-walk the renders of keyItems, to find links that need at least an empty stub in the normal (even though they
    // do not need to be added to the stub list)
    //
    const descriptionAggregate = keyItems
        .filter(isSchemaRoom)
        .map(({ render }) => (render))
        .flat()
    const linkTargets = extractLinksFromRoomDescription(descriptionAggregate)
        .filter((key) => (!keys.includes(key)))

    const linkItems = linkTargets
        .map((key) => (normal[key]))
        .filter((value) => (value))
        .map((item): SchemaTag | undefined => {
            if (isNormalFeature(item)) {
                return {
                    tag: 'Feature',
                    key: item.key,
                    render: [],
                    name: [],
                    contents: []
                }
            }
            if (isNormalAction(item)) {
                return {
                    tag: 'Action',
                    key: item.key,
                    src: ''
                }
            }
        })
        .filter((value): value is SchemaTag => (Boolean(value)))

    return { newStubKeys, schema: [...keyItems, ...stubItems, ...linkItems] }
}

export default normalSubset
