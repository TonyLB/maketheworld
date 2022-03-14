import { PersonalAssetsCondition, PersonalAssetsAction } from './baseClasses'
// import cacheDB, { LastSyncType } from '../../cacheDB'
import {
    socketDispatchPromise,
    // LifeLinePubSub,
    getStatus
} from '../lifeLine'
// import { getMyCharacterById } from '../player'
// import { receiveMessages } from '../messages'
// import { push as pushFeedback } from '../UI/feedback'
import delayPromise from '../../lib/delayPromise'

export const lifelineCondition: PersonalAssetsCondition = ({}, getState) => {
    const state = getState()
    const status = getStatus(state)

    return (status === 'CONNECTED')
}

export const getFetchURL: PersonalAssetsAction = ({ internalData: { id } }) => async (dispatch) => {
    const { url } = await dispatch(socketDispatchPromise('fetch')({
        AssetId: id
    }))

    return { internalData: { fetchURL: url } }
}

export const fetchAction: PersonalAssetsAction = ({ internalData: { fetchURL } }) => async () => {
    if (!fetchURL) {
        throw new Error()
    }
    const assetWML = await fetch(fetchURL, { method: 'GET' }).then((response) => (response.text()))
    return { publicData: { originalWML: assetWML, currentWML: assetWML }}
}

export const saveAction: PersonalAssetsAction = ({ internalData: { id } }) => async (dispatch) => {
    return {}
}

export const clearAction: PersonalAssetsAction = ({ internalData: { id } }) => async (dispatch) => {
    return { publicData: { originalWML: undefined, currentWML: undefined } }
}

export const backoffAction: PersonalAssetsAction = ({ internalData: { incrementalBackoff = 0.5 }}) => async (dispatch) => {
    if (incrementalBackoff >= 30) {
        throw new Error()
    }
    await delayPromise(incrementalBackoff * 1000)
    return { internalData: { incrementalBackoff: Math.min(incrementalBackoff * 2, 30) } }
}