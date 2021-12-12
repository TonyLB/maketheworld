const { checkForConnect } = require('./checkForConnect')
const { checkForDisconnect } = require('./checkForDisconnect')
const { checkForMovement } = require('./checkForMovement')

const processCharacterEvent = ({ dbClient, lambdaClient }) => async ({ eventName, data }) => {
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
                checkForMovement({ dbClient, lambdaClient }, data)
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

exports.processCharacterEvent = processCharacterEvent
