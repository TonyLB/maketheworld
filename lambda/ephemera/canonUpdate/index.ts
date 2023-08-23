import { EphemeraAssetId, isEphemeraAssetId } from '@tonylb/mtw-interfaces/dist/baseClasses'
import { ephemeraDB } from "@tonylb/mtw-utilities/dist/dynamoDB";
import { CanonSetMessage, CanonUpdateMessage, MessageBus } from "../messageBus/baseClasses";
import { unique } from "@tonylb/mtw-utilities/dist/lists";
import internalCache from "../internalCache";
import { AssetKey } from '@tonylb/mtw-utilities/dist/types';
import topologicalSort from '../mtw-utilities/dist/graphStorage/utils/graph/topologicalSort';

export const canonUpdateMessage = async ({ payloads, messageBus }: { payloads: CanonUpdateMessage[], messageBus?: MessageBus }): Promise<void> => {
    const previousAssets = (await internalCache.Global.get('assets')) || []
    const assetGraph = await internalCache.Graph.get(
        unique(
            previousAssets,
            payloads.map((payload) => {
                if (payload.type === 'CanonSet') {
                    return payload.assetIds
                }
                else {
                    return payload.assetId
                }
            }).flat()
        ).filter((item): item is string => (typeof item === 'string')).map((assetId) => (AssetKey(assetId))),
        'back'
    )
    //
    // TODO: Make canonUpdate more resilient in the face of race-conditions (i.e., make it capable of responding smoothly
    // when draft.assets includes assets it didn't know were in consideration)
    //
    await ephemeraDB.optimisticUpdate<{ EphemeraId: string; DataCategory: string; assets: string[] }>({
        Key: {
            EphemeraId: 'Global',
            DataCategory: 'Assets'
        },
        updateKeys: ['assets'],
        updateReducer: (draft) => {
            const canonSetRecord = payloads.find((payload): payload is CanonSetMessage => (payload.type === 'CanonSet'))
            let unsortedAssets = [...draft.assets]
            if (canonSetRecord) {
                unsortedAssets = canonSetRecord.assetIds.filter(isEphemeraAssetId).map((assetId) => (assetId.split('#')[1]))
            }
            else {
                unsortedAssets = unique(
                    (unsortedAssets || []).filter((value) => (!payloads.find((payload) => (payload.type === 'CanonRemove' && `ASSET#${value}` === payload.assetId)))),
                    payloads
                        .filter(({ type }) => (type === 'CanonAdd'))
                        .map((payload) => (payload.type === 'CanonAdd' && payload.assetId.split('#')?.[1])).filter((value) => (value))
                        .filter((value): value is string => (Boolean(value)))
                )
            }
            const unsortedGraph = assetGraph.filter({ keys: unsortedAssets.map((assetId) => (AssetKey(assetId))) }).reverse()
            draft.assets = topologicalSort(unsortedGraph).flat().map((assetKey) => (assetKey.split('#')?.[1] || ''))
        },
        priorFetch: { EphemeraId: 'Global', DataCategory: 'Assets', assets: previousAssets },
        successCallback: ({ assets }) => {
            internalCache.Global.set({ key: 'assets', value: assets })
            if (messageBus) {
                const changedAssets = [
                    ...(previousAssets.filter((previousAsset) => (!assets.find((currentAsset) => (currentAsset === previousAsset))))),
                    ...(assets.filter((currentAsset) => (!previousAssets.find((previousAsset) => (currentAsset === previousAsset))))
                    )
                ]
                changedAssets.forEach((assetId) => {
                        messageBus.send({
                            type: 'Perception',
                            ephemeraId: `ASSET#${assetId}`
                        })    
                    })
            }
        },
        ReturnValues: 'UPDATED_NEW'
    })
}
