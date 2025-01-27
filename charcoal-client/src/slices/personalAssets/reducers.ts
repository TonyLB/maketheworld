import { PayloadAction } from '@reduxjs/toolkit'
import { PersonalAssetsPublic } from './baseClasses'
import { v4 as uuidv4 } from 'uuid'
import { GenericTree } from '@tonylb/mtw-base/ts/genericTree'
import { selectKeysByTag } from '@tonylb/mtw-wml/ts/schema/selectors/keysByTag'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import { Schema } from '@tonylb/mtw-wml/ts/schema'
import { SubscriptionClientMessage } from '@tonylb/mtw-interfaces/ts/subscriptions'
import { StandardFormData } from '@tonylb/mtw-wml/ts/standardize/components/dataTypes'
import { isSchemaAsset, SchemaTag } from '@tonylb/mtw-base/ts/schema'
import { ComponentTag } from '@tonylb/mtw-wml/ts/standardize/components/dataTypes/abstract'

export const setCurrentWML = (state: PersonalAssetsPublic, newCurrent: PayloadAction<{ value: string }>) => {
    state.currentWML = newCurrent.payload.value
    state.draftWML = undefined
    const schema = new Schema()
    schema.loadWML(newCurrent.payload.value)
    const standardized = new StandardForm(schema.schema[0])
    state.base = standardized.toJSON()
    const baseKey = standardized.key
    const importsStandardized = Object.values(state.importData)
        .map((tree) => (
            tree.length === 1 && isSchemaAsset(tree[0].data)
                ? [{ ...tree[0], data: { ...tree[0].data, key: baseKey }}]
                : []
        ))
        .filter((tree) => (tree.length))
        .reduce<StandardForm | undefined>((previous, incoming) => {
            const standardForm = new StandardForm(incoming[0])
            return previous ? previous.merge(standardForm) : standardForm
        }, undefined)
    if (importsStandardized) {
        importsStandardized._metaData = standardized.metaData
        state.inherited = importsStandardized.toJSON()
    }
}

export const setDraftWML = (state: PersonalAssetsPublic, newDraft: PayloadAction<{ value: string }>) => {
    state.draftWML = newDraft.payload.value
}

export const revertDraftWML = (state: PersonalAssetsPublic, newDraft: PayloadAction<{}>) => {
    state.draftWML = undefined
}

export const setLoadedImage = (state: PersonalAssetsPublic, action: PayloadAction<{ itemId: string; file: File }>) => {
    state.loadedImages[action.payload.itemId] = {
        loadId: uuidv4(),
        file: action.payload.file
    }
}

export type UpdateStandardPayloadSetInherited = {
    type: 'setInherited';
    inherited: StandardFormData;
}

export type UpdateStandardPayloadUpdateComponent = {
    type: 'update';
    update: (draft: StandardForm) => StandardForm;
}

export type UpdateStandardPayloadRemoveComponent = {
    type: 'removeComponent';
    componentKey: string;
}

type UpdateStandardPayloadRenameKey = {
    type: 'renameKey',
    from: string;
    to: string;
}

export type UpdateStandardPayload = UpdateStandardPayloadSetInherited | UpdateStandardPayloadUpdateComponent | UpdateStandardPayloadRemoveComponent | UpdateStandardPayloadRenameKey

const isUpdateStandardPayloadSetBase = (payload: UpdateStandardPayload): payload is UpdateStandardPayloadSetInherited => (payload.type === 'setInherited')
const isUpdateStandardPayloadUpdateComponent = (payload: UpdateStandardPayload): payload is UpdateStandardPayloadUpdateComponent => (payload.type === 'update')
const isUpdateStandardPayloadRemoveComponent = (payload: UpdateStandardPayload): payload is UpdateStandardPayloadRemoveComponent => (payload.type === 'removeComponent')
const isUpdateStandardPayloadRenameKey = (payload: UpdateStandardPayload): payload is UpdateStandardPayloadRenameKey => (payload.type === 'renameKey')

