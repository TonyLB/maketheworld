import AssetWorkspace from '@tonylb/mtw-asset-workspace'
import { AssetWorkspaceAddress } from '@tonylb/mtw-asset-workspace/ts/readOnly'
import { ParseWMLAPIImage } from "@tonylb/mtw-interfaces/ts/asset"
import { assetWorkspaceFromAssetId } from './utilities/assets'
import { isNormalAsset } from '@tonylb/mtw-normal';
import { formatImage } from './formatImage';
import { StartExecutionCommand, SFNClient } from '@aws-sdk/client-sfn'
import { DeleteObjectCommand, S3Client } from '@aws-sdk/client-s3'
import AWSXRay from 'aws-xray-sdk'
import { apiClient } from './clients';
import { EphemeraAssetId } from '@tonylb/mtw-interfaces/ts/baseClasses';
import { Graph } from '@tonylb/mtw-utilities/dist/graphStorage/utils/graph';
import { fetchImports } from './fetchImportDefaults';

const params = { region: process.env.AWS_REGION }
const s3Client = AWSXRay.captureAWSv3Client(new S3Client(params))
export const sfnClient = new SFNClient({ region: process.env.AWS_REGION })
const { UPLOAD_BUCKET } = process.env

type ParseWMLHandlerArguments = {
    address: AssetWorkspaceAddress;
    player: string;
    requestId: string;
    connectionId: string;
    uploadName?: string;
}

const parseWMLHandler = async (event: ParseWMLHandlerArguments) => {

    const { address, player, requestId, connectionId, uploadName } = event
    const images = []

    const assetWorkspace = new AssetWorkspace(address)
    await assetWorkspace.loadJSON()

    console.log(`JSON loaded: ${JSON.stringify(assetWorkspace.normal, null, 4)}`)

    assetWorkspace.setWorkspaceLookup(assetWorkspaceFromAssetId)
    const fileType = Object.values(assetWorkspace.normal || {}).find(isNormalAsset) ? 'Asset' : 'Character'
    const imageFiles = (await Promise.all([
        assetWorkspace.loadWMLFrom(uploadName || assetWorkspace.fileName, true),
        ...((images || []).map(async ({ key, fileName }) => {
            const final = await formatImage(s3Client)({ fromFileName: fileName, width: fileType === 'Asset' ? 1200: 200, height: fileType === 'Asset' ? 800 : 200 })
            return { key, fileName: final }
        }))
    ])).slice(1) as ParseWMLAPIImage[]
    if (imageFiles.length) {
        assetWorkspace.status.json = 'Dirty'
        imageFiles.forEach(({ key, fileName }) => {
            (assetWorkspace as AssetWorkspace).properties[key] = { fileName }
        })
    }
    if (assetWorkspace.status.json !== 'Clean') {
        await Promise.all([
            assetWorkspace.pushJSON(),
            assetWorkspace.pushWML(),
            //
            // TODO: Refactor dbRegister to only register the asset and its graph connections, not every single component in the asset.
            //
            // dbRegister(assetWorkspace)
        ])

        //
        // TODO: Separate cacheAssets out into parseWML step function rather than calling
        // another step function from inside the WML lambda
        //
        await sfnClient.send(new StartExecutionCommand({
            stateMachineArn: process.env.CACHE_ASSETS_SFN,
            input: JSON.stringify({
                addresses: [assetWorkspace.address],
                updateOnly: Boolean(assetWorkspace.address.zone !== 'Personal')
            })
        }))
    }
    else {
        await assetWorkspace.pushWML()
    }

    if (uploadName) {
        try {
            await s3Client.send(new DeleteObjectCommand({
                Bucket: UPLOAD_BUCKET,
                Key: uploadName
            }))  
        }
        catch {}
    }

    if (connectionId && requestId) {
        await apiClient.send({
            ConnectionId: connectionId,
            Data: JSON.stringify({
                messageType: 'ParseWML',
                images: imageFiles,
                RequestId: requestId
            })
        })
    }

}

type FetchImportsHandlerArguments = {
    ConnectionId: string;
    RequestId: string;
    inheritanceNodes: { key: EphemeraAssetId; address: AssetWorkspaceAddress }[];
    inheritanceEdges: { from: EphemeraAssetId; to: EphemeraAssetId }[];
    payloads: { assetId: EphemeraAssetId; keys: string[] }[];
}

const fetchImportsHandler = async (event: FetchImportsHandlerArguments) => {
    const inheritanceGraph = new Graph<EphemeraAssetId, { key: EphemeraAssetId; address: AssetWorkspaceAddress }, {}>(Object.assign({}, ...event.inheritanceNodes.map(({ key, address }) => ({ [key]: { key, address } }))), event.inheritanceEdges, { address: {} as any })
    return await fetchImports({
        ConnectionId: event.ConnectionId,
        RequestId: event.RequestId,
        inheritanceGraph,
        payloads: event.payloads
    })
}

export const handler = async (event: any) => {

    switch(event.message) {
        case 'parseWML':
            return await parseWMLHandler(event)
        case 'fetchImports':
            return await fetchImportsHandler(event)
    }
}
