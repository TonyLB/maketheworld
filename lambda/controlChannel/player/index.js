const { marshall, unmarshall } = require('@aws-sdk/util-dynamodb')
const { UpdateItemCommand, GetItemCommand, QueryCommand } = require('@aws-sdk/client-dynamodb')

const { TABLE_PREFIX } = process.env;
const ephemeraTable = `${TABLE_PREFIX}_ephemera`
const permanentsTable = `${TABLE_PREFIX}_permanents`

const splitType = (value) => {
    const sections = value.split('#')
    if (sections.length) {
        return [sections[0], sections.slice(1).join('#')]
    }
    else {
        return ['', '']
    }
}

const getPlayerByConnectionId = async (dbClient, connectionId) => {
    const { Items = [] } = await dbClient.send(new QueryCommand({
        TableName: ephemeraTable,
        IndexName: 'DataCategoryIndex',
        KeyConditionExpression: 'DataCategory = :dc',
        ExpressionAttributeValues: marshall({
            ":dc": `CONNECTION#${connectionId}`
        }),
        ProjectionExpression: 'EphemeraId'
    }))
    const playerName = Items
        .map(unmarshall)
        .reduce((previous, { EphemeraId }) => {
            const [ itemType, itemKey ] = splitType(EphemeraId)
            if (itemType === 'PLAYER') {
                return itemKey
            }
            return previous
        }, '')
    return playerName
}

//
// Returns all of the meta data about Player in the Ephemera table, as
// well as a connections array of the currently active lifeLine connections
//
const getConnectionsByPlayerName = async (dbClient, PlayerName) => {
    const { Items = [] } = await dbClient.send(new QueryCommand({
        TableName: ephemeraTable,
        KeyConditionExpression: 'EphemeraId = :eid',
        ExpressionAttributeValues: marshall({
            ":eid": `PLAYER#${PlayerName}`
        }),
    }))
    const returnVal = Items
        .map(unmarshall)
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
// TODO: Remove direct access to Characters list and instead make secured outlets for
// adding characters and archiving them.
//
const putPlayer = (dbClient, PlayerName) => async ({ Characters, CodeOfConductConsent }) => {
    if (!PlayerName || (Characters === undefined && CodeOfConductConsent === undefined)) {
        return {
            statusCode: 403,
            body: JSON.stringify({
                messageType: 'Error'
            })
        }
    }

    const characterUpdate = Characters !== undefined
        ? `Characters = :characters`
        : ''
    const conductUpdate = CodeOfConductConsent !== undefined
        ? `CodeOfConductConsent = :conduct`
        : ''
    const UpdateExpression = `SET ${[characterUpdate, conductUpdate].filter((value) => (value)).join(', ')}`
    const ExpressionAttributeValues = marshall({
        ...(Characters !== undefined ? { ":characters": Characters } : {}),
        ...(CodeOfConductConsent !== undefined ? { ":conduct": CodeOfConductConsent }: {})
    })

    const { Attributes } = await dbClient.send(new UpdateItemCommand({
        TableName: permanentsTable,
        Key: marshall({
            PermanentId: `PLAYER#${PlayerName}`,
            DataCategory: 'Details'
        }),
        UpdateExpression,
        ExpressionAttributeValues,
        ReturnValues: 'ALL_NEW'
    }))
    //
    // TODO: Supplement direct return to the calling connection with an update to
    // the connection the player is connected with (if any).  This will allow Admin
    // changes to player status to be immediately reflected.  Will require tracking
    // the connection of a player on $connect and $disconnect
    //
    return {
        statusCode: 200,
        body: JSON.stringify({
            messageType: 'Player',
            PlayerName,
            Characters: Attributes.Characters || [],
            CodeOfConductConsent: Attributes.CodeOfConductConsent ?? false
        })
    }
}

const whoAmI = async (dbClient, connectionId, RequestId) => {
    const username = await getPlayerByConnectionId(dbClient, connectionId)
    if (username) {
        const { Item } = await dbClient.send(new GetItemCommand({
            TableName: permanentsTable,
            Key: marshall({
                PermanentId: `PLAYER#${username}`,
                DataCategory: 'Details'
            })
        }))
        const { Characters, CodeOfConductConsent } = unmarshall(Item)
        return {
            statusCode: 200,
            body: JSON.stringify({
                messageType: 'Player',
                PlayerName: username,
                Characters,
                CodeOfConductConsent,
                RequestId
            })
        }
    }
    else {
        return {
            statusCode: 200,
            body: JSON.stringify({
                messageType: 'Error'
            })
        }
    }
}

exports.putPlayer = putPlayer
exports.whoAmI = whoAmI
exports.getConnectionsByPlayerName = getConnectionsByPlayerName
