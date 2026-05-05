import { handleStaleSessionFinding } from './index'

describe('handleStaleSessionFinding (stub)', () => {
    let logSpy: jest.SpyInstance

    beforeEach(() => {
        logSpy = jest.spyOn(console, 'log').mockImplementation(() => {})
    })

    afterEach(() => {
        logSpy.mockRestore()
    })

    it('logs structured stub payload and returns without throwing', async () => {
        await handleStaleSessionFinding({ player: 'p1', diagnosticRunId: 'run-1' })

        expect(logSpy).toHaveBeenCalledTimes(1)
        expect(JSON.parse(logSpy.mock.calls[0][0] as string)).toEqual({
            event: 'stale-session-finding-received-stub',
            player: 'p1',
            diagnosticRunId: 'run-1'
        })
    })
})
