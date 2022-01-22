import { checkForConnect } from './checkForConnect.js'
import { checkForDisconnect } from './checkForDisconnect.js'

export const processPlayerEvent = ({ dbClient }) => async ({ eventName, data }) => {
    switch(eventName) {
        case 'INSERT':
            await Promise.all([
                checkForConnect(dbClient, data),
            ])
            break
        case 'MODIFY':
            await Promise.all([
            ])
            break
        case 'REMOVE':
            await Promise.all([
                checkForDisconnect(dbClient, data)
            ])
            break
        default:
            break
    }
}
