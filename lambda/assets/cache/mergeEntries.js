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

const mapContents = (normalForm) => ({ contents, ...rest }) => ({
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

export const mergeEntries = async (assetId, normalForm) => {
    const mergeEntries = Object.values(normalForm)
        .filter(({ tag }) => (['Room', 'Feature'].includes(tag)))
        .map(({ appearances, ...rest }) => ({
            ...rest,
            appearances: appearances
                .map(mapContextStackToConditions(normalForm))
                .map((item) => (rest.tag === 'Room' ? mapContents(normalForm)(item) : item))
                .map(({ conditions, name, render, exits, features }) => ({
                    conditions,
                    name,
                    render,
                    exits,
                    features
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
