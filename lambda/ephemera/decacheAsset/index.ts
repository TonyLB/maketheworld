import { ephemeraDB } from "@tonylb/mtw-utilities/dist/dynamoDB"
import { AssetKey } from "@tonylb/mtw-utilities/dist/types"
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
    graphUpdate.setEdges([{ itemId: AssetKey(assetId), edges: [], options: { direction: 'back' } }])
    await Promise.all([
        mergeIntoEphemera(assetId, [], graphUpdate),
        ephemeraDB.deleteItem({
            EphemeraId: AssetKey(assetId),
            DataCategory: 'Meta::Asset'
        })
    ])
    await graphUpdate.flush()
}

export default decacheAsset
