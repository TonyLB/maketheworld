import { v4 as uuidv4 } from 'uuid'
import { PersonalAssetsCondition, PersonalAssetsAction, PersonalAssetsPublic } from './baseClasses'
import {
    socketDispatchPromise,
    getStatus,
    LifeLinePubSub
} from '../lifeLine'
import delayPromise from '../../lib/delayPromise'
import { Token, TokenizeException } from '@tonylb/mtw-wml/ts/parser/tokenizer/baseClasses'
import { AssetClientFetchImports } from '@tonylb/mtw-interfaces/ts/asset'
import { Schema, schemaToWML } from '@tonylb/mtw-wml/ts/schema'
import { getStandardForm, updateStandard, receiveWMLEvent } from '.'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import { StandardFormData } from '@tonylb/mtw-wml/ts/standardize/components/dataTypes'
import { treeNodeTypeguard } from '@tonylb/mtw-base/ts/genericTree'
import { publicSelectors, PersonalAssetsPublicAugmented } from './selectors'
import { getWMLBase } from '../wmlDataSource/selectors'
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

/**
 * Subscribe to mtw.wml via WML dataSource slice; register LifeLine listener for
 * clearPendingEditsByRequestIds and Merge Conflict toast. Base comes from dataSource
 * Snapshot (no fetch for WML body). See personalAssets AGENT.md "WML dataSource integration".
 *
 * DEPRECATED: getFetchURL (message: 'fetch') previously returned properties (image filenames).
 * Image items will use uuid-as-filename; restore a getProperties flow when that refactor lands.
 * See personalAssets AGENT.md "Deprecated: Image properties (fetch)".
 */
export const subscribeAction: PersonalAssetsAction = (data) => async (dispatch) => {
    const { internalData: { id }, publicData } = data
    const properties = {}

    // Subscribe to LifeLinePubSub to receive WML StreamEvent messages for this asset
    const wmlSerializer = new WMLDataSourceEventSerializer(createBrowserDataSourceEnvironment())
    const subscription = id ? LifeLinePubSub.subscribe(async ({ payload }) => {
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

    // WML dataSource owns subscribe; backend sends Snapshot with sidecarUrl
    if (id && isSchemaAssetUUID(id)) {
        dispatch(subscribeToWmlDataSource([id]))
    }

    const editUniversalKey: AssetUUID = (id && isSchemaAssetUUID(id)) ? id : 'ASSET#uninitialized' as AssetUUID
    const editData: StandardFormData = {
        universalKey: editUniversalKey,
        components: [],
        metaData: []
    }

    return {
        publicData: {
            properties,
            edit: editData,
            pendingEdits: [],
            serialized: false
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

const EMPTY_BASE: StandardFormData = { universalKey: 'ASSET#uninitialized', components: [], metaData: [] }

export const fetchImportsStateAction: PersonalAssetsAction = ({ internalData: { id }, publicData }) => async (dispatch, getState) => {
    const base = (id && getWMLBase(getState(), id)) ?? EMPTY_BASE
    const standardForm = publicSelectors.getStandardForm({ ...(publicData as PersonalAssetsPublic), base, key: id ?? '' } as PersonalAssetsPublicAugmented & { key: string })

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
    // wmlDataSource owns mtw.wml unsubscribe; triggers socket unsubscribe via UNSUBSCRIBE state
    if (id) {
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

export const regenerateWMLAction: PersonalAssetsAction = ({ internalData: { id }, publicData }) => async(dispatch, getState) => {
    const base = (id && getWMLBase(getState(), id)) ?? EMPTY_BASE
    const standardForm = publicSelectors.getStandardForm({ ...(publicData as PersonalAssetsPublic), base, key: id ?? '' } as PersonalAssetsPublicAugmented & { key: string })
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