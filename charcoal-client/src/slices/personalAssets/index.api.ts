import { v4 as uuidv4 } from 'uuid'
import { PersonalAssetsCondition, PersonalAssetsAction, PersonalAssetsPublic } from './baseClasses'
import {
    socketDispatchPromise,
    getStatus,
    LifeLinePubSub,
    socketDispatch
} from '../lifeLine'
import delayPromise from '../../lib/delayPromise'
import { Token, TokenizeException } from '@tonylb/mtw-wml/ts/parser/tokenizer/baseClasses'
import { AssetClientFetchImports } from '@tonylb/mtw-interfaces/ts/asset'
import { Schema, schemaToWML } from '@tonylb/mtw-wml/ts/schema'
import { getStandardForm, updateStandard, receiveWMLEvent } from '.'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import { StandardFormData } from '@tonylb/mtw-wml/ts/standardize/components/dataTypes'
import { treeNodeTypeguard } from '@tonylb/mtw-base/ts/genericTree'
import { publicSelectors } from './selectors'
import { isSchemaImport } from '@tonylb/mtw-base/ts/schema/metaData'
import { isImportable, ComponentUUID, AssetUUID, isSchemaAssetUUID } from '@tonylb/mtw-base/ts/schema'
import { isSubscriptionClientMessage, WMLSubscriptionClientMessage } from '@tonylb/mtw-interfaces/ts/subscriptions'
import { fromWebSocketFormat } from '@tonylb/mtw-lambda-patterns/ts/dataSource/formatTransform'
import { WMLDataSourceEventSerializer, WMLContentEventExternal, WMLStreamingEventHeader } from '@tonylb/mtw-interfaces/ts/eventBridge/wml'
import { createBrowserDataSourceEnvironment } from '../dataSource'
import { subscribeToWmlDataSource, unsubscribeFromWmlDataSource } from '../wmlDataSource'

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
    // Subscribe to LifeLinePubSub to receive WML StreamEvent messages for this asset
    // This allows us to receive Content Update events that clear pendingEdits
    const wmlSerializer = new WMLDataSourceEventSerializer(createBrowserDataSourceEnvironment())
    const subscription = id ? LifeLinePubSub.subscribe(async ({ payload }) => {
        // Filter for StreamEvent messages from mtw.wml data source
        if (isSubscriptionClientMessage(payload) &&
            payload.messageType === 'StreamEvent' &&
            payload.dataSourceKey === 'mtw.wml' &&
            payload.streamKey === id) {
            const coreFormat = fromWebSocketFormat(payload as WMLSubscriptionClientMessage)
            const content = await wmlSerializer.deserialize({
                content: coreFormat.update as WMLContentEventExternal,
                header: coreFormat.header as WMLStreamingEventHeader
            })
            if (content) {
                dispatch(receiveWMLEvent(id)({ header: coreFormat.header, content }))
            }
        }
    }) : undefined

    // Tell the backend to deliver mtw.wml events for this asset (Content Update / Merge Conflict)
    if (id && isSchemaAssetUUID(id)) {
        dispatch(socketDispatch({ message: 'subscribe', dataSourceKey: 'mtw.wml', streamKeys: [id] }, { service: 'subscriptions' }))
        //
        // TEMPORARY: Parallel subscription into the WML dataSource slice
        // -----------------------------------------------------------------
        // While personalAssets still owns the direct mtw.wml subscription and
        // base application, also subscribe the generic wmlDataSource slice to
        // the same stream so we can compare materializedView with the legacy
        // personalAssets.base for validation during the migration.
        //
        // This call should be removed once WML dataSource fully owns
        // subscribe/unsubscribe and personalAssets stops fetching/applying
        // WML directly (see AGENT.subscriberSync.refactor.planning.md).
        //
        dispatch(subscribeToWmlDataSource([id]))
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
    const standardForm = new StandardForm(schemaConverter.schema[0])
    // Initialize edit with the correct universalKey from the base
    const editUniversalKey: AssetUUID = (id && isSchemaAssetUUID(id)) ? id : 'ASSET#uninitialized' as AssetUUID
    const editData: StandardFormData = { 
        universalKey: editUniversalKey, 
        components: [], 
        metaData: [] 
    }
    return {
        publicData: {
            originalWML: assetWML,
            currentWML: assetWML,
            base: standardForm.toJSON(),
            standard: standardForm.toJSON(),
            edit: editData,
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
                        const component = standardForm.components.find(c => c.key === componentData.key)
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

        const base = new StandardForm(id)
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

    if (id && isSchemaAssetUUID(id) && standardForm.metaData.filter(treeNodeTypeguard(isSchemaImport))) {
        await dispatch(fetchImports(id))
    }
    return {}
}

export const clearAction: PersonalAssetsAction = ({ internalData: { id, subscription } }) => async (dispatch) => {
    // Unsubscribe from LifeLinePubSub when clearing the asset
    if (subscription) {
        LifeLinePubSub.unsubscribe(subscription)
    }
    // Tell the backend to stop delivering mtw.wml events for this asset
    if (id) {
        dispatch(socketDispatch({ message: 'unsubscribe', dataSourceKey: 'mtw.wml', streamKeys: [id] }, { service: 'subscriptions' }))
        //
        // TEMPORARY: Mirror the personalAssets unsubscribe into the WML dataSource
        // ------------------------------------------------------------------------
        // Keep the wmlDataSource slice subscription lifecycle aligned with the
        // legacy personalAssets subscription so we can safely compare states
        // during migration. This will be removed when wmlDataSource owns the
        // mtw.wml subscribe/unsubscribe responsibility.
        //
        dispatch(unsubscribeFromWmlDataSource([id]))
    }
    return { 
        publicData: { originalWML: undefined, currentWML: undefined },
        internalData: { subscription: undefined }
    }
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
    if (!id || !isSchemaAssetUUID(id)) {
        throw new Error()
    }
    const schema = new Schema()
    schema._schema = [{
        data: {
            tag: 'Asset',
            uuid: id,
            Story: undefined
        },
        children: []
    }]
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