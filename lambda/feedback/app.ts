import { apiClient } from "./clients"

export const handler = async (event) => {

    console.log(`event: ${JSON.stringify(event, null, 4)}`)

    await Promise.all(event.Records.map(async ({ Sns }) => {
        if (
            Sns.MessageAttributes.ConnectionIds?.Type !== 'String' ||
            !Array.isArray(JSON.parse(Sns.MessageAttributes.ConnectionIds.Value)) ||
            Sns.MessageAttributes.RequestId?.Type !== 'String' ||
            Sns.MessageAttributes.Type?.Type !== 'String'
        ) {
            throw new Error(`Incoming message format failure (${JSON.stringify(Sns.MessageAttributes, null, 4)})`)
        }
        const connectionIds = JSON.parse(Sns.MessageAttributes.ConnectionIds.Value) as string[]
        const RequestId = Sns.MessageAttributes.RequestId.Value
        switch(Sns.MessageAttributes.Type.Value) {
            case 'Success':
                const Data = JSON.stringify({
                    ...JSON.parse(Sns.Message),
                    RequestId
                })
                await Promise.all(connectionIds.map((ConnectionId) => (apiClient.send({
                    ConnectionId,
                    Data
                }))))
                break
        }
    }))
}
