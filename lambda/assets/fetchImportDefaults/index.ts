import { FetchImportsMessage, MessageBus } from "../messageBus/baseClasses"

import internalCache from '../internalCache'
import { apiClient } from "../clients"
import { splitType } from "@tonylb/mtw-utilities/dist/types"
import Normalizer from "@tonylb/mtw-wml/dist/normalize"

import { SchemaAssetTag } from "@tonylb/mtw-wml/dist/schema/baseClasses"
import { isSchemaAssetContents } from "@tonylb/mtw-wml/dist/schema/baseClasses"
import { schemaToWML } from "@tonylb/mtw-wml/dist/schema"
import recursiveFetchImports, { NestedTranslateImportToFinal } from "./recursiveFetchImports"
import { FetchImportsJSONHelper } from "./baseClasses"

export const fetchImportsMessage = async ({ payloads, messageBus }: { payloads: FetchImportsMessage[], messageBus: MessageBus }): Promise<void> => {
    const [ConnectionId, RequestId] = await Promise.all([
        internalCache.Connection.get("connectionId"),
        internalCache.Connection.get("RequestId")
    ])
    const jsonHelper = new FetchImportsJSONHelper()

    await Promise.all(
        payloads.map(async ({ importsFromAsset }) => {
            //
            // TODO: Create a helper class with asynchronous get-JSON-File functionality to
            // replace directly using internalCache.JSONFile
            //

            //
            // TODO: Refactor helper class to accept a graph with nodes that correlate assetIds and their
            // address data.  Use graph lookup to populate the helper class
            //

            //
            // TODO: Deprecate direct dependency of the helper class on internalCache (i.e. embed
            // the same lookups into the helper class for portability)
            //

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
