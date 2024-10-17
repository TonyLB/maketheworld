import { PayloadAction } from '@reduxjs/toolkit'
import { PersonalAssetsPublic } from './baseClasses'
import { v4 as uuidv4 } from 'uuid'
import { SchemaDescriptionTag, SchemaNameTag, SchemaOutputTag, SchemaRoomTag, SchemaShortNameTag, SchemaSummaryTag, SchemaTag, SchemaWithKey, isSchemaAsset, isSchemaDescription, isSchemaExit, isSchemaLink, isSchemaName, isSchemaRoom, isSchemaShortName, isSchemaSummary } from '@tonylb/mtw-wml/dist/schema/baseClasses'
import { GenericTree, GenericTreeNode, GenericTreeNodeFiltered } from '@tonylb/mtw-wml/dist/tree/baseClasses'
import { selectKeysByTag } from '@tonylb/mtw-wml/dist/schema/selectors/keysByTag'
import { Standardizer } from '@tonylb/mtw-wml/dist/standardize'
import { Schema } from '@tonylb/mtw-wml/dist/schema'
import { unwrapSubject, wrappedNodeTypeGuard } from '@tonylb/mtw-wml/dist/schema/utils'
import { EditWrappedStandardNode, isStandardFeature, isStandardKnowledge, isStandardMap, isStandardRoom, StandardCharacter, StandardComponent, StandardFeature, StandardForm, StandardKnowledge, StandardMap, StandardRoom, StandardTheme, unwrapStandardComponent } from '@tonylb/mtw-wml/dist/standardize/baseClasses'
import { Draft, WritableDraft } from 'immer/dist/internal'
import { excludeUndefined } from '../../lib/lists'
import { listDiff } from '@tonylb/mtw-wml/dist/schema/treeManipulation/listDiff'
import { deepEqual } from '../../lib/objects'
import immerProduce from 'immer'
import { publicSelectors } from './selectors'
import { SubscriptionClientMessage } from '@tonylb/mtw-interfaces/dist/subscriptions'

export const setCurrentWML = (state: PersonalAssetsPublic, newCurrent: PayloadAction<{ value: string }>) => {
    state.currentWML = newCurrent.payload.value
    state.draftWML = undefined
    const schema = new Schema()
    schema.loadWML(newCurrent.payload.value)
    const standardizer = new Standardizer(schema.schema)
    state.base = standardizer.standardForm
    const baseKey = standardizer.standardForm.key
    const importsStandardizer = new Standardizer(
        ...Object.values(state.importData)
            .map((tree) => (
                tree.length === 1 && isSchemaAsset(tree[0].data)
                    ? [{ ...tree[0], data: { ...tree[0].data, key: baseKey }}]
                    : []
            ))
            .filter((tree) => (tree.length))
    )
    importsStandardizer.loadStandardForm({
        byId: importsStandardizer._byId,
        key: baseKey,
        tag: 'Asset',
        metaData: standardizer.metaData
    })
    const inheritedStandardizer = importsStandardizer.prune({ match: 'Inherited' })
    state.inherited = inheritedStandardizer.standardForm
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

export type UpdateStandardPayloadReplaceItem = {
    type: 'replaceItem';
    componentKey: string;
    itemKey: string; // Needs to restrict to possible itemKeys
    item?: GenericTreeNode<SchemaTag>
    produce?: (draft: Draft<GenericTreeNode<SchemaTag>>) => void;
}

type UpdateStandardPayloadUpdateField = {
    type: 'updateField';
    componentKey: string;
    itemKey: string; // Needs to restrict to possible itemKeys
    value?: any
}

type UpdateStandardPayloadAddComponent = {
    type: 'addComponent';
    tag: SchemaWithKey["tag"];
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

export type UpdateStandardPayload = UpdateStandardPayloadReplaceItem | UpdateStandardPayloadUpdateField | UpdateStandardPayloadAddComponent | UpdateStandardPayloadSpliceList | UpdateStandardPayloadReplaceMetaData | UpdateStandardPayloadRenameKey

const isUpdateStandardPayloadReplaceItem = (payload: UpdateStandardPayload): payload is UpdateStandardPayloadReplaceItem => (payload.type === 'replaceItem')
const isUpdateStandardPayloadUpdateField = (payload: UpdateStandardPayload): payload is UpdateStandardPayloadUpdateField => (payload.type === 'updateField')
const isUpdateStandardPayloadAddComponent = (payload: UpdateStandardPayload): payload is UpdateStandardPayloadAddComponent => (payload.type === 'addComponent')
const isUpdateStandardPayloadSpliceList = (payload: UpdateStandardPayload): payload is UpdateStandardPayloadSpliceList => (payload.type === 'spliceList')
const isUpdateStandardPayloadReplaceMetaData = (payload: UpdateStandardPayload): payload is UpdateStandardPayloadReplaceMetaData => (payload.type === 'replaceMetaData')
const isUpdateStandardPayloadRenameKey = (payload: UpdateStandardPayload): payload is UpdateStandardPayloadRenameKey => (payload.type === 'renameKey')

export const nextSyntheticKey = ({ schema, tag }: { schema: GenericTree<SchemaTag>, tag: SchemaWithKey["tag"] }): string => {
    const keysByTag = selectKeysByTag(tag)(schema)
    let nextIndex = 1
    while (keysByTag.includes(`${tag}${nextIndex}`)) { nextIndex++ }
    return `${tag}${nextIndex}`
}

const defaultComponentFromTag = (tag: SchemaTag["tag"], key: string): StandardComponent => {
    switch(tag) {
        case 'Room':
            return {
                tag,
                key,
                exits: [],
                themes: []
            }
        case 'Feature':
        case 'Knowledge':
            return {
                tag,
                key,
            }
        case 'Image':
            return {
                tag: 'Image' as const,
                key,
            }
        case 'Variable':
            return {
                tag: 'Variable' as const,
                key,
                default: 'false',
            }
        case 'Computed':
            return {
                tag: 'Computed' as const,
                key,
                src: '',
            }
        case 'Action':
            return {
                tag: 'Action' as const,
                key,
                src: '',
            }
        case 'Map':
            return {
                tag: 'Map' as const,
                key,
                themes: [],
                images: [],
                positions: [],
            }
        case 'Theme':
            return {
                tag: 'Theme' as const,
                key,
                prompts: [],
                rooms: [],
                maps: [],
            }
        default:
            throw new Error(`No default component for tag: '${tag}'`)
    }
}

export const updateStandard = (state: PersonalAssetsPublic, action: PayloadAction<UpdateStandardPayload>) => {
    const { payload } = action
    const standardForm = publicSelectors.getStandardForm({ ...state, key: '' })
    const component = (isUpdateStandardPayloadReplaceItem(payload) || isUpdateStandardPayloadUpdateField(payload)) ? standardForm.byId[payload.componentKey] : undefined
    const mergeToEdit = (delta: StandardForm): void => {
        const editStandardizer = new Standardizer()
        const deltaStandardizer = new Standardizer()
        editStandardizer.loadStandardForm(state.edit)
        deltaStandardizer.loadStandardForm(delta)
        const mergedStandardizer = editStandardizer.merge(deltaStandardizer)
        state.edit = mergedStandardizer.standardForm
    }
    const mergeFieldToEdit = <T extends StandardComponent, K extends keyof T>({ componentKey, tag, key, oldValue, newValue }: {
        componentKey: string; tag: T["tag"], key: K, oldValue: T[K]; newValue: T[K];
    }) => {
        mergeToEdit({
            ...state.edit,
            byId: {
                [componentKey]: {
                    ...(defaultComponentFromTag(tag, componentKey) as T),
                    key: componentKey,
                    tag,
                    [key]: newValue
                        ? oldValue
                            ? { data: { tag: 'Replace' }, children: [
                                { data: { tag: 'ReplaceMatch' }, children: [oldValue].filter(excludeUndefined) },
                                { data: { tag: 'ReplacePayload' }, children: [unwrapSubject(newValue as GenericTreeNode<SchemaTag>) as GenericTreeNodeFiltered<T, SchemaOutputTag>] }
                            ]}
                            : newValue
                        : oldValue
                            ? {
                                data: { tag: 'Remove' },
                                children: [oldValue]
                            }
                            : undefined
                } as StandardComponent
            }
        })
    }
    if (isUpdateStandardPayloadReplaceItem(payload)) {
        const produce = payload.produce
        const item = payload.item
        switch(component?.tag) {
            case 'Room':
                switch(payload.itemKey) {
                    case 'shortName':
                        const oldShortName = component.shortName ? JSON.parse(JSON.stringify(unwrapSubject(component.shortName))) as GenericTreeNodeFiltered<SchemaShortNameTag, SchemaOutputTag> : undefined
                        const newShortName = produce
                            ? immerProduce(component.shortName, produce) : 
                            item && wrappedNodeTypeGuard(isSchemaShortName)(item)
                                ? item as unknown as EditWrappedStandardNode<SchemaShortNameTag, SchemaOutputTag> | undefined
                                : undefined
                        mergeFieldToEdit<StandardRoom, "shortName">({
                            componentKey: component.key,
                            tag: 'Room',
                            key: 'shortName',
                            oldValue: oldShortName,
                            newValue: newShortName
                        })
                        break
                    case 'name':
                        const oldName = component.name ? JSON.parse(JSON.stringify(unwrapSubject(component.name))) as GenericTreeNodeFiltered<SchemaNameTag, SchemaOutputTag> : undefined
                        const newName = produce
                            ? immerProduce(component.name, produce) : 
                            item && wrappedNodeTypeGuard(isSchemaName)(item)
                                ? item as unknown as EditWrappedStandardNode<SchemaNameTag, SchemaOutputTag> | undefined
                                : undefined
                        mergeFieldToEdit<StandardRoom, "name">({
                            componentKey: component.key,
                            tag: 'Room',
                            key: 'name',
                            oldValue: oldName,
                            newValue: newName
                        })
                        break
                    case 'summary':
                        const oldSummary = component.summary ? JSON.parse(JSON.stringify(unwrapSubject(component.summary))) as GenericTreeNodeFiltered<SchemaSummaryTag, SchemaOutputTag> : undefined
                        const newSummary = produce
                            ? immerProduce(component.summary, produce) : 
                            item && wrappedNodeTypeGuard(isSchemaSummary)(item)
                                ? item as unknown as EditWrappedStandardNode<SchemaSummaryTag, SchemaOutputTag> | undefined
                                : undefined
                        mergeFieldToEdit<StandardRoom, "summary">({
                            componentKey: component.key,
                            tag: 'Room',
                            key: 'summary',
                            oldValue: oldSummary,
                            newValue: newSummary
                        })
                        break
                    case 'description':
                        const oldDescription = component.description ? JSON.parse(JSON.stringify(unwrapSubject(component.description))) as GenericTreeNodeFiltered<SchemaDescriptionTag, SchemaOutputTag> : undefined
                        const newDescription = produce
                            ? immerProduce(component.description, produce) : 
                            item && wrappedNodeTypeGuard(isSchemaDescription)(item)
                                ? item as unknown as EditWrappedStandardNode<SchemaDescriptionTag, SchemaOutputTag> | undefined
                                : undefined
                        mergeFieldToEdit<StandardRoom, "description">({
                            componentKey: component.key,
                            tag: 'Room',
                            key: 'description',
                            oldValue: oldDescription,
                            newValue: newDescription
                        })
                        break
                }
                break
            case 'Feature':
            case 'Knowledge':
                switch(payload.itemKey) {
                    case 'name':
                        const oldName = component.name ? JSON.parse(JSON.stringify(unwrapSubject(component.name))) as GenericTreeNodeFiltered<SchemaNameTag, SchemaOutputTag> : undefined
                        const newName = produce
                            ? immerProduce(component.name, produce) : 
                            item && wrappedNodeTypeGuard(isSchemaName)(item)
                                ? item as unknown as EditWrappedStandardNode<SchemaNameTag, SchemaOutputTag> | undefined
                                : undefined
                        mergeFieldToEdit<StandardFeature | StandardKnowledge, "name">({
                            componentKey: component.key,
                            tag: component?.tag,
                            key: 'name',
                            oldValue: oldName,
                            newValue: newName
                        })
                        break
                    case 'description':
                        const oldDescription = component.description ? JSON.parse(JSON.stringify(unwrapSubject(component.description))) as GenericTreeNodeFiltered<SchemaDescriptionTag, SchemaOutputTag> : undefined
                        const newDescription = produce
                            ? immerProduce(component.description, produce) : 
                            item && wrappedNodeTypeGuard(isSchemaDescription)(item)
                                ? item as unknown as EditWrappedStandardNode<SchemaDescriptionTag, SchemaOutputTag> | undefined
                                : undefined
                        mergeFieldToEdit<StandardFeature | StandardKnowledge, "description">({
                            componentKey: component.key,
                            tag: component?.tag,
                            key: 'description',
                            oldValue: oldDescription,
                            newValue: newDescription
                        })
                        break
                }
                break
            case 'Map':
            case 'Character':
                switch(payload.itemKey) {
                    case 'name':
                        const oldName = component.name ? JSON.parse(JSON.stringify(unwrapSubject(component.name))) as GenericTreeNodeFiltered<SchemaNameTag, SchemaOutputTag> : undefined
                        const newName = produce
                            ? immerProduce(component.name, produce) : 
                            item && wrappedNodeTypeGuard(isSchemaName)(item)
                                ? item as unknown as EditWrappedStandardNode<SchemaNameTag, SchemaOutputTag> | undefined
                                : undefined
                        mergeFieldToEdit<StandardMap | StandardCharacter, "name">({
                            componentKey: component.key,
                            tag: component?.tag,
                            key: 'name',
                            oldValue: oldName,
                            newValue: newName
                        })
                        break
                }
                break
            case 'Theme':
                switch(payload.itemKey) {
                    case 'name':
                        const oldName = component.name ? JSON.parse(JSON.stringify(unwrapSubject(component.name))) as GenericTreeNodeFiltered<SchemaNameTag, SchemaOutputTag> : undefined
                        const newName = produce
                            ? immerProduce(component.name, produce) : 
                            item && wrappedNodeTypeGuard(isSchemaName)(item)
                                ? item as unknown as EditWrappedStandardNode<SchemaNameTag, SchemaOutputTag> | undefined
                                : undefined
                        mergeFieldToEdit<StandardTheme, "name">({
                            componentKey: component.key,
                            tag: component?.tag,
                            key: 'name',
                            oldValue: oldName,
                            newValue: newName
                        })
                        break
                }
                break
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
                        } as StandardComponent
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
        // TODO: Add a true/false return value to recursiveRenameWalk to
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
        const newComponent: StandardComponent = {
            ...JSON.parse(JSON.stringify(standardForm.byId[payload.from])),
            key: payload.to
        }
        const renameEditStandard: StandardForm = {
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
                        if (component.key === payload.to) {
                            component.description = undefined
                        }
                        updateStandard(state, { type: 'updateStandard', payload: { type: 'replaceItem', componentKey: component.key, itemKey: 'description', item: newDescription[0] } })
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
                        if (component.key === payload.to) {
                            component.description = undefined
                        }
                        updateStandard(state, { type: 'updateStandard', payload: { type: 'replaceItem', componentKey: component.key, itemKey: 'description', item: newDescription[0] } })
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
                        if (component.key === payload.to) {
                            component.summary = undefined
                        }
                        updateStandard(state, { type: 'updateStandard', payload: { type: 'replaceItem', componentKey: component.key, itemKey: 'summary', item: newSummary[0] } })
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
    const standardizer = new Standardizer()
    standardizer.loadStandardForm(state.base)
    const importsStandardizer = new Standardizer(
        ...Object.values(state.importData)
            .map((tree) => (
                tree.length === 1 && isSchemaAsset(tree[0].data)
                    ? [{ ...tree[0], data: { ...tree[0].data, key: baseKey }}]
                    : []
            ))
            .filter((tree) => (tree.length))
    )
    importsStandardizer.loadStandardForm({
        byId: importsStandardizer._byId,
        key: baseKey,
        tag: 'Asset',
        metaData: standardizer.metaData
    })
    const inheritedStandardizer = importsStandardizer.prune({ match: 'Inherited' })
    state.inherited = inheritedStandardizer.standardForm
}

export const receiveWMLEvent = (state: PersonalAssetsPublic, event: SubscriptionClientMessage) => {
    if (event.detailType === 'Asset Edited') {
        const baseStandardizer = new Standardizer()
        baseStandardizer.loadStandardForm(state.base)
        const incomingSchema = new Schema()
        incomingSchema.loadWML(event.schema)
        const incomingStandardizer = new Standardizer(incomingSchema.schema)
        try {
            const mergedStandardizer = baseStandardizer.merge(incomingStandardizer)
            state.base = mergedStandardizer.standardForm
        }
        catch (err) {}
    }
}