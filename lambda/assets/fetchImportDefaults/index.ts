import { FetchImportsMessage, MessageBus } from "../messageBus/baseClasses"

import internalCache from '../internalCache'
import { InheritanceGraph } from "./baseClasses"
import { EphemeraAssetId } from "@tonylb/mtw-interfaces/ts/baseClasses"
import { sfnClient } from "../clients"
import { StartExecutionCommand } from "@aws-sdk/client-sfn"

export const fetchImportsMessage = async ({ payloads }: { payloads: FetchImportsMessage[], messageBus: MessageBus }): Promise<void> => {
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
            await sfnClient.send(new StartExecutionCommand({
                stateMachineArn: process.env.FETCH_IMPORTS_SFN,
                input: JSON.stringify({
                    ConnectionId,
                    RequestId,
                    inheritanceNodes: Object.values(inheritanceGraph.nodes),
                    inheritanceEdges: inheritanceGraph.edges,
                    payloads: importsFromAsset
                })
            }))
        })
    )
}
