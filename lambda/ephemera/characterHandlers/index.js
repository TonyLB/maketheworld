import { checkForConnect } from './checkForConnect.js'
import { checkForDisconnect } from './checkForDisconnect.js'
import { checkForMovement } from './checkForMovement.js'

export const processCharacterEvent = (dbClient) => async ({ eventName, data }) => {
    switch(eventName) {
        case 'INSERT':
            await Promise.all([
                checkForConnect(dbClient, data),
            ])
            break
        case 'MODIFY':
            await Promise.all([
                checkForConnect(dbClient, data),
                checkForDisconnect(dbClient, data),
                checkForMovement(dbClient, data)
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
