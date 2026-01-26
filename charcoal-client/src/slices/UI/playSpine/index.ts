import { createSlice, PayloadAction } from '@reduxjs/toolkit'

interface PlaySpineState {
    forceCharacterSelection: boolean; // User-initiated character selection intent (ephemeral UI state)
}

const initialState: PlaySpineState = {
    forceCharacterSelection: false
}

const playSpineSlice = createSlice({
    name: 'playSpine',
    initialState,
    reducers: {
        setForceCharacterSelection(state, action: PayloadAction<boolean>) {
            state.forceCharacterSelection = action.payload
        }
    }
})

export const getForceCharacterSelection = (state: any): boolean => 
    (state.UI?.playSpine?.forceCharacterSelection ?? false)

export const { setForceCharacterSelection } = playSpineSlice.actions
export default playSpineSlice.reducer
