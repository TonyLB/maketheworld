//
// lineEntry is a slice in the UI section of the store to persistently
// store the current state of what is entered in the user prompt
//

import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { EphemeraCharacterId } from '@tonylb/mtw-interfaces/dist/baseClasses'
import { WritableDraft } from 'immer/dist/internal'

import { RootState, Selector } from '../../../store'
import { ParseCommandModes } from '../../lifeLine/baseClasses'

type LineEntryMode = ParseCommandModes | 'Options'

export type LineEntry = Record<EphemeraCharacterId, {
    entry: string;
    currentMode: LineEntryMode;
}>

const initialState = {} as LineEntry

const lineEntryOrder: LineEntryMode[] = [
    'OOCMessage',
    'NarrateMessage',
    'SayMessage',
    'Command'
]

const setCurrentModeHelper = (state: WritableDraft<LineEntry>, action: { characterId: EphemeraCharacterId, mode: ParseCommandModes | 'Options', name: string; }) => {
    if (action.mode === 'NarrateMessage' && state[action.characterId].entry.trim() === '' && action.name) {
        state[action.characterId].entry = `${action.name} `
    }
    if (action.mode !== 'NarrateMessage' && state[action.characterId].currentMode == 'NarrateMessage' && state[action.characterId].entry.trim() === action.name) {
        state[action.characterId].entry = ''
    }
    state[action.characterId].currentMode = action.mode
}

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
        setCurrentMode(state, action: PayloadAction<{ characterId: EphemeraCharacterId, mode: ParseCommandModes | 'Options', name: string; }>) {
            if (!state[action.payload.characterId]) {
                state[action.payload.characterId] = {
                    entry: '',
                    currentMode: 'Command'
                }
            }
            setCurrentModeHelper(state, action.payload)
        },
        moveCurrentMode(state, action: PayloadAction<{ characterId: EphemeraCharacterId, up: boolean, name: string }>) {
            if (!state[action.payload.characterId]) {
                state[action.payload.characterId] = {
                    entry: '',
                    currentMode: 'Command'
                }
            }
            const currentIndex = lineEntryOrder.indexOf(state[action.payload.characterId].currentMode)
            if (currentIndex === -1) {
                state[action.payload.characterId].currentMode = 'Command'
            }
            else {
                if (action.payload.up && currentIndex > 0) {
                    setCurrentModeHelper(state, { characterId: action.payload.characterId, mode: lineEntryOrder[currentIndex - 1], name: action.payload.name })
                }
                if (!action.payload.up && currentIndex < lineEntryOrder.length - 1) {
                    setCurrentModeHelper(state, { characterId: action.payload.characterId, mode: lineEntryOrder[currentIndex + 1], name: action.payload.name })
                }
            }
        }
    }
})

export const getLineEntry: (value: EphemeraCharacterId) => Selector<string> = (characterId) => (state: RootState) => ((state.UI.lineEntry[characterId] || { entry: '' }).entry)
export const getLineEntryMode: (value: EphemeraCharacterId) => Selector<ParseCommandModes | 'Options'> = (characterId) => (state: RootState) => ((state.UI.lineEntry[characterId] || { currentMode: 'Command' }).currentMode)

export const { setEntry, setCurrentMode, moveCurrentMode } = lineEntrySlice.actions

export default lineEntrySlice.reducer
