const { documentClient, graphqlClient, gql } = require('../utilities')
const { getCharacterInfo } = require('./getCharacterInfo')

const { TABLE_PREFIX, AWS_REGION } = process.env;
const permanentTable = `${TABLE_PREFIX}_permanents`

exports.getCharacter = (event) => {


    const { CharacterId } = event

    return CharacterId
        ? (getCharacterInfo({ CharacterId }))
            .then(({ Name, Pronouns, FirstImpression, OneCoolThing, Outfit, HomeId, Grants }) => ({
                CharacterId, Name, Pronouns, FirstImpression, OneCoolThing, Outfit, HomeId, Grants
            }))
            .then(({ CharacterId, ...rest }) => (documentClient.query({
                    TableName: permanentTable,
                    KeyConditionExpression: 'DataCategory = :CharacterId',
                    ExpressionAttributeValues: {
                        ":CharacterId": `CHARACTER#${CharacterId}`
                    },
                    IndexName: "DataCategoryIndex",
                    Limit: 1
                }).promise()
                .then(({ Items }) => (Items))
                .then((Items) => (Items[0] || {}))
                .then(({ PermanentId = '' }) => (PermanentId.split('#').slice(1).join('#')))
                .then((PlayerName) => ({ ...( PlayerName ? { PlayerName } : {} ), CharacterId, ...rest }))
            ))
            .catch((err) => ({ error: err.stack }))
        : Promise.resolve({ error: "No CharacterId specified"})

}