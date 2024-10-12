//
// standardSubset takes a standardForm and a set of keys for Rooms, Features, Bookmarks,
// and Maps, and returns a *subset* standardForm that contains a listing of only those things
// needed in order to render the structure of the object specified by the given keys
//

import { excludeUndefined, unique } from "@tonylb/mtw-utilities/ts/lists"
import {
    isSchemaLink,
    isSchemaExit
} from "@tonylb/mtw-wml/ts/schema/baseClasses"
import { SchemaTagTree } from "@tonylb/mtw-wml/ts/tagTree/schema"
import { isStandardAction, isStandardFeature, isStandardKnowledge, isStandardMap, isStandardRoom, SerializableStandardForm } from "@tonylb/mtw-wml/ts/standardize/baseClasses"
import { Standardizer } from "@tonylb/mtw-wml/ts/standardize"
import { isSchemaRoom } from "@tonylb/mtw-wml/dist/schema/baseClasses"

export const standardSubset = ({ standard, keys, stubKeys }: { standard: SerializableStandardForm, keys: string[], stubKeys: string[] }): { newStubKeys: string[]; standard: SerializableStandardForm } => {
    const standardizer = new Standardizer()
    standardizer.loadStandardForm(standard)

    //
    // Extend the incoming stubKeys with any that need to be added because of connection to first-class
    // keys
    //
    const newMapKeys = unique(
        Object.values(standardizer.standardForm.byId)
            .filter(isStandardMap)
            .map(({ positions, key }) => {
                if (!keys.includes(key)) {
                    return []
                }
                const tagTree = new SchemaTagTree(positions)
                const finalMapTargets = tagTree
                    .prune({ not: { match: 'Room' }})
                    .tree
                    .map(({ data }) => (data))
                    .filter(isSchemaRoom)
                    .map(({ key }) => (key))
                return finalMapTargets
            }).flat(2)
            .filter((key) => (!keys.includes(key)))
    )
    const newExitKeys = unique(
        Object.values(standardizer.standardForm.byId)
            .filter(isStandardRoom)
            .map(({ key, exits }) => {
                const tagTree = new SchemaTagTree(exits)
                const finalExitTargets = tagTree
                    .prune({ not: { match: 'Exit' } })
                    .tree
                    .map(({ data }) => (data))
                    .filter(isSchemaExit)
                    .map(({ to }) => {
                        if (keys.includes(key)) {
                            return [to]
                        }
                        if (keys.includes(to)) {
                            return [key]
                        }
                        return []
                    })
                return finalExitTargets
            })
            .flat(2)
            .filter((key) => (!keys.includes(key)))
    )
    const newLinkKeys = unique(
        Object.values(standardizer.standardForm.byId)
            .filter(isStandardRoom)
            .map(({ key, summary, description }) => {
                if (!keys.includes(key)) {
                    return []
                }
                const tagTree = new SchemaTagTree([summary, description].filter(excludeUndefined))
                const linkTargets = tagTree
                    .prune({ not: { match: 'Link' } })
                    .tree
                    .map(({ data }) => (data))
                    .filter(isSchemaLink)
                    .map(({ to }) => (to))
                return linkTargets
            })
            .flat()
            .filter((key) => (!keys.includes(key)))
    )
    const allStubKeys = unique(stubKeys, newMapKeys, newExitKeys, newLinkKeys)
       
    //
    // Redact the schema items for stubs that match against this asset (since we won't need their
    // renders, or exits to non-key items)
    //
    const stubItems = allStubKeys
        .map((key) => (standardizer.standardForm.byId[key]))
        .filter((value) => (value))
        .map((item) => {
            if (isStandardRoom(item)) {
                return [{
                    ...item,
                    name: { data: { tag: 'Name' }, children: [] },
                    summary: { data: { tag: 'Summary' }, children: [] },
                    description: { data: { tag: 'Description' }, children: [] },
                }]
            }
            else if (isStandardFeature(item) || isStandardKnowledge(item)) {
                return [{
                    ...item,
                    name: { data: { tag: 'Name' }, children: [] },
                    description: { data: { tag: 'Description' }, children: [] }
                }]
            }
            else if (isStandardAction(item)) {
                return [item]
            }
            else {
                return []
            }
        }).flat(1)

    const newById = Object.assign({},
        ...stubItems.map((item) => ({ [item.key]: item })),
        ...Object.values(standardizer.standardForm.byId)
            .filter(({ key }) => (keys.includes(key)))
            .map((item) => ({ [item.key]: item }))
    )

    standardizer._byId = newById

    return { newStubKeys: newExitKeys, standard: standardizer.stripped }
}

export default standardSubset
