import { splitType } from '/opt/utilities/types.js'

import { ephemeraDB, assetDB } from "/opt/utilities/dynamoDB/index.js"
import { SocketQueue } from "/opt/utilities/apiManagement/index.js"

const getConnectionsByPlayerName = async (PlayerName) => {
    const Items = await ephemeraDB.query({
        EphemeraId: `PLAYER#${PlayerName}`
    })
    
    const returnVal = Items
        .reduce((previous, { DataCategory }) => {
            const [ itemType, itemKey ] = splitType(DataCategory)
            if (itemType === 'CONNECTION') {
                return [...previous, itemKey]
            }
            return previous
        }, [])
    return returnVal
}

//
// uploadResponse forwards a processing response from an Upload to the players that have
// subscribed to know when it finishes processing.
//
export const uploadResponse = async ({ uploadId, ...rest }) => {
    const Items = await assetDB.query({
        AssetId: `UPLOAD#${uploadId}`,
        ProjectionFields: ['DataCategory', 'RequestId']
    })
    const playerNames = Items
        .map(({ DataCategory, RequestId }) => ({ PlayerName: splitType(DataCategory)[1], RequestId }))
    await Promise.all(playerNames
        .map(async ({ PlayerName, RequestId }) => {
            const connections = await getConnectionsByPlayerName(PlayerName)
            await Promise.all((connections || [])
                .map(async (ConnectionId) => {
                    const socketQueue = new SocketQueue()
                    socketQueue.send({
                        ConnectionId, 
                        Message: {
                            ...rest,
                            RequestId
                        }
                    })
                    await socketQueue.flush()
                    await assetDB.deleteItem({
                        AssetId: `UPLOAD#${uploadId}`,
                        DataCategory: `PLAYER#${PlayerName}`
                    })
                })
            )
        }))
}

export default uploadResponse