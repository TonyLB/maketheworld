import { EventBridgeClient, PutEventsCommand } from "@aws-sdk/client-eventbridge"

const ebClient = new EventBridgeClient({ region: process.env.AWS_REGION })

export const handler = async (event) => {

    // Handle Cognito PostConfirm messages
    if (event?.triggerSource === 'PostConfirmation_ConfirmSignUp' && event?.userName) {
        await ebClient.send(new PutEventsCommand({
            Entries: [{
                EventBusName: process.env.EVENT_BUS_NAME,
                Source: 'mtw.diagnostics',
                DetailType: 'Heal Player',
                Detail: JSON.stringify({ player: event.userName })
            }]
        }))
    }
    return event
}
