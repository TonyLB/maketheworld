import { v4 as uuidv4 } from 'uuid'
import { PersonalAssetsCondition, PersonalAssetsAction } from './baseClasses'
import {
    socketDispatchPromise,
    getStatus
} from '../lifeLine'
import delayPromise from '../../lib/delayPromise'
import { Token, TokenizeException } from '@tonylb/mtw-wml/dist/parser/tokenizer/baseClasses'
import { AssetClientFetchImports, AssetClientParseWML, AssetClientUploadURL } from '@tonylb/mtw-interfaces/dist/asset'
import { Schema, schemaToWML } from '@tonylb/mtw-wml/dist/schema'
import { isEphemeraAssetId, isEphemeraCharacterId } from '@tonylb/mtw-interfaces/dist/baseClasses'
import { getStandardForm, setImport } from '.'
import { Standardizer } from '@tonylb/mtw-wml/dist/standardize'
import { treeNodeTypeguard } from '@tonylb/mtw-wml/dist/tree/baseClasses'
import { isImportable, isSchemaImport, isSchemaWithKey } from '@tonylb/mtw-wml/dist/schema/baseClasses'

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
    const schemaConverter = new Schema()
    if (id) {
        try {
            schemaConverter.loadWML(assetWML)
        }
        catch (err) {
            if (err instanceof TokenizeException) {
                console.log(`Token: Error message: ${err.message}`)
            }
            throw err
        }
    }
    const standardizer = new Standardizer(schemaConverter.schema)
    return {
        publicData: {
            originalWML: assetWML,
            currentWML: assetWML,
            standard: standardizer.standardForm,
            serialized: true
        }
    }
}

type ImportsByAssets = Record<string, Record<string, string>>

export const fetchImports = (id: string) => async (dispatch: any, getState: () => any) => {
    if (!id) {
        return {}
    }
    const standardForm = getStandardForm(id)(getState())

    const importsByAssetId = standardForm.metaData
        .filter(treeNodeTypeguard(isSchemaImport))
        .reduce<Record<string, Record<string, string>>>((previous, { data, children }) => ({
            ...previous,
            [data.from]: children
                .filter(treeNodeTypeguard(isImportable))
                .reduce((accumulator, { data: { key, as }}) => ({
                    ...accumulator,
                    [as ?? key]: key
                }), previous[data.from] ?? {})
        }), {})

    const importFetches: AssetClientFetchImports[] = await Promise.all(
        Object.entries(importsByAssetId).map(([assetId, keys]) => (
            //
            // TODO: Generalize fetchImports to take a list of keys by assetId
            //
            dispatch(socketDispatchPromise({ message: 'fetchImports', assetId: `ASSET#${assetId}`, keys: Object.values(keys) }, { service: 'asset' }))
        )
    ))

    //
    // TODO: Refactor to write directly into importData, and re-derive schema from baseSchema and new importData.
    // Deprecate setImport action.
    //
    importFetches.map(({ importsByAsset }) => (importsByAsset)).flat().forEach(({ assetId, wml }) => {
        const schema = new Schema()
        schema.loadWML(wml)
        dispatch(setImport(id)({ assetKey: assetId.split('#')[1], schema: schema.schema }))
    })

}

export const fetchImportsStateAction: PersonalAssetsAction = ({ internalData: { id }, publicData: { standard }}) => async (dispatch) => {

    if (isEphemeraAssetId(id) && standard.metaData.filter(treeNodeTypeguard(isSchemaImport))) {
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
        standard = { key: '', tag: 'Asset', byId: {}, metaData: [] },
        serialized
    }
}) => async (dispatch, getState) => {
    if (!s3Object || !id || !(isEphemeraAssetId(id) || isEphemeraCharacterId(id))) {
        throw new Error()
    }

    const { images = [] } = await dispatch(socketDispatchPromise({
        message: 'parseWML',
        AssetId: id,
        tag: standard.tag,
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

export const locallyParseWMLAction: PersonalAssetsAction = ({ publicData }) => async(dispatch) => {
    const { draftWML } = publicData
    if (!draftWML) {
        return {}
    }
    let tokens: Token[] = []
    try {
        const schema = new Schema()
        schema.loadWML(draftWML)
        const standardizer = new Standardizer(schema.schema)
        return {
            publicData: {
                standard: standardizer.standardForm,
                currentWML: draftWML,
                draftWML: undefined
            },
            internalData: {
                error: undefined,
                standardizer
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
        else {
            throw {
                error: 'Unknown exception'
            }
        }
    }
}

export const regenerateWMLAction: PersonalAssetsAction = ({ publicData: { standard }}) => async(dispatch) => {
    try {
        const standardizer = new Standardizer()
        standardizer.loadStandardForm(standard)
        const newWML = schemaToWML(standardizer.schema)
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
    const schema = new Schema()
    if (isEphemeraAssetId(id)) {
        schema._schema = [{
            data: {
                tag: 'Asset',
                key: id.split('#')[1],
                Story: undefined
            },
            children: []
        }]
    }
    else if (isEphemeraCharacterId(id)) {
        schema._schema = [{
            data: {
                tag: 'Character',
                key: id.split('#')[1],
                Pronouns: {
                    subject: 'they',
                    object: 'them',
                    possessive: 'theirs',
                    adjective: 'their',
                    reflexive: 'themself'
                }
            },
            children: [
                { data: { tag: 'Name' }, children: [{ data: { tag: 'String', value: 'Unknown' }, children: [] }] },
                {
                    data: {
                        tag: 'Pronouns',
                        subject: 'they',
                        object: 'them',
                        possessive: 'theirs',
                        adjective: 'their',
                        reflexive: 'themself'
                    },
                    children: []
                },
            ]
        }]
    }
    else {
        throw new Error()
    }
    const newWML = schemaToWML(schema.schema)
    const standardizer = new Standardizer(schema.schema)
    return {
        publicData: {
            standard: standardizer.standardForm,
            schema: schema.schema,
            currentWML: newWML,
            properties: {},
            importDefaults: {},
            importData: {},
            loadedImages: {}
        }
    }
}