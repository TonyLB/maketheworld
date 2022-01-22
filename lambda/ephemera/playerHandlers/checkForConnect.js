import { marshall } from '@aws-sdk/util-dynamodb'
import { UpdateItemCommand } from '@aws-sdk/client-dynamodb'
import { healGlobalConnections } from '../selfHealing/index.js'
import { splitType } from '../utilities/index.js'

const { TABLE_PREFIX } = process.env;
const ephemeraTable = `${TABLE_PREFIX}_ephemera`

export const checkForConnect = async (dbClient, { newImage }) => {
    const { EphemeraId, DataCategory } = newImage
    if (DataCategory.startsWith('CONNECTION#')) {
        const PlayerName = splitType(EphemeraId)[1]
        const ConnectionId = splitType(DataCategory)[1]
        const updateCommand = new UpdateItemCommand({
            TableName: ephemeraTable,
            Key: marshall({
                EphemeraId: 'Global',
                DataCategory: 'Connections'
            }),
            UpdateExpression: 'SET connections.#connection = :player',
            ExpressionAttributeValues: marshall({
                ':player': PlayerName
            }),
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
        //
        // TODO: Cascade a whoAmI return value off of connect, rather than
        // having to request it explicitly from the client.  This will let
        // the client know when the ephemera for the player have been
        // properly set.
        //
    }

    return {}
}
