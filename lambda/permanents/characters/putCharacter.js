const { v4: uuidv4 } = require('/opt/uuid')
const { documentClient, graphqlClient, gql } = require('./utilities')
const { gqlOutput } = require('./gqlOutput')
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


const characterGQL = ({
    Name,
    CharacterId,
    Pronouns,
    FirstImpression,
    Outfit,
    OneCoolThing,
    HomeId
}) => (gql`mutation ReportCharacter {
    externalPutCharacter (Name: "${Name}", CharacterId: "${CharacterId}", Pronouns: "${Pronouns}", FirstImpression: "${FirstImpression}", Outfit: "${Outfit}", OneCoolThing: "${OneCoolThing}", HomeId: "${HomeId}") {
        ${gqlOutput}
    }
}`)

const characterGQLReport = async ({
    Name,
    CharacterId,
    Pronouns,
    FirstImpression,
    Outfit,
    OneCoolThing,
    HomeId
}) => {
    if (CharacterId) {
        await graphqlClient.mutate({ mutation: characterGQL({
            Name,
            CharacterId,
            Pronouns,
            FirstImpression,
            Outfit,
            OneCoolThing,
            HomeId
        }) })
    }
}

exports.putCharacter = ({
    CharacterId: passedCharacterId,
    PlayerName,
    Name,
    Pronouns,
    FirstImpression,
    OneCoolThing,
    Outfit,
    HomeId
}) => {

    const newCharacter = !Boolean(passedCharacterId)
    const CharacterId = passedCharacterId || uuidv4()

    return batchDispatcher([{
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
        },
        {
            PutRequest: {
                Item: {
                    PermanentId: `PLAYER#${PlayerName}`,
                    DataCategory: `CHARACTER#${CharacterId}`
                }
            }
        },
        ...((newCharacter && [{
            PutRequest: {
                Item: {
                    PermanentId: `CHARACTER#${CharacterId}`,
                    DataCategory: 'GRANT#MINIMUM',
                    Roles: 'PLAYER'
                }
            }
        }]) || [])
        ])
        .then(characterGQLReport({
            Name,
            CharacterId,
            Pronouns,
            FirstImpression,
            Outfit,
            OneCoolThing,
            HomeId
        }))
        .then(() => (getCharacterInfo({ CharacterId })))
        .then(({ Grants }) => ({
            Type: "CHARACTER",
            PlayerName,
            CharacterInfo: {
                CharacterId,
                PlayerName,
                Name,
                Pronouns,
                FirstImpression,
                OneCoolThing,
                Outfit,
                HomeId,
                Grants
            }
        }))
        .catch((err) => ({ error: err.stack }))

}