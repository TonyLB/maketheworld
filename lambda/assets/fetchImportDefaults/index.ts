import { FetchImportsMessage, MessageBus } from "../messageBus/baseClasses"

import internalCache from '../internalCache'
import { apiClient } from "@tonylb/mtw-utilities/dist/apiManagement/apiManagementClient"
import { splitType } from "@tonylb/mtw-utilities/dist/types"
import Normalizer from "@tonylb/mtw-wml/dist/normalize"

import { SchemaAssetTag } from "@tonylb/mtw-wml/dist/schema/baseClasses"
import { isSchemaAssetContents } from "@tonylb/mtw-wml/dist/schema/baseClasses"
import { schemaToWML } from "@tonylb/mtw-wml/dist/schema"
import recursiveFetchImports, { NestedTranslateImportToFinal } from "./recursiveFetchImports"

export const fetchImportsMessage = async ({ payloads, messageBus }: { payloads: FetchImportsMessage[], messageBus: MessageBus }): Promise<void> => {
    const [ConnectionId, RequestId] = await Promise.all([
        internalCache.Connection.get("connectionId"),
        internalCache.Connection.get("RequestId")
    ])

    await Promise.all(
        payloads.map(async ({ importsFromAsset }) => {
            const importsByAsset = await Promise.all(
                importsFromAsset.map(async ({ assetId, keys }) => {
                    const schemaTags = await recursiveFetchImports({ assetId, translate: new NestedTranslateImportToFinal(keys, []) })
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
