const { v4: uuidv4 } = require('/opt/uuid')
const { documentClient, graphqlClient, gql } = require('../utilities')
const { gqlOutput } = require('../gqlOutput')
const { getCharacterInfo } = require('./getCharacterInfo')

const { TABLE_PREFIX } = process.env;
const permanentTable = `${TABLE_PREFIX}_permanents`

const batchDispatcher = (items) => {
    const groupBatches = items.reduce((({ current, requestLists }, item) => {
            if (current.length > 23) {
                return {
                    requestLists: [ ...requestLists, current ],
                    current: [item]
                }
            }
            else {
                return {
                    requestLists,
                    current: [...current, item]
                }
            }
        }), { current: [], requestLists: []})
    const batchPromises = [...groupBatches.requestLists, groupBatches.current]
        .map((itemList) => (documentClient.batchWrite({ RequestItems: {
            [permanentTable]: itemList
        } }).promise()))
    return Promise.all(batchPromises)
}

exports.putCharacter = ({
    CharacterId: passedCharacterId,
    Name,
    Pronouns,
    FirstImpression,
    OneCoolThing,
    Outfit,
    HomeId
}) => {

    const CharacterId = passedCharacterId || uuidv4()

    return documentClient.put({
            TableName: permanentTable,
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
        }).promise()
        .then(() => ([{
            Character: {
                CharacterId,
                Name,
                Pronouns,
                FirstImpression,
                OneCoolThing,
                Outfit,
                HomeId
            }
        }]))
        .catch((err) => ({ error: err.stack }))

}