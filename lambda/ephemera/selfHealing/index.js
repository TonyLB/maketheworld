import { GetItemCommand, ScanCommand, PutItemCommand, UpdateItemCommand } from '@aws-sdk/client-dynamodb'
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb'

import { splitType } from '../utilities/index.js'

const { TABLE_PREFIX } = process.env;
const ephemeraTable = `${TABLE_PREFIX}_ephemera`
const assetsTable = `${TABLE_PREFIX}_assets`

export const healGlobalConnections = async (dbClient) => {
    try {
        const { Items = [] } = await dbClient.send(new ScanCommand({
            TableName: ephemeraTable,
            FilterExpression: "begins_with(EphemeraId, :player) AND begins_with(DataCategory, :connection)",
            ExpressionAttributeValues: marshall({
                ':player': 'PLAYER#',
                ':connection': 'CONNECTION#'
            }),
            ProjectionExpression: 'EphemeraId, DataCategory'
        }))
    
        const connectionMap = Items
            .map(unmarshall)
            .map(({ EphemeraId, DataCategory }) => ({ Player: splitType(EphemeraId)[1], Connection: splitType(DataCategory)[1]}))
            .reduce((previous, { Player, Connection }) => ({ ...previous, [Connection]: Player }), {})
    
        await dbClient.send(new PutItemCommand({
            TableName: ephemeraTable,
            Item: marshall({
                EphemeraId: 'Global',
                DataCategory: 'Connections',
                connections: connectionMap
            })
        }))
        return connectionMap
    }
    catch(error) {}
    return {}
    
}

export const healCharacter = async (dbClient, CharacterId) => {
    try {
        const { Item } = await dbClient.send(new GetItemCommand({
            TableName: assetsTable,
            Key: marshall({
                AssetId: `CHARACTER#${CharacterId}`,
                DataCategory: 'Meta::Character'
            }),
            ProjectionExpression: 'EphemeraId, #Name, HomeId',
            ExpressionAttributeNames: {
                '#Name': 'Name'
            }
        }))

        if (Item) {
            const { Name, HomeId } = unmarshall(Item)
            await dbClient.send(new UpdateItemCommand({
                TableName: ephemeraTable,
                Key: marshall({
                    EphemeraId: `CHARACTERINPLAY#${CharacterId}`,
                    DataCategory: 'Connection'
                }),
                UpdateExpression: `SET #Name = :name, RoomId = if_not_exists(RoomId, :homeId), Connected = if_not_exists(Connected, :false)`,
                ExpressionAttributeNames: {
                    '#Name': 'Name'
                },
                ExpressionAttributeValues: marshall({
                    ':name': Name,
                    ':homeId': HomeId || 'VORTEX',
                    ':false': false
                })
            }))
        }
    }
    catch(error) {
        //
        // TODO: Handle absence of character from Assets table
        //
    }
    return {}

}
