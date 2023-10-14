import { apiClient } from "../clients"
import { splitType } from "@tonylb/mtw-utilities/dist/types"
import Normalizer from "@tonylb/mtw-wml/dist/normalize"

import { SchemaAssetTag } from "@tonylb/mtw-wml/dist/schema/baseClasses"
import { isSchemaAssetContents } from "@tonylb/mtw-wml/dist/schema/baseClasses"
import { schemaToWML } from "@tonylb/mtw-wml/dist/schema"
import recursiveFetchImports, { NestedTranslateImportToFinal } from "./recursiveFetchImports"
import { FetchImportsJSONHelper, InheritanceGraph } from "./baseClasses"
import { EphemeraAssetId } from "@tonylb/mtw-interfaces/ts/baseClasses"

type FetchImportsArguments = {
    ConnectionId: string;
    RequestId: string;
    inheritanceGraph: InheritanceGraph;
    payloads: { assetId: EphemeraAssetId; keys: string[] }[]
}

export const fetchImports = async ({ ConnectionId, RequestId, inheritanceGraph, payloads }: FetchImportsArguments): Promise<void> => {

    const jsonHelper = new FetchImportsJSONHelper(inheritanceGraph)

    const importsByAsset = await Promise.all(
        payloads.map(async ({ assetId, keys }) => {
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
}
