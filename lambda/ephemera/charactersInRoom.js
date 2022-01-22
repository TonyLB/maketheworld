import { marshall, unmarshall } from '@aws-sdk/util-dynamodb'
import { DynamoDBClient, UpdateItemCommand, GetItemCommand } from '@aws-sdk/client-dynamodb'

const REGION = process.env.AWS_REGION
const dbClient = new DynamoDBClient({ region: REGION })

const { TABLE_PREFIX } = process.env;
const ephemeraTable = `${TABLE_PREFIX}_ephemera`

export const addCharacterToRoom = async ({ CharacterId, Name: incomingName, RoomId, Connected, ConnectionId }) => {
    const EphemeraId = `CHARACTERINPLAY#${CharacterId}`
    let Name = incomingName
    if (!Name) {
        const { Item } = await dbClient.send(new GetItemCommand({
            TableName: ephemeraTable,
            Key: marshall({
                EphemeraId,
                DataCategory: 'Connection'
            }),
            ProjectionExpression: '#name',
            ExpressionAttributeNames: { '#name': 'Name' }
        }))
        Name = unmarshall(Item).Name
    }
    if (Connected) {
        await dbClient.send(new UpdateItemCommand({
            TableName: ephemeraTable,
            Key: marshall({
                EphemeraId: `ROOM#${RoomId}`,
                DataCategory: 'Meta::Room'
            }),
            UpdateExpression: "SET activeCharacters.#characterId = :character REMOVE inactiveCharacters.#characterId",
            ExpressionAttributeNames: { "#characterId": EphemeraId },
            ExpressionAttributeValues: marshall({
                ":character": {
                    EphemeraId,
                    Name,
                    ConnectionId
                }
            }, { removeUndefinedValues: true })
        }))
    }
    else {
        await dbClient.send(new UpdateItemCommand({
            TableName: ephemeraTable,
            Key: marshall({
                EphemeraId: `ROOM#${RoomId}`,
                DataCategory: 'Meta::Room'
            }),
            UpdateExpression: "SET inactiveCharacters.#characterId = :character REMOVE activeCharacters.#characterId",
            ExpressionAttributeNames: { "#characterId": EphemeraId },
            ExpressionAttributeValues: marshall({
                ":character": {
                    EphemeraId,
                    Name
                }
            }, { removeUndefinedValues: true })
        }))
    }
}

export const removeCharacterFromRoom = async ({ CharacterId, RoomId }) => {
    await dbClient.send(new UpdateItemCommand({
        TableName: ephemeraTable,
        Key: marshall({
            EphemeraId: `ROOM#${RoomId}`,
            DataCategory: 'Meta::Room'
        }),
        UpdateExpression: "REMOVE inactiveCharacters.#characterId, activeCharacters.#characterId",
        ExpressionAttributeNames: { "#characterId": `CHARACTERINPLAY#${CharacterId}` }
    }))
}
