import { splitType } from "../utilities/types.js"
import { updateEphemera } from "../utilities/dynamoDB/index.js"

export const handleCharacterEvent = async ({ dbClient, eventName, oldImage, newImage }) => {
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
    const remap = ['Name', 'Pronouns', 'FirstImpression', 'Outfit', 'OneCoolThing', 'fileName']
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
        //
        // TODO: Add a parallel operation to update the Characters field on the relevant player
        // for the incoming character
        //
        const CharacterId = splitType(newImage.AssetId)[1]
        await updateEphemera({
            dbClient,
            EphemeraId: `CHARACTERINPLAY#${CharacterId}`,
            DataCategory: 'Connection',
            UpdateExpression,
            ...(expressionValues ? { ExpressionAttributeValues: expressionValues }: {}),
            ...(remap['Name'] !== 'ignore' ? { ExpressionAttributeNames: { '#Name': 'Name' }} : {})
        })
    }
}
