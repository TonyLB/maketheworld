import { healGlobalValues } from '/opt/utilities/selfHealing/index.js'
import { splitType } from '/opt/utilities/types.js'
import { ephemeraDB } from '/opt/utilities/dynamoDB/index.js'

//
// When connections get removed explicitly, this DBStream event
// won't be necessary (it will be done immediately as part of
// processing).  But when the connection doesn't get eliminated
// in normal processing, the redundancy is for it to time out of
// the Ephemera table, and this DBStream processor _will_ catch
// that.
//
// TODO: Implement timeout, and limit this record process to
// only trigger when the delete is caused by the DynamoDB system
// itself (check AWS Documentation on how to distinguish that)
//
export const checkForDisconnect = async ({ oldImage }) => {
    const { DataCategory } = oldImage
    if (DataCategory.startsWith('CONNECTION#')) {
        const ConnectionId = splitType(DataCategory)[1]
        await ephemeraDB.update({
            EphemeraId: 'Global',
            DataCategory: 'Connections',
            UpdateExpression: 'REMOVE connections.#connection',
            ExpressionAttributeNames: {
                '#connection': ConnectionId
            },
            catchException: healGlobalValues
        })
    }

    return {}
}
