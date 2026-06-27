jest.mock('./handleOrphanedImprovisedObjectFinding', () => ({
    handleOrphanedImprovisedObjectFinding: jest.fn(),
}))

import './index'
import { ephemeraObjectsDataSource } from './index'
import { handleOrphanedImprovisedObjectFinding } from './handleOrphanedImprovisedObjectFinding'

const handleOrphanedImprovisedObjectFindingMock = handleOrphanedImprovisedObjectFinding as jest.MockedFunction<
    typeof handleOrphanedImprovisedObjectFinding
>

describe('mtw.ephemera.objects DataSource', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        handleOrphanedImprovisedObjectFindingMock.mockResolvedValue(undefined)
    })

    it('registers mtw.ephemera.objects', () => {
        expect(ephemeraObjectsDataSource.dataSourceKey).toBe('mtw.ephemera.objects')
    })

    it('receiveEvents dispatches Orphaned Improvised Object Finding to handleOrphanedImprovisedObjectFinding', async () => {
        const finding = {
            type: 'Orphaned Improvised Object Finding' as const,
            objectId: 'OBJECT#Skates' as const,
            diagnosticRunId: 'run-1',
            timestamp: '2025-01-01T00:00:00.000Z',
        }
        const events: any[] = [
            {
                header: {
                    dataSourceKey: 'mtw.diagnostics',
                    streamKey: 'global',
                    timestamp: Date.now(),
                    type: 'Orphaned Improvised Object Finding',
                },
                getContent: () => Promise.resolve(finding),
            },
        ]

        await ephemeraObjectsDataSource.receiveEvents?.({
            events,
            streamEvent: jest.fn().mockResolvedValue(undefined),
            streamEnvelope: jest.fn().mockResolvedValue(undefined),
        })

        expect(handleOrphanedImprovisedObjectFindingMock).toHaveBeenCalledTimes(1)
        expect(handleOrphanedImprovisedObjectFindingMock).toHaveBeenCalledWith(finding)
    })
})
