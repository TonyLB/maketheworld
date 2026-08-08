import { jest, describe, it, expect, beforeEach } from '@jest/globals'
import type { EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { RenderCacheTargetCatalog } from '@tonylb/mtw-interfaces/ts/eventBridge/diagnostics'

jest.mock('../staleSessionSweep', () => ({
    staleSessionSweep: jest.fn(async () => ({ emittedCount: 0, players: [] as string[] })),
    evaluateStaleSessionsForPlayer: jest.fn(async () => ({ emittedCount: 0, players: [] as string[] }))
}))
jest.mock('../roomOccupancyDriftSweep', () => ({
    roomOccupancyDriftSweep: jest.fn(async () => ({ emittedCount: 0, roomIds: [] as string[] }))
}))
jest.mock('../playerMisalignmentSweep', () => ({
    playerMisalignmentSweep: jest.fn(async () => ({ emittedCount: 0, players: [] as string[] }))
}))
jest.mock('../componentVerticalMisalignmentSweep', () => ({
    componentVerticalMisalignmentSweep: jest.fn(async () => ({ emitted: false }))
}))
jest.mock('../renderCacheDriftSweep', () => ({
    renderCacheDriftSweep: jest.fn(async () => ({
        emittedCount: 0,
        roomIds: [] as EphemeraRoomId[],
        catalogsChecked: 0,
        driftedCatalogs: [] as RenderCacheTargetCatalog[],
    }))
}))
jest.mock('../orphanedImprovisedObjectSweep', () => ({
    orphanedImprovisedObjectSweep: jest.fn(async () => ({ emittedCount: 0, objectIds: [] as string[] }))
}))

import { componentVerticalMisalignmentSweep } from '../componentVerticalMisalignmentSweep'
import { renderCacheDriftSweep } from '../renderCacheDriftSweep'
import { orphanedImprovisedObjectSweep } from '../orphanedImprovisedObjectSweep'
import { evaluateStaleSessionsForPlayer, staleSessionSweep } from '../staleSessionSweep'
import { roomOccupancyDriftSweep } from '../roomOccupancyDriftSweep'
import { playerMisalignmentSweep } from '../playerMisalignmentSweep'
import { processDiagnosticsSubscribedEvents } from './index'
import messageBus from '../messageBus'
import { getCollectedError, getCollectedReturnValueBody } from '../returnValue/collector'

const makeEnvelope = (header: { dataSourceKey: string; type: string }, content: unknown) => ({
    header: {
        dataSourceKey: header.dataSourceKey,
        type: header.type,
        streamKey: 'global',
        timestamp: Date.now()
    },
    getContent: async () => content
})

const sessionDisconnectProblemEnvelope = (dedupeKey: string) =>
    makeEnvelope(
        { dataSourceKey: 'mtw.connections', type: 'Session Disconnect Problem' },
        {
            type: 'Session Disconnect Problem',
            sessionId: 'session-1',
            sourceOperation: 'checkSession',
            attemptCount: 2,
            dedupeKey,
            timestamp: new Date().toISOString()
        }
    )

const staleSessionProblemEnvelope = (dedupeKey: string, player = 'player-one') =>
    makeEnvelope(
        { dataSourceKey: 'mtw.players', type: 'Stale Session Problem' },
        {
            type: 'Stale Session Problem',
            sessionId: 'session-stale',
            player,
            sourceOperation: 'connect',
            attemptCount: 1,
            dedupeKey,
            timestamp: new Date().toISOString()
        }
    )

const OBJECT_ID = 'OBJECT#Skates' as EphemeraObjectId

const spawnCompensationProblemEnvelope = (dedupeKey: string) =>
    makeEnvelope(
        { dataSourceKey: 'mtw.ephemera.objects', type: 'Spawn Compensation Problem' },
        {
            type: 'Spawn Compensation Problem',
            objectId: OBJECT_ID,
            targetRoomId: 'ROOM#Cafe',
            sourceOperation: 'spawnOneImprovisationObject',
            placementError: 'placement failed',
            deleteError: 'delete failed',
            attemptCount: 1,
            dedupeKey,
            timestamp: new Date().toISOString(),
        }
    )

describe('diagnosticsDataSource subscribed event processing', () => {
    beforeEach(() => {
        jest.mocked(staleSessionSweep).mockReset()
        jest.mocked(staleSessionSweep).mockResolvedValue({ emittedCount: 0, players: [] as string[] })
        jest.mocked(evaluateStaleSessionsForPlayer).mockReset()
        jest.mocked(evaluateStaleSessionsForPlayer).mockResolvedValue({ emittedCount: 0, players: [] as string[] })
        jest.mocked(roomOccupancyDriftSweep).mockReset()
        jest.mocked(roomOccupancyDriftSweep).mockResolvedValue({ emittedCount: 0, roomIds: [] as string[] })
        jest.mocked(playerMisalignmentSweep).mockReset()
        jest.mocked(playerMisalignmentSweep).mockResolvedValue({ emittedCount: 0, players: [] as string[] })
        jest.mocked(componentVerticalMisalignmentSweep).mockReset()
        jest.mocked(componentVerticalMisalignmentSweep).mockResolvedValue({ emitted: false })
        jest.mocked(renderCacheDriftSweep).mockReset()
        jest.mocked(renderCacheDriftSweep).mockResolvedValue({
            emittedCount: 0,
            roomIds: [] as EphemeraRoomId[],
            catalogsChecked: 0,
            driftedCatalogs: [] as RenderCacheTargetCatalog[],
        })
        jest.mocked(orphanedImprovisedObjectSweep).mockReset()
        jest.mocked(orphanedImprovisedObjectSweep).mockResolvedValue({ emittedCount: 0, objectIds: [] as EphemeraObjectId[] })
        messageBus.clear()
    })

    it('dedupes repeated Session Disconnect Problem reports by dedupeKey within one batch', async () => {
        await processDiagnosticsSubscribedEvents([
            sessionDisconnectProblemEnvelope('dup-1'),
            sessionDisconnectProblemEnvelope('dup-1'),
        ])

        expect(staleSessionSweep).toHaveBeenCalledTimes(1)
    })

    it('dedupes repeated Session Disconnect Problem reports by dedupeKey across separate receiveEvents calls', async () => {
        await processDiagnosticsSubscribedEvents([sessionDisconnectProblemEnvelope('dup-cross-batch')])
        await processDiagnosticsSubscribedEvents([sessionDisconnectProblemEnvelope('dup-cross-batch')])

        expect(staleSessionSweep).toHaveBeenCalledTimes(1)
    })

    it('runs staleSessionSweep for distinct dedupeKeys across separate receiveEvents calls', async () => {
        await processDiagnosticsSubscribedEvents([sessionDisconnectProblemEnvelope('dup-a')])
        await processDiagnosticsSubscribedEvents([sessionDisconnectProblemEnvelope('dup-b')])

        expect(staleSessionSweep).toHaveBeenCalledTimes(2)
    })

    it('passes diagnosticRunId through for api.diagnostics StaleSessionSweep events', async () => {
        await processDiagnosticsSubscribedEvents([
            makeEnvelope(
                { dataSourceKey: 'api.diagnostics', type: 'StaleSessionSweep' },
                {
                    type: 'StaleSessionSweep',
                    diagnosticRunId: 'diag-1'
                }
            )
        ])
        await messageBus.settle()

        expect(staleSessionSweep).toHaveBeenCalledWith({ diagnosticRunId: 'diag-1' })
        expect(Object.keys(getCollectedReturnValueBody()).length).toBeGreaterThan(0)
    })

    it('passes nowMs through for api.diagnostics StaleSessionSweep events', async () => {
        await processDiagnosticsSubscribedEvents([
            makeEnvelope(
                { dataSourceKey: 'api.diagnostics', type: 'StaleSessionSweep' },
                {
                    type: 'StaleSessionSweep',
                    nowMs: 12345
                }
            )
        ])
        await messageBus.settle()

        expect(staleSessionSweep).toHaveBeenCalledWith({ nowMs: 12345 })
        expect(Object.keys(getCollectedReturnValueBody()).length).toBeGreaterThan(0)
    })

    it('emits ReturnValue for api.diagnostics RoomOccupancyDriftSweep events', async () => {
        await processDiagnosticsSubscribedEvents([
            makeEnvelope(
                { dataSourceKey: 'api.diagnostics', type: 'RoomOccupancyDriftSweep' },
                {
                    type: 'RoomOccupancyDriftSweep',
                    diagnosticRunId: 'diag-2',
                    nowMs: 54321
                }
            )
        ])
        await messageBus.settle()

        expect(roomOccupancyDriftSweep).toHaveBeenCalledWith({ diagnosticRunId: 'diag-2', nowMs: 54321 })
        expect(Object.keys(getCollectedReturnValueBody()).length).toBeGreaterThan(0)
    })

    it('emits ReturnValue for api.diagnostics PlayerMisalignmentSweep events', async () => {
        await processDiagnosticsSubscribedEvents([
            makeEnvelope(
                { dataSourceKey: 'api.diagnostics', type: 'PlayerMisalignmentSweep' },
                {
                    type: 'PlayerMisalignmentSweep',
                    diagnosticRunId: 'diag-3',
                    nowMs: 67890
                }
            )
        ])
        await messageBus.settle()

        expect(playerMisalignmentSweep).toHaveBeenCalledWith({ diagnosticRunId: 'diag-3', nowMs: 67890 })
        expect(Object.keys(getCollectedReturnValueBody()).length).toBeGreaterThan(0)
    })

    it('invokes componentVerticalMisalignmentSweep for ComponentVerticalMisalignmentSweep with assetId', async () => {
        jest.mocked(componentVerticalMisalignmentSweep).mockResolvedValueOnce({
            emitted: true,
            status: 'missing',
        })
        await processDiagnosticsSubscribedEvents([
            makeEnvelope(
                { dataSourceKey: 'api.diagnostics', type: 'ComponentVerticalMisalignmentSweep' },
                {
                    type: 'ComponentVerticalMisalignmentSweep',
                    assetId: 'ASSET#diag-asset',
                    diagnosticRunId: 'diag-cv',
                    nowMs: 11111,
                }
            )
        ])
        await messageBus.settle()

        expect(componentVerticalMisalignmentSweep).toHaveBeenCalledWith({
            assetId: 'ASSET#diag-asset',
            diagnosticRunId: 'diag-cv',
            nowMs: 11111,
        })
        expect(Object.keys(getCollectedReturnValueBody()).length).toBeGreaterThan(0)
    })

    it('emits ReturnValue for api.diagnostics RenderCacheDriftSweep events', async () => {
        jest.mocked(renderCacheDriftSweep).mockResolvedValueOnce({
            emittedCount: 1,
            roomIds: ['ROOM#alpha' as EphemeraRoomId],
            catalogsChecked: 1,
            driftedCatalogs: [{ ephemeraId: 'ROOM#alpha' as EphemeraRoomId, perspectiveKey: 'PERSPECTIVE#v1#abc' }],
        })
        await processDiagnosticsSubscribedEvents([
            makeEnvelope(
                { dataSourceKey: 'api.diagnostics', type: 'RenderCacheDriftSweep' },
                {
                    type: 'RenderCacheDriftSweep',
                    roomIds: ['ROOM#alpha'],
                    diagnosticRunId: 'diag-rc',
                    nowMs: 22222,
                }
            )
        ])
        await messageBus.settle()

        expect(renderCacheDriftSweep).toHaveBeenCalledWith({
            roomIds: ['ROOM#alpha'],
            diagnosticRunId: 'diag-rc',
            nowMs: 22222,
        })
        expect(Object.keys(getCollectedReturnValueBody()).length).toBeGreaterThan(0)
    })

    it('emits Error when RenderCacheDriftSweep roomIds is not an array', async () => {
        await processDiagnosticsSubscribedEvents([
            makeEnvelope(
                { dataSourceKey: 'api.diagnostics', type: 'RenderCacheDriftSweep' },
                {
                    type: 'RenderCacheDriftSweep',
                    roomIds: 'ROOM#alpha',
                }
            )
        ])
        await messageBus.settle()

        expect(renderCacheDriftSweep).not.toHaveBeenCalled()
        expect(getCollectedError()).toEqual({
            error: 'RenderCacheDriftSweep requires roomIds array',
            statusCode: 400,
        })
    })

    it('triggers orphanedImprovisedObjectSweep for Spawn Compensation Problem with targeted objectId', async () => {
        await processDiagnosticsSubscribedEvents([spawnCompensationProblemEnvelope('skates-dup-1')])

        expect(orphanedImprovisedObjectSweep).toHaveBeenCalledWith({ objectIds: [OBJECT_ID] })
    })

    it('drops malformed Spawn Compensation Problem payloads without invoking sweep', async () => {
        await processDiagnosticsSubscribedEvents([
            makeEnvelope(
                { dataSourceKey: 'mtw.ephemera.objects', type: 'Spawn Compensation Problem' },
                {
                    type: 'Spawn Compensation Problem',
                    objectId: OBJECT_ID,
                    targetRoomId: 'ROOM#Cafe',
                    sourceOperation: 'spawnOneImprovisationObject',
                    placementError: 'placement failed',
                    attemptCount: 1,
                    dedupeKey: 'missing-delete-error',
                }
            )
        ])

        expect(orphanedImprovisedObjectSweep).not.toHaveBeenCalled()
    })

    it('dedupes repeated Spawn Compensation Problem reports by dedupeKey within one batch', async () => {
        await processDiagnosticsSubscribedEvents([
            spawnCompensationProblemEnvelope('skates-batch-dup'),
            spawnCompensationProblemEnvelope('skates-batch-dup'),
        ])

        expect(orphanedImprovisedObjectSweep).toHaveBeenCalledTimes(1)
    })

    it('dedupes repeated Spawn Compensation Problem reports by dedupeKey across separate receiveEvents calls', async () => {
        await processDiagnosticsSubscribedEvents([spawnCompensationProblemEnvelope('skates-cross-dup')])
        await processDiagnosticsSubscribedEvents([spawnCompensationProblemEnvelope('skates-cross-dup')])

        expect(orphanedImprovisedObjectSweep).toHaveBeenCalledTimes(1)
    })

    it('runs evaluateStaleSessionsForPlayer scoped to the reported player for Stale Session Problem', async () => {
        await processDiagnosticsSubscribedEvents([staleSessionProblemEnvelope('stale-dup-1', 'player-one')])

        expect(evaluateStaleSessionsForPlayer).toHaveBeenCalledWith({ player: 'player-one' })
        expect(staleSessionSweep).not.toHaveBeenCalled()
    })

    it('drops malformed Stale Session Problem payloads without invoking the scoped evaluator', async () => {
        await processDiagnosticsSubscribedEvents([
            makeEnvelope(
                { dataSourceKey: 'mtw.players', type: 'Stale Session Problem' },
                {
                    type: 'Stale Session Problem',
                    sessionId: 'session-stale',
                    player: 'player-one',
                    sourceOperation: 'connect',
                    attemptCount: 1
                    // missing dedupeKey
                }
            )
        ])

        expect(evaluateStaleSessionsForPlayer).not.toHaveBeenCalled()
    })

    it('dedupes repeated Stale Session Problem reports by dedupeKey within one batch', async () => {
        await processDiagnosticsSubscribedEvents([
            staleSessionProblemEnvelope('stale-batch-dup'),
            staleSessionProblemEnvelope('stale-batch-dup'),
        ])

        expect(evaluateStaleSessionsForPlayer).toHaveBeenCalledTimes(1)
    })

    it('dedupes repeated Stale Session Problem reports by dedupeKey across separate receiveEvents calls', async () => {
        await processDiagnosticsSubscribedEvents([staleSessionProblemEnvelope('stale-cross-dup')])
        await processDiagnosticsSubscribedEvents([staleSessionProblemEnvelope('stale-cross-dup')])

        expect(evaluateStaleSessionsForPlayer).toHaveBeenCalledTimes(1)
    })

    it('emits ReturnValue for api.diagnostics OrphanedImprovisedObjectSweep events', async () => {
        jest.mocked(orphanedImprovisedObjectSweep).mockResolvedValueOnce({
            emittedCount: 1,
            objectIds: [OBJECT_ID],
        })
        await processDiagnosticsSubscribedEvents([
            makeEnvelope(
                { dataSourceKey: 'api.diagnostics', type: 'OrphanedImprovisedObjectSweep' },
                {
                    type: 'OrphanedImprovisedObjectSweep',
                    objectIds: [OBJECT_ID],
                    diagnosticRunId: 'diag-orphan',
                    nowMs: 99999,
                }
            )
        ])
        await messageBus.settle()

        expect(orphanedImprovisedObjectSweep).toHaveBeenCalledWith({
            objectIds: [OBJECT_ID],
            diagnosticRunId: 'diag-orphan',
            nowMs: 99999,
        })
        expect(Object.keys(getCollectedReturnValueBody()).length).toBeGreaterThan(0)
    })
})
