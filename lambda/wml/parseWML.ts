import AssetWorkspace, { AssetWorkspaceAddress } from "@tonylb/mtw-asset-workspace/ts"
import { assetWorkspaceFromAssetId } from "./utilities/assets"
import { formatImage } from "./formatImage"
import { s3Client, sfnClient, snsClient } from "./clients"
import { ParseWMLAPIImage } from "@tonylb/mtw-interfaces/ts/asset"

import { dbRegister } from "./serialize/dbRegister"
import { StartExecutionCommand } from "@aws-sdk/client-sfn"
import { DeleteObjectCommand } from "@aws-sdk/client-s3"
import { PublishCommand } from "@aws-sdk/client-sns"
import { ConnectionKey } from '@tonylb/mtw-utilities/ts/types'

import StandardImage from "@tonylb/mtw-wml/ts/standardize/components/image"


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
        try {
            await assetWorkspace.loadJSON()
        }
        catch {}

        assetWorkspace.setWorkspaceLookup(assetWorkspaceFromAssetId)
        const imageFiles = (await Promise.all([
            uploadName ? assetWorkspace.loadWMLFrom(uploadName, true) : assetWorkspace.loadWML(),
            ...((images || []).map(async ({ key, fileName }) => {
                const final = await formatImage(s3Client)({ fromFileName: fileName, width: 1200, height: 800 })
                return { key, fileName: final }
            }))
        ])).slice(1) as ParseWMLAPIImage[]
        if (imageFiles.length && assetWorkspace.standard) {
            assetWorkspace.status.json = 'Dirty'
            const newStandard = assetWorkspace.standard._clone()
            imageFiles.forEach(({ key, fileName }) => {
                const imageComponent = newStandard.byId[key]
                if (imageComponent instanceof StandardImage) {
                    newStandard.byUniversalId[key] = imageComponent.withFileName(fileName)
                }
            })
            assetWorkspace.standard = newStandard
        }
        if (assetWorkspace.status.json !== 'Clean') {
            if (!assetWorkspace.standard) {
                return
            }
            

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
                    Targets: { DataType: 'String.Array', StringValue: JSON.stringify([ConnectionKey(connectionId)]) },
                    Type: { DataType: 'String', StringValue: 'Success' }
                }
            }))
        }
    }
    catch (error) {
        if (requestId && connectionId) {
            await snsClient.send(new PublishCommand({
                TopicArn: FEEDBACK_TOPIC,
                Message: '{}',
                MessageAttributes: {
                    RequestId: { DataType: 'String', StringValue: requestId },
                    Targets: { DataType: 'String.Array', StringValue: JSON.stringify([ConnectionKey(connectionId)]) },
                    Type: { DataType: 'String', StringValue: 'Error' },
                    Error: { DataType: 'String', StringValue: 'Internal error in ParseWML' }
                }
            }))
        }
        throw error
    }

}