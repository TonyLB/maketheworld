import { PayloadAction } from '@reduxjs/toolkit'
import { PersonalAssetsPublic } from './baseClasses'
import { v4 as uuidv4 } from 'uuid'
import { SchemaDescriptionTag, SchemaNameTag, SchemaOutputTag, SchemaShortNameTag, SchemaSummaryTag, SchemaTag, SchemaWithKey, isSchemaAsset, isSchemaDescription, isSchemaExit, isSchemaLink, isSchemaName, isSchemaShortName, isSchemaSummary, isSchemaWithKey } from '@tonylb/mtw-wml/dist/schema/baseClasses'
import { markInherited } from '@tonylb/mtw-wml/dist/schema/treeManipulation/inherited'
import { GenericTree, GenericTreeNode, TreeId } from '@tonylb/mtw-wml/dist/tree/baseClasses'
import { map } from '@tonylb/mtw-wml/dist/tree/map'
import { filter } from '@tonylb/mtw-wml/dist/tree/filter'
import { selectKeysByTag } from '@tonylb/mtw-wml/dist/schema/selectors/keysByTag'
import { maybeGenericIDFromTree } from '@tonylb/mtw-wml/dist/tree/genericIDTree'
import { Standardizer } from '@tonylb/mtw-wml/dist/standardize'
import { Schema, schemaToWML } from '@tonylb/mtw-wml/dist/schema'
import { wrappedNodeTypeGuard } from '@tonylb/mtw-wml/dist/schema/utils'
import { EditWrappedStandardNode } from '@tonylb/mtw-wml/dist/standardize/baseClasses'

