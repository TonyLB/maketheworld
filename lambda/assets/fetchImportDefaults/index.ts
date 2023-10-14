import { FetchImportsMessage, MessageBus } from "../messageBus/baseClasses"

import internalCache from '../internalCache'
import { apiClient } from "../clients"
import { splitType } from "@tonylb/mtw-utilities/dist/types"
import Normalizer from "@tonylb/mtw-wml/dist/normalize"

import { SchemaAssetTag } from "@tonylb/mtw-wml/dist/schema/baseClasses"
import { isSchemaAssetContents } from "@tonylb/mtw-wml/dist/schema/baseClasses"
import { schemaToWML } from "@tonylb/mtw-wml/dist/schema"
import recursiveFetchImports, { NestedTranslateImportToFinal } from "./recursiveFetchImports"
import { FetchImportsJSONHelper, InheritanceGraph } from "./baseClasses"
import { EphemeraAssetId } from "@tonylb/mtw-interfaces/ts/baseClasses"

export const fetchImportsMessage = async ({ payloads, messageBus }: { payloads: FetchImportsMessage[], messageBus: MessageBus }): Promise<void> => {
    const [ConnectionId, RequestId] = await Promise.all([
        internalCache.Connection.get("connectionId"),
        internalCache.Connection.get("RequestId")
    ])

    await Promise.all(
        payloads.map(async ({ importsFromAsset }) => {
            const ancestry = await internalCache.Graph.get(importsFromAsset.map(({ assetId }) => (assetId)), 'back', { fetchEdges: true })
            const addresses = await internalCache.Meta.get(Object.keys(ancestry.nodes) as EphemeraAssetId[])
            const inheritanceGraph = new InheritanceGraph(
                Object.assign({}, ...addresses.map(({ address, AssetId }) => ({ [AssetId]: { key: AssetId, address } }))),
                ancestry.edges as any,
                { address: {} as any }
            )
            const jsonHelper = new FetchImportsJSONHelper(inheritanceGraph)

            //
            // TODO: Decouple creation of the data to populate the helper class (to be done on the assets lambda)
            // from creation of the helper class and the rest of the fetchImports process (to be done on the
            // wml lambda, by way of step function call)
            //
            const importsByAsset = await Promise.all(
                importsFromAsset.map(async ({ assetId, keys }) => {
                    const schemaTags = await recursiveFetchImports({ assetId, jsonHelper, translate: new NestedTranslateImportToFinal(keys, []) })
                    const assetSchema: SchemaAssetTag = {
                        tag: 'Asset',
                        Story: undefined,
                        key: splitType(assetId)[1],
                        contents: schemaTags.filter(isSchemaAssetContents)
                    }
                    const normalizer = new Normalizer()
                    normalizer.loadSchema([assetSchema])
                    normalizer.standardize()
                    return {
                        assetId,
                        wml: schemaToWML(normalizer.schema)
                    }
                })
            )
            await apiClient.send({
                ConnectionId,
                Data: JSON.stringify({
                    RequestId,
                    messageType: 'FetchImports',
                    importsByAsset
                })
            })
        })
    )
}
