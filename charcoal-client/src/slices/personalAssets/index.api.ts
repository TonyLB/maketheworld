import { v4 as uuidv4 } from 'uuid'
import { PersonalAssetsCondition, PersonalAssetsAction, PersonalAssetsPublic } from './baseClasses'
import {
    socketDispatchPromise,
    getStatus
} from '../lifeLine'
import delayPromise from '../../lib/delayPromise'
import { Token, TokenizeException } from '@tonylb/mtw-wml/ts/parser/tokenizer/baseClasses'
import { AssetClientFetchImports, AssetClientParseWML, AssetClientUploadURL } from '@tonylb/mtw-interfaces/ts/asset'
import { Schema, schemaToWML } from '@tonylb/mtw-wml/ts/schema'
import { isEphemeraAssetId, isEphemeraCharacterId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { getStandardForm, updateStandard } from '.'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import { treeNodeTypeguard } from '@tonylb/mtw-base/ts/genericTree'
import { publicSelectors } from './selectors'
import { isSchemaImport } from '@tonylb/mtw-base/ts/schema/metaData'
import { isImportable, ComponentUUID, AssetUUID } from '@tonylb/mtw-base/ts/schema'

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

    return { internalData: { fetchURL: url }, publicData: { properties: properties || {} } }
}

export const fetchAction: PersonalAssetsAction = ({ internalData: { id, fetchURL } }) => async (dispatch, getState) => {
    if (!fetchURL) {
        throw new Error()
    }
    let subscription: any = undefined
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
    const standardForm = new StandardForm(schemaConverter.schema[0])
    return {
        publicData: {
            originalWML: assetWML,
            currentWML: assetWML,
            base: standardForm.toJSON(),
            standard: standardForm.toJSON(),
            serialized: true
        },
        internalData: { subscription }
    }
}

export const fetchImports = (id: string) => async (dispatch: any, getState: () => any) => {
    if (!id) {
        return {}
    }
    const standardFormData = getStandardForm(id)(getState())
    const standardForm = new StandardForm(standardFormData)

    const importsByAssetId = standardForm.metaData
        .filter(treeNodeTypeguard(isSchemaImport))
        .reduce<Record<string, ComponentUUID[]>>((previous, { data, children }) => {
            const componentUUIDs = children
                .filter(treeNodeTypeguard(isImportable))
                .map(({ data: componentData }) => {
                    // Prefer uuid (ComponentUUID) if available, otherwise look up by key in StandardForm
                    if (componentData.uuid) {
                        return componentData.uuid
                    }
                    if (componentData.key) {
                        // Look up component in StandardForm by key to get universalKey
                        const component = standardForm._components.find(c => c.key === componentData.key)
                        return component?.universalKey
                    }
                    return undefined
                })
                .filter((uuid): uuid is ComponentUUID => uuid !== undefined)
            
            if (componentUUIDs.length > 0) {
                return {
                    ...previous,
                    [data.from]: [...(previous[data.from] ?? []), ...componentUUIDs]
                }
            }
            return previous
        }, {})

    const importFetches: AssetClientFetchImports[] = await Promise.all(
        Object.entries(importsByAssetId).map(([assetId, keys]) => (
            //
            // TODO: Generalize fetchImports to take a list of keys by assetId
            //
            dispatch(socketDispatchPromise({ message: 'fetchImports', assetId: `ASSET#${assetId}`, keys }, { service: 'asset' }))
        )
    ))

        const base = new StandardForm(id.split('#').slice(1).join('#'))
        const inherited = importFetches
            .map(({ importsByAsset }) => (importsByAsset))
            .flat()
            .reduce<StandardForm>((previous, { wml }) => {
                const standardForm = new StandardForm(wml)
                standardForm._universalKey = id as AssetUUID
                return previous.merge(standardForm)
            }, base)
    dispatch(updateStandard(id)({ type: 'setInherited', inherited: inherited.toJSON() }))

}

export const fetchImportsStateAction: PersonalAssetsAction = ({ internalData: { id }, publicData }) => async (dispatch) => {
    const standardForm = publicSelectors.getStandardForm({ ...(publicData as PersonalAssetsPublic), key: '' })

    if (id && isEphemeraAssetId(id) && standardForm.metaData.filter(treeNodeTypeguard(isSchemaImport))) {
        await dispatch(fetchImports(id))
    }
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

export const locallyParseWMLAction: PersonalAssetsAction = ({ publicData }) => async(dispatch) => {
    const { draftWML } = publicData
    if (!draftWML) {
        return {}
    }
    let tokens: Token[] = []
    try {
        const schema = new Schema()
        schema.loadWML(draftWML)
        const standardForm = new StandardForm(schema.schema[0])
        return {
            publicData: {
                standard: standardForm.toJSON(),
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
        else {
            throw {
                error: 'Unknown exception'
            }
        }
    }
}

export const regenerateWMLAction: PersonalAssetsAction = ({ publicData }) => async(dispatch) => {
    const standardForm = publicSelectors.getStandardForm({ ...(publicData as PersonalAssetsPublic), key: '' })
    try {
        const newStandard = new StandardForm(standardForm)
        const newWML = schemaToWML([newStandard.schema])
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
                uuid: id,
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
            },
            children: [
                { data: { tag: 'Name' }, children: [{ data: { tag: 'String', value: 'Unknown' }, children: [] }] },
            ]
        }]
    }
    else {
        throw new Error()
    }
    const newWML = schemaToWML(schema.schema)
    const standardForm = new StandardForm(schema.schema[0])
    return {
        publicData: {
            standard: standardForm.toJSON(),
            schema: schema.schema,
            currentWML: newWML,
            properties: {},
            importDefaults: {},
            importData: {},
            loadedImages: {}
        }
    }
}