import { EphemeraAssetId, isEphemeraAssetId } from '@tonylb/mtw-interfaces/dist/baseClasses'
import { ephemeraDB } from "@tonylb/mtw-utilities/dist/dynamoDB";
import { CanonSetMessage, CanonUpdateMessage, MessageBus } from "../messageBus/baseClasses";
import { unique } from "@tonylb/mtw-utilities/dist/lists";
import internalCache from "../internalCache";

export const canonUpdateMessage = async ({ payloads, messageBus }: { payloads: CanonUpdateMessage[], messageBus?: MessageBus }): Promise<void> => {
    let previousAssets: string[] = []
    const { assets = [] } = (await ephemeraDB.optimisticUpdate<{ EphemeraId: string; DataCategory: string; assets: string[] }>({
        Key: {
            EphemeraId: 'Global',
            DataCategory: 'Assets'
        },
        updateKeys: ['assets'],
        updateReducer: (draft) => {
            previousAssets = [...draft.assets]
            const canonSetRecord = payloads.find((payload): payload is CanonSetMessage => (payload.type === 'CanonSet'))
            if (canonSetRecord) {
                draft.assets = canonSetRecord.assetIds.filter(isEphemeraAssetId).map((assetId) => (assetId.split('#')[1]))
            }
            else {
                draft.assets = unique(
                    (draft.assets || []).filter((value) => (!payloads.find((payload) => (payload.type === 'CanonRemove' && `ASSET#${value}` === payload.assetId)))),
                    payloads
                        .filter(({ type }) => (type === 'CanonAdd'))
                        .map((payload) => (payload.type === 'CanonAdd' && payload.assetId.split('#')?.[1])).filter((value) => (value))
                        .filter((value): value is string => (Boolean(value)))
                )
            }
        },
        ReturnValues: 'UPDATED_NEW'
    })) || {}
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
}
