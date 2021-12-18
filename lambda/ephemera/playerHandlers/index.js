const { checkForConnect } = require('./checkForConnect')
const { checkForDisconnect } = require('./checkForDisconnect')

const processPlayerEvent = ({ dbClient }) => async ({ eventName, data }) => {
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

exports.processPlayerEvent = processPlayerEvent
