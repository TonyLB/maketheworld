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
import { StandardForm } from "@tonylb/mtw-wml/ts/standardize"
import { isSchemaRoom } from "@tonylb/mtw-wml/dist/schema/baseClasses"
import StandardMap from "@tonylb/mtw-wml/ts/standardize/components/map"
import StandardRoom from "@tonylb/mtw-wml/ts/standardize/components/room"
import StandardFeature from "@tonylb/mtw-wml/ts/standardize/components/feature"
import StandardKnowledge from "@tonylb/mtw-wml/ts/standardize/components/knowledge"
import StandardAction from "@tonylb/mtw-wml/ts/standardize/components/action"
import { StandardRoomData } from "@tonylb/mtw-wml/ts/standardize/components/dataTypes/room"
import { StandardFeatureData } from "@tonylb/mtw-wml/ts/standardize/components/dataTypes/feature"
import { StandardKnowledgeData } from "@tonylb/mtw-wml/ts/standardize/components/dataTypes/knowledge"

export const standardSubset = ({ standard, keys, stubKeys }: { standard: StandardForm, keys: string[], stubKeys: string[] }): { newStubKeys: string[]; standard: StandardForm } => {
    //
    // Extend the incoming stubKeys with any that need to be added because of connection to first-class
    // keys
    //
    const newMapKeys = unique(
        Object.values(standard.byId)
            .filter((component): component is StandardMap => (Boolean(component instanceof StandardMap)))
            .map((component) => {
                if (!keys.includes(component.key)) {
                    return []
                }
                const tagTree = new SchemaTagTree(component.positions)
                const finalMapTargets = tagTree
                    .prune({ not: { match: 'Room' }})
                    .tree
                    .map(({ data }) => (data))
                    .filter(isSchemaRoom)
                    .map(({ key }) => (key))
                return finalMapTargets
            })
            .flat(2)
            .filter((key) => (!keys.includes(key)))
    )
    const newExitKeys = unique(
        Object.values(standard.byId)
            .filter((component) => (component instanceof StandardRoom))
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
        Object.values(standard.byId)
            .filter((component) => (component instanceof StandardRoom))
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
        .map((key) => (standard.byId[key]))
        .filter(excludeUndefined)
        .map((component) => {
            if (component instanceof StandardRoom) {
                const returnValue = component.clone()
                returnValue._payload._name = undefined
                returnValue._payload._summary = undefined
                returnValue._payload._description = undefined
                return [returnValue]
            }
            else if (component instanceof StandardFeature || component instanceof StandardKnowledge) {
                const returnValue = component.clone()
                returnValue._payload._name = undefined
                returnValue._payload._description = undefined
                return [returnValue]
            }
            else if (component instanceof StandardAction) {
                return [component]
            }
            else {
                return []
            }
        }).flat(1)

    const newById = Object.assign({},
        ...stubItems.map((item) => ({ [item.key]: item })),
        ...Object.values(standard.byId)
            .filter(({ key }) => (keys.includes(key)))
            .map((item) => ({ [item.key]: item }))
    )

    const returnValue = new StandardForm(standard.key)
    returnValue._byId = newById

    return { newStubKeys: newExitKeys, standard: returnValue }
}

export default standardSubset
