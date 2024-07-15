import { AssetWorkspaceAddress } from '@tonylb/mtw-asset-workspace/ts/'
import { PublishCommand } from '@aws-sdk/client-sns'
import { snsClient } from './clients';
import { EphemeraAssetId } from '@tonylb/mtw-interfaces/ts/baseClasses';
import { Graph } from '@tonylb/mtw-utilities/dist/graphStorage/utils/graph';
import { fetchImports } from './fetchImportDefaults';
import { parseWMLHandler } from './parseWML'
import copyWML from './copyWML';
import { resetWML } from './resetWML';

const { FEEDBACK_TOPIC } = process.env

type FetchImportsHandlerArguments = {
    ConnectionId: string;
    RequestId: string;
    inheritanceNodes: { key: EphemeraAssetId; address: AssetWorkspaceAddress }[];
    inheritanceEdges: { from: EphemeraAssetId; to: EphemeraAssetId }[];
    payloads: { assetId: EphemeraAssetId; keys: string[] }[];
}

const fetchImportsHandler = async (event: FetchImportsHandlerArguments) => {
    try {
        const inheritanceGraph = new Graph<EphemeraAssetId, { key: EphemeraAssetId; address: AssetWorkspaceAddress }, {}>(Object.assign({}, ...event.inheritanceNodes.map(({ key, address }) => ({ [key]: { key, address } }))), event.inheritanceEdges, { address: {} as any })
        return await fetchImports({
            ConnectionId: event.ConnectionId,
            RequestId: event.RequestId,
            inheritanceGraph,
            payloads: event.payloads
        })
    }
    catch (error) {
        await snsClient.send(new PublishCommand({
            TopicArn: FEEDBACK_TOPIC,
            Message: '{}',
            MessageAttributes: {
                RequestId: { DataType: 'String', StringValue: event.RequestId },
                ConnectionIds: { DataType: 'String.Array', StringValue: JSON.stringify([event.ConnectionId]) },
                Type: { DataType: 'String', StringValue: 'Error' },
                Error: { DataType: 'String', StringValue: 'Internal error in FetchImports' }
            }
        }))
        console.log(error)
        throw error
    }
}

export const handler = async (event: any) => {

    switch(event.message) {
        case 'parseWML':
            return await parseWMLHandler(event)
        case 'copyWML':
            return await copyWML(event)
        case 'resetWML':
            return await resetWML(event)
        case 'fetchImports':
            return await fetchImportsHandler(event)
    }
}
