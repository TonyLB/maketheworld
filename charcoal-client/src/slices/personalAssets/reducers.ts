import { PayloadAction } from '@reduxjs/toolkit'
import { PersonalAssetsPublic } from './baseClasses'
import { v4 as uuidv4 } from 'uuid'
import Normalizer from '@tonylb/mtw-wml/dist/normalize'
import { SchemaTag, isSchemaAsset, isSchemaExit, isSchemaLink, isSchemaWithKey } from '@tonylb/mtw-wml/dist/schema/baseClasses'
import { standardizeSchema } from '@tonylb/mtw-wml/dist/schema/standardize'
import { markInherited } from '@tonylb/mtw-wml/dist/schema/treeManipulation/inherited'
import { GenericTree, GenericTreeNode, TreeId } from '@tonylb/mtw-wml/dist/tree/baseClasses'
import { map } from '@tonylb/mtw-wml/dist/tree/map'
import { filter } from '@tonylb/mtw-wml/dist/tree/filter'
import { selectKeysByTag } from '@tonylb/mtw-wml/dist/normalize/selectors/keysByTag'
import { maybeGenericIDFromTree } from '@tonylb/mtw-wml/dist/tree/genericIDTree'

export const setCurrentWML = (state: PersonalAssetsPublic, newCurrent: PayloadAction<{ value: string }>) => {
    state.currentWML = newCurrent.payload.value
    const normalizer = new Normalizer()
    normalizer.loadWML(newCurrent.payload.value)
    state.normal = normalizer.normal
    state.draftWML = undefined
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

export type UpdateSchemaPayload = UpdateSchemaPayloadReplace | UpdateSchemaPayloadUpdateNode | UpdateSchemaPayloadAddChild | UpdateSchemaPayloadRename | UpdateSchemaPayloadDelete

export const deriveWorkingSchema = ({ baseSchema, importData={} }: { baseSchema: PersonalAssetsPublic["baseSchema"], importData?: PersonalAssetsPublic["importData"] }): PersonalAssetsPublic["schema"] => {
    const baseKey = baseSchema.length >= 1 && isSchemaAsset(baseSchema[0].data) && baseSchema[0].data.key
    const standardized = standardizeSchema(
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
    return maybeGenericIDFromTree(standardized)
}

export const updateSchema = (state: PersonalAssetsPublic, action: PayloadAction<UpdateSchemaPayload>) => {
    const { payload } = action
    const addKeyIfNeeded = (node: GenericTreeNode<SchemaTag, TreeId>): GenericTreeNode<SchemaTag, TreeId> => {
        const { data } = node
        if (isSchemaWithKey(data) && !data.key)  {
            const keysByTag = selectKeysByTag(data.tag)(schema)
            let nextIndex = 1
            while (keysByTag.includes(`${data.tag}${nextIndex}`)) { nextIndex++ }
            return {
                ...node,
                data: {
                    ...data,
                    key: `${data.tag}${nextIndex}`
                },
            }
        }
        return node
    }
    const schema = filter({ tree: state.schema, callback: ({ tag }: SchemaTag, id: TreeId) => (tag !== 'Inherited') })
    switch(payload.type) {
        case 'replace':
            const replacedSchema = map(schema, (node) => {
                if (node.id === payload.id) {
                    return addKeyIfNeeded(maybeGenericIDFromTree([payload.item])[0])
                }
                else {
                    return node
                }
            })
            state.baseSchema = replacedSchema
            break
        case 'updateNode':
            const updatedSchema = map(schema, ({ data, children, id }: GenericTreeNode<SchemaTag, TreeId>) => ([{
                data: id === payload.id ? payload.item : data,
                children,
                id
            }]))
            state.baseSchema = updatedSchema
            break
        case 'addChild':
            const addedSchema = map(schema, (node: GenericTreeNode<SchemaTag, TreeId>) => {
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
            const renamedSchema = map(schema, (node) => {
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
            const deletedSchema = filter({ tree: schema, callback: (_: SchemaTag, { id }: TreeId) => (Boolean(id !== payload.id)) })
            state.baseSchema = deletedSchema
            break
    }
    const normalizer = new Normalizer()
    state.schema = deriveWorkingSchema(state)
    normalizer.loadSchema(state.schema)
    state.normal = normalizer.normal
}

export const setImport = (state: PersonalAssetsPublic, action: PayloadAction<{ assetKey: string; schema: GenericTree<SchemaTag, TreeId> }>) => {
    state.importData[action.payload.assetKey] = action.payload.schema
}
