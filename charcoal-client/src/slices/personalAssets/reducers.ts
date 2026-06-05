import { PayloadAction } from '@reduxjs/toolkit'
import { PersonalAssetsPublic } from './baseClasses'
import { v4 as uuidv4 } from 'uuid'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import { StandardFormData } from '@tonylb/mtw-wml/ts/standardize/components/dataTypes'
import StandardReference from '@tonylb/mtw-wml/ts/standardize/components/reference'
import type { ScopedInstrumentationOptions } from '../../testing/scopedInstrumentation'
import { unique } from '../../lib/lists'

export const setLoadedImage = (state: PersonalAssetsPublic, action: PayloadAction<{ itemId: string; file: File }>) => {
    state.loadedImages[action.payload.itemId] = {
        loadId: uuidv4(),
        file: action.payload.file
    }
}

export type UpdateStandardPayloadSetInherited = {
    type: 'setInherited';
    inherited: StandardFormData;
    base?: StandardFormData;
    options?: ScopedInstrumentationOptions;
}

export type UpdateStandardPayloadUpdateComponent = {
    type: 'update';
    update: (draft: StandardForm) => StandardForm;
    base?: StandardFormData;
    options?: ScopedInstrumentationOptions;
}

export type UpdateStandardPayloadUpdateLocal = {
    type: 'updateLocal';
    update: (draft: StandardForm) => StandardForm;
    base?: StandardFormData;
    options?: ScopedInstrumentationOptions;
}

export type UpdateStandardPayloadRemoveComponent = {
    type: 'removeComponent';
    componentKey: string;
    /** When false, implicit descendants are rehomed (bodies remain). Default true. */
    cascade?: boolean;
    base?: StandardFormData;
    options?: ScopedInstrumentationOptions;
}

export type UpdateStandardPayload = UpdateStandardPayloadSetInherited | UpdateStandardPayloadUpdateComponent | UpdateStandardPayloadUpdateLocal | UpdateStandardPayloadRemoveComponent

const isUpdateStandardPayloadSetBase = (payload: UpdateStandardPayload): payload is UpdateStandardPayloadSetInherited => (payload.type === 'setInherited')
const isUpdateStandardPayloadUpdateComponent = (payload: UpdateStandardPayload): payload is UpdateStandardPayloadUpdateComponent => (payload.type === 'update')
const isUpdateStandardPayloadUpdateLocal = (payload: UpdateStandardPayload): payload is UpdateStandardPayloadUpdateLocal => (payload.type === 'updateLocal')
const isUpdateStandardPayloadRemoveComponent = (payload: UpdateStandardPayload): payload is UpdateStandardPayloadRemoveComponent => (payload.type === 'removeComponent')

const EMPTY_BASE: StandardFormData = { universalKey: 'ASSET#uninitialized', components: [], metaData: [] }

function mergeInstrumentationOptions(
    existing: ScopedInstrumentationOptions | undefined,
    incoming: ScopedInstrumentationOptions
): ScopedInstrumentationOptions {
    const existingList = existing?.instrumentation ?? []
    const incomingList = incoming?.instrumentation ?? []
    const merged = unique(existingList, incomingList)
    return merged.length ? { instrumentation: merged } : {}
}

export const updateStandard = (state: PersonalAssetsPublic, action: PayloadAction<UpdateStandardPayload>) => {
    const { payload } = action
    if (payload.options?.instrumentation?.length) {
        state.instrumentationOptionsForCurrentEdit = mergeInstrumentationOptions(state.instrumentationOptionsForCurrentEdit, payload.options)
    }
    const baseData = payload.base ?? EMPTY_BASE
    const mergeToEdit = (delta: StandardForm): void => {
        const editStandardized = new StandardForm(state.edit)
        const merged = editStandardized.merge(delta)
        // Ensure the edit has the correct universalKey from the base
        // (it may be 'ASSET#uninitialized' if never properly initialized)
        if (merged.universalKey === 'ASSET#uninitialized' && baseData.universalKey !== 'ASSET#uninitialized') {
            merged._universalKey = baseData.universalKey
        }
        state.edit = merged.toJSON()
    }
    if (isUpdateStandardPayloadSetBase(payload)) {
        state.inherited = payload.inherited
        return
    }
    const base = new StandardForm(baseData)
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
            state.lastUpdateDiff = diff.toJSON()
        }
    }
    if (isUpdateStandardPayloadUpdateLocal(payload)) {
        const modified = payload.update(localStandardForm._clone())
        const diff = localStandardForm.diff(modified)
        if (diff) {
            mergeToEdit(diff)
            state.lastUpdateDiff = diff.toJSON()
        }
    }
    if (isUpdateStandardPayloadRemoveComponent(payload)) {
        // Create a StandardReference from the componentKey (ComponentUUID string)
        const componentReference = new StandardReference(payload.componentKey)
        // Remove the component with cascade to also remove sub-components
        const componentRemoved = localStandardForm.removeComponent(componentReference, {
            cascade: payload.cascade ?? true
        })
        const diff = localStandardForm.diff(componentRemoved)
        if (diff) {
            mergeToEdit(diff)
            state.lastUpdateDiff = diff.toJSON()
        }
    }
}

export const clearPendingEditsByRequestIds = (state: PersonalAssetsPublic, action: PayloadAction<{ assetKey: string; RequestIds: string[] }>) => {
    const { RequestIds } = action.payload
    if (!RequestIds || RequestIds.length === 0) return
    state.pendingEdits = state.pendingEdits.filter(({ meta }) => !RequestIds.includes(meta.key))
}

export const clearLastUpdateDiff = (state: PersonalAssetsPublic, _action: PayloadAction<void>) => {
    state.lastUpdateDiff = undefined
}

export const saveEdit = (state: PersonalAssetsPublic, action: PayloadAction<{ requestId: string }>) => {
    const instrumentationOptions = state.instrumentationOptionsForCurrentEdit
    // Invoked before applyEdit send (optimistic pending); stream clearPending matches meta.key.
    state.pendingEdits = [
        ...state.pendingEdits,
        {
            meta: {
                key: action.payload.requestId,
                time: Date.now(),
                ...(instrumentationOptions?.instrumentation?.length ? { instrumentationOptions } : {})
            },
            edit: JSON.parse(JSON.stringify(state.edit))
        }
    ]
    state.edit.components = []
    state.edit.metaData = []
    // Clear Asset-level metadata after saving to pendingEdits
    delete state.edit.shortName
    delete state.edit.summary
    delete state.instrumentationOptionsForCurrentEdit
}

/** Roll back optimistic pending when applyEdit fails; no-op if stream already cleared the row. */
export const revertSaveEdit = (state: PersonalAssetsPublic, action: PayloadAction<{ requestId: string }>) => {
    const index = state.pendingEdits.findIndex(({ meta }) => meta.key === action.payload.requestId)
    if (index === -1) {
        return
    }
    const snapshot = state.pendingEdits[index].edit
    state.pendingEdits = state.pendingEdits.filter(({ meta }) => meta.key !== action.payload.requestId)
    const editForm = new StandardForm(state.edit)
    state.edit = editForm.merge(new StandardForm(snapshot)).toJSON()
}
