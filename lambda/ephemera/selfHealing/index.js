const { QueryCommand, ScanCommand, PutItemCommand } = require('@aws-sdk/client-dynamodb');
const { marshall, unmarshall } = require('@aws-sdk/util-dynamodb');

const { splitType } = require('../utilities')

const { TABLE_PREFIX } = process.env;
const ephemeraTable = `${TABLE_PREFIX}_ephemera`

const healGlobalConnections = async (dbClient) => {
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

exports.healGlobalConnections = healGlobalConnections
