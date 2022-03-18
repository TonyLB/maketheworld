import { WMLQuery } from '../../wml/wmlQuery'
import { PersonalAssetsCondition, PersonalAssetsAction } from './baseClasses'
import {
    socketDispatchPromise,
    getStatus
} from '../lifeLine'
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
    const fetchedAssetWML = await fetch(fetchURL, { method: 'GET' }).then((response) => (response.text()))
    const assetWML = fetchedAssetWML.replace(/\r/g, '')
    const wmlQuery = new WMLQuery(assetWML)
    return { publicData: { originalWML: assetWML, wmlQuery }}
}

export const saveAction: PersonalAssetsAction = ({ internalData: { id } }) => async (dispatch) => {
    return {}
}

export const clearAction: PersonalAssetsAction = ({ internalData: { id } }) => async (dispatch) => {
    return { publicData: { originalWML: undefined, wmlQuery: undefined } }
}

export const backoffAction: PersonalAssetsAction = ({ internalData: { incrementalBackoff = 0.5 }}) => async (dispatch) => {
    if (incrementalBackoff >= 30) {
        throw new Error()
    }
    await delayPromise(incrementalBackoff * 1000)
    return { internalData: { incrementalBackoff: Math.min(incrementalBackoff * 2, 30) } }
}