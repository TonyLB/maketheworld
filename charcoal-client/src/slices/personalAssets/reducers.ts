import { PayloadAction } from '@reduxjs/toolkit'
import { PersonalAssetsPublic } from './baseClasses'
import { v4 as uuidv4 } from 'uuid'
import Normalizer from '@tonylb/mtw-wml/dist/normalize'
import { SchemaTag, isSchemaExit, isSchemaLink, isSchemaWithKey } from '@tonylb/mtw-wml/dist/schema/baseClasses'
import { NormalForm } from '@tonylb/mtw-wml/dist/normalize/baseClasses'
import { GenericTree, GenericTreeNode, TreeId } from '@tonylb/mtw-wml/dist/tree/baseClasses'
import { map } from '@tonylb/mtw-wml/dist/tree/map'
import { filter } from '@tonylb/mtw-wml/dist/tree/filter'
import { selectKeysByTag } from '@tonylb/mtw-wml/dist/normalize/selectors/keysByTag'

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

const addIdIfNeeded = (tree: GenericTree<SchemaTag, Partial<TreeId>>): GenericTree<SchemaTag, TreeId> => (map(tree, ({ id, ...rest }) => ({ id: id ?? uuidv4(), ...rest })))

export const updateSchema = (state: PersonalAssetsPublic, action: PayloadAction<UpdateSchemaPayload>) => {
    const { schema } = state
    const normalizer = new Normalizer()
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
    switch(payload.type) {
        case 'replace':
            const replacedSchema = map(schema, (node) => {
                if (node.id === payload.id) {
                    return addKeyIfNeeded(addIdIfNeeded([payload.item])[0])
                }
                else {
                    return node
                }
            })
            normalizer.loadSchema(replacedSchema)
            state.schema = replacedSchema
            state.normal = normalizer.normal
            return
        case 'updateNode':
            const updatedSchema = map(schema, ({ data, children, id }: GenericTreeNode<SchemaTag, TreeId>) => ([{
                data: id === payload.id ? payload.item : data,
                children,
                id
            }]))
            normalizer.loadSchema(updatedSchema)
            state.schema = updatedSchema
            state.normal = normalizer.normal
            return
        case 'addChild':
            const addedSchema = map(schema, (node) => {
                if (node.id === payload.id) {
                    return {
                        ...node,
                        children: [
                            ...node.children,
                            ...addIdIfNeeded([payload.item]).map(addKeyIfNeeded)
                        ]
                    }
                }
                else {
                    return node
                }
            })
            normalizer.loadSchema(addedSchema)
            state.schema = addedSchema
            state.normal = normalizer.normal
            return
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
            normalizer.loadSchema(renamedSchema)
            state.schema = renamedSchema
            state.normal = normalizer.normal
            return
        case 'delete':
            const deletedSchema = filter({ tree: schema, callback: (_: SchemaTag, { id }: TreeId) => (Boolean(id !== payload.id)) })
            normalizer.loadSchema(deletedSchema)
            state.schema = deletedSchema
            state.normal = normalizer.normal
            return
    }
}

export const setImport = (state: PersonalAssetsPublic, action: PayloadAction<{ assetKey: string; normal: NormalForm }>) => {
    state.importData[action.payload.assetKey] = action.payload.normal
}
