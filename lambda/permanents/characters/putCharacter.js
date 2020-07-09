const { v4: uuidv4 } = require('/opt/uuid')
const { documentClient, } = require('../utilities')

const { permanentAndDeltas } = require('../delta')

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

    return permanentAndDeltas({
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
        .then((writes) => (documentClient.batchWrite({ RequestItems: writes }).promise()))
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