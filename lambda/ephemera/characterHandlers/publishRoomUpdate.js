import { marshall, unmarshall } from '@aws-sdk/util-dynamodb'
import { PutItemCommand } from '@aws-sdk/client-dynamodb'
import { v4 as uuidv4 } from 'uuid'

import { splitType } from '../utilities/index.js'

const { TABLE_PREFIX } = process.env;
const messageTable = `${TABLE_PREFIX}_messages`

export const publishRoomUpdate = ({ dbClient, RoomId, notCharacterId, epochTime }) => ({ Attributes }) => {
    const { activeCharacters = {} } = unmarshall(Attributes)
    return dbClient.send(new PutItemCommand({
        TableName: messageTable,
        Item: marshall({
            MessageId: `MESSAGE#${uuidv4()}`,
            CreatedTime: epochTime,
            Targets: [`ROOM#${RoomId}`, `NOT-CHARACTER#${notCharacterId}`],
            RoomId,
            DataCategory: 'Meta::Message',
            DisplayProtocol: 'RoomUpdate',
            Characters: Object.values(activeCharacters).map(({ EphemeraId, ...rest }) => ({
                CharacterId: splitType(EphemeraId)[1],
                ...rest
            }))
        })
    }))
}

export default publishRoomUpdate
