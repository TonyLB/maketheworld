import { ephemeraDB } from "@tonylb/mtw-utilities/dist/dynamoDB"
import { MessageBus } from "../messageBus/baseClasses"
import { mergeIntoEphemera } from "../cacheAsset/mergeIntoEphemera";
import internalCache from "../internalCache";
import { graphStorageDB } from "../dependentMessages/graphCache";
import GraphUpdate from "@tonylb/mtw-utilities/dist/graphStorage/update";
import { EphemeraAssetId, EphemeraCharacterId } from "@tonylb/mtw-interfaces/ts/baseClasses";

type DecacheAssetArguments = {
    assetId: EphemeraAssetId | EphemeraCharacterId;
    messageBus: MessageBus;
}

export const decacheAsset = async ({ assetId, messageBus }: DecacheAssetArguments): Promise<void> => {
    const graphUpdate = new GraphUpdate({ internalCache: internalCache._graphCache, dbHandler: graphStorageDB })
    graphUpdate.setEdges([{ itemId: assetId, edges: [], options: { direction: 'back' } }])
    const DataCategory = assetId.split('#')[0] === 'ASSET' ? 'Meta::Asset' : 'Meta::Character'
    await Promise.all([
        mergeIntoEphemera(assetId.split('#')[1], [], graphUpdate),
        ephemeraDB.deleteItem({
            EphemeraId: assetId,
            DataCategory
        })
    ])
    await graphUpdate.flush()
}

export default decacheAsset
