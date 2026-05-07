import messageBus from './messageBus'
import { sendApiCognitoEvent } from './dataSource/apiCognito'
import './dataSource'

export const routeCognitoIngress = async (event: any) => {
    if (event?.triggerSource === 'PostConfirmation_ConfirmSignUp' && event?.userName) {
        sendApiCognitoEvent(messageBus, {
            type: 'New Player',
            player: event.userName
        })
    }
}