export const setCurrentWML = (state: PersonalAssetsPublic, newCurrent: PayloadAction<{ value: string }>) => {
    state.currentWML = newCurrent.payload.value
    state.draftWML = undefined
    const schema = new Schema()
    schema.loadWML(newCurrent.payload.value)
    const standardizer = new Standardizer(schema.schema)
    state.baseSchema = standardizer.schema
    state.standard = standardizer.standardForm
    const baseKey = state.baseSchema.length >= 1 && isSchemaAsset(state.baseSchema[0].data) && state.baseSchema[0].data.key
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
    const combinedStandardizer = inheritedStandardizer.merge(standardizer)
    state.schema = combinedStandardizer.schema
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

type UpdateSchemaPayloadReplace = {
    type: 'replace';
    id: string;
    item: GenericTreeNode<SchemaTag, Partial<TreeId>>
}

type UpdateSchemaPayloadReplaceChildren = {
    type: 'replaceChildren';
    id: string;
    children: GenericTree<SchemaTag, Partial<TreeId>>
}

type UpdateSchemaPayloadUpdateNode = {
    type: 'updateNode';
    id: string;
    item: SchemaTag;
}

type UpdateSchemaPayloadAddChild = {
    type: 'addChild';
    id: string;
    afterId?: string;
    item: GenericTreeNode<SchemaTag, Partial<TreeId>>
}

type UpdateSchemaPayloadRename = {
    type: 'rename';
    fromKey: string;
    toKey: string;
}

type UpdateSchemaPayloadDelete = {
    type: 'delete';
    id: string;
}

export type UpdateSchemaPayload = UpdateSchemaPayloadReplace | UpdateSchemaPayloadReplaceChildren | UpdateSchemaPayloadUpdateNode | UpdateSchemaPayloadAddChild | UpdateSchemaPayloadRename | UpdateSchemaPayloadDelete

type UpdateStandardPayloadReplaceItem = {
    type: 'replaceItem';
    componentKey: string;
    itemKey: string; // Needs to restrict to possible itemKeys
    item?: GenericTreeNode<SchemaTag>
}

type UpdateStandardPayloadUpdateField = {
    type: 'updateField';
    componentKey: string;
    itemKey: string; // Needs to restrict to possible itemKeys
    value?: any
}

export type UpdateStandardPayload = UpdateStandardPayloadReplaceItem | UpdateStandardPayloadUpdateField

export const deriveWorkingStandardizer = ({ baseSchema, importData={} }: { baseSchema: PersonalAssetsPublic["baseSchema"], importData?: PersonalAssetsPublic["importData"] }): Standardizer => {
    const baseKey = baseSchema.length >= 1 && isSchemaAsset(baseSchema[0].data) && baseSchema[0].data.key
    const standardizer = new Standardizer(
        ...Object.values(importData)
            .map(markInherited)
            .map((tree) => (
                tree.length === 1 && isSchemaAsset(tree[0].data)
                    ? [{ ...tree[0], data: { ...tree[0].data, key: baseKey }}]
                    : []
            ))
            .filter((tree) => (tree.length)),
        baseSchema
    )
    return standardizer
}

export const nextSyntheticKey = ({ schema, tag }: { schema: GenericTree<SchemaTag>, tag: SchemaWithKey["tag"] }): string => {
    const keysByTag = selectKeysByTag(tag)(schema)
    let nextIndex = 1
    while (keysByTag.includes(`${tag}${nextIndex}`)) { nextIndex++ }
    return `${tag}${nextIndex}`
}

export const updateSchema = (state: PersonalAssetsPublic, action: PayloadAction<UpdateSchemaPayload>) => {
    const { payload } = action
    const addKeyIfNeeded = (node: GenericTreeNode<SchemaTag, TreeId>): GenericTreeNode<SchemaTag, TreeId> => {
        const { data } = node
        if (isSchemaWithKey(data) && !data.key)  {
            return {
                ...node,
                data: {
                    ...data,
                    key: nextSyntheticKey({ schema: state.baseSchema, tag: data.tag })
                },
            }
        }
        return node
    }
    switch(payload.type) {
        case 'replace':
            const replacedSchema = map(state.baseSchema, (node) => {
                if (node.id === payload.id) {
                    return addKeyIfNeeded(maybeGenericIDFromTree([payload.item])[0])
                }
                else {
                    return node
                }
            })
            state.baseSchema = replacedSchema
            break
        case 'replaceChildren':
            const replaceChildrenSchema = map(state.baseSchema, (node) => {
                if (node.id === payload.id) {
                    return { ...node, children: maybeGenericIDFromTree(payload.children) }
                }
                else {
                    return node
                }
            })
            state.baseSchema = replaceChildrenSchema
            break
        case 'updateNode':
            const updatedSchema = map(state.baseSchema, ({ data, children, id }: GenericTreeNode<SchemaTag, TreeId>) => ([{
                data: id === payload.id ? payload.item : data,
                children,
                id
            }]))
            state.baseSchema = updatedSchema
            break
        case 'addChild':
            const addedSchema = map(state.baseSchema, (node: GenericTreeNode<SchemaTag, TreeId>) => {
                if (node.id === payload.id) {
                    const afterIndex = payload.afterId ? node.children.findIndex(({ id }) => (id === payload.afterId)) : -1
                    if (afterIndex !== -1) {
                        return [{
                            ...node,
                            children: [
                                ...node.children.slice(0, afterIndex + 1),
                                ...maybeGenericIDFromTree([payload.item]).map(addKeyIfNeeded),
                                ...node.children.slice(afterIndex + 1)
                            ]
                        }]
                    }
                    else {
                        return [{
                            ...node,
                            children: [
                                ...node.children,
                                ...maybeGenericIDFromTree([payload.item]).map(addKeyIfNeeded)
                            ]
                        }]
                    }
                }
                else {
                    return [node]
                }
            })
            state.baseSchema = addedSchema
            break
        case 'rename':
            const renamedSchema = map(state.baseSchema, (node) => {
                let returnValue: SchemaTag = node.data
                if (isSchemaWithKey(returnValue) && returnValue.key === payload.fromKey) {
                    returnValue = {
                        ...returnValue,
                        key: payload.toKey
                    }
                }
                if (isSchemaExit(returnValue)) {
                    returnValue = {
                        ...returnValue,
                        to: returnValue.to === payload.fromKey ? payload.toKey : returnValue.to,
                        from: returnValue.from === payload.fromKey ? payload.toKey : returnValue.from
                    }
                }
                if (isSchemaLink(returnValue)) {
                    returnValue = {
                        ...returnValue,
                        to: returnValue.to === payload.fromKey ? payload.toKey : returnValue.to
                    }
                }
                return { ...node, data: returnValue }
            })
            state.baseSchema = renamedSchema
            break
        case 'delete':
            const deletedSchema = filter({ tree: state.baseSchema, callback: (_: SchemaTag, { id }: TreeId) => (Boolean(id !== payload.id)) })
            state.baseSchema = deletedSchema
            break
    }
    // const standardizer = deriveWorkingStandardizer(state)
    const standardizer = new Standardizer(state.baseSchema)
    state.baseSchema = standardizer.schema
    state.standard = standardizer.standardForm
    const baseKey = state.baseSchema.length >= 1 && isSchemaAsset(state.baseSchema[0].data) && state.baseSchema[0].data.key
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
    const combinedStandardizer = inheritedStandardizer.merge(standardizer)
    state.schema = combinedStandardizer.schema
}

export const updateStandard = (state: PersonalAssetsPublic, action: PayloadAction<UpdateStandardPayload>) => {
    const { payload } = action
    const component = ['replaceItem', 'updateField'].includes(payload.type) ? state.standard.byId[payload.componentKey] : undefined
    if (payload.type === 'replaceItem') {
        const item = payload.item ? maybeGenericIDFromTree([payload.item])[0] : undefined
        switch(component?.tag) {
            case 'Room':
                switch(payload.itemKey) {
                    case 'shortName':
                        if (!item || wrappedNodeTypeGuard(isSchemaShortName)(item)) {
                            component.shortName = item as unknown as EditWrappedStandardNode<SchemaShortNameTag, SchemaOutputTag> | undefined
                        }
                        break
                    case 'name':
                        if (!item || wrappedNodeTypeGuard(isSchemaName)(item)) {
                            component.name = item as unknown as EditWrappedStandardNode<SchemaNameTag, SchemaOutputTag> | undefined
                        }
                        break
                    case 'summary':
                        if (!item || wrappedNodeTypeGuard(isSchemaSummary)(item)) {
                            component.summary = item as unknown as EditWrappedStandardNode<SchemaSummaryTag, SchemaOutputTag> | undefined
                        }
                        break
                    case 'description':
                        if (!item || wrappedNodeTypeGuard(isSchemaDescription)(item)) {
                            component.description = item as unknown as EditWrappedStandardNode<SchemaDescriptionTag, SchemaOutputTag> | undefined
                        }
                        break
                }
                break
            case 'Feature':
            case 'Knowledge':
                switch(payload.itemKey) {
                    case 'name':
                        if (!item || wrappedNodeTypeGuard(isSchemaName)(item)) {
                            component.name = item as unknown as EditWrappedStandardNode<SchemaNameTag, SchemaOutputTag> | undefined
                        }
                        break
                    case 'description':
                        if (!item || wrappedNodeTypeGuard(isSchemaDescription)(item)) {
                            component.description = item as unknown as EditWrappedStandardNode<SchemaDescriptionTag, SchemaOutputTag> | undefined
                        }
                        break
                }
                break
            case 'Map':
            case 'Character':
                switch(payload.itemKey) {
                    case 'name':
                        if (wrappedNodeTypeGuard(isSchemaName)(item)) {
                            component.name = item as unknown as EditWrappedStandardNode<SchemaNameTag, SchemaOutputTag> | undefined
                        }
                        break
                }
                break
        }
    }
    if (payload.type === 'updateField') {
        console.log(`updateField payload: ${JSON.stringify(payload, null, 4)}`)
        switch(component?.tag) {
            case 'Action':
            case 'Variable':
            case 'Computed':
                component[payload.itemKey] = payload.value
                break
        }
    }
    const inheritedStandardizer = new Standardizer()
    inheritedStandardizer.loadStandardForm(state.inherited)
    const standardizer = new Standardizer()
    standardizer.loadStandardForm(state.standard)
    const combinedStandardizer = inheritedStandardizer.merge(standardizer)
    state.schema = combinedStandardizer.schema
}

export const setImport = (state: PersonalAssetsPublic, action: PayloadAction<{ assetKey: string; schema: GenericTree<SchemaTag, TreeId> }>) => {
    state.importData[action.payload.assetKey] = action.payload.schema
    const baseKey = state.baseSchema.length >= 1 && isSchemaAsset(state.baseSchema[0].data) && state.baseSchema[0].data.key
    const standardizer = new Standardizer()
    standardizer.loadStandardForm(state.standard)
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
    const combinedStandardizer = inheritedStandardizer.merge(standardizer)
    state.schema = combinedStandardizer.schema
}
