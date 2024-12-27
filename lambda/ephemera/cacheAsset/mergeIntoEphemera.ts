//
// mergeIntoEphemera merges a new list of EphemeraItems into the current database, updating
// both the per-Asset entries and (if necessary) the Meta::<Component> aggregate entries
//
import { EphemeraComputedId, EphemeraFeatureId, EphemeraKnowledgeId, EphemeraRoomId, isEphemeraComputedId, isEphemeraRoomId, isEphemeraVariableId } from "@tonylb/mtw-interfaces/ts/baseClasses"
import evaluateCode from "@tonylb/mtw-utilities/dist/computation/sandbox"
import { ephemeraDB } from "@tonylb/mtw-utilities/dist/dynamoDB"
import { unique } from "@tonylb/mtw-utilities/dist/lists"
import { AssetKey, splitType } from "@tonylb/mtw-utilities/dist/types"
import internalCache from "../internalCache"
import { RoomCharacterListItem } from "../internalCache/baseClasses"
import messageBus from "../messageBus"
import dependencyCascade from "../dependentMessages/dependencyCascade"
import { updateDependenciesFromMergeActions } from "./dependencyUpdate"
import GraphUpdate from "@tonylb/mtw-utilities/dist/graphStorage/update"
import { StandardComponentData } from "@tonylb/mtw-wml/ts/standardize/baseClasses"
import { StandardExampleNDJSONData } from "@tonylb/mtw-wml/ts/standardize/components/dataTypes/example"
import StandardExample from "@tonylb/mtw-wml/ts/standardize/components/example"
import { RenderTree } from "@tonylb/mtw-wml/ts/standardize/render/baseClasses"
import { objectMerge } from "@tonylb/mtw-wml/ts/lib/objects"
import { deepEqual } from "@tonylb/mtw-utilities/ts/objects"
import { excludeUndefined } from "@tonylb/mtw-utilities/ts/lists"

export const mergeIntoEphemera = async (assetId: string, items: StandardComponentData[], graphUpdate: GraphUpdate<typeof internalCache._graphCache, string>): Promise<void> => {
    //
    // TODO:  Better error handling and validation throughout
    //
    const DataCategory = AssetKey(assetId)
    let computedIdsNeedingCascade: EphemeraComputedId[] = []
    await ephemeraDB.mergeTransact({
        query: {
            IndexName: 'DataCategoryIndex',
            Key: { DataCategory }
        },
        items: items.map((item) => ({ ...item, DataCategory })) as any,
        mergeFunction: ({ incoming }) => (incoming),
        beforeTransact: updateDependenciesFromMergeActions(assetId, graphUpdate),
        transactFactory: async ({ key, action }) => {
            const [ephemeraTag] = splitType(key.EphemeraId)
            const [_, assetKey] = splitType(key.DataCategory)
            const tag = `${ephemeraTag[0].toUpperCase()}${ephemeraTag.slice(1).toLowerCase()}`
            if (action === 'delete') {
                return [{ Update: {
                    Key: { ...key, DataCategory: `Meta::${tag}` },
                    updateKeys: ['cached'],
                    updateReducer: (draft) => {
                        draft.cached = (draft.cached || []).filter((value) => (value !== assetKey))
                    },
                    deleteCondition: ({ cached }) => (cached.length === 0)
                }}]
            }
            if (typeof action === 'object') {
                const ephemeraId = action.EphemeraId
                let activeCharacters: RoomCharacterListItem[] | undefined = undefined
                if (isEphemeraRoomId(ephemeraId)) {
                    activeCharacters = await internalCache.RoomCharacterList.get(ephemeraId)
                }
                if (isEphemeraComputedId(ephemeraId) && action.src) {
                    computedIdsNeedingCascade = [...computedIdsNeedingCascade, ephemeraId]
                }
                return [{ Update: {
                    Key: { ...key, DataCategory: `Meta::${tag}` },
                    updateKeys: ['cached', 'activeCharacters', 'src', 'rootAsset', 'value'],
                    updateReducer: (draft) => {
                        draft.cached = unique(draft.cached || [], [assetKey])
                        draft.activeCharacters = activeCharacters
                        if (action.src) {
                            draft.src = action.src
                            draft.rootAsset = assetId
                        }
                        if (isEphemeraVariableId(ephemeraId) && action.default) {
                            if (typeof draft.value === 'undefined') {
                                draft.value = evaluateCode(`return (${action.default})`)({})
                                internalCache.AssetState.set(ephemeraId, draft.value)
                            }
                        }
                    }
                }}]
            }
            return []
        }
    })
    await dependencyCascade({
        payloads: computedIdsNeedingCascade.map((ephemeraId) => ({ targetId: ephemeraId })),
        messageBus
    })

}

