import { ephemeraDB } from "@tonylb/mtw-utilities/dist/dynamoDB";
import { CanonUpdateMessage, MessageBus } from "../messageBus/baseClasses";
import { unique } from "@tonylb/mtw-utilities/dist/lists";
import internalCache from "../internalCache";

export const canonUpdateMessage = async ({ payloads }: { payloads: CanonUpdateMessage[], messageBus?: MessageBus }): Promise<void> => {
    const { assets = [] } = await ephemeraDB.optimisticUpdate({
        key: {
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
    })
    internalCache.Global.set({ key: 'assets', value: assets })
    //
    // TODO: RoomUpdate for all active characters
    //
}
