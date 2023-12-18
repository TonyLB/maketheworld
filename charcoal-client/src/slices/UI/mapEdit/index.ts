import { createSelector, createSlice, PayloadAction } from "@reduxjs/toolkit"
import { Selector } from '../../../store'

//
// UI/MapEdit redux slice stores a list of conditionals that have been hidden in the UI
//
type MapEditData = Record<string, string[]>

const initialState = {} as MapEditData

const mapEditSlice = createSlice({
    name: 'mapEdit',
    initialState,
    reducers: {
        toggle(state, action: PayloadAction<{ mapId: string, key: string }>) {
            const { mapId, key } = action.payload
            if (mapId in state) {
                const mapState = state[mapId] || []
                if (mapState.includes(key)) {
                    state[mapId] = mapState.filter((conditional) => (conditional !== key))
                }
                else {
                    state[mapId] = [...mapState, key]
                }
            }
            else {
                state[mapId] = [key]
            }
        }
    }
})

export const { toggle } = mapEditSlice.actions

export const mapEditAllConditions: Selector<Record<string, string[]>> = ({ UI: { mapEdit = {} } }) => (mapEdit)

export const mapEditConditionsByMapId = (mapId: string): Selector<string[]> => createSelector(
    mapEditAllConditions,
    (mapEditAllConditions) => (mapEditAllConditions[mapId] || [])
)

export const mapEditConditionState = (mapId: string, key: string): Selector<boolean> => createSelector(
    mapEditAllConditions,
    (mapEditAllConditions) => ((mapEditAllConditions[mapId] || []).includes(key))
)

export default mapEditSlice.reducer
