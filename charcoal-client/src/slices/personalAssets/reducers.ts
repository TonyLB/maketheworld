import { PayloadAction } from '@reduxjs/toolkit'
import { PersonalAssetsPublic } from './baseClasses'
import { v4 as uuidv4 } from 'uuid'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import { StandardFormData } from '@tonylb/mtw-wml/ts/standardize/components/dataTypes'
import StandardReference from '@tonylb/mtw-wml/ts/standardize/components/reference'

export const setDraftWML = (state: PersonalAssetsPublic, newDraft: PayloadAction<{ value: string }>) => {
    state.draftWML = newDraft.payload.value
}

export const revertDraftWML = (state: PersonalAssetsPublic, _action: PayloadAction<{}>) => {
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

export type UpdateStandardPayloadUpdateLocal = {
    type: 'updateLocal';
    update: (draft: StandardForm) => StandardForm;
}

export type UpdateStandardPayloadRemoveComponent = {
    type: 'removeComponent';
    componentKey: string;
}

export type UpdateStandardPayload = UpdateStandardPayloadSetInherited | UpdateStandardPayloadUpdateComponent | UpdateStandardPayloadUpdateLocal | UpdateStandardPayloadRemoveComponent

const isUpdateStandardPayloadSetBase = (payload: UpdateStandardPayload): payload is UpdateStandardPayloadSetInherited => (payload.type === 'setInherited')
const isUpdateStandardPayloadUpdateComponent = (payload: UpdateStandardPayload): payload is UpdateStandardPayloadUpdateComponent => (payload.type === 'update')
const isUpdateStandardPayloadUpdateLocal = (payload: UpdateStandardPayload): payload is UpdateStandardPayloadUpdateLocal => (payload.type === 'updateLocal')
const isUpdateStandardPayloadRemoveComponent = (payload: UpdateStandardPayload): payload is UpdateStandardPayloadRemoveComponent => (payload.type === 'removeComponent')

export const updateStandard = (state: PersonalAssetsPublic, action: PayloadAction<UpdateStandardPayload>) => {
    const { payload } = action
    const mergeToEdit = (delta: StandardForm): void => {
        const editStandardized = new StandardForm(state.edit)
        const merged = editStandardized.merge(delta)
        // Ensure the edit has the correct universalKey from the base
        // (it may be 'ASSET#uninitialized' if never properly initialized)
        if (merged.universalKey === 'ASSET#uninitialized' && state.base.universalKey !== 'ASSET#uninitialized') {
            merged._universalKey = state.base.universalKey
        }
        state.edit = merged.toJSON()
    }
    if (isUpdateStandardPayloadSetBase(payload)) {
        state.inherited = payload.inherited
        return
    }
    const base = new StandardForm(state.base)
    const localStandardForm = state.pendingEdits.reduce<StandardForm>((previous, pendingEdit) => {
        const editStandardized = new StandardForm(pendingEdit.edit)
        return previous.merge(editStandardized)
    }, base).merge(new StandardForm(state.edit))
    const standardForm = state.inherited ? new StandardForm(state.inherited).merge(localStandardForm) : localStandardForm
    if (isUpdateStandardPayloadUpdateComponent(payload)) {
        const modified = payload.update(standardForm._clone())
        const diff = standardForm.diff(modified)
        if (diff && !diff.isEmpty()) {
            mergeToEdit(diff)
        }
    }
    if (isUpdateStandardPayloadUpdateLocal(payload)) {
        const modified = payload.update(localStandardForm._clone())
        const diff = localStandardForm.diff(modified)
        if (diff) {
            mergeToEdit(diff)
        }
    }
    if (isUpdateStandardPayloadRemoveComponent(payload)) {
        // Create a StandardReference from the componentKey (ComponentUUID string)
        const componentReference = new StandardReference(payload.componentKey)
        // Remove the component with cascade to also remove sub-components
        const componentRemoved = localStandardForm.removeComponent(componentReference, { cascade: true })
        const diff = localStandardForm.diff(componentRemoved)
        if (diff) {
            mergeToEdit(diff)
        }
    }
}

export const clearPendingEditsByRequestIds = (state: PersonalAssetsPublic, action: PayloadAction<{ assetKey: string; RequestIds: string[] }>) => {
    const { RequestIds } = action.payload
    if (!RequestIds || RequestIds.length === 0) return
    state.pendingEdits = state.pendingEdits.filter(({ meta }) => !RequestIds.includes(meta.key))
}

export const saveEdit = (state: PersonalAssetsPublic, action: PayloadAction<{ requestId: string }>) => {
    state.pendingEdits = [...state.pendingEdits, { meta: { tag: 'Meta', key: action.payload.requestId, time: Date.now() }, edit: JSON.parse(JSON.stringify(state.edit)) }]
    state.edit.components = []
    state.edit.metaData = []
    // Clear Asset-level metadata after saving to pendingEdits
    delete state.edit.shortName
    delete state.edit.summary
}
