//
// mergeIntoEphemera merges a new list of EphemeraItems into the current database, updating
// both the per-Asset entries and (if necessary) the Meta::<Component> aggregate entries
//
import { EphemeraComputedId, isEphemeraComputedId, isEphemeraRoomId, isEphemeraVariableId } from "@tonylb/mtw-interfaces/dist/baseClasses"
import evaluateCode from "@tonylb/mtw-utilities/dist/computation/sandbox"
import { ephemeraDB } from "@tonylb/mtw-utilities/dist/dynamoDB"
import { unique } from "@tonylb/mtw-utilities/dist/lists"
import { AssetKey, splitType } from "@tonylb/mtw-utilities/dist/types"
import internalCache from "../internalCache"
import { RoomCharacterListItem } from "../internalCache/baseClasses"
import messageBus from "../messageBus"
import { EphemeraItem } from "./baseClasses"
import dependencyCascade from "../dependentMessages/dependencyCascade"

export const mergeIntoEphemera = async (assetId: string, items: EphemeraItem[]): Promise<void> => {
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
                    deleteCondition: ({ cached }) => (cached.length === 0),
                    deleteCascade: ({ EphemeraId }) => ([
                        { EphemeraId, DataCategory: 'Graph::Forward' },
                        { EphemeraId, DataCategory: 'Graph::Back' }
                    ])
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