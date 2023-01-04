import { v4 as uuidv4 } from 'uuid'
import { WMLQuery } from '@tonylb/mtw-wml/dist/wmlQuery'
import { PersonalAssetsCondition, PersonalAssetsAction } from './baseClasses'
import {
    socketDispatchPromise,
    getStatus
} from '../lifeLine'
import delayPromise from '../../lib/delayPromise'
import { NormalImport } from '@tonylb/mtw-wml/dist/normalize/baseClasses'
import { wmlQueryFromCache } from '../../lib/wmlQueryCache'
import { TokenizeException } from '@tonylb/mtw-wml/dist/parser/tokenizer/baseClasses'
import { ParseException } from '@tonylb/mtw-wml/dist/parser/baseClasses'
import { AssetClientImportDefaults, AssetClientUploadURL } from '@tonylb/mtw-interfaces/dist/asset'
import { schemaToWML } from '@tonylb/mtw-wml/dist/schema'
import Normalizer from '@tonylb/mtw-wml/dist/normalize'

export const lifelineCondition: PersonalAssetsCondition = ({}, getState) => {
    const state = getState()
    const status = getStatus(state)

    return (status === 'CONNECTED')
}

export const getFetchURL: PersonalAssetsAction = ({ internalData: { id } }) => async (dispatch) => {
    const { url, properties } = await dispatch(socketDispatchPromise({
        message: 'fetch',
        AssetId: id || ''
    }, { service: 'asset' }))

    return { internalData: { fetchURL: url }, publicData: { properties } }
}

export const fetchAction: PersonalAssetsAction = ({ internalData: { id, fetchURL } }) => async () => {
    if (!fetchURL) {
        throw new Error()
    }
    const fetchedAssetWML = await fetch(fetchURL, { method: 'GET' }).then((response) => (response.text()))
    const assetWML = fetchedAssetWML.replace(/\r/g, '')
    if (id) {
        try {
            wmlQueryFromCache({ key: id, value: assetWML })
        }
        catch (err) {
            if (err instanceof TokenizeException) {
                console.log(`Token: Error message: ${err.message}`)
            }
            if (err instanceof ParseException) {
                console.log(`Parse: Error message: ${err.message}`)
            }
            throw err
        }
    }
    return { publicData: { originalWML: assetWML, currentWML: assetWML }}
}

type ImportsByAssets = Record<string, Record<string, string>>

export const fetchDefaultsAction: PersonalAssetsAction = ({ publicData: { currentWML }, internalData: { id } }) => async (dispatch) => {
    if (!currentWML) {
        throw new Error()
    }
    if (!id) {
        return {}
    }

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

    const importFetches: AssetClientImportDefaults[] = await Promise.all(
        Object.entries(importsByAssetId).map(([assetId, keys]) => (
            dispatch(socketDispatchPromise({ message: 'fetchImportDefaults', assetId: `ASSET#${assetId}`, keys: Object.values(keys) }, { service: 'asset' }))
        ))        
    )

    const importDefaults = importFetches.reduce<AssetClientImportDefaults["defaultsByKey"]>((previous, importFetch) => (
        Object.entries(importsByAssetId[importFetch.assetId.split('#')[1]] || {})
            .reduce<AssetClientImportDefaults["defaultsByKey"]>((accumulator, [localKey, awayKey]) => {
                const defaultItem = importFetch.defaultsByKey[awayKey]
                if (!defaultItem) {
                    return accumulator
                }
                else {
                    return {
                        ...accumulator,
                        [localKey]: defaultItem
                    }
                }
            }, previous)
    ), {})

    return {
        publicData: {
            importDefaults
        }
    }
}

export const getSaveURL: PersonalAssetsAction = ({ internalData: { id } }) => async (dispatch) => {
    if (id) {
        const uploadRequestId = uuidv4()
        const assetType = id?.split('#')?.[0] === 'CHARACTER' ? 'Character' : 'Asset'
        const { url, s3Object, images: saveImages } = (await dispatch(socketDispatchPromise({
            message: 'upload',
            tag: assetType,
            images: [],
            uploadRequestId
        }, { service: 'asset' }))) as AssetClientUploadURL
    
        return { internalData: { saveURL: url, uploadRequestId, s3Object, saveImages } }
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
    // if (!currentWML || !saveURL || !uploadRequestId) {
    //     throw new Error()
    // }
    // await fetch(saveURL, {
    //     method: 'PUT',
    //     body: currentWML
    // })
    return {}
}

export const parseWML: PersonalAssetsAction = ({
    internalData: {
        id,
        s3Object
    }
}) => async (dispatch, getState) => {
    // if (!s3Object || !id) {
    //     throw new Error()
    // }
    // const assetType = id?.split('#')?.[0] === 'CHARACTER' ? 'Characters' : 'Assets'
    // const assetKey = id?.split('#').slice(1).join('#')
    // await dispatch(socketDispatchPromise({
    //     message: 'parseWML',
    //     zone: 'Personal',
    //     fileName: assetKey,
    //     subFolder: assetType,
    //     uploadName: s3Object
    // }, { service: 'asset' }))
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

export const regenerateWMLAction: PersonalAssetsAction = ({ publicData: { normal = {} }}) => async(dispatch) => {
    const normalizer = new Normalizer()
    normalizer._normalForm = normal
    const newWML = schemaToWML(normalizer.schema)
    return {
        publicData: { currentWML: newWML }
    }
}
