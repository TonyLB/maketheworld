import { v4 as uuidv4 } from 'uuid'
import { PersonalAssetsCondition, PersonalAssetsAction } from './baseClasses'
import {
    socketDispatchPromise,
    getStatus
} from '../lifeLine'
import delayPromise from '../../lib/delayPromise'
import { NormalImport, isNormalImport } from '@tonylb/mtw-wml/dist/normalize/baseClasses'
import { Token, TokenizeException } from '@tonylb/mtw-wml/dist/parser/tokenizer/baseClasses'
import { ParseException } from '@tonylb/mtw-wml/dist/parser/baseClasses'
import { AssetClientFetchImports, AssetClientParseWML, AssetClientUploadURL } from '@tonylb/mtw-interfaces/dist/asset'
import { schemaFromParse, schemaToWML } from '@tonylb/mtw-wml/dist/schema'
import Normalizer from '@tonylb/mtw-wml/dist/normalize'
import SourceStream from '@tonylb/mtw-wml/dist/parser/tokenizer/sourceStream'
import tokenizer from '@tonylb/mtw-wml/dist/parser/tokenizer'
import parse from '@tonylb/mtw-wml/dist/parser'
import { isEphemeraAssetId, isEphemeraCharacterId } from '@tonylb/mtw-interfaces/dist/baseClasses'
import { getNormalized, setImport } from '.'

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
            normalizer.standardize()
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
    return { publicData: { originalWML: assetWML, currentWML: assetWML, normal: normalizer.normal, serialized: true }}
}

type ImportsByAssets = Record<string, Record<string, string>>

export const fetchImports = (id: string) => async (dispatch: any, getState: () => any) => {
    if (!id) {
        return {}
    }
    const normal = getNormalized(id)(getState())

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

    const importFetches: AssetClientFetchImports[] = await Promise.all(
        Object.entries(importsByAssetId).map(([assetId, keys]) => (
            //
            // TODO: Generalize fetchImports to take a list of keys by assetId
            //
            dispatch(socketDispatchPromise({ message: 'fetchImports', assetId: `ASSET#${assetId}`, keys: Object.values(keys) }, { service: 'asset' }))
        )
    ))

    importFetches.map(({ importsByAsset }) => (importsByAsset)).flat().forEach(({ assetId, wml }) => {
        const normalizer = new Normalizer()
        normalizer.loadWML(wml)
        dispatch(setImport(id)({ assetKey: assetId.split('#')[1], normal: normalizer.normal }))
    })

}

export const fetchImportsStateAction: PersonalAssetsAction = ({ internalData: { id }, publicData: { normal = {} }}) => async (dispatch) => {
    if (isEphemeraAssetId(id) && Object.values(normal).filter(isNormalImport)) {
        await dispatch(fetchImports(id))
    }
    return {}
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
        properties = {},
        serialized
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
        }, []),
        ...(serialized ? {} : { create: true })
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
            loadedImages: {},
            serialized: true,
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
        normalizer.standardize()
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

export const initializeNewAction: PersonalAssetsAction = ({ internalData: { id } }) => async(dispatch) => {
    if (!id) {
        throw new Error()
    }
    const normalizer = new Normalizer()
    if (isEphemeraAssetId(id)) {
        normalizer.put({
            tag: 'Asset',
            key: id.split('#')[1],
            Story: undefined,
            contents: []
        }, { contextStack: [] })
    }
    else if (isEphemeraCharacterId(id)) {
        normalizer.put({
            tag: 'Character',
            key: id.split('#')[1],
            contents: [],
            Name: 'Unknown',
            Pronouns: {
                subject: 'they',
                object: 'them',
                possessive: 'theirs',
                adjective: 'their',
                reflexive: 'themself'
            }
        }, { contextStack: [] })
    }
    else {
        throw new Error()
    }
    const newWML = schemaToWML(normalizer.schema)
    return {
        publicData: {
            normal: normalizer.normal,
            currentWML: newWML,
            properties: {},
            importDefaults: {},
            importData: {},
            loadedImages: {}
        }
    }
}