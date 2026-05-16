import { createSlice } from '@reduxjs/toolkit'
import type { AnyAction, ThunkAction } from '@reduxjs/toolkit'

import { RootState, Selector } from '../../../store'
import { requestThinkingResult } from '../../thinkingResults'
import type { ThinkingWorkItemId } from '@tonylb/mtw-interfaces/ts/eventBridge/ephemera/thinking'

interface ThinkingDashboardState {
    open: boolean
    selectedWorkItemId: string | null
}

const initialState: ThinkingDashboardState = {
    open: false,
    selectedWorkItemId: null
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
            state.selectedWorkItemId = null
        },
        selectThinkingResult(state, action: { payload: ThinkingWorkItemId }) {
            state.selectedWorkItemId = action.payload
        },
        clearThinkingResultSelection(state) {
            state.selectedWorkItemId = null
        }
    }
})

export const {
    openThinkingDashboard,
    closeThinkingDashboard,
    selectThinkingResult,
    clearThinkingResultSelection
} = thinkingDashboardSlice.actions

export const openThinkingResultDetail = (workItemId: ThinkingWorkItemId): ThunkAction<void, RootState, unknown, AnyAction> => (dispatch) => {
    dispatch(selectThinkingResult(workItemId))
    dispatch(requestThinkingResult(workItemId))
}

export const getThinkingDashboardOpen: Selector<boolean> = (state: RootState) =>
    state.UI.thinkingDashboard.open

export const getSelectedThinkingWorkItemId: Selector<string | null> = (state: RootState) =>
    state.UI.thinkingDashboard.selectedWorkItemId

export default thinkingDashboardSlice.reducer
