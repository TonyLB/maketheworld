//
// lineEntry is a slice in the UI section of the store to persistently
// store the current state of what is entered in the user prompt
//

import { createSlice, PayloadAction, createSelector } from '@reduxjs/toolkit'

import { RootState, Selector } from '../../../store'
import { ParseCommandModes, ParseCommandProps } from '../../lifeLine/baseClasses'

type LineEntryMode = ParseCommandModes | 'Options'

export interface LineEntry {
    entry: string;
    currentMode: LineEntryMode;
}

const initialState = {
    entry: '',
    currentMode: 'Command'
} as LineEntry

const lineEntrySlice = createSlice({
    name: 'lineEntry',
    initialState,
    reducers: {
        setEntry(state, action: PayloadAction<string>) {
            state.entry = action.payload
        },
        setCurrentMode(state, action: PayloadAction<ParseCommandModes | 'Options'>) {
            state.currentMode = action.payload
        }
    }
})

export const getLineEntry: Selector<string> = (state: RootState) => (state.UI.lineEntry.entry)
export const getLineEntryMode: Selector<ParseCommandModes | 'Options'> = (state: RootState) => (state.UI.lineEntry.currentMode)

export const { setEntry, setCurrentMode } = lineEntrySlice.actions

export default lineEntrySlice.reducer
