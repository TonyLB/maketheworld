import { PayloadAction } from '@reduxjs/toolkit'
import { PersonalAssetsPublic } from './baseClasses'

export const setCurrentWML = (state: PersonalAssetsPublic, newCurrent: PayloadAction<{ value: string }>) => {
    console.log(`newCurrent: ${JSON.stringify(newCurrent, null, 4)}`)
    state.currentWML = newCurrent.payload.value
    state.draftWML = undefined
}

export const setDraftWML = (state: PersonalAssetsPublic, newDraft: PayloadAction<{ value: string }>) => {
    state.draftWML = newDraft.payload.value
}
