import { PayloadAction } from '@reduxjs/toolkit'
import { PersonalAssetsPublic } from './baseClasses'
import { v4 as uuidv4 } from 'uuid'
import { WritableDraft } from 'immer/dist/internal'
import Normalizer, { NormalizerInsertPosition } from '@tonylb/mtw-wml/dist/normalize'
import { schemaFromParse } from '@tonylb/mtw-wml/dist/schema'
import parser from "@tonylb/mtw-wml/dist/parser"
import tokenizer from "@tonylb/mtw-wml/dist/parser/tokenizer"
import SourceStream from "@tonylb/mtw-wml/dist/parser/tokenizer/sourceStream"
import { SchemaTag } from '@tonylb/mtw-wml/dist/schema/baseClasses'
import { NormalReference } from '@tonylb/mtw-wml/dist/normalize/baseClasses'

export const setCurrentWML = (state: PersonalAssetsPublic, newCurrent: PayloadAction<{ value: string }>) => {
    state.currentWML = newCurrent.payload.value
    const schema = schemaFromParse(parser(tokenizer(new SourceStream(newCurrent.payload.value))))
    const normalizer = new Normalizer()
    schema.forEach((item) => {
        normalizer.put(item, { contextStack: [] })
    })
    state.normal = normalizer.normal
    state.draftWML = undefined
}

export const setDraftWML = (state: PersonalAssetsPublic, newDraft: PayloadAction<{ value: string }>) => {
    state.draftWML = newDraft.payload.value
}

export const setLoadedImage = (state: PersonalAssetsPublic, action: PayloadAction<{ itemId: string; file: File }>) => {
    state.loadedImages[action.payload.itemId] = {
        loadId: uuidv4(),
        file: action.payload.file
    }
}

type UpdateNormalPayloadPut = {
    type: 'put';
    item: SchemaTag;
    position: NormalizerInsertPosition;
}

type UpdateNormalPayloadDelete = {
    type: 'delete';
    references: NormalReference[];
}

export type UpdateNormalPayload = UpdateNormalPayloadPut |
    UpdateNormalPayloadDelete

export const updateNormal = (state: PersonalAssetsPublic, action: PayloadAction<UpdateNormalPayload>) => {
    const normalizer = new Normalizer()
    normalizer._normalForm = state.normal
    switch(action.payload.type) {
        case 'put':
            normalizer.put(action.payload.item, action.payload.position)
            break
        case 'delete':
            action.payload.references.forEach((reference) => { normalizer.delete(reference) })
            break
    }
    state.normal = normalizer.normal
}
