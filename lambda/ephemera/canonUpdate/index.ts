import { EphemeraId } from '@tonylb/mtw-interfaces/dist/baseClasses'
import { nonLegacyEphemeraDB } from "@tonylb/mtw-utilities/dist/dynamoDB";
import { CanonUpdateMessage, MessageBus } from "../messageBus/baseClasses";
import { unique } from "@tonylb/mtw-utilities/dist/lists";
import internalCache from "../internalCache";

export const canonUpdateMessage = async ({ payloads, messageBus }: { payloads: CanonUpdateMessage[], messageBus?: MessageBus }): Promise<void> => {
    //
    // TODO: Fix type broadening in nonLegacyEphemeraDB, so that you can pass a type that includes string[] properties
    // to optimisticUpdate, and not cast as any
    //
    const { assets = [] } = (await nonLegacyEphemeraDB.optimisticUpdate({
        Key: {
            EphemeraId: 'Global',
            DataCategory: 'Assets'
        },
        updateKeys: ['assets'],
        updateReducer: (draft) => {
            draft.assets = unique(
                (draft.assets || []).filter((value) => (!payloads.find(({ type, assetId }) => (type === 'CanonRemove' && `ASSET#${value}` === assetId)))),
                payloads.filter(({ type }) => (type === 'CanonAdd')).map(({ assetId }) => (assetId.split('#')?.[1])).filter((value) => (value))
            )
        },
        ReturnValues: 'UPDATED_NEW'
    })) as any
    internalCache.Global.set({ key: 'assets', value: assets })
    if (messageBus) {
        payloads.forEach(({ assetId }) => {
            messageBus.send({
                type: 'Perception',
                ephemeraId: assetId
            })    
        })
    }
}
