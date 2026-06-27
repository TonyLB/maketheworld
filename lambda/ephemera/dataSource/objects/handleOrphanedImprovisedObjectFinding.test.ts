jest.mock('./persistImprovisationObject', () => ({
    persistDeleteImprovisationObject: jest.fn(),
}))

import { persistDeleteImprovisationObject } from './persistImprovisationObject'
import { handleOrphanedImprovisedObjectFinding } from './handleOrphanedImprovisedObjectFinding'
import type { DiagnosticsOrphanedImprovisedObjectFindingEvent } from '@tonylb/mtw-interfaces/ts/eventBridge/diagnostics'

const persistDeleteMock = persistDeleteImprovisationObject as jest.MockedFunction<
    typeof persistDeleteImprovisationObject
>

const baseFinding: DiagnosticsOrphanedImprovisedObjectFindingEvent = {
    type: 'Orphaned Improvised Object Finding',
    objectId: 'OBJECT#Skates',
    diagnosticRunId: 'run-1',
    timestamp: '2025-01-01T00:00:00.000Z',
}

describe('handleOrphanedImprovisedObjectFinding', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        persistDeleteMock.mockResolvedValue({ ok: true, objectId: 'OBJECT#Skates' })
    })

    it('calls persistDeleteImprovisationObject with objectId only', async () => {
        await handleOrphanedImprovisedObjectFinding(baseFinding)

        expect(persistDeleteMock).toHaveBeenCalledTimes(1)
        expect(persistDeleteMock).toHaveBeenCalledWith({ objectId: 'OBJECT#Skates' })
    })

    it('no-ops when finding payload is invalid', async () => {
        await handleOrphanedImprovisedObjectFinding({
            ...baseFinding,
            objectId: 'ROOM#Cafe' as DiagnosticsOrphanedImprovisedObjectFindingEvent['objectId'],
        })

        expect(persistDeleteMock).not.toHaveBeenCalled()
    })

    it('logs when delete fails', async () => {
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined)
        persistDeleteMock.mockResolvedValue({ ok: false, errorMessage: 'transact failed' })

        await handleOrphanedImprovisedObjectFinding(baseFinding)

        expect(consoleErrorSpy).toHaveBeenCalledWith(
            '[mtw.ephemera.objects] orphaned improvised object repair delete failed',
            {
                objectId: 'OBJECT#Skates',
                diagnosticRunId: 'run-1',
                deleteError: 'transact failed',
            }
        )
        consoleErrorSpy.mockRestore()
    })

    it('returns silently when delete succeeds', async () => {
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined)

        await handleOrphanedImprovisedObjectFinding(baseFinding)

        expect(consoleErrorSpy).not.toHaveBeenCalled()
        consoleErrorSpy.mockRestore()
    })
})
