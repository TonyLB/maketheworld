import { PayloadAction } from '@reduxjs/toolkit'
import { PersonalAssetsPublic } from './baseClasses'
import { v4 as uuidv4 } from 'uuid'
import { GenericTree, GenericTreeNode, GenericTreeNodeFiltered } from '@tonylb/mtw-base/ts/genericTree'
import { selectKeysByTag } from '@tonylb/mtw-wml/ts/schema/selectors/keysByTag'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import { Schema } from '@tonylb/mtw-wml/ts/schema'
import { unwrapSubject, wrappedNodeTypeGuard } from '@tonylb/mtw-wml/ts/schema/utils'
import { defaultComponentFromTag, EditWrappedStandardNode, isStandardCharacter, isStandardFeature, isStandardKnowledge, isStandardMap, isStandardRoom, isStandardTheme, StandardCharacter, StandardComponentData, StandardMap, StandardTheme, unwrapStandardComponent } from '@tonylb/mtw-wml/ts/standardize/baseClasses'
import { Draft, WritableDraft } from 'immer/dist/internal'
import { excludeUndefined } from '../../lib/lists'
import { listDiff } from '@tonylb/mtw-wml/ts/schema/treeManipulation/listDiff'
import { deepEqual } from '../../lib/objects'
import immerProduce from 'immer'
import { publicSelectors } from './selectors'
import { SubscriptionClientMessage } from '@tonylb/mtw-interfaces/ts/subscriptions'
import { StandardComponentNonEditData, StandardFormData } from '@tonylb/mtw-wml/ts/standardize/components/dataTypes'
import { isSchemaAsset, SchemaOutputTag, SchemaTag, SchemaWithKey } from '@tonylb/mtw-base/ts/schema'
import { isSchemaExit, isSchemaRoom, isSchemaShortName, SchemaShortNameTag } from '@tonylb/mtw-base/ts/schema/components'
import { isSchemaDescription, isSchemaName, isSchemaSummary, SchemaDescriptionTag, SchemaNameTag, SchemaSummaryTag } from '@tonylb/mtw-base/ts/schema/example'
import { isSchemaLink } from '@tonylb/mtw-base/ts/schema/renderTree'
import { standardComponentByTag } from '@tonylb/mtw-wml/ts/standardize/nonEditFactory'
import { ComponentTag } from '@tonylb/mtw-wml/ts/standardize/components/dataTypes/abstract'
import { StandardComponent } from '@tonylb/mtw-wml/ts/standardize/components/baseClasses'
import { editConverters } from '@tonylb/mtw-wml/ts/schema/converters/edit'
import StandardRoom from '@tonylb/mtw-wml/ts/standardize/components/room'
import StandardFeature from '@tonylb/mtw-wml/ts/standardize/components/feature'
import StandardKnowledge from '@tonylb/mtw-wml/ts/standardize/components/knowledge'
import { StandardRender } from '@tonylb/mtw-wml/ts/standardize/render'

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

export type UpdateStandardPayloadUpdateComponent = {
    type: 'updateComponent';
    componentKey: string;
    update: (draft: StandardComponent) => StandardComponent | undefined;
}

type UpdateStandardPayloadUpdateField = {
    type: 'updateField';
    componentKey: string;
    itemKey: string; // Needs to restrict to possible itemKeys
    value?: any
}

type UpdateStandardPayloadAddComponent = {
    type: 'addComponent';
    tag: ComponentTag;
    key?: string;
}

type UpdateStandardPayloadSpliceList = {
    type: 'spliceList';
    componentKey: string;
    itemKey: string; // Needs to restrict to possible itemKeys
    at: number;
    replace?: number;
    items: GenericTree<SchemaTag>;
    produce?: (draft: Draft<GenericTree<SchemaTag>>) => void;
}

type UpdateStandardPayloadReplaceMetaData = {
    type: 'replaceMetaData';
    metaData: GenericTree<SchemaTag>;
}

type UpdateStandardPayloadRenameKey = {
    type: 'renameKey',
    from: string;
    to: string;
}

export type UpdateStandardPayload = UpdateStandardPayloadUpdateComponent | UpdateStandardPayloadUpdateField | UpdateStandardPayloadAddComponent | UpdateStandardPayloadSpliceList | UpdateStandardPayloadReplaceMetaData | UpdateStandardPayloadRenameKey

const isUpdateStandardPayloadUpdateComponent = (payload: UpdateStandardPayload): payload is UpdateStandardPayloadUpdateComponent => (payload.type === 'updateComponent')
const isUpdateStandardPayloadUpdateField = (payload: UpdateStandardPayload): payload is UpdateStandardPayloadUpdateField => (payload.type === 'updateField')
const isUpdateStandardPayloadAddComponent = (payload: UpdateStandardPayload): payload is UpdateStandardPayloadAddComponent => (payload.type === 'addComponent')
const isUpdateStandardPayloadSpliceList = (payload: UpdateStandardPayload): payload is UpdateStandardPayloadSpliceList => (payload.type === 'spliceList')
const isUpdateStandardPayloadReplaceMetaData = (payload: UpdateStandardPayload): payload is UpdateStandardPayloadReplaceMetaData => (payload.type === 'replaceMetaData')
const isUpdateStandardPayloadRenameKey = (payload: UpdateStandardPayload): payload is UpdateStandardPayloadRenameKey => (payload.type === 'renameKey')

