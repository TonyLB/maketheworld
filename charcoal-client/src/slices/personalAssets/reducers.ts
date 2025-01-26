import { PayloadAction } from '@reduxjs/toolkit'
import { PersonalAssetsPublic } from './baseClasses'
import { v4 as uuidv4 } from 'uuid'
import { GenericTree } from '@tonylb/mtw-base/ts/genericTree'
import { selectKeysByTag } from '@tonylb/mtw-wml/ts/schema/selectors/keysByTag'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import { Schema } from '@tonylb/mtw-wml/ts/schema'
import { defaultComponentFromTag, isStandardFeature, isStandardKnowledge, isStandardMap, isStandardRoom, StandardComponentData, unwrapStandardComponent } from '@tonylb/mtw-wml/ts/standardize/baseClasses'
import { Draft, WritableDraft } from 'immer/dist/internal'
import { excludeUndefined } from '../../lib/lists'
import { listDiff } from '@tonylb/mtw-wml/ts/schema/treeManipulation/listDiff'
import { deepEqual } from '../../lib/objects'
import immerProduce from 'immer'
import { publicSelectors } from './selectors'
import { SubscriptionClientMessage } from '@tonylb/mtw-interfaces/ts/subscriptions'
import { StandardFormData } from '@tonylb/mtw-wml/ts/standardize/components/dataTypes'
import { isSchemaAsset, SchemaTag } from '@tonylb/mtw-base/ts/schema'
import { isSchemaExit, isSchemaRoom } from '@tonylb/mtw-base/ts/schema/components'
import { isSchemaLink } from '@tonylb/mtw-base/ts/schema/renderTree'
import { ComponentTag } from '@tonylb/mtw-wml/ts/standardize/components/dataTypes/abstract'
import { StandardComponent } from '@tonylb/mtw-wml/ts/standardize/components/baseClasses'
import StandardRoom from '@tonylb/mtw-wml/ts/standardize/components/room'
import StandardFeature from '@tonylb/mtw-wml/ts/standardize/components/feature'
import StandardKnowledge from '@tonylb/mtw-wml/ts/standardize/components/knowledge'
import { StandardRender } from '@tonylb/mtw-wml/ts/standardize/render'
import { StandardRemove } from '@tonylb/mtw-wml/ts/standardize/components/edits'
import { StandardComponentImportPayload } from '@tonylb/mtw-wml/ts/standardize/components/dataTypes/metaData'
import { standardComponentByTag } from '@tonylb/mtw-wml/ts/standardize/nonEditFactory'
import { ImportItemContent } from '@tonylb/mtw-wml/ts/standardize/components/metaData'

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

type UpdateStandardPayloadAddComponent = {
    type: 'addComponent';
    tag: ComponentTag;
    key?: string;
    import?: StandardComponentImportPayload;
}

type UpdateStandardPayloadRenameKey = {
    type: 'renameKey',
    from: string;
    to: string;
}

export type UpdateStandardPayload = UpdateStandardPayloadSetInherited | UpdateStandardPayloadUpdateComponent | UpdateStandardPayloadRemoveComponent | UpdateStandardPayloadAddComponent | UpdateStandardPayloadRenameKey

