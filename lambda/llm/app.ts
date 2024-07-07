import { roomGeneratePrompt } from "./roomGenerate"
import { snsClient } from './clients'
import { PublishCommand } from "@aws-sdk/client-sns"

const { FEEDBACK_TOPIC } = process.env

export const handler = async (event) => {

    switch(event.type) {
        case 'RoomGenerate':
            const prompt = await roomGeneratePrompt(event.name)
            return { prompt }
        case 'ParseRoomGenerate':
            const body = event.results.Body
            if (body) {
                if ('results' in body) {
                    await snsClient.send(new PublishCommand({
                        TopicArn: FEEDBACK_TOPIC,
                        Message: JSON.stringify({
                            messageType: 'LLMGenerate',
                            description: body.results[0].outputText
                        }),
                        MessageAttributes: {
                            RequestId: { DataType: 'String', StringValue: event.RequestId },
                            ConnectionIds: { DataType: 'String.Array', StringValue: JSON.stringify([event.ConnectionId]) },
                            Type: { DataType: 'String', StringValue: 'Success' }
                        }
                    }))

                    return {}
                }
            }
    }
    throw new Error('Invalid input type')
}
