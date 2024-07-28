import AssetWorkspace, { AssetWorkspaceAddress } from "@tonylb/mtw-asset-workspace"
import { assetWorkspaceFromAssetId } from "./utilities/assets"
import { formatImage } from "./formatImage"
import { s3Client, sfnClient, snsClient } from "./clients"
import { ParseWMLAPIImage } from "@tonylb/mtw-interfaces/ts/asset"
import { extractDependenciesFromJS } from "./utilities/extractDependencies"
import { dbRegister } from "./serialize/dbRegister"
import { StartExecutionCommand } from "@aws-sdk/client-sfn"
import { DeleteObjectCommand } from "@aws-sdk/client-s3"
import { PublishCommand } from "@aws-sdk/client-sns"
import { Standardizer } from "@tonylb/mtw-wml/ts/standardize"

type ParseWMLHandlerArguments = {
    address: AssetWorkspaceAddress;
    player: string;
    requestId: string;
    connectionId: string;
    uploadName?: string;
    images: { key: string; fileName: string }[];
}

const { UPLOAD_BUCKET, FEEDBACK_TOPIC } = process.env

export const parseWMLHandler = async (event: ParseWMLHandlerArguments) => {

    const { address, requestId, connectionId, uploadName, images = [] } = event

    try {
        const assetWorkspace = new AssetWorkspace(address)
        await assetWorkspace.loadJSON()

        assetWorkspace.setWorkspaceLookup(assetWorkspaceFromAssetId)
        const fileType = assetWorkspace.standard?.tag ?? 'Asset'
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
            const standardizer = new Standardizer()
            if (!assetWorkspace.standard) {
                return
            }
            standardizer.deserialize(assetWorkspace.standard)
            standardizer.assignDependencies(extractDependenciesFromJS)
            assetWorkspace.standard = standardizer.stripped
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
    catch (error) {
        await snsClient.send(new PublishCommand({
            TopicArn: FEEDBACK_TOPIC,
            Message: '{}',
            MessageAttributes: {
                RequestId: { DataType: 'String', StringValue: requestId },
                ConnectionIds: { DataType: 'String.Array', StringValue: JSON.stringify([connectionId]) },
                Type: { DataType: 'String', StringValue: 'Error' },
                Error: { DataType: 'String', StringValue: 'Internal error in ParseWML' }
            }
        }))
        throw error
    }

}