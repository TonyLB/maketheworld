import { checkForDisconnect } from './checkForDisconnect.js'

export const processPlayerEvent = async ({ eventName, data }) => {
    switch(eventName) {
        case 'INSERT':
            await Promise.all([
            ])
            break
        case 'MODIFY':
            await Promise.all([
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
