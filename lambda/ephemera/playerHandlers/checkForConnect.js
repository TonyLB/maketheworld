import { healGlobalValues } from '../selfHealing/index.js'
import { splitType } from '/opt/utilities/types.js'
import { updateEphemera } from '/opt/utilities/dynamoDB/index.js'

export const checkForConnect = async ({ newImage }) => {
    const { EphemeraId, DataCategory } = newImage
    if (DataCategory.startsWith('CONNECTION#')) {
        const PlayerName = splitType(EphemeraId)[1]
        const ConnectionId = splitType(DataCategory)[1]
        await updateEphemera({
            EphemeraId: 'Global',
            DataCategory: 'Connections',
            UpdateExpression: 'SET connections.#connection = :player',
            ExpressionAttributeValues: {
                ':player': PlayerName
            },
            ExpressionAttributeNames: {
                '#connection': ConnectionId
            },
            catchException: healGlobalValues
        })
        //
        // TODO: Cascade a whoAmI return value off of connect, rather than
        // having to request it explicitly from the client.  This will let
        // the client know when the ephemera for the player have been
        // properly set.
        //
    }

    return {}
}
