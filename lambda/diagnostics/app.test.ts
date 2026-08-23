import { jest, describe, it, expect, beforeEach } from '@jest/globals'
import type { EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import type { RenderCacheTargetCatalog } from '@tonylb/mtw-interfaces/ts/eventBridge/diagnostics'

jest.mock('./staleSessionSweep', () => ({
    staleSessionSweep: jest.fn(async () => ({ emittedCount: 0, players: [] as string[] }))
}))
jest.mock('./roomOccupancyDriftSweep', () => ({
    roomOccupancyDriftSweep: jest.fn(async () => ({ emittedCount: 0, roomIds: [] as string[] }))
}))
jest.mock('./playerMisalignmentSweep', () => ({
    playerMisalignmentSweep: jest.fn(async () => ({ emittedCount: 0, players: [] as string[] }))
}))
jest.mock('./componentVerticalMisalignmentSweep', () => ({
    componentVerticalMisalignmentSweep: jest.fn(async () => ({ emitted: false }))
}))
jest.mock('./renderCacheDriftSweep', () => ({
    renderCacheDriftSweep: jest.fn(async () => ({
        emittedCount: 0,
        roomIds: [] as EphemeraRoomId[],
        catalogsChecked: 0,
        driftedCatalogs: [] as RenderCacheTargetCatalog[],
    }))
}))
jest.mock('./orphanedImprovisedObjectSweep', () => ({
    orphanedImprovisedObjectSweep: jest.fn(async () => ({ emittedCount: 0, objectIds: [] as string[] }))
}))
jest.mock('./ludicGraphStaleStructureSweep', () => ({
    ludicGraphStaleStructureSweep: jest.fn(async () => ({ emittedCount: 0, ephemeraIds: [] as string[] }))
}))
jest.mock('./ludicGraphPortMismatchSweep', () => ({
    ludicGraphPortMismatchSweep: jest.fn(async () => ({ emittedCount: 0, ports: [] as { ephemeraId: string; portId: string }[] }))
}))

import { staleSessionSweep } from './staleSessionSweep'
import { roomOccupancyDriftSweep } from './roomOccupancyDriftSweep'
import { playerMisalignmentSweep } from './playerMisalignmentSweep'
import { componentVerticalMisalignmentSweep } from './componentVerticalMisalignmentSweep'
import { renderCacheDriftSweep } from './renderCacheDriftSweep'
import { orphanedImprovisedObjectSweep } from './orphanedImprovisedObjectSweep'
import { ludicGraphStaleStructureSweep } from './ludicGraphStaleStructureSweep'
import { ludicGraphPortMismatchSweep } from './ludicGraphPortMismatchSweep'
import { handler } from './app'

describe('diagnostics handler', () => {
    beforeEach(() => {
        jest.mocked(staleSessionSweep).mockReset()
        jest.mocked(staleSessionSweep).mockResolvedValue({ emittedCount: 0, players: [] as string[] })
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
        jest.mocked(ludicGraphStaleStructureSweep).mockReset()
        jest.mocked(ludicGraphStaleStructureSweep).mockResolvedValue({ emittedCount: 0, ephemeraIds: [] as EphemeraMembershipHostId[] })
        jest.mocked(ludicGraphPortMismatchSweep).mockReset()
        jest.mocked(ludicGraphPortMismatchSweep).mockResolvedValue({ emittedCount: 0, ports: [] })
    })

    it('invokes staleSessionSweep for direct StaleSessionSweep via api.diagnostics synthetic lane', async () => {
        const result = await handler({
            type: 'StaleSessionSweep',
            diagnosticRunId: 'dr-1'
        })

        expect(staleSessionSweep).toHaveBeenCalledWith({ diagnosticRunId: 'dr-1' })
        expect(result).toEqual({ emittedCount: 0, players: [] })
    })

    it('invokes staleSessionSweep for mtw.connections Session Disconnect Problem', async () => {
        await handler({
            source: 'mtw.connections',
            'detail-type': 'Session Disconnect Problem',
            detail: {
                sessionId: 'session-1',
                player: 'player-1',
                sourceOperation: 'checkSession',
                attemptCount: 3,
                dedupeKey: 'session-1::checkSession::3'
            }
        })

        expect(staleSessionSweep).toHaveBeenCalledWith()
    })

    it('drops malformed mtw.connections Session Disconnect Problem payloads without throwing', async () => {
        await expect(handler({
            source: 'mtw.connections',
            'detail-type': 'Session Disconnect Problem',
            detail: {
                sessionId: 'session-1',
                sourceOperation: 'checkSession',
                attemptCount: 3
            }
        })).resolves.toBeUndefined()

        expect(staleSessionSweep).not.toHaveBeenCalled()
    })

    it('passes nowMs through direct StaleSessionSweep synthetic intake', async () => {
        const result = await handler({
            type: 'StaleSessionSweep',
            diagnosticRunId: 'dr-2',
            nowMs: 12345
        })

        expect(staleSessionSweep).toHaveBeenCalledWith({
            diagnosticRunId: 'dr-2',
            nowMs: 12345
        })
        expect(result).toEqual({ emittedCount: 0, players: [] })
    })

    it('invokes roomOccupancyDriftSweep for direct RoomOccupancyDriftSweep type', async () => {
        const result = await handler({
            type: 'RoomOccupancyDriftSweep',
            diagnosticRunId: 'dr-3',
            nowMs: 67890
        })

        expect(roomOccupancyDriftSweep).toHaveBeenCalledWith({
            diagnosticRunId: 'dr-3',
            nowMs: 67890
        })
        expect(result).toEqual({ emittedCount: 0, roomIds: [] })
    })

    it('invokes playerMisalignmentSweep for direct PlayerMisalignmentSweep type', async () => {
        const result = await handler({
            type: 'PlayerMisalignmentSweep',
            diagnosticRunId: 'dr-4',
            nowMs: 98765
        })

        expect(playerMisalignmentSweep).toHaveBeenCalledWith({
            diagnosticRunId: 'dr-4',
            nowMs: 98765
        })
        expect(result).toEqual({ emittedCount: 0, players: [] })
    })

    it('invokes componentVerticalMisalignmentSweep for direct ComponentVerticalMisalignmentSweep type', async () => {
        jest.mocked(componentVerticalMisalignmentSweep).mockResolvedValueOnce({
            emitted: true,
            status: 'missing',
        })
        const result = await handler({
            type: 'ComponentVerticalMisalignmentSweep',
            assetId: 'ASSET#sweep-asset',
            diagnosticRunId: 'dr-cv',
            nowMs: 4242,
        })

        expect(componentVerticalMisalignmentSweep).toHaveBeenCalledWith({
            assetId: 'ASSET#sweep-asset',
            diagnosticRunId: 'dr-cv',
            nowMs: 4242,
        })
        expect(result).toEqual({ emitted: true, status: 'missing' })
    })

    it('invokes renderCacheDriftSweep for direct RenderCacheDriftSweep type', async () => {
        jest.mocked(renderCacheDriftSweep).mockResolvedValueOnce({
            emittedCount: 0,
            roomIds: ['ROOM#alpha' as EphemeraRoomId],
            catalogsChecked: 0,
            driftedCatalogs: [] as RenderCacheTargetCatalog[],
        })
        const result = await handler({
            type: 'RenderCacheDriftSweep',
            roomIds: ['ROOM#alpha', 'ROOM#alpha'],
            diagnosticRunId: 'dr-rc',
            nowMs: 3333,
        })

        expect(renderCacheDriftSweep).toHaveBeenCalledWith({
            roomIds: ['ROOM#alpha', 'ROOM#alpha'],
            diagnosticRunId: 'dr-rc',
            nowMs: 3333,
        })
        expect(result).toEqual({
            emittedCount: 0,
            roomIds: ['ROOM#alpha'],
            catalogsChecked: 0,
            driftedCatalogs: [],
        })
    })

    it('invokes orphanedImprovisedObjectSweep for direct OrphanedImprovisedObjectSweep type', async () => {
        jest.mocked(orphanedImprovisedObjectSweep).mockResolvedValueOnce({
            emittedCount: 1,
            objectIds: ['OBJECT#Skates' as EphemeraObjectId],
        })
        const result = await handler({
            type: 'OrphanedImprovisedObjectSweep',
            objectIds: ['OBJECT#Skates'],
            diagnosticRunId: 'dr-orphan',
            nowMs: 4444,
        })

        expect(orphanedImprovisedObjectSweep).toHaveBeenCalledWith({
            objectIds: ['OBJECT#Skates'],
            diagnosticRunId: 'dr-orphan',
            nowMs: 4444,
        })
        expect(result).toEqual({ emittedCount: 1, objectIds: ['OBJECT#Skates'] })
    })

    it('invokes orphanedImprovisedObjectSweep for mtw.ephemera.objects Spawn Compensation Problem', async () => {
        await handler({
            source: 'mtw.ephemera.objects',
            'detail-type': 'Spawn Compensation Problem',
            detail: {
                objectId: 'OBJECT#Skates',
                targetRoomId: 'ROOM#Cafe',
                sourceOperation: 'spawnOneImprovisationObject',
                placementError: 'placement failed',
                deleteError: 'delete failed',
                attemptCount: 1,
                dedupeKey: 'OBJECT#Skates::spawnCompensation::1',
            },
        })

        expect(orphanedImprovisedObjectSweep).toHaveBeenCalledWith({ objectIds: ['OBJECT#Skates'] })
    })

    it('drops malformed mtw.ephemera.objects Spawn Compensation Problem payloads without throwing', async () => {
        await expect(handler({
            source: 'mtw.ephemera.objects',
            'detail-type': 'Spawn Compensation Problem',
            detail: {
                objectId: 'OBJECT#Skates',
                targetRoomId: 'ROOM#Cafe',
                sourceOperation: 'spawnOneImprovisationObject',
                placementError: 'placement failed',
                attemptCount: 1,
            },
        })).resolves.toBeUndefined()

        expect(orphanedImprovisedObjectSweep).not.toHaveBeenCalled()
    })

    // Regression: the direct-invoke allow-list in app.ts named this type, but ingress.ts's
    // normalizeApiDiagnosticsIngress switch had no matching case, so the sweep silently never ran.
    it('invokes ludicGraphStaleStructureSweep for direct LudicGraphStaleStructureSweep type', async () => {
        jest.mocked(ludicGraphStaleStructureSweep).mockResolvedValueOnce({
            emittedCount: 1,
            ephemeraIds: ['ROOM#Kitchen' as EphemeraMembershipHostId],
        })
        const result = await handler({
            type: 'LudicGraphStaleStructureSweep',
            diagnosticRunId: 'dr-lgss',
            nowMs: 5555,
        })

        expect(ludicGraphStaleStructureSweep).toHaveBeenCalledWith({
            diagnosticRunId: 'dr-lgss',
            nowMs: 5555,
        })
        expect(result).toEqual({ emittedCount: 1, ephemeraIds: ['ROOM#Kitchen'] })
    })

    // Same regression shape as the case above: app.ts's allow-list and ingress.ts's switch have
    // to be added together, or the direct invoke is accepted and then silently dropped.
    it('invokes ludicGraphPortMismatchSweep for direct LudicGraphPortMismatchSweep type', async () => {
        jest.mocked(ludicGraphPortMismatchSweep).mockResolvedValueOnce({
            emittedCount: 1,
            ports: [{ ephemeraId: 'OBJECT#Rope' as EphemeraMembershipHostId, portId: 'abcd123' }],
        })
        const result = await handler({
            type: 'LudicGraphPortMismatchSweep',
            diagnosticRunId: 'dr-lgpm',
            nowMs: 5555,
        })

        expect(ludicGraphPortMismatchSweep).toHaveBeenCalledWith({
            diagnosticRunId: 'dr-lgpm',
            nowMs: 5555,
        })
        expect(result).toEqual({ emittedCount: 1, ports: [{ ephemeraId: 'OBJECT#Rope', portId: 'abcd123' }] })
    })

})
