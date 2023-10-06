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

const params = { region: process.env.AWS_REGION }
const s3Client = AWSXRay.captureAWSv3Client(new S3Client(params))
export const sfnClient = new SFNClient({ region: process.env.AWS_REGION })
const { UPLOAD_BUCKET } = process.env

export const handler = async (event: { address: AssetWorkspaceAddress; player: string; requestId: string; connectionId: string; uploadName?: string }) => {

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
            // dbRegister(assetWorkspace)
        ])
        //
        // TODO: Refactor below so as to not make duplicate healPlayer calls when parsing multiple WMLs
        //
        if (assetWorkspace.address.zone === 'Personal') {
            // await healPlayer(player)
        }

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
