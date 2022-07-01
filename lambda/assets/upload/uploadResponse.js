import { splitType } from '@tonylb/mtw-utilities/dist/types'

import { ephemeraDB, assetDB } from "@tonylb/mtw-utilities/dist/dynamoDB/index"
import { SocketQueue } from "@tonylb/mtw-utilities/dist/apiManagement/index"

export const getConnectionsByPlayerName = async (PlayerName) => {
    const Items = await ephemeraDB.query({
        IndexName: 'DataCategoryIndex',
        DataCategory: 'Meta::Connection',
        FilterExpression: 'player = :player',
        ExpressionAttributeValues: {
            ':player': PlayerName
        },
    })
    const returnVal = Items
        .reduce((previous, { EphemeraId }) => {
            const [ itemType, itemKey ] = splitType(EphemeraId)
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
            await Promise.all([
                ...(connections || [])
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
                    }),
                assetDB.deleteItem({
                    AssetId: `UPLOAD#${uploadId}`,
                    DataCategory: `PLAYER#${PlayerName}`
                })
            ])
        }))
}

export default uploadResponse