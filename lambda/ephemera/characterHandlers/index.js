import { checkForConnect } from './checkForConnect.js'
import { checkForDisconnect } from './checkForDisconnect.js'
import { checkForMovement } from './checkForMovement.js'

export const processCharacterEvent = async ({ eventName, data }) => {
    switch(eventName) {
        case 'INSERT':
            await Promise.all([
                checkForConnect(data),
            ])
            break
        case 'MODIFY':
            await Promise.all([
                checkForConnect(data),
                checkForDisconnect(data),
                checkForMovement(data)
            ])
            break
        case 'REMOVE':
            await Promise.all([
                checkForDisconnect(data)
            ])
            break
        default:
            break
    }
}
