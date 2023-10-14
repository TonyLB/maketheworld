import { EventBridgeClient, PutEventsCommand } from "@aws-sdk/client-eventbridge"
import { apiClient as apiClientImport } from "@tonylb/mtw-utilities/dist/apiManagement/apiManagementClient"
import { SFNClient } from "@aws-sdk/client-sfn"
import { SNSClient } from "@aws-sdk/client-sns"
import AWSXRay from 'aws-xray-sdk'

export const ebClient = AWSXRay.captureAWSv3Client(new EventBridgeClient({ region: process.env.AWS_REGION }))
export const sfnClient = AWSXRay.captureAWSv3Client(new SFNClient({ region: process.env.AWS_REGION }))
export const snsClient = AWSXRay.captureAWSv3Client(new SNSClient({ region: process.env.AWS_REGION }))

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
