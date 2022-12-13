//
// lineEntry is a slice in the UI section of the store to persistently
// store the current state of what is entered in the user prompt
//

import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { EphemeraCharacterId } from '@tonylb/mtw-interfaces/dist/baseClasses'

import { RootState, Selector } from '../../../store'
import { ParseCommandModes } from '../../lifeLine/baseClasses'

type LineEntryMode = ParseCommandModes | 'Options'

export type LineEntry = Record<EphemeraCharacterId, {
    entry: string;
    currentMode: LineEntryMode;
}>

const initialState = {} as LineEntry

const lineEntrySlice = createSlice({
    name: 'lineEntry',
    initialState,
    reducers: {
        setEntry(state, action: PayloadAction<{ characterId: EphemeraCharacterId, entry: string }>) {
            if (!state[action.payload.characterId]) {
                state[action.payload.characterId] = {
                    entry: '',
                    currentMode: 'Command'
                }
            }
            state[action.payload.characterId].entry = action.payload.entry
        },
        setCurrentMode(state, action: PayloadAction<{ characterId: EphemeraCharacterId, mode: ParseCommandModes | 'Options' }>) {
            if (!state[action.payload.characterId]) {
                state[action.payload.characterId] = {
                    entry: '',
                    currentMode: 'Command'
                }
            }
            state[action.payload.characterId].currentMode = action.payload.mode
        }
    }
})

export const getLineEntry: (value: EphemeraCharacterId) => Selector<string> = (characterId) => (state: RootState) => ((state.UI.lineEntry[characterId] || { entry: '' }).entry)
export const getLineEntryMode: (value: EphemeraCharacterId) => Selector<ParseCommandModes | 'Options'> = (characterId) => (state: RootState) => ((state.UI.lineEntry[characterId] || { currentMode: 'Command' }).currentMode)

export const { setEntry, setCurrentMode } = lineEntrySlice.actions

export default lineEntrySlice.reducer
