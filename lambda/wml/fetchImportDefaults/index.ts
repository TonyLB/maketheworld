import { snsClient } from "../clients"
import { splitType } from "@tonylb/mtw-utilities/ts/types"

import { SchemaAssetTag } from "@tonylb/mtw-wml/ts/schema/baseClasses"
import { schemaToWML } from "@tonylb/mtw-wml/ts/schema"
import recursiveFetchImports, { NestedTranslateImportToFinal } from "./recursiveFetchImports"
import { FetchImportsJSONHelper, InheritanceGraph } from "./baseClasses"
import { EphemeraAssetId } from "@tonylb/mtw-interfaces/ts/baseClasses"
import standardizeSchema from "@tonylb/mtw-wml/ts/schema/standardize"
import { PublishCommand } from "@aws-sdk/client-sns"

const { FEEDBACK_TOPIC } = process.env

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
                key: splitType(assetId)[1]
            }
            const standardized = standardizeSchema([{ data: assetSchema, children: schemaTags }])
            const wrappedWithInheritedTag = standardized.map(({ data, children }) => ({
                data,
                children: [{
                    data: { tag: 'Inherited' as const },
                    children
                }]
            }))
            const wml = schemaToWML(wrappedWithInheritedTag)
            return {
                assetId,
                wml
            }
        })
    )
    await snsClient.send(new PublishCommand({
        TopicArn: FEEDBACK_TOPIC,
        Message: JSON.stringify({
            messageType: 'FetchImports',
            importsByAsset
        }),
        MessageAttributes: {
            RequestId: { DataType: 'String', StringValue: RequestId },
            ConnectionIds: { DataType: 'String.Array', StringValue: JSON.stringify([ConnectionId]) },
            Type: { DataType: 'String', StringValue: 'Success' }
        }
    }))

}
