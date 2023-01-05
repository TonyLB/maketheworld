import { PayloadAction } from '@reduxjs/toolkit'
import { PersonalAssetsPublic } from './baseClasses'
import { v4 as uuidv4 } from 'uuid'
import { WritableDraft } from 'immer/dist/internal'
import Normalizer from '@tonylb/mtw-wml/dist/normalize'
import { schemaFromParse } from '@tonylb/mtw-wml/dist/schema'
import parser from "@tonylb/mtw-wml/dist/parser"
import tokenizer from "@tonylb/mtw-wml/dist/parser/tokenizer"
import SourceStream from "@tonylb/mtw-wml/dist/parser/tokenizer/sourceStream"

export const setCurrentWML = (state: PersonalAssetsPublic, newCurrent: PayloadAction<{ value: string }>) => {
    state.currentWML = newCurrent.payload.value
    const schema = schemaFromParse(parser(tokenizer(new SourceStream(newCurrent.payload.value))))
    const normalizer = new Normalizer()
    schema.forEach((item, index) => {
        normalizer.add(item, { contextStack: [], location: [index] })
    })
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

export const updateNormal = (state: PersonalAssetsPublic, action: PayloadAction<(normalizer: WritableDraft<Normalizer>) => void>) => {
    const normalizer = new Normalizer()
    normalizer._normalForm = state.normal
    action.payload(normalizer)
    state.normal = normalizer.normal
}
