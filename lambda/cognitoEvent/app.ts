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
    // Handle Cognito PostConfirm messages (NOTE: To keep this package as lightweight as
    // possible, we directly use the aws-sdk client, rather than importing the eventBridgeClient
    // utility from mtw-utilities)
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
