import { PayloadAction } from '@reduxjs/toolkit'
import { PlayerPublic } from './baseClasses'

export const setCurrentDraft = (state: PlayerPublic, action: PayloadAction<string | undefined>) => {
    state.currentDraft = action.payload
}
