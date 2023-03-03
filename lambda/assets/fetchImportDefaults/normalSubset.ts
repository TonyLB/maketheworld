//
// normalSubset takes a standardized NormalForm and a set of keys for Rooms, Features, Bookmarks,
// and Maps, and returns a *subset* list of SchemaTags that contains a listing of only those things
// needed in order to render the structure of the object specified by the given keys
//

import { unique } from "@tonylb/mtw-utilities/dist/lists"
import Normalizer from "@tonylb/mtw-wml/dist/normalize"
import { isNormalExit, NormalForm, NormalItem } from "@tonylb/mtw-wml/dist/normalize/baseClasses"
import { isSchemaCondition } from "@tonylb/mtw-wml/dist/schema/baseClasses"
import { SchemaFeatureTag } from "@tonylb/mtw-wml/dist/schema/baseClasses"
import { isSchemaFeature } from "@tonylb/mtw-wml/dist/schema/baseClasses"
import { isSchemaRoom } from "@tonylb/mtw-wml/dist/schema/baseClasses"
import { SchemaRoomTag } from "@tonylb/mtw-wml/dist/schema/baseClasses"
import { SchemaConditionTagRoomContext } from "@tonylb/mtw-wml/dist/schema/baseClasses"
import { isSchemaConditionTagRoomContext } from "@tonylb/mtw-wml/dist/schema/baseClasses"
import { isSchemaExit } from "@tonylb/mtw-wml/dist/schema/baseClasses"
import { SchemaRoomLegalContents } from "@tonylb/mtw-wml/dist/schema/baseClasses"
import { SchemaTag } from "@tonylb/mtw-wml/dist/schema/baseClasses"

//
// RecursiveRoomContentsFilter filters all contents of a room to include only the exits that are relevant to the
// slice of the asset being examined. It dives into conditions to do this, and excludes conditions that have
// no contents
//
const recursiveRoomContentsFilter = ({ contents, keys }: { contents: SchemaRoomLegalContents[], keys: string[] }): SchemaRoomLegalContents[] => {
    return contents.reduce<SchemaRoomLegalContents[]>((previous, item) => {
        if (isSchemaExit(item) && (keys.includes(item.from) || keys.includes(item.to))) {
            return [
                ...previous,
                item
            ]
        }
        if (isSchemaCondition(item) && isSchemaConditionTagRoomContext(item)) {
            const conditionContents = recursiveRoomContentsFilter({ contents: item.contents, keys })
            if (conditionContents.length) {
                const conditionRecurse: SchemaConditionTagRoomContext = {
                    tag: 'If',
                    contextTag: 'Room',
                    conditions: item.conditions,
                    contents: conditionContents
                }
                return [
                    ...previous,
                    conditionRecurse
                ]
            }
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

    return { newStubKeys, schema: [...keyItems, ...stubItems] }
}

export default normalSubset
