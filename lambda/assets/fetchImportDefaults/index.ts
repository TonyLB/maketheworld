import { FetchImportsMessage, MessageBus } from "../messageBus/baseClasses"

import internalCache from '../internalCache'
import { FetchImportsJSONHelper, InheritanceGraph } from "./baseClasses"
import { EphemeraAssetId } from "@tonylb/mtw-interfaces/ts/baseClasses"
import { Graph } from "@tonylb/mtw-utilities/ts/graphStorage/utils/graph"
import { stripImportAndExport } from "./utils"
import recursiveFetchImports from "./recursiveFetchImports"
import { schemaToWML } from "@tonylb/mtw-wml/ts/schema"
import { snsClient } from "../clients"
import { PublishCommand } from "@aws-sdk/client-sns"

const { FEEDBACK_TOPIC } = process.env

export const fetchImportsMessage = async ({ payloads }: { payloads: FetchImportsMessage[], messageBus: MessageBus }): Promise<void> => {
    const [ConnectionId, RequestId] = await Promise.all([
        internalCache.Connection.get("connectionId"),
        internalCache.Connection.get("RequestId")
    ])

    await Promise.all(
        payloads.map(async ({ importsFromAsset }) => {
            const ancestry = await internalCache.Graph.get(importsFromAsset.map(({ assetId }) => (assetId)), 'back', { fetchEdges: true })
            const addresses = await internalCache.Meta.get(Object.keys(ancestry.nodes) as EphemeraAssetId[])
            const inheritanceGraph: InheritanceGraph = new Graph(
                Object.assign({}, ...addresses.map(({ address, AssetId }) => ({ [AssetId]: { key: AssetId, address } }))),
                ancestry.edges as any,
                { address: {} as any }
            )
            const jsonHelper = new FetchImportsJSONHelper(inheritanceGraph)

            const importsByAsset = await Promise.all(
                importsFromAsset.map(async ({ assetId, keys }) => {
                    const standard = stripImportAndExport(await recursiveFetchImports({ assetId, jsonHelper, fullKeys: keys, stubKeys: [] }))
                    const wml = schemaToWML([standard.schema])
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
        })
    )
}
