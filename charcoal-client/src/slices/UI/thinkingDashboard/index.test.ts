import thinkingDashboardReducer, {
    openThinkingDashboard,
    closeThinkingDashboard,
    getThinkingDashboardOpen
} from './index'

describe('thinkingDashboard UI slice', () => {
    it('starts closed', () => {
        const state = thinkingDashboardReducer(undefined, { type: 'unknown' })
        expect(state.open).toBe(false)
    })

    it('opens on openThinkingDashboard', () => {
        const state = thinkingDashboardReducer(undefined, openThinkingDashboard())
        expect(state.open).toBe(true)
    })

    it('closes on closeThinkingDashboard', () => {
        const openState = thinkingDashboardReducer(undefined, openThinkingDashboard())
        const state = thinkingDashboardReducer(openState, closeThinkingDashboard())
        expect(state.open).toBe(false)
    })

    it('getThinkingDashboardOpen reads UI.thinkingDashboard.open', () => {
        const mockState = {
            UI: {
                thinkingDashboard: { open: true }
            }
        } as any
        expect(getThinkingDashboardOpen(mockState)).toBe(true)
    })
})