export const nextSyntheticKey = ({ schema, tag }: { schema: GenericTree<SchemaTag>, tag: ComponentTag | "Import" }): string => {
    const keysByTag = selectKeysByTag(tag)(schema)
    let nextIndex = 1
    while (keysByTag.includes(`${tag}${nextIndex}`)) { nextIndex++ }
    return `${tag}${nextIndex}`
}

export const updateStandard = (state: PersonalAssetsPublic, action: PayloadAction<UpdateStandardPayload>) => {
    const { payload } = action
    const standardFormData = publicSelectors.getStandardForm({ ...state, key: '' })
    const standardForm = new StandardForm(standardFormData)
    const component = isUpdateStandardPayloadUpdateField(payload) ? standardForm.byId[payload.componentKey] : undefined
    const mergeToEdit = (delta: StandardForm): void => {
        const editStandardized = new StandardForm(state.edit)
        state.edit = editStandardized.merge(delta).toJSON()
    }
    const mergeComponentToEdit = (deltaComponent: StandardComponent): void => {
        const delta = new StandardForm(state.base.key)
        delta.byId[deltaComponent.key] = deltaComponent
        mergeToEdit(delta)
    }
    if (isUpdateStandardPayloadUpdateComponent(payload)) {
        const standardForm = state.pendingEdits.reduce<StandardForm>((previous, pendingEdit) => {
            const editStandardized = new StandardForm(pendingEdit.edit)
            return previous.merge(editStandardized)
        }, new StandardForm(state.base)).merge(new StandardForm(state.edit))
        const component = standardForm.byId[payload.componentKey]
        if (component) {
            const newComponent = payload.update(component)
            if (newComponent) {
                mergeComponentToEdit(newComponent)
            }
        }
    }
    if (isUpdateStandardPayloadUpdateField(payload)) {
        switch(component?.tag) {
            case 'Action':
            case 'Variable':
            case 'Computed':
                mergeToEdit({
                    ...state.edit,
                    byId: {
                        [payload.componentKey]: {
                            tag: 'Replace',
                            key: component.key,
                            match: JSON.parse(JSON.stringify(component)),
                            payload: {
                                ...component,
                                [payload.itemKey]: payload.value
                            }
                        }
                    }
                })
                break
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
        state.edit.byId[payload.key ?? syntheticKey] = defaultComponentFromTag(payload.tag, payload.key ?? syntheticKey)
    }
    if (isUpdateStandardPayloadSpliceList(payload)) {
        const component = standardForm.byId[payload.componentKey]
        if (component?.[payload.itemKey] && Array.isArray(component[payload.itemKey])) {
            const oldList = JSON.parse(JSON.stringify(component[payload.itemKey])) as GenericTree<SchemaTag>
            const newList = payload.produce
                ? immerProduce(component[payload.itemKey], payload.produce) as unknown as GenericTree<SchemaTag>
                : [
                    ...component[payload.itemKey].slice(0, payload.at),
                    ...payload.items,
                    ...component[payload.itemKey].slice(payload.at + payload.replace)
                ]

            //
            // Compare the sublists before and after, and deduce Removes, Adds, and Replaces in
            // order.
            //
            const editChildren = listDiff(oldList, newList)
            if (editChildren.length) {
                mergeToEdit({
                    ...state.edit,
                    byId: {
                        [payload.componentKey]: {
                            ...(defaultComponentFromTag(component.tag, payload.componentKey)),
                            key: payload.componentKey,
                            tag: component.tag,
                            [payload.itemKey]: editChildren
                        } as StandardComponentData
                    }
                })
            }
        }
    }
    if (isUpdateStandardPayloadReplaceMetaData(payload)) {
        const editChildren = listDiff(standardForm.metaData, payload.metaData)
        if (editChildren.length) {
            mergeToEdit({
                ...state.edit,
                byId: {},
                metaData: editChildren
            })
        }
    }
    if (isUpdateStandardPayloadRenameKey(payload)) {
        //
        // Add a true/false return value to recursiveRenameWalk to
        // indicate whether it made a change, then use that to track at
        // each step of renaming, whether a rename has occurred and
        // add a mergeToEdit to represent the change
        //
        const recursiveRenameWalk = <T extends SchemaTag>(props: {
            tree: GenericTree<SchemaTag>;
            typeGuard: (value: SchemaTag) => value is T;
            transform: (value: WritableDraft<T>) => void;
        }): { changed: Boolean, tree: GenericTree<SchemaTag> } => {
            const { tree, typeGuard, transform } = props
            return tree.reduce<{ changed: Boolean; tree: GenericTree<SchemaTag> }>((previous, { data, children }) => {
                const recurse = recursiveRenameWalk({ tree: children, typeGuard, transform })
                const transformedData = typeGuard(data) ? immerProduce(data, transform) : data
                return {
                    changed: previous.changed || !deepEqual(data, transformedData) || recurse.changed,
                    tree: [...previous.tree, { data: transformedData, children: recurse.tree }]
                }
            }, { changed: false, tree: [] })
        }
        const previousComponent = JSON.parse(JSON.stringify(standardForm.byId[payload.from]))
        const newComponent: StandardComponentData = {
            ...JSON.parse(JSON.stringify(standardForm.byId[payload.from])),
            key: payload.to
        }
        const renameEditStandard: StandardFormData = {
            ...state.edit,
            byId: {
                [payload.from]: {
                    tag: 'Remove' as const,
                    key: previousComponent.key,
                    component: unwrapStandardComponent(previousComponent)
                },
                [payload.to]: newComponent
            },
            metaData: []
        }
        mergeToEdit(renameEditStandard)
        const renamedStandardForm = publicSelectors.getStandardForm({ ...state, key: '' })
        Object.values(renamedStandardForm.byId).filter(excludeUndefined).forEach((component) => {
            if (isStandardFeature(component) || isStandardKnowledge(component)) {
                //
                // Recursive transform links
                //
                if (component.description) {
                    const { changed, tree: newDescription } = recursiveRenameWalk({
                        tree: [component.description],
                        typeGuard: isSchemaLink,
                        transform: (link) => {
                            if (link.to === payload.from) {
                                link.to = payload.to
                            }
                        }
                    })
                    if (changed) {
                        updateStandard(
                            state,
                            {
                                type: 'updateStandard',
                                payload: {
                                    type: 'updateComponent',
                                    componentKey: component.key,
                                    update: (draft) => {
                                        const base = draft.clone()
                                        if (base instanceof StandardFeature || base instanceof StandardKnowledge) {
                                            base._payload._description = new StandardRender(newDescription[0])
                                        }
                                        return base
                                    }
                                }
                            }
                        )
                    }
                }
            }
            if (isStandardRoom(component)) {
                //
                // Recursive transform exits
                //
                const { changed, tree: newExits } = recursiveRenameWalk({
                    tree: component.exits,
                    typeGuard: isSchemaExit,
                    transform: (exit) => {
                        exit.to = exit.to === payload.from ? payload.to : exit.to
                        exit.from = exit.from === payload.from ? payload.to : exit.from
                        exit.key = `${exit.from}:${exit.to}`
                    }
                })
                if (changed) {
                    updateStandard(state, { type: 'updateStandard', payload: { type: 'spliceList', componentKey: component.key, itemKey: 'exits', at: 0, replace: component.exits.length, items: newExits } })
                }
                //
                // Recursive transform links
                //
                if (component.description) {
                    const { changed, tree: newDescription } = recursiveRenameWalk({
                        tree: [component.description],
                        typeGuard: isSchemaLink,
                        transform: (link) => {
                            if (link.to === payload.from) {
                                link.to = payload.to
                            }
                        }
                    })
                    if (changed) {
                        updateStandard(
                            state,
                            {
                                type: 'updateStandard',
                                payload: {
                                    type: 'updateComponent',
                                    componentKey: component.key,
                                    update: (draft) => {
                                        const base = draft.clone()
                                        if (base instanceof StandardRoom) {
                                            base._payload._description = new StandardRender(newDescription[0])
                                        }
                                        return base
                                    }
                                }
                            }
                        )
                    }
                }
                if (component.summary) {
                    const { changed, tree: newSummary } = recursiveRenameWalk({
                        tree: [component.summary],
                        typeGuard: isSchemaLink,
                        transform: (link) => {
                            if (link.to === payload.from) {
                                link.to = payload.to
                            }
                        }
                    })
                    if (changed) {
                        updateStandard(
                            state,
                            {
                                type: 'updateStandard',
                                payload: {
                                    type: 'updateComponent',
                                    componentKey: component.key,
                                    update: (draft) => {
                                        const base = draft.clone()
                                        if (base instanceof StandardRoom) {
                                            base._payload._summary = new StandardRender(newSummary[0])
                                        }
                                        return base
                                    }
                                }
                            }
                        )
                    }
                }
            }
            if (isStandardMap(component)) {
                //
                // Recursive transform positions
                //
                const { changed, tree: newPositions } = recursiveRenameWalk({
                    tree: component.positions,
                    typeGuard: isSchemaRoom,
                    transform: (room) => {
                        if (room.key === payload.from) {
                            room.key = payload.to
                        }
                    }
                })
                if (changed) {
                    updateStandard(state, { type: 'updateStandard', payload: { type: 'spliceList', componentKey: component.key, itemKey: 'positions', at: 0, replace: component.positions.length, items: newPositions } })
                }
            }
        })
    }
}

export const setImport = (state: PersonalAssetsPublic, action: PayloadAction<{ assetKey: string; schema: GenericTree<SchemaTag> }>) => {
    state.importData[action.payload.assetKey] = action.payload.schema
    const baseKey = state.base.key
    const standardized = new StandardForm(state.base)
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
    importsStandardized._metaData = standardized.metaData
    state.inherited = importsStandardized.toJSON()
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
