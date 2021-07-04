// Copyright 2020 Tony Lower-Basch. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

const { marshall, unmarshall } = require('@aws-sdk/util-dynamodb')
const { DynamoDBClient, GetItemCommand, UpdateItemCommand } = require('@aws-sdk/client-dynamodb')

const REGION = process.env.AWS_REGION
const dbClient = new DynamoDBClient({ region: REGION })

const { TABLE_PREFIX } = process.env;
const ephemeraTable = `${TABLE_PREFIX}_ephemera`
const permanentsTable = `${TABLE_PREFIX}_permanents`

const denormalizeFactory = ({
    label,
    ephemeraPrefix,
    permanentPrefix,
    dataCategory,
    requiredFields = [],
    optionalFields = [],
    extraReturnFields = [],
    reservedMapping = {}
} ) => async ({ [`${label}Id`]: ItemId, data }) => {

    if (!ItemId) {
        return {}
    }
    const EphemeraId = `${ephemeraPrefix}#${ItemId}`
    const PermanentId = `${permanentPrefix}#${ItemId}`

    const allFields = [...requiredFields, ...optionalFields]

    let newRecord = {}

    const remapAttributes = allFields.reduce(
            (previousAttributes, fieldName) =>
        {
            const remapAttribute = reservedMapping[fieldName]
            if (remapAttribute) {
                return {
                    ...previousAttributes,
                    [fieldName]: remapAttribute
                }
            }
            else {
                return previousAttributes
            }
        }, {})
    let fromPermanent = {}
    const expressionAttributeNamesGenerator = (filterFunc) => (
        Object.values(remapAttributes).length
            ? Object.entries(remapAttributes).filter(filterFunc).reduce((previous, [key, value]) => ({...previous, [value]: key }), {})
            : undefined
    )
    if (data) {
        fromPermanent = data
    }
    else {
        const allExpressionAttributeNames = expressionAttributeNamesGenerator(() => (true))
        const { Item } = await dbClient.send(new GetItemCommand({
            TableName: permanentsTable,
            Key: marshall({
                PermanentId,
                DataCategory: 'Details'
            }),
            ProjectionExpression: allFields.map((key) => remapAttributes[key] ?? key).join(', '),
            ...(Object.values(allExpressionAttributeNames).length ? { ExpressionAttributeNames: allExpressionAttributeNames } : {})
        }))
        fromPermanent = unmarshall(Item)
    }
    const ExpressionAttributeNames = expressionAttributeNamesGenerator(([key]) => fromPermanent[key])

    const newExpressionAttributes = Object.assign({}, ...(allFields.filter((key) => (fromPermanent[key] !== undefined)).map((key) => ({ [`:${key}`]: fromPermanent[key] }))))
    if (Object.keys(newExpressionAttributes).length) {
        const newUpdateExpression = allFields.filter((key) => (fromPermanent[key] !== undefined)).map((key) => (`${remapAttributes[key] ?? key} = :${key}`)).join(', ')
        const { Attributes: newAttributes } = await dbClient.send(new UpdateItemCommand({
            TableName: ephemeraTable,
            Key: marshall({
                EphemeraId,
                DataCategory: dataCategory
            }),
            UpdateExpression: `SET ${newUpdateExpression}`,
            ExpressionAttributeValues: marshall(newExpressionAttributes),
            ...(Object.values(ExpressionAttributeNames).length ? { ExpressionAttributeNames } : {}),
            ReturnValues: 'ALL_NEW'
        }))
        newRecord = unmarshall(newAttributes)    
    }

    const remap = Object.assign({}, ...([...allFields, ...extraReturnFields].map((key) => ({ [key]: newRecord[key] }))))
    return {
        [`${label}Id`]: ItemId,
        ...remap
    }
}

const denormalizeCharacter = denormalizeFactory({
    label: 'Character',
    ephemeraPrefix: 'CHARACTERINPLAY',
    permanentPrefix: 'CHARACTER',
    dataCategory: 'Connection',
    requiredFields: ['Name'],
    optionalFields: ['FirstImpression', 'Pronouns', 'Outfit', 'OneCoolThing'],
    extraReturnFields: ['Connected'],
    reservedMapping: { Name: '#name' }
})

exports.denormalizeCharacter = denormalizeCharacter
