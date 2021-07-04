// Copyright 2020 Tony Lower-Basch. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

const { marshall, unmarshall } = require('@aws-sdk/util-dynamodb')
const { DynamoDBClient, GetItemCommand, UpdateItemCommand } = require('@aws-sdk/client-dynamodb')

const REGION = process.env.AWS_REGION
const dbClient = new DynamoDBClient({ region: REGION })

const { TABLE_PREFIX } = process.env;
const ephemeraTable = `${TABLE_PREFIX}_ephemera`
const permanentsTable = `${TABLE_PREFIX}_permanents`

const denormalizeCharacter = async ({ CharacterId, data }) => {

    if (!CharacterId) {
        return []
    }
    const EphemeraId = `CHARACTERINPLAY#${CharacterId}`
    const PermanentId = `CHARACTER#${CharacterId}`

    const requiredFields = ['Name']
    const optionalFields = ['FirstImpression', 'Pronouns', 'Outfit', 'OneCoolThing']
    const allFields = [...requiredFields, ...optionalFields]

    let newRecord = {}

    let fromCharacterPermanent = {}
    if (data) {
        fromCharacterPermanent = data
    }
    else {
        const { Item } = await dbClient.send(new GetItemCommand({
            TableName: permanentsTable,
            Key: marshall({
                PermanentId,
                DataCategory: 'Details'
            }),
            ProjectionExpression: allFields.map((key) => (key === 'Name' ? '#name' : key)).join(', '),
            ExpressionAttributeNames: { '#name': 'Name' }
        }))
        fromCharacterPermanent = unmarshall(Item)    
    }
    const newExpressionAttributes = Object.assign({}, ...(allFields.filter((key) => fromCharacterPermanent[key]).map((key) => ({ [`:${key}`]: fromCharacterPermanent[key] }))))
    if (Object.keys(newExpressionAttributes).length) {
        const newUpdateExpression = allFields.filter((key) => fromCharacterPermanent[key]).map((key) => (`${key === 'Name' ? '#name' : key} = :${key}`)).join(', ')
        const { Attributes: newAttributes } = await dbClient.send(new UpdateItemCommand({
            TableName: ephemeraTable,
            Key: marshall({
                EphemeraId,
                DataCategory: 'Connection'
            }),
            UpdateExpression: `SET ${newUpdateExpression}`,
            ExpressionAttributeValues: marshall(newExpressionAttributes),
            ExpressionAttributeNames: { '#name': 'Name' },
            ReturnValues: 'ALL_NEW'
        }))
        newRecord = unmarshall(newAttributes)    
    }

    const remap = Object.assign({}, ...([...allFields, 'Connected'].map((key) => ({ [key]: newRecord[key] }))))
    return {
        CharacterId,
        ...remap
    }
}

exports.denormalizeCharacter = denormalizeCharacter
