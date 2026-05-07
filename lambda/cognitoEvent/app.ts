import { routeCognitoIngress } from "./ingress"
import messageBus from "./messageBus"

export const handler = async (event) => {

    //
    // Handle Cognito PreSignup messages
    //
    if (event?.triggerSource === 'PreSignUp_SignUp') {
        event.response.autoConfirmUser = true
        return event
    }

    messageBus.clear()
    await routeCognitoIngress(event)
    await messageBus.flush()
    return event
}
