import { healGlobalValues } from '../selfHealing/index.js'
import { splitType } from '/opt/utilities/types.js'
import { updateEphemera } from '/opt/utilities/dynamoDB/index.js'

export const checkForDisconnect = async ({ oldImage }) => {
    const { DataCategory } = oldImage
    if (DataCategory.startsWith('CONNECTION#')) {
        const ConnectionId = splitType(DataCategory)[1]
        await updateEphemera({
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
