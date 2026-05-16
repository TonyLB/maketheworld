import { createSlice } from '@reduxjs/toolkit'

import { RootState, Selector } from '../../../store'

interface ThinkingDashboardState {
    open: boolean
}

const initialState: ThinkingDashboardState = {
    open: false
}

const thinkingDashboardSlice = createSlice({
    name: 'thinkingDashboard',
    initialState,
    reducers: {
        openThinkingDashboard(state) {
            state.open = true
        },
        closeThinkingDashboard(state) {
            state.open = false
        }
    }
})

export const {
    openThinkingDashboard,
    closeThinkingDashboard
} = thinkingDashboardSlice.actions

export const getThinkingDashboardOpen: Selector<boolean> = (state: RootState) =>
    state.UI.thinkingDashboard.open

export default thinkingDashboardSlice.reducer