export const mergeIntoExamples = async (assetId: string, itemsByRoomId: Record<EphemeraRoomId, StandardExample[]>): Promise<void> => {
    //
    // For each unique room in the list of examples, update the room's list of examples
    //
    await Promise.all((Object.entries(itemsByRoomId) as [EphemeraRoomId | EphemeraFeatureId | EphemeraKnowledgeId, StandardExample[]][]).map(async ([componentId, examples]) => {
        //
        // Because the EXAMPLE entries are interspersed with other DataCategories, we need
        // to explicitly build the merge transact, rather than using the utility mergeTransact
        // operator
        //
        const currentExamples = (await ephemeraDB.query<{ EphemeraId: EphemeraRoomId | EphemeraFeatureId | EphemeraKnowledgeId; DataCategory: string; scopedId: string; name: RenderTree; description: RenderTree; summary: RenderTree }>({
            Key: { EphemeraId: componentId },
            KeyConditionExpression: 'begins_with(DataCategory, :dcPrefix)',
            ExpressionAttributeValues: {
                ':dcPrefix': 'EXAMPLE#'
            },
            ProjectionFields: ['DataCategory', 'name', 'description', 'summary', 'scopedId']
        })).filter(({ DataCategory }) => (DataCategory.endsWith(`::${assetId}`)))

        const currentExamplesByUniversalKey = currentExamples.reduce<Record<string, StandardExample>>((previous, { DataCategory, scopedId, ...example }) => {
            const universalKey = DataCategory.split('::')[0].split('#').slice(1).join('#')
            return {
                ...previous,
                [universalKey]: new StandardExample({
                    tag: 'Example',
                    key: scopedId,
                    ...example,
                    universalKey
                })
            }
        }, {})

        const itemsByUniversalKey = examples.reduce<Record<string, StandardExample>>((previous, example) => {
            const universalKey = example.universalKey
            if (!universalKey) {
                return previous
            }
            return {
                ...previous,
                [universalKey]: example
            }
        }, {})

        const mergedExamples = objectMerge(currentExamplesByUniversalKey, itemsByUniversalKey)

        const transactItems = Object.values(mergedExamples).map(({ itemA, itemB }) => {
            if (itemA && itemB) {
                if (deepEqual(itemA.toNDJSON(), itemB.toNDJSON())) {
                    return undefined
                }
                const name = itemB._payload._name?.toNDJSON()
                const description = itemB._payload._description?.toNDJSON()
                const summary = itemB._payload._summary?.toNDJSON()
                return {
                    Put: {
                        EphemeraId: componentId,
                        DataCategory: `EXAMPLE#${itemB.universalKey}::${assetId}`,
                        scopedId: itemB.key,
                        ...(name ? { name } : {}),
                        ...(description ? { description } : {}),
                        ...(summary ? { summary } : {})
                    }
                }
            }
            if (itemA) {
                return {
                    Delete: { EphemeraId: componentId, DataCategory: `EXAMPLE#${itemA.universalKey}::${assetId}` }
                }
            }
            if (itemB) {
                const name = itemB._payload._name?.toNDJSON()
                const description = itemB._payload._description?.toNDJSON()
                const summary = itemB._payload._summary?.toNDJSON()
                return {
                    Put: {
                        EphemeraId: componentId,
                        DataCategory: `EXAMPLE#${itemB.universalKey}::${assetId}`,
                        scopedId: itemB.key,
                        ...(name ? { name } : {}),
                        ...(description ? { description } : {}),
                        ...(summary ? { summary } : {})
                    }
                }
            }
            return undefined
        })

        await ephemeraDB.transactWrite(transactItems.filter(excludeUndefined))

    }))
}