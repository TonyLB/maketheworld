import { v4 as uuidv4 } from 'uuid'
import { WMLQuery } from '../../wml/wmlQuery'
import { PersonalAssetsCondition, PersonalAssetsAction } from './baseClasses'
import {
    socketDispatchPromise,
    apiDispatchPromise,
    getStatus
} from '../lifeLine'
import delayPromise from '../../lib/delayPromise'
import { NormalImport } from '../../wml/normalize'

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
    return { publicData: { originalWML: assetWML, currentWML: assetWML }}
}

type ImportsByAssets = Record<string, Record<string, string>>

export const fetchDefaultsAction: PersonalAssetsAction = ({ publicData: { currentWML }, internalData: { id } }) => async (dispatch) => {
    if (!currentWML) {
        throw new Error()
    }
    const assetKey = id?.split('#').slice(1).join('#')

    const wmlQuery = new WMLQuery(currentWML)
    const normalized = wmlQuery.normalize()
    const importsByAssetId = Object.values(normalized)
        .filter(({ tag }) => (tag === 'Import'))
        .map((item) => (item as NormalImport))
        .reduce((previous, { from, mapping }) => ({
            ...previous,
            [from]: Object.entries(mapping)
                .reduce((previous, [localKey, { key: awayKey }]) => ({
                    ...previous,
                    [localKey]: awayKey
                }), {})
        }), {} as ImportsByAssets)

    const { importDefaults } = await dispatch(socketDispatchPromise('fetchImportDefaults')({ importsByAssetId, assetId: assetKey }))

    return {
        publicData: {
            defaultAppearances: importDefaults.components,
            inheritedExits: importDefaults.aggregateExits
        }
    }
}

export const getSaveURL: PersonalAssetsAction = ({ internalData: { id } }) => async (dispatch) => {
    if (id) {
        const uploadRequestId = uuidv4()
        const assetType = id?.split('#')?.[0] === 'CHARACTER' ? 'Character' : 'Asset'
        const assetKey = id?.split('#').slice(1).join('#')
        const { url } = await dispatch(socketDispatchPromise('upload')({
            fileName: `${assetKey}.wml`,
            tag: assetType,
            uploadRequestId
        }))
    
        return { internalData: { saveURL: url, uploadRequestId } }    
    }
    throw new Error()
}

export const saveWML: PersonalAssetsAction = ({
    internalData: {
        saveURL,
        uploadRequestId
    },
    publicData: {
        currentWML
    }
}) => async (dispatch, getState) => {
    if (!currentWML || !saveURL || !uploadRequestId) {
        throw new Error()
    }
    await apiDispatchPromise(saveURL, uploadRequestId)(currentWML)
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