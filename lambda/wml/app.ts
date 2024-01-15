import AssetWorkspace from '@tonylb/mtw-asset-workspace'
import { AssetWorkspaceAddress } from '@tonylb/mtw-asset-workspace/ts/'
import { ParseWMLAPIImage } from "@tonylb/mtw-interfaces/ts/asset"
import { assetWorkspaceFromAssetId } from './utilities/assets'
import { isNormalAsset } from '@tonylb/mtw-wml/ts/normalize/baseClasses'
import { formatImage } from './formatImage';
import { StartExecutionCommand, SFNClient } from '@aws-sdk/client-sfn'
import { DeleteObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { PublishCommand } from '@aws-sdk/client-sns'
import AWSXRay from 'aws-xray-sdk'
import { snsClient } from './clients';
import { EphemeraAssetId } from '@tonylb/mtw-interfaces/ts/baseClasses';
import { Graph } from '@tonylb/mtw-utilities/dist/graphStorage/utils/graph';
import { fetchImports } from './fetchImportDefaults';
import { dbRegister } from './serialize/dbRegister';
import Normalizer from '@tonylb/mtw-wml/ts/normalize'
import { extractDependenciesFromJS } from './utilities/extractDependencies'

const params = { region: process.env.AWS_REGION }
const s3Client = AWSXRay.captureAWSv3Client(new S3Client(params))
export const sfnClient = new SFNClient({ region: process.env.AWS_REGION })
const { UPLOAD_BUCKET, FEEDBACK_TOPIC } = process.env

type ParseWMLHandlerArguments = {
    address: AssetWorkspaceAddress;
    player: string;
    requestId: string;
    connectionId: string;
    uploadName?: string;
}

const parseWMLHandler = async (event: ParseWMLHandlerArguments) => {

    const { address, requestId, connectionId, uploadName } = event
    const images = []

    const assetWorkspace = new AssetWorkspace(address)
    await assetWorkspace.loadJSON()

    assetWorkspace.setWorkspaceLookup(assetWorkspaceFromAssetId)
    const fileType = Object.values(assetWorkspace.normal || {}).find(isNormalAsset) ? 'Asset' : 'Character'
    const imageFiles = (await Promise.all([
        uploadName ? assetWorkspace.loadWMLFrom(uploadName, true) : assetWorkspace.loadWML(),
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
        const normalizer = new Normalizer()
        normalizer.loadNormal(assetWorkspace.normal || {})
        normalizer.assignDependencies(extractDependenciesFromJS)
        assetWorkspace.normal = normalizer.normal
        await Promise.all([
            assetWorkspace.pushJSON(),
            assetWorkspace.pushWML(),
            dbRegister(assetWorkspace)
        ])

        //
        // TODO: Separate cacheAssets out into parseWML step function rather than calling
        // another step function from inside the WML lambda
        //
        await sfnClient.send(new StartExecutionCommand({
            stateMachineArn: process.env.CACHE_ASSETS_SFN,
            input: JSON.stringify({
                assetIds: [assetWorkspace.assetId],
                addresses: [{ AssetId: assetWorkspace.assetId, address: assetWorkspace.address }],
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
        await snsClient.send(new PublishCommand({
            TopicArn: FEEDBACK_TOPIC,
            Message: JSON.stringify({
                messageType: 'ParseWML',
                images: imageFiles
            }),
            MessageAttributes: {
                RequestId: { DataType: 'String', StringValue: requestId },
                ConnectionIds: { DataType: 'String.Array', StringValue: JSON.stringify([connectionId]) },
                Type: { DataType: 'String', StringValue: 'Success' }
            }
        }))
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
