import { memoizedEvaluate, clearMemoSpace } from './memoize.js'
import { splitType, AssetKey } from '../types.js'

import { getCharacterAssets, getItemMeta, getStateByAsset, getGlobalAssets, getNormalForm } from './dynamoDB.js'

const evaluateConditionalList = (asset, list = [], state) => {
    if (list.length > 0) {
        const [first, ...rest] = list
        const evaluation = memoizedEvaluate(asset, first.if, state)

        if (Boolean(evaluation) && evaluation !== '{#ERROR}') {
            return evaluateConditionalList(rest)
        }
        else {
            return false
        }
    }
    return true
}

export const assetRender = async ({ assetId, existingStatesByAsset = {}, existingNormalFormsByAsset = {} }) => {

    const [normalForm, assetState] = await Promise.all([
        getNormalForm(assetId, existingNormalFormsByAsset),
        getStateByAsset([assetId], existingStatesByAsset)
    ])

    clearMemoSpace()

    const roomNamesAndExits = Object.values(normalForm)
        .filter(({ tag }) => (tag === 'Room'))
        .reduce((previous, { key, EphemeraId, appearances = [] }) => {
            const name = appearances
                .filter(({ name }) => (name !== undefined))
                .filter(({ conditions = [] }) => (evaluateConditionalList(assetId, conditions, assetState)))
                .map(({ name }) => (name))
            const exits = appearances
                .filter(({ contents = [] }) => (contents.filter(({ tag }) => (tag === 'Exit')).length > 0))
                .filter(({ conditions = [] }) => (evaluateConditionalList(assetId, conditions, assetState)))
                .map(({ contents }) => {
                    return contents
                        .filter(({ tag }) => (tag === 'Exit'))
                        .map(({ key }) => {
                            const { to, toEphemeraId, name } = normalForm[key]
                            return {
                                key,
                                to,
                                toEphemeraId,
                                name
                            }
                        })
                })
                .reduce((previous, list) => ([...previous, ...list]), [])
            return {
                ...previous,
                [key]: {
                    EphemeraId,
                    name: [ ...(previous[key]?.names || []), ...name ],
                    exits: [ ...(previous[key]?.exits || []), ...exits ]
                }
            }
        }, {})

    return Object.entries(roomNamesAndExits)
        .filter(([_, { names = [], exits = [] }]) => (names.length > 0 || exits.length > 0))
        .reduce((previous, [key, value]) => ({ ...previous, [key]: value }), {})
}

export default assetRender
