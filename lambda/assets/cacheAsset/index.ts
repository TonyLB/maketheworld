import { StandardForm } from "@tonylb/mtw-wml/ts/standardize";
import internalCache from "../internalCache";
import { CacheAssetMessage, MessageBus } from "../messageBus/baseClasses";
import AssetWorkspace from "@tonylb/mtw-asset-workspace";
import { schemaToWML } from "@tonylb/mtw-wml/ts/schema";

export const cacheAssetMessage = async ({ payloads, messageBus }: { payloads: CacheAssetMessage[], messageBus: MessageBus }): Promise<void> => {
    await Promise.all(
        payloads.map(async (payload) => {
            const { assetId } = payload

            const [dbAsset, fileAsset] = await Promise.all([
                internalCache.AssetData.get([`ASSET#${assetId}`]).then(([assetCache]) => (assetCache?.standardForm ?? new StandardForm(`<Asset key=(${assetId}) />`))),
                (async () => {
                    const assetMeta = (await internalCache.Meta.get([`ASSET#${assetId}`]))[0]
                    const { address } = assetMeta ?? {}
                    if (!address) {
                        return new StandardForm(`<Asset key=(${assetId}) />`)
                    }
                    const assetWorkspace = new AssetWorkspace(address)
                    await assetWorkspace.loadJSON()
                    return assetWorkspace.standard ?? new StandardForm(`<Asset key=(${assetId}) />`)
                })()
            ])

            const diff = dbAsset.diff(fileAsset)
            if (diff) {
                console.log(`Difference found for asset ${assetId}:`, schemaToWML([diff.schema]))
            }
        })
    )
}

export default cacheAssetMessage