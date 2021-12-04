const { marshall, unmarshall } = require('@aws-sdk/util-dynamodb')
const { UpdateItemCommand, Update, GetItemCommand } = require('@aws-sdk/client-dynamodb')

const { TABLE_PREFIX } = process.env;
const permanentsTable = `${TABLE_PREFIX}_permanents`

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

const whoAmI = async (dbClient, username, RequestId) => {
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

exports.putPlayer = putPlayer
exports.whoAmI = whoAmI