export const nextSyntheticKey = ({ schema, tag }: { schema: GenericTree<SchemaTag>, tag: ComponentTag | "Import" }): string => {
    const keysByTag = selectKeysByTag(tag)(schema)
    let nextIndex = 1
    while (keysByTag.includes(`${tag}${nextIndex}`)) { nextIndex++ }
    return `${tag}${nextIndex}`
}

export const updateStandard = (state: PersonalAssetsPublic, action: PayloadAction<UpdateStandardPayload>) => {
    const { payload } = action
    const mergeToEdit = (delta: StandardForm): void => {
        const editStandardized = new StandardForm(state.edit)
        state.edit = editStandardized.merge(delta).toJSON()
    }
    if (isUpdateStandardPayloadSetBase(payload)) {
        state.inherited = payload.inherited
        return
    }
    const base = new StandardForm(state.base)
    const standardForm = state.pendingEdits.reduce<StandardForm>((previous, pendingEdit) => {
        const editStandardized = new StandardForm(pendingEdit.edit)
        return previous.merge(editStandardized)
    }, state.inherited ? new StandardForm(state.inherited).merge(base) : base).merge(new StandardForm(state.edit))
    if (isUpdateStandardPayloadUpdateComponent(payload)) {
        const modified = payload.update(standardForm._clone())
        const diff = standardForm.diff(modified)
        if (diff) {
            mergeToEdit(diff)
        }
    }
    if (isUpdateStandardPayloadRemoveComponent(payload)) {
        const localStandardForm = state.pendingEdits.reduce<StandardForm>((previous, pendingEdit) => {
            const editStandardized = new StandardForm(pendingEdit.edit)
            return previous.merge(editStandardized)
        }, base).merge(new StandardForm(state.edit))
        const componentRemoved = localStandardForm._clone()
        delete componentRemoved._byId[payload.componentKey]
        Object.keys(componentRemoved.byId)
            .filter((key) => (key.startsWith(`${payload.componentKey}.`)))
            .forEach((key) => {
                delete componentRemoved._byId[key]
            })
        const diff = localStandardForm.diff(componentRemoved)
        if (diff) {
            mergeToEdit(diff)
        }
    }
    if (isUpdateStandardPayloadRenameKey(payload)) {
        const renamedStandardForm = standardForm.renameKey([{ fromKey: payload.from, toKey: payload.to }])
        const renameDiff = standardForm.diff(renamedStandardForm)
        if (renameDiff) {
            mergeToEdit(renameDiff)
        }
    }
}

export const receiveWMLEvent = (state: PersonalAssetsPublic, action: PayloadAction<{ assetKey: string; event: SubscriptionClientMessage }>) => {
    const { event } = action.payload
    if (event.detailType === 'Asset Update') {
        const base = new StandardForm(state.base)
        const incomingSchema = new Schema()
        incomingSchema.loadWML(event.schema)
        const incoming = new StandardForm(incomingSchema.schema[0])
        try {
            const mergedStandardizer = base.merge(incoming)
            state.base = mergedStandardizer.toJSON()
        }
        catch (err) {}
        state.pendingEdits = state.pendingEdits.filter(({ meta }) => (meta.key !== event.RequestId))
    }
    if (event.detailType === 'Merge Conflict') {
        state.pendingEdits = state.pendingEdits.filter(({ meta }) => (meta.key !== event.RequestId))
    }
}

export const saveEdit = (state: PersonalAssetsPublic, action: PayloadAction<{ requestId: string }>) => {
    state.pendingEdits = [...state.pendingEdits, { meta: { tag: 'Meta', key: action.payload.requestId, time: Date.now() }, edit: JSON.parse(JSON.stringify(state.edit)) }]
    state.edit.byId = {}
    state.edit.metaData = []
}
