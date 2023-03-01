import { v4 as uuidv4 } from 'uuid'
import { PersonalAssetsCondition, PersonalAssetsAction } from './baseClasses'
import {
    socketDispatchPromise,
    getStatus
} from '../lifeLine'
import delayPromise from '../../lib/delayPromise'
import { NormalImport } from '@tonylb/mtw-wml/dist/normalize/baseClasses'
import { Token, TokenizeException } from '@tonylb/mtw-wml/dist/parser/tokenizer/baseClasses'
import { ParseException } from '@tonylb/mtw-wml/dist/parser/baseClasses'
import { AssetClientFetchImports, AssetClientImportDefaults, AssetClientParseWML, AssetClientUploadURL } from '@tonylb/mtw-interfaces/dist/asset'
import { schemaFromParse, schemaFromWML, schemaToWML } from '@tonylb/mtw-wml/dist/schema'
import Normalizer from '@tonylb/mtw-wml/dist/normalize'
import SourceStream from '@tonylb/mtw-wml/dist/parser/tokenizer/sourceStream'
import tokenizer from '@tonylb/mtw-wml/dist/parser/tokenizer'
import parse from '@tonylb/mtw-wml/dist/parser'
import { isEphemeraAssetId, isEphemeraCharacterId } from '@tonylb/mtw-interfaces/dist/baseClasses'
import { isSchemaAssetContents, SchemaAssetTag, SchemaTag } from '@tonylb/mtw-wml/dist/schema/baseClasses'

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
    const normalizer = new Normalizer()
    if (id) {
        try {
            normalizer.loadWML(assetWML)
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
    return { publicData: { originalWML: assetWML, currentWML: assetWML, normal: normalizer.normal }}
}

type ImportsByAssets = Record<string, Record<string, string>>

export const fetchDefaultsAction: PersonalAssetsAction = ({ publicData: { normal }, internalData: { id } }) => async (dispatch) => {
    if (!id) {
        return {}
    }

    const importsByAssetId = Object.values(normal || {})
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

    const importAPICall: [AssetClientImportDefaults, AssetClientFetchImports][] = await Promise.all(
        Object.entries(importsByAssetId).map(([assetId, keys]) => (Promise.all([
            //
            // TODO: Deprecate fetchImportDefaults and use fetchImports return instead
            //
            dispatch(socketDispatchPromise({ message: 'fetchImportDefaults', assetId: `ASSET#${assetId}`, keys: Object.values(keys) }, { service: 'asset' })),
            dispatch(socketDispatchPromise({ message: 'fetchImports', assetId: `ASSET#${assetId}`, keys: Object.values(keys) }, { service: 'asset' }))
        ])
    )))
    const importFetchDefaults = importAPICall.map((items) => (items[0]))
    const importFetches = importAPICall.map((items) => (items[1]))

    const importDefaults = importFetchDefaults.reduce<AssetClientImportDefaults["defaultsByKey"]>((previous, importFetch) => (
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

    //
    // TODO: Figure out how to merge incoming importData with pre-existing importData, overriding stubs with
    // full schema where necessary, but never overriding a full schema with a stub
    //
    const importData: Record<string, SchemaTag> = importFetches.map(({ importsByAsset }) => (importsByAsset)).flat().reduce<Record<string, SchemaTag>>((previous, { assetId, schemaByKey, stubsByKey }) => {
        const aggregateSchema: SchemaAssetTag = {
            tag: 'Asset',
            Story: undefined,
            key: assetId.split('#')[1],
            contents: [
                ...Object.values(stubsByKey).map(schemaFromWML).flat().filter(isSchemaAssetContents),
                ...Object.values(schemaByKey).map(schemaFromWML).flat().filter(isSchemaAssetContents)
            ]
        }
        return {
            ...previous,
            [assetId]: aggregateSchema
        }
    }, {})

    return {
        publicData: {
            importDefaults,
            importData
        }
    }
}

export const getSaveURL: PersonalAssetsAction = ({ internalData: { id }, publicData: { loadedImages } }) => async (dispatch) => {
    if (id) {
        const uploadRequestId = uuidv4()
        const assetType = id?.split('#')?.[0] === 'CHARACTER' ? 'Character' : 'Asset'
        const { url, s3Object, images: saveImages } = (await dispatch(socketDispatchPromise({
            message: 'upload',
            tag: assetType,
            images: Object.values(loadedImages || {}).map(({ loadId, file }) => ({ key: loadId, contentType: file.type })),
            uploadRequestId
        }, { service: 'asset' }))) as AssetClientUploadURL
    
        return { internalData: { saveURL: url, uploadRequestId, s3Object, saveImages } }
    }
    throw new Error()
}

export const saveWML: PersonalAssetsAction = ({
    internalData: {
        saveURL,
        saveImages,
        uploadRequestId
    },
    publicData: {
        currentWML,
        loadedImages
    }
}) => async (dispatch, getState) => {
    if (!currentWML || !saveURL || !uploadRequestId) {
        throw new Error()
    }
    await Promise.all([
        fetch(saveURL, {
            method: 'PUT',
            body: currentWML
        }),
        ...((saveImages || []).map(({ presignedOutput, key }) => (async () => {
            const loadedImage = Object.values(loadedImages || {}).find(({ loadId }) => (loadId === key))
            if (loadedImage) {
                await fetch(presignedOutput, {
                    method: 'PUT',
                    body: loadedImage.file
                })
            }
        })()))
    ])
    return {}
}

export const parseWML: PersonalAssetsAction = ({
    internalData: {
        id,
        s3Object,
        saveImages
    },
    publicData: {
        loadedImages = {},
        properties = {}
    }
}) => async (dispatch, getState) => {
    if (!s3Object || !id || !(isEphemeraAssetId(id) || isEphemeraCharacterId(id))) {
        throw new Error()
    }

    const { images = [] } = await dispatch(socketDispatchPromise({
        message: 'parseWML',
        AssetId: id,
        uploadName: s3Object,
        images: (saveImages || []).reduce<{ key: string; fileName: string }[]>((previous, { key, s3Object }) => {
            const loadKey = Object.keys(loadedImages).find((loadKey) => (loadedImages[loadKey].loadId === key))
            if (loadKey) {
                return [
                    ...previous,
                    {
                        key: loadKey,
                        fileName: s3Object
                    }
                ]
            }
            else {
                return previous
            }
        }, [])
    }, { service: 'asset' })) as AssetClientParseWML

    return {
        internalData: {
            saveImages: undefined,
            saveURL: undefined
        },
        publicData: {
            properties: images.reduce<Record<string, { fileName: string }>>((previous, { key, fileName }) => ({
                ...previous,
                [key]: { fileName }
            }), properties),
            loadedImages: {}
        }
    }
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

export const locallyParseWMLAction: PersonalAssetsAction = ({ publicData: { draftWML }}) => async(dispatch) => {
    if (!draftWML) {
        return {}
    }
    let tokens: Token[] = []
    try {
        tokens = tokenizer(new SourceStream(draftWML))
        const schema = schemaFromParse(parse(tokens))
        const normalizer = new Normalizer()
        schema.forEach((tag, index) => {
            normalizer.put(tag, { contextStack: [], index, replace: false })
        })
        return {
            publicData: {
                normal: normalizer.normal,
                currentWML: draftWML,
                draftWML: undefined
            },
            internalData: {
                error: undefined
            }
        }
    }
    catch (err) {
        if (err instanceof TokenizeException) {
            throw {
                error: err.message,
                errorStart: err.startIdx,
                errorEnd: err.endIdx
            }
        }
        else if (err instanceof ParseException) {
            throw {
                error: err.message,
                errorStart: tokens[err.startToken].startIdx,
                errorEnd: tokens[err.endToken].endIdx
            }
        }
        else {
            throw {
                error: 'Unknown exception'
            }
        }
    }
}

export const regenerateWMLAction: PersonalAssetsAction = ({ publicData: { normal = {} }}) => async(dispatch) => {
    const normalizer = new Normalizer()
    normalizer._normalForm = normal
    try {
        const newWML = schemaToWML(normalizer.schema)
        return {
            publicData: { currentWML: newWML }
        }
    }
    catch (err) {
        console.log(err)
        throw err
    }
}
