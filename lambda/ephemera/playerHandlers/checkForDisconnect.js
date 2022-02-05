import { marshall } from '@aws-sdk/util-dynamodb'
import { UpdateItemCommand } from '@aws-sdk/client-dynamodb'
import { healGlobalValues } from '../selfHealing/index.js'
import { splitType } from '/opt/utilities/types.js'

const { TABLE_PREFIX } = process.env;
const ephemeraTable = `${TABLE_PREFIX}_ephemera`

export const checkForDisconnect = async (dbClient, { oldImage }) => {
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
            await healGlobalValues(dbClient)
            await dbClient.send(updateCommand)
        }
    }

    return {}
}
