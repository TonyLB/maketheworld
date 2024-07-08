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
                    const { outputText = '' } = body.results[0]
                    const strippedStart = (outputText.trim().toLowerCase().startsWith('```json') ? outputText.trim().slice(7) : outputText).trim()
                    const strippedEnd = (strippedStart.endsWith('```') ? strippedStart.slice(0, -3) : strippedStart).trim()
                    const json = JSON.parse(strippedEnd)
                    if (typeof json === 'object' && ('description' in json && 'summary' in json)) {
                        await snsClient.send(new PublishCommand({
                            TopicArn: FEEDBACK_TOPIC,
                            Message: JSON.stringify({
                                messageType: 'LLMGenerate',
                                description: json.description,
                                summary: json.summary
                            }),
                            MessageAttributes: {
                                RequestId: { DataType: 'String', StringValue: event.RequestId },
                                ConnectionIds: { DataType: 'String.Array', StringValue: JSON.stringify([event.ConnectionId]) },
                                Type: { DataType: 'String', StringValue: 'Success' }
                            }
                        }))
                    }
                    else {
                        throw new Error('Invalid format returned from LLM')
                    }

                    return {}
                }
            }
    }
    throw new Error('Invalid input type')
}
