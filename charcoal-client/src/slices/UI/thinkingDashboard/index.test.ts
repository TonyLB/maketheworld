import { describe, it, expect, vi } from 'vitest'

import thinkingDashboardReducer, {
    openThinkingDashboard,
    closeThinkingDashboard,
    selectThinkingResult,
    clearThinkingResultSelection,
    getThinkingDashboardOpen,
    getSelectedThinkingWorkItemId,
    openThinkingResultDetail
} from './index'

vi.mock('../../thinkingResults', () => ({
    requestThinkingResult: vi.fn(() => ({ type: 'thinkingResults/requestThinkingResult' }))
}))

import { requestThinkingResult } from '../../thinkingResults'

const mockRequestThinkingResult = vi.mocked(requestThinkingResult)

describe('thinkingDashboard UI slice', () => {
    it('starts closed with no selection', () => {
        const state = thinkingDashboardReducer(undefined, { type: 'unknown' })
        expect(state.open).toBe(false)
        expect(state.selectedWorkItemId).toBeNull()
    })

    it('opens on openThinkingDashboard', () => {
        const state = thinkingDashboardReducer(undefined, openThinkingDashboard())
        expect(state.open).toBe(true)
    })

    it('closes and clears selection on closeThinkingDashboard', () => {
        let state = thinkingDashboardReducer(undefined, openThinkingDashboard())
        state = thinkingDashboardReducer(state, selectThinkingResult('work-1'))
        state = thinkingDashboardReducer(state, closeThinkingDashboard())
        expect(state.open).toBe(false)
        expect(state.selectedWorkItemId).toBeNull()
    })

    it('selectThinkingResult sets selectedWorkItemId', () => {
        const state = thinkingDashboardReducer(undefined, selectThinkingResult('work-1'))
        expect(state.selectedWorkItemId).toBe('work-1')
    })

    it('clearThinkingResultSelection clears selection', () => {
        let state = thinkingDashboardReducer(undefined, selectThinkingResult('work-1'))
        state = thinkingDashboardReducer(state, clearThinkingResultSelection())
        expect(state.selectedWorkItemId).toBeNull()
    })

    it('getThinkingDashboardOpen reads UI.thinkingDashboard.open', () => {
        const mockState = {
            UI: {
                thinkingDashboard: { open: true, selectedWorkItemId: null }
            }
        } as any
        expect(getThinkingDashboardOpen(mockState)).toBe(true)
    })

    it('getSelectedThinkingWorkItemId reads selection', () => {
        const mockState = {
            UI: {
                thinkingDashboard: { open: true, selectedWorkItemId: 'work-2' }
            }
        } as any
        expect(getSelectedThinkingWorkItemId(mockState)).toBe('work-2')
    })

    it('openThinkingResultDetail selects and requests fetch', () => {
        const dispatch = vi.fn()
        openThinkingResultDetail('work-1')(dispatch, vi.fn(), undefined)
        expect(dispatch).toHaveBeenCalledWith(selectThinkingResult('work-1'))
        expect(mockRequestThinkingResult).toHaveBeenCalledWith('work-1')
    })
})
