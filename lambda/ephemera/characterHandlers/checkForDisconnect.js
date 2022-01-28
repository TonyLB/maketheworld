import { marshall } from '@aws-sdk/util-dynamodb'
import { PutItemCommand } from '@aws-sdk/client-dynamodb'
import { v4 as uuidv4 } from 'uuid'
import { splitType } from '../utilities/index.js'
import publishRoomUpdate from './publishRoomUpdate.js'
import characterEphemeraDenormalize from './characterEphemeraDenormalize.js'

const { TABLE_PREFIX } = process.env;
const messageTable = `${TABLE_PREFIX}_messages`

export const checkForDisconnect = async (dbClient, { oldImage, newImage }) => {
    const epochTime = Date.now()
    if (!newImage.EphemeraId || ((!newImage.Connected) && oldImage.Connected)) {
        const disconnectMessage = async () => {
            const { Name, RoomId, EphemeraId = '' } = oldImage
            const CharacterId = splitType(EphemeraId)[1]
            await dbClient.send(new PutItemCommand({
                TableName: messageTable,
                Item: marshall({
                    MessageId: `MESSAGE#${uuidv4()}`,
                    DataCategory: 'Meta::Message',
                    CreatedTime: Date.now(),
                    Targets: [`ROOM#${RoomId}`, `NOT-CHARACTER#${CharacterId}`],
                    DisplayProtocol: "WorldMessage",
                    Message: `${Name || 'Someone'} has disconnected.`
                })
            }))
        }
        const updateRoomEphemera = async () => {
            const { RoomId, EphemeraId, Name, Color, ConnectionId } = newImage
            const CharacterId = splitType(EphemeraId)[1]
            if (RoomId) {
                try {
                    await characterEphemeraDenormalize({
                        dbClient,
                        RoomId,
                        EphemeraId,
                        Name,
                        Color,
                        ConnectionId,
                        isActive: false,
                        isInactive: true,
                        returnValues: true
                    }).then(publishRoomUpdate({
                        dbClient,
                        notCharacterId: CharacterId,
                        epochTime: epochTime + 2,
                        RoomId
                    }))
                }
                catch(event) {
                    console.log(`ERROR: Disconnect updateRoom`)
                }
            }
            else {
                if (oldImage.RoomId) {
                    const { RoomId } = oldImage
                    const CharacterId = splitType(oldImage.EphemeraId)[1]
                    try {
                        await characterEphemeraDenormalize({
                            dbClient,
                            RoomId,
                            EphemeraId,
                            isActive: false,
                            isInactive: false,
                            returnValues: true
                        }).then(publishRoomUpdate({
                            dbClient,
                            notCharacterId: CharacterId,
                            epochTime: epochTime + 2,
                            RoomId
                        }))
                    }
                    catch(event) {
                        console.log(`ERROR: DisconnectEphemera (Delete)`)
                    }
                }
            }
        }
        //
        // Disconnect messages and update Room
        //
        await Promise.all([
            disconnectMessage(),
            updateRoomEphemera()
        ])
    }
    return {}
}