const isUpdateStandardPayloadSetBase = (payload: UpdateStandardPayload): payload is UpdateStandardPayloadSetInherited => (payload.type === 'setInherited')
const isUpdateStandardPayloadUpdateComponent = (payload: UpdateStandardPayload): payload is UpdateStandardPayloadUpdateComponent => (payload.type === 'update')
const isUpdateStandardPayloadRemoveComponent = (payload: UpdateStandardPayload): payload is UpdateStandardPayloadRemoveComponent => (payload.type === 'removeComponent')
const isUpdateStandardPayloadAddComponent = (payload: UpdateStandardPayload): payload is UpdateStandardPayloadAddComponent => (payload.type === 'addComponent')
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
    const mergeComponentToEdit = (key: string, deltaComponent: StandardComponent | undefined): void => {
        const modified = standardForm._clone()
        if (deltaComponent) {
            modified._byId[key] = deltaComponent
        }
        else {
            delete modified._byId[key]
        }
        mergeToEdit(standardForm.diff(modified))
    }
    if (isUpdateStandardPayloadUpdateComponent(payload)) {
        const modified = payload.update(standardForm._clone())
        const diff = standardForm.diff(modified)
        if (diff) {
            mergeToEdit(diff)
        }
    }
    if (isUpdateStandardPayloadAddComponent(payload)) {
        //
        // Create a next synthetic key that doesn't conflict with the existing standardForm
        //
        const keysByTag = Object.entries(standardForm.byId).filter(([_, node]) => (node.tag === payload.tag)).map(([key]) => (key))
        let nextIndex = 1
        while (keysByTag.includes(`${payload.tag}${nextIndex}`)) { nextIndex++ }

        const syntheticKey = `${payload.tag}${nextIndex}`

        //
        // Add a default component
        //
        const component = standardComponentByTag(payload.tag, payload.key ?? syntheticKey)
        if (component) {
            mergeComponentToEdit(syntheticKey, payload.import
                ? component.withImport(new ImportItemContent(payload.import.fromKey, payload.import.assetId).toJSON())
                : component
            )
        }
        else {
            throw new Error(`Could not create component of tag ${payload.tag}`)
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
        // //
        // // Add a true/false return value to recursiveRenameWalk to
        // // indicate whether it made a change, then use that to track at
        // // each step of renaming, whether a rename has occurred and
        // // add a mergeToEdit to represent the change
        // //
        // const recursiveRenameWalk = <T extends SchemaTag>(props: {
        //     tree: GenericTree<SchemaTag>;
        //     typeGuard: (value: SchemaTag) => value is T;
        //     transform: (value: WritableDraft<T>) => void;
        // }): { changed: Boolean, tree: GenericTree<SchemaTag> } => {
        //     const { tree, typeGuard, transform } = props
        //     return tree.reduce<{ changed: Boolean; tree: GenericTree<SchemaTag> }>((previous, { data, children }) => {
        //         const recurse = recursiveRenameWalk({ tree: children, typeGuard, transform })
        //         const transformedData = typeGuard(data) ? immerProduce(data, transform) : data
        //         return {
        //             changed: previous.changed || !deepEqual(data, transformedData) || recurse.changed,
        //             tree: [...previous.tree, { data: transformedData, children: recurse.tree }]
        //         }
        //     }, { changed: false, tree: [] })
        // }
        // const previousComponent = JSON.parse(JSON.stringify(standardForm.byId[payload.from]))
        // const newComponent: StandardComponentData = {
        //     ...JSON.parse(JSON.stringify(standardForm.byId[payload.from])),
        //     key: payload.to
        // }
        // const renameEditStandard: StandardFormData = {
        //     ...state.edit,
        //     byId: {
        //         [payload.from]: {
        //             tag: 'Remove' as const,
        //             key: previousComponent.key,
        //             component: unwrapStandardComponent(previousComponent)
        //         },
        //         [payload.to]: newComponent
        //     },
        //     metaData: []
        // }
        // mergeToEdit(renameEditStandard)
        // const renamedStandardForm = publicSelectors.getStandardForm({ ...state, key: '' })
        // Object.values(renamedStandardForm.byId).filter(excludeUndefined).forEach((component) => {
        //     if (isStandardFeature(component) || isStandardKnowledge(component)) {
        //         //
        //         // Recursive transform links
        //         //
        //         if (component.description) {
        //             const { changed, tree: newDescription } = recursiveRenameWalk({
        //                 tree: [component.description],
        //                 typeGuard: isSchemaLink,
        //                 transform: (link) => {
        //                     if (link.to === payload.from) {
        //                         link.to = payload.to
        //                     }
        //                 }
        //             })
        //             if (changed) {
        //                 updateStandard(
        //                     state,
        //                     {
        //                         type: 'updateStandard',
        //                         payload: {
        //                             type: 'updateComponent',
        //                             componentKey: component.key,
        //                             update: (draft) => {
        //                                 const base = draft.clone()
        //                                 if (base instanceof StandardFeature || base instanceof StandardKnowledge) {
        //                                     base._payload._description = new StandardRender(newDescription[0])
        //                                 }
        //                                 return base
        //                             }
        //                         }
        //                     }
        //                 )
        //             }
        //         }
        //     }
        //     if (isStandardRoom(component)) {
        //         //
        //         // Recursive transform exits
        //         //
        //         const { changed, tree: newExits } = recursiveRenameWalk({
        //             tree: component.exits,
        //             typeGuard: isSchemaExit,
        //             transform: (exit) => {
        //                 exit.to = exit.to === payload.from ? payload.to : exit.to
        //                 exit.from = exit.from === payload.from ? payload.to : exit.from
        //                 exit.key = `${exit.from}:${exit.to}`
        //             }
        //         })
        //         if (changed) {
        //             updateStandard(state, { type: 'updateStandard', payload: { type: 'spliceList', componentKey: component.key, itemKey: 'exits', at: 0, replace: component.exits.length, items: newExits } })
        //         }
        //         //
        //         // Recursive transform links
        //         //
        //         if (component.description) {
        //             const { changed, tree: newDescription } = recursiveRenameWalk({
        //                 tree: [component.description],
        //                 typeGuard: isSchemaLink,
        //                 transform: (link) => {
        //                     if (link.to === payload.from) {
        //                         link.to = payload.to
        //                     }
        //                 }
        //             })
        //             if (changed) {
        //                 updateStandard(
        //                     state,
        //                     {
        //                         type: 'updateStandard',
        //                         payload: {
        //                             type: 'updateComponent',
        //                             componentKey: component.key,
        //                             update: (draft) => {
        //                                 const base = draft.clone()
        //                                 if (base instanceof StandardRoom) {
        //                                     base._payload._description = new StandardRender(newDescription[0])
        //                                 }
        //                                 return base
        //                             }
        //                         }
        //                     }
        //                 )
        //             }
        //         }
        //         if (component.summary) {
        //             const { changed, tree: newSummary } = recursiveRenameWalk({
        //                 tree: [component.summary],
        //                 typeGuard: isSchemaLink,
        //                 transform: (link) => {
        //                     if (link.to === payload.from) {
        //                         link.to = payload.to
        //                     }
        //                 }
        //             })
        //             if (changed) {
        //                 updateStandard(
        //                     state,
        //                     {
        //                         type: 'updateStandard',
        //                         payload: {
        //                             type: 'updateComponent',
        //                             componentKey: component.key,
        //                             update: (draft) => {
        //                                 const base = draft.clone()
        //                                 if (base instanceof StandardRoom) {
        //                                     base._payload._summary = new StandardRender(newSummary[0])
        //                                 }
        //                                 return base
        //                             }
        //                         }
        //                     }
        //                 )
        //             }
        //         }
        //     }
        //     if (isStandardMap(component)) {
        //         //
        //         // Recursive transform positions
        //         //
        //         const { changed, tree: newPositions } = recursiveRenameWalk({
        //             tree: component.positions,
        //             typeGuard: isSchemaRoom,
        //             transform: (room) => {
        //                 if (room.key === payload.from) {
        //                     room.key = payload.to
        //                 }
        //             }
        //         })
        //         if (changed) {
        //             updateStandard(state, { type: 'updateStandard', payload: { type: 'spliceList', componentKey: component.key, itemKey: 'positions', at: 0, replace: component.positions.length, items: newPositions } })
        //         }
        //     }
        // })
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
