import { GetObjectCommand as GetObjectCommandOriginal } from "@aws-sdk/client-s3"
import { EventBridgeClient, PutEventsCommand } from "@aws-sdk/client-eventbridge"
import { apiClient as apiClientImport } from "@tonylb/mtw-utilities/dist/apiManagement/apiManagementClient"
import { SFNClient } from "@aws-sdk/client-sfn"

export const ebClient = new EventBridgeClient({ region: process.env.AWS_REGION })
export const sfnClient = new SFNClient({ region: process.env.AWS_REGION })

// export const s3Client = new S3Client(params)

export class GetObjectCommand extends GetObjectCommandOriginal {}

export const apiClient = {
    send: (message: any) => {
        return apiClientImport.send(message)
            .catch(async (err: any) => {
                if (err.name === 'GoneException' || err.name === 'BadRequestException') {
                    await ebClient.send(new PutEventsCommand({
                        Entries: [{
                            EventBusName: process.env.EVENT_BUS_NAME,
                            Source: 'mtw.diagnostics',
                            DetailType: 'Force Disconnect',
                            Detail: JSON.stringify({
                                connectionId: message.ConnectionId
                            })
                        }]
                    }))
                }
                else {
                    console.log(`Error: ${err.name}`)
                    throw err
                }
            })
    }
}
