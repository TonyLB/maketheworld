const { documentClient } = require('../utilities')
const { getCharacterInfo } = require('./getCharacterInfo')


const { TABLE_PREFIX } = process.env;
const permanentTable = `${TABLE_PREFIX}_permanents`

exports.getPlayerCharacters = (event) => {

    const { PlayerName } = event

    return PlayerName
        ? (documentClient.get({
                TableName: permanentTable,
                Key: {
                    PermanentId: `PLAYER#${PlayerName}`,
                    DataCategory: 'Details'
                }
            }).promise())
            .then(({ Item = {} }) => (Item.Characters || []) )
            .then((Items) => (Promise.all(Items.map((CharacterId) => (getCharacterInfo({ documentClient, CharacterId }))))))
            .then((Items) => (Items.map((Item) => ({
                PlayerName,
                ...Item
            }))))
            .then((Items) => (Items.map((Item) => ({ ...Item }))))
            .catch((err) => ({ error: err.stack }))
        : Promise.resolve({ error: "No PlayerName specified"})

}
