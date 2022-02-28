import { splitType } from "/opt/utilities/types.js"
import { assetDB, ephemeraDB } from "/opt/utilities/dynamoDB/index.js"

export const handleCharacterEvents = async ({ events }) => {
    await Promise.all(
        events.map(async ({ eventName, oldImage, newImage }) => {
            const mappedValue = (key) => {
                if (newImage[key]) {
                    if (!oldImage || (newImage[key] !== oldImage[key])) {
                        return { value: newImage[key] }
                    }
                }
                else {
                    if (oldImage[key]) {
                        return 'remove'
                    }
                }
                return 'ignore'
            }
            const remap = ['Name', 'Pronouns', 'fileName']
                .reduce((previous, key) => ({ ...previous, [key]: mappedValue(key) }), {})
            const flagName = (key) => (key === 'Name' ? '#Name' : key)
            const setItems = Object.entries(remap)
                .filter(([key, value]) => (value instanceof Object))
                .map(([key]) => (`${flagName(key)} = :${key}`))
            const expressionValues = Object.entries(remap)
                .filter(([key, value]) => (value instanceof Object))
                .reduce((previous, [key, value]) => ({
                    ...previous,
                    [`:${key}`]: value.value
                }), {})
            const removeItems = Object.entries(remap)
                .filter(([key, value]) => (value === 'remove'))
                .map(([key]) => (flagName(key)))
            const UpdateExpression = [
                ...(setItems.length ? [`SET ${setItems.join(', ')}`] : []),
                ...(removeItems.length ? [`REMOVE ${removeItems.join(', ')}`] : [])
            ].join(' ')
            if (UpdateExpression) {
                const CharacterId = splitType(newImage.AssetId)[1]
                await Promise.all([
                    ephemeraDB.update({
                        EphemeraId: `CHARACTERINPLAY#${CharacterId}`,
                        DataCategory: 'Meta::Character',
                        UpdateExpression,
                        ...(Object.keys(expressionValues).length ? { ExpressionAttributeValues: expressionValues }: {}),
                        ...(remap['Name'] !== 'ignore' ? { ExpressionAttributeNames: { '#Name': 'Name' }} : {})
                    }),
                    ...(newImage.player
                        ? [assetDB.update({
                            AssetId: `PLAYER#${newImage.player}`,
                            DataCategory: 'Meta::Player',
                            UpdateExpression: 'SET Characters.#characterId = :character',
                            ExpressionAttributeNames: {
                                '#characterId': CharacterId
                            },
                            ExpressionAttributeValues: {
                                ':character': {
                                    Name: newImage.Name,
                                    scopedId: newImage.scopedId,
                                    fileName: newImage.fileName
                                }
                            }
                        })]
                        : []
                    )
                ])
            }
        })
    )
}
