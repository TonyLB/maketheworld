const { marshall } = require('@aws-sdk/util-dynamodb')
const { UpdateItemCommand } = require('@aws-sdk/client-dynamodb')
const { healGlobalConnections } = require('../selfHealing')
const { splitType } = require('../utilities')

const { TABLE_PREFIX } = process.env;
const ephemeraTable = `${TABLE_PREFIX}_ephemera`

const checkForDisconnect = async (dbClient, { oldImage }) => {
    const { DataCategory } = oldImage
    if (DataCategory.startsWith('CONNECTION#')) {
        const ConnectionId = splitType(DataCategory)[1]
        const updateCommand = new UpdateItemCommand({
            TableName: ephemeraTable,
            Key: marshall({
                EphemeraId: 'Global',
                DataCategory: 'Connections'
            }),
            UpdateExpression: 'REMOVE connections.#connection',
            ExpressionAttributeNames: {
                '#connection': ConnectionId
            }
        })
        try {
            await dbClient.send(updateCommand)
        }
        catch {
            await healGlobalConnections(dbClient)
            await dbClient.send(updateCommand)
        }
    }

    return {}
}

exports.checkForDisconnect = checkForDisconnect
