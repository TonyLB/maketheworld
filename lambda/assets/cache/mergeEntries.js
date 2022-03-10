import {
    mergeIntoDataRange
} from '/opt/utilities/dynamoDB/index.js'
import { splitType, AssetKey } from '/opt/utilities/types.js'

//
// At current levels of functionality, it is sufficient to do a deep-equality
// check.
//
const compareEntries = (current, incoming) => {
    return JSON.stringify(current) === JSON.stringify(incoming)
}

const mapContextStackToConditions = (normalForm) => ({ contextStack, ...rest }) => ({
    conditions: contextStack.reduce((previous, { key, tag }) => {
        if (tag !== 'Condition') {
            return previous
        }
        const { if: condition = '', dependencies = [] } = normalForm[key]
        return [
            ...previous,
            {
                if: condition,
                dependencies
            }
        ]
    }, []),
    ...rest
})

const mapContents = (normalForm) => ({ contents = [], ...rest }) => ({
    ...rest,
    ...(contents.reduce((previous, { tag, key }) => {
        if (tag === 'Exit') {
            return {
                ...previous,
                exits: [
                    ...(previous.exits || []),
                    {
                        to: normalForm[key].toEphemeraId,
                        name: normalForm[key].name
                    }
                ]
            }
        }
        if (tag === 'Feature') {
            return {
                ...previous,
                features: [
                    ...(previous.features || []),
                    {
                        EphemeraId: normalForm[key].EphemeraId,
                        name: normalForm[key].name
                    }
                ]
            }
        }
        return previous
    }, {}))
})

const mapRoomLocations = (normalForm) => ({ rooms, contents, ...rest }) => {
    const fileURL = contents
        .filter(({ tag }) => (tag === 'Image'))
        .reduce((previous, { key }) => (normalForm[key]?.fileURL || previous), undefined)
    return {
        ...rest,
        fileURL,
        contents: contents.filter(({ tag }) => (tag !== 'Image')),
        rooms: (Object.entries(rooms).reduce((previous, [roomId, location]) => {
            const { EphemeraId } = normalForm[roomId]
            return {
                ...previous,
                [roomId]: {
                    ...location,
                    EphemeraId
                }
            }
        }, {}))
    }
}

export const mergeEntries = async (assetId, normalForm) => {
    const mergeEntries = Object.values(normalForm)
        .filter(({ tag }) => (['Room', 'Feature', 'Map'].includes(tag)))
        .map(({ appearances = [], ...rest }) => ({
            ...rest,
            appearances: appearances
                .map(mapContextStackToConditions(normalForm))
                .map((item) => (['Room'].includes(rest.tag) ? mapContents(normalForm)(item) : item))
                .map((item) => (['Map'].includes(rest.tag) ? mapRoomLocations(normalForm)(item) : item))
                .map(({ conditions, name, render, exits, features, rooms, fileURL }) => ({
                    conditions,
                    name,
                    render,
                    exits,
                    features,
                    rooms,
                    fileURL
                }))
        }))
    await Promise.all([
        mergeIntoDataRange({
            table: 'ephemera',
            search: { DataCategory: AssetKey(assetId) },
            items: mergeEntries,
            mergeFunction: ({ current, incoming }) => {
                if (!incoming) {
                    return 'delete'
                }
                if (!current) {
                    return incoming
                }
                if (compareEntries(current, incoming)) {
                    return 'ignore'
                }
                else {
                    return incoming
                }
            }
        })
    ])
}

export default mergeEntries
