import { PayloadAction } from '@reduxjs/toolkit'
import { PersonalAssetsPublic } from './baseClasses'
import { v4 as uuidv4 } from 'uuid'
import Normalizer, { NormalizerInsertPosition } from '@tonylb/mtw-wml/dist/normalize'
import { SchemaTag } from '@tonylb/mtw-wml/dist/simpleSchema/baseClasses'
import { NormalForm, NormalReference } from '@tonylb/mtw-wml/dist/normalize/baseClasses'
import { GenericTree, GenericTreeNode } from '@tonylb/mtw-wml/dist/sequence/tree/baseClasses'
import { map } from '@tonylb/mtw-wml/dist/sequence/tree/map'

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
    item: GenericTreeNode<SchemaTag, { id?: string }>
}

type UpdateSchemaPayloadAddChild = {
    type: 'addChild';
    id: string;
    item: GenericTreeNode<SchemaTag, { id?: string }>
}

export type UpdateSchemaPayload = UpdateSchemaPayloadReplace | UpdateSchemaPayloadAddChild

const addIdIfNeeded = (tree: GenericTree<SchemaTag, { id?: string }>): GenericTree<SchemaTag, { id: string }> => (map(tree, ({ id, ...rest }) => ({ id: id ?? uuidv4(), ...rest })))

export const updateSchema = (state: PersonalAssetsPublic, action: PayloadAction<UpdateSchemaPayload>) => {
    const { schema } = state
    switch(action.payload.type) {
        case 'replace':
            const replacedSchema = map(schema, (node) => {
                if (node.id === action.payload.id) {
                    return addIdIfNeeded([action.payload.item])[0]
                }
                else {
                    return node
                }
            })
            return {
                schema: replacedSchema
            }
        case 'addChild':
            const addedSchema = map(schema, (node) => {
                if (node.id === action.payload.id) {
                    return {
                        ...node,
                        children: [
                            ...node.children,
                            ...addIdIfNeeded([action.payload.item])
                        ]
                    }
                }
                else {
                    return node
                }
            })
            return {
                schema: addedSchema
            }
    }
    return {}
}

type UpdateNormalPayloadPutPosition = {
    type: 'put';
    item: GenericTreeNode<SchemaTag>;
    position: NormalizerInsertPosition;
}

type UpdateNormalPayloadPutReference = {
    type: 'put';
    item: GenericTreeNode<SchemaTag>;
    reference: NormalReference;
    replace?: boolean;
}

type UpdateNormalPayloadPut = UpdateNormalPayloadPutPosition | UpdateNormalPayloadPutReference
const isUpdateNormalPayloadPutReference = (payload: UpdateNormalPayloadPut): payload is UpdateNormalPayloadPutReference => ('reference' in payload)

type UpdateNormalPayloadDelete = {
    type: 'delete';
    references: NormalReference[];
}

type UpdateNormalPayloadRename = {
    type: 'rename';
    fromKey: string;
    toKey: string;
}

export type UpdateNormalPayload = UpdateNormalPayloadPut |
    UpdateNormalPayloadDelete |
    UpdateNormalPayloadRename

export const updateNormal = (state: PersonalAssetsPublic, action: PayloadAction<UpdateNormalPayload>) => {
    const normalizer = new Normalizer()
    normalizer.loadNormal(state.normal)
    switch(action.payload.type) {
        case 'put':
            if (isUpdateNormalPayloadPutReference(action.payload)) {
                const position = {
                    ...normalizer._referenceToInsertPosition(action.payload.reference),
                    replace: action.payload.replace
                }
                normalizer.put(action.payload.item, position)
            }
            else {
                normalizer.put(action.payload.item, action.payload.position)
            }
            break
        case 'delete':
            action.payload.references.forEach((reference) => { normalizer.delete(reference) })
            break
        case 'rename':
            normalizer.renameItem(
                action.payload.fromKey,
                action.payload.toKey
            )
            break
    }
    normalizer.standardize()
    state.normal = normalizer.normal
}

export const setImport = (state: PersonalAssetsPublic, action: PayloadAction<{ assetKey: string; normal: NormalForm }>) => {
    state.importData[action.payload.assetKey] = action.payload.normal
}
