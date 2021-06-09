const { v4: uuidv4 } = require('/opt/uuid')
const { documentClient, } = require('../utilities')

const { permanentAndDeltas } = require('../delta')

const { TABLE_PREFIX } = process.env;
const ephemeraTable = `${TABLE_PREFIX}_ephemera`

exports.putCharacter = async ({
    CharacterId: passedCharacterId,
    Name,
    Pronouns,
    FirstImpression,
    OneCoolThing,
    Outfit,
    HomeId
}) => {

    const CharacterId = passedCharacterId || uuidv4()

    try {
        const writes = await permanentAndDeltas({
            PutRequest: {
                Item: {
                    PermanentId: `CHARACTER#${CharacterId}`,
                    DataCategory: 'Details',
                    Name,
                    Pronouns,
                    FirstImpression,
                    OneCoolThing,
                    Outfit,
                    HomeId
                }
            }
        })

        await Promise.all([
            documentClient.batchWrite({ RequestItems: writes }).promise(),
            documentClient.update({
                TableName: ephemeraTable,
                Key: {
                    EphemeraId: `CHARACTERINPLAY#${CharacterId}`,
                    DataCategory: 'Connection',
                },
                UpdateExpression: 'SET #name = :name, Pronouns = :pronouns, FirstImpression = :firstImpression, OneCoolThing = :oneCoolThing, Outfit = :outfit',
                ExpressionAttributeValues: {
                    ':pronouns': Pronouns,
                    ':firstImpression': FirstImpression,
                    ':oneCoolThing': OneCoolThing,
                    ':outfit': Outfit,
                    ':name': Name,
                    ':id': `CHARACTERINPLAY#${CharacterId}`
                },
                ExpressionAttributeNames: {
                    '#name': 'Name'
                },
                ConditionExpression: 'EphemeraId = :id'
            }).promise()
        ])
        return [{
            Character: {
                CharacterId,
                Name,
                Pronouns,
                FirstImpression,
                OneCoolThing,
                Outfit,
                HomeId
            }
        }]

    }
    catch (err) {
        return { error: err.stack }
    }

}