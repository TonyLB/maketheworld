import { snsClient } from "../clients"

import { schemaToWML } from "@tonylb/mtw-wml/ts/schema"
import recursiveFetchImports from "./recursiveFetchImports"
import { FetchImportsJSONHelper, InheritanceGraph } from "./baseClasses"
import { EphemeraAssetId } from "@tonylb/mtw-interfaces/ts/baseClasses"
import { PublishCommand } from "@aws-sdk/client-sns"
import { stripImportAndExport } from "./utils"

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
            const standard = stripImportAndExport(await recursiveFetchImports({ assetId, jsonHelper, fullKeys: keys, stubKeys: [] }))
            const wrappedWithInheritedTag = {
                data: standard.schema.data,
                children: [{
                    data: { tag: 'Inherited' as const },
                    children: standard.schema.children
                }]
            }
            const wml = schemaToWML([wrappedWithInheritedTag])
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
