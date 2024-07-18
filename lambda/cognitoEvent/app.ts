import { EventBridgeClient, PutEventsCommand } from "@aws-sdk/client-eventbridge"

const ebClient = new EventBridgeClient({ region: process.env.AWS_REGION })

export const handler = async (event) => {

    //
    // Handle Cognito PreSignup messages
    //
    if (event?.triggerSource === 'PreSignUp_SignUp') {
        event.response.autoConfirmUser = true
        return event
    }

    //
    // Handle Cognito PostConfirm messages
    //
    if (event?.triggerSource === 'PostConfirmation_ConfirmSignUp' && event?.userName) {
        await ebClient.send(new PutEventsCommand({
            Entries: [{
                EventBusName: process.env.EVENT_BUS_NAME,
                Source: 'mtw.connections',
                DetailType: 'New Player',
                Detail: JSON.stringify({ player: event.userName })
            }]
        }))
    }
    return event
}
