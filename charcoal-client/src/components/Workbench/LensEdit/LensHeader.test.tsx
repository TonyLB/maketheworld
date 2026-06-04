/**
 * @vitest-environment jsdom
 */

import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, screen } from '@testing-library/react'
import type { AssetUUID, ComponentUUID } from '@tonylb/mtw-base/ts/schema'
import StandardRoom from '@tonylb/mtw-wml/ts/standardize/components/room'

import { deIndentWML } from '@tonylb/mtw-wml/ts/schema/utils'

import { LensHeader } from './LensHeader'
import {
    applyLastFlushToCommitted,
    materializeComponentInAssetMock,
    mockMaterializeComponentInAsset,
    mockMaterializeComponentInAssetImport,
    renderWorkbenchComponentSession,
    resetWorkbenchAssetMock,
    updateStandardMock
} from '../foundations/WorkbenchComponent/testing/harness'

const pushChoiceMock = vi.fn()
const confirmOrphanClosureMock = vi.fn().mockResolvedValue(true)

const ROOM_ID = 'ROOM#room1' as ComponentUUID
const ROOM2_ID = 'ROOM#room2' as ComponentUUID
const LENS_ID = 'LENS#lens1' as ComponentUUID

const FLUSH_DELAY_MS = 100

vi.mock('react-redux', () => ({
    useDispatch: () =>
        vi.fn((action: unknown) => {
            if (typeof action === 'function') {
                return (action as (dispatch: unknown) => unknown)(vi.fn())
            }
            return action
        })
}))

vi.mock('../foundations/useWorkbenchAsset', async (importOriginal) => {
    const mock = await import('../foundations/WorkbenchComponent/testing/mock')
    return {
        useWorkbenchAsset: () => mock.mockWorkbenchReturn
    }
})

vi.mock('../../../../slices/UI/choiceDialog', () => ({
    pushChoice: (choice: unknown) => {
        pushChoiceMock(choice)
        return () => Promise.resolve('confirm')
    }
}))

vi.mock('../foundations/consistency/confirmOrphanClosureBeforeLocalEdit', () => ({
    confirmOrphanClosureBeforeComponentDisassociate: (...args: unknown[]) =>
        confirmOrphanClosureMock(...args)
}))

vi.mock('../ImportComponentDialog', () => ({
    default: ({
        open,
        onImportSelect
    }: {
        open: boolean
        onImportSelect: (
            fromAsset: AssetUUID,
            uuid: ComponentUUID,
            tag: 'Lens'
        ) => void
    }) =>
        open ? (
            <button
                type="button"
                data-testid="mock-import-select"
                onClick={() =>
                    onImportSelect(
                        'ASSET#source' as AssetUUID,
                        'LENS#imported' as ComponentUUID,
                        'Lens'
                    )
                }
            >
                Mock Import Select
            </button>
        ) : null
}))

const roomWithLensWml = `
    <Asset uuid=(test)>
        <Room uuid=(room1) key=(room1)><ShortName>R1</ShortName><Lens uuid=(lens1)/></Room>
        <Lens uuid=(lens1)><ShortName>My Lens</ShortName></Lens>
    </Asset>
`

const nestedOnlyLensWml = deIndentWML(`
    <Asset uuid=(test)>
        <Room uuid=(room1) key=(room1)><ShortName>R1</ShortName><Lens uuid=(lens1)><ShortName>My Lens</ShortName></Lens></Room>
    </Asset>
`)

const topLevelLensWml = `
    <Asset uuid=(test)>
        <Room uuid=(room1) key=(room1)><ShortName>R1</ShortName><Lens uuid=(lens1)/></Room>
        <Lens uuid=(lens1)><ShortName>My Lens</ShortName></Lens>
    </Asset>
`

const sharedLensWml = `
    <Asset uuid=(test)>
        <Room uuid=(room1) key=(room1)><ShortName>R1</ShortName><Lens uuid=(lens1)/></Room>
        <Room uuid=(room2) key=(room2)><ShortName>R2</ShortName><Lens uuid=(lens1)/></Room>
        <Lens uuid=(lens1)><ShortName>Shared Lens</ShortName></Lens>
    </Asset>
`

const roomWithoutLensWml = `
    <Asset uuid=(test)>
        <Room uuid=(room1) key=(room1)><ShortName>R1</ShortName></Room>
    </Asset>
`

const flushAsync = async (): Promise<void> => {
    await act(async () => {
        await Promise.resolve()
        await Promise.resolve()
    })
}

const renderLensHeader = (wml: string, roomId: ComponentUUID = ROOM_ID) =>
    renderWorkbenchComponentSession<StandardRoom>({
        options: {
            wml,
            componentId: roomId,
            guard: (c): c is StandardRoom => c instanceof StandardRoom,
            flushDelayMs: FLUSH_DELAY_MS
        },
        children: <LensHeader RoomId={roomId} />
    })

describe('LensHeader', () => {
    beforeEach(() => {
        vi.useFakeTimers()
        resetWorkbenchAssetMock()
        pushChoiceMock.mockClear()
        confirmOrphanClosureMock.mockClear()
        confirmOrphanClosureMock.mockResolvedValue(true)
    })

    afterEach(() => {
        vi.clearAllTimers()
        vi.useRealTimers()
    })

    it('shows Room not found when RoomId is not in standardForm', () => {
        renderLensHeader('<Asset uuid=(test) />')
        expect(screen.getByText('Room not found')).toBeTruthy()
    })

    it('shows Create New Lens, Reference Existing Lens, and Import Lens when room has no lens', () => {
        renderLensHeader(roomWithoutLensWml)
        fireEvent.click(screen.getByRole('button', { name: /Dynamic Rendering/i }))
        expect(screen.getByText('Create New Lens')).toBeTruthy()
        expect(screen.getByText('Reference Existing Lens')).toBeTruthy()
        expect(screen.getByText('Import Lens')).toBeTruthy()
    })

    it('create new awaits materialize then associates on working without immediate flush', async () => {
        mockMaterializeComponentInAsset()

        const { getSession } = renderLensHeader(roomWithoutLensWml)
        fireEvent.click(screen.getByRole('button', { name: /Dynamic Rendering/i }))

        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: /Create New Lens/i }))
        })
        await flushAsync()

        expect(materializeComponentInAssetMock).toHaveBeenCalledTimes(1)

        const spec = materializeComponentInAssetMock.mock.calls[0]![0]!
        expect(spec.universalKey).toMatch(/^LENS#/)
        expect(spec.fromAsset).toBeUndefined()

        expect(getSession().working?.lens.payload.length).toBe(1)
        expect(getSession().working?.lens.payload[0]!.universalKey).toBe(spec.universalKey)

        expect(updateStandardMock).not.toHaveBeenCalled()
    })

    it('create new debounced flush uses updateLocal', async () => {
        mockMaterializeComponentInAsset()

        renderLensHeader(roomWithoutLensWml)
        fireEvent.click(screen.getByRole('button', { name: /Dynamic Rendering/i }))

        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: /Create New Lens/i }))
        })
        await flushAsync()

        expect(materializeComponentInAssetMock).toHaveBeenCalledTimes(1)

        const materializedKey = materializeComponentInAssetMock.mock.calls[0]![0]!.universalKey

        act(() => {
            vi.advanceTimersByTime(FLUSH_DELAY_MS)
        })

        expect(updateStandardMock).toHaveBeenCalledTimes(1)
        expect(updateStandardMock.mock.calls[0]![0]).toMatchObject({ type: 'updateLocal' })

        const flushUpdate = updateStandardMock.mock.calls[0]![0]!.update
        const { mockWorkbenchReturn } = await import('../foundations/WorkbenchComponent/testing/mock')
        const draft = mockWorkbenchReturn.localStandardForm._clone()
        expect(draft.byUniversalId[materializedKey]).toBeDefined()

        flushUpdate(draft)

        expect(draft.byUniversalId[materializedKey]).toBeDefined()
        const room = draft.byUniversalId[ROOM_ID]
        expect(room instanceof StandardRoom).toBe(true)
        if (room instanceof StandardRoom) {
            expect(room.lens.payload.length).toBe(1)
        }
    })

    it('import awaits materialize then associates on working', async () => {
        mockMaterializeComponentInAssetImport()

        const { getSession } = renderLensHeader(roomWithoutLensWml)
        fireEvent.click(screen.getByRole('button', { name: /Dynamic Rendering/i }))

        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: /Import Lens/i }))
        })
        await act(async () => {
            fireEvent.click(screen.getByTestId('mock-import-select'))
        })
        await flushAsync()

        expect(materializeComponentInAssetMock).toHaveBeenCalledTimes(1)

        expect(materializeComponentInAssetMock.mock.calls[0]![0]).toEqual({
            universalKey: 'LENS#imported',
            fromAsset: 'ASSET#source'
        })

        expect(getSession().working?.lens.payload.length).toBe(1)
        expect(getSession().working?.lens.payload[0]!.universalKey).toBe('LENS#imported')

        expect(updateStandardMock).not.toHaveBeenCalled()
    })

    it('shows lens summary and Edit when room has a lens', () => {
        const onEditLens = vi.fn()
        renderWorkbenchComponentSession<StandardRoom>({
            options: {
                wml: roomWithLensWml,
                componentId: ROOM_ID,
                guard: (c): c is StandardRoom => c instanceof StandardRoom,
                flushDelayMs: FLUSH_DELAY_MS
            },
            children: <LensHeader RoomId={ROOM_ID} onEditLens={onEditLens} />
        })
        expect(screen.getByText('My Lens')).toBeTruthy()
        fireEvent.click(screen.getByLabelText('Edit Lens'))
        expect(onEditLens).toHaveBeenCalledWith(LENS_ID)
    })

    it('shows fallback label when lens has no short name', () => {
        renderLensHeader(`
            <Asset uuid=(test)>
                <Room uuid=(room1) key=(room1)><ShortName>R1</ShortName><Lens uuid=(lens1)/></Room>
                <Lens uuid=(lens1)></Lens>
            </Asset>
        `)
        expect(screen.getByText('Lens (no short name)')).toBeTruthy()
    })

    it('disables action buttons when readonly', () => {
        renderWorkbenchComponentSession<StandardRoom>({
            options: {
                wml: roomWithoutLensWml,
                componentId: ROOM_ID,
                guard: (c): c is StandardRoom => c instanceof StandardRoom,
                flushDelayMs: FLUSH_DELAY_MS,
                readonly: true
            },
            children: <LensHeader RoomId={ROOM_ID} />
        })
        fireEvent.click(screen.getByRole('button', { name: /Dynamic Rendering/i }))
        const createButton = screen.getByRole('button', { name: /Create New Lens/i })
        expect(createButton.getAttribute('aria-disabled')).toBe('true')
    })

    it('delete disassociates lens on working without removeComponent', async () => {
        const { getSession } = renderLensHeader(roomWithLensWml)

        await act(async () => {
            fireEvent.click(screen.getByLabelText('Delete Lens reference'))
            await flushAsync()
        })

        expect(getSession().working?.lens.payload.length).toBe(0)
        expect(updateStandardMock).not.toHaveBeenCalledWith(
            expect.objectContaining({ type: 'removeComponent' })
        )
    })

    it('debounced flush persists lens disassociate via updateLocal', async () => {
        renderLensHeader(roomWithLensWml)

        await act(async () => {
            fireEvent.click(screen.getByLabelText('Delete Lens reference'))
            await flushAsync()
            vi.advanceTimersByTime(FLUSH_DELAY_MS)
        })

        expect(updateStandardMock).toHaveBeenCalledTimes(1)
        expect(updateStandardMock.mock.calls[0]![0]).toMatchObject({ type: 'updateLocal' })
    })

    it('flush after delete retains orphaned nested lens in byUniversalId (assign only)', async () => {
        renderLensHeader(nestedOnlyLensWml)

        await act(async () => {
            fireEvent.click(screen.getByLabelText('Delete Lens reference'))
            await flushAsync()
            vi.advanceTimersByTime(FLUSH_DELAY_MS)
        })

        const flushed = applyLastFlushToCommitted()
        expect(flushed.byUniversalId[LENS_ID]).toBeDefined()
    })

    it('keeps lens body when deleted from room but lens is on top level', async () => {
        renderLensHeader(topLevelLensWml)

        await act(async () => {
            fireEvent.click(screen.getByLabelText('Delete Lens reference'))
            await flushAsync()
            vi.advanceTimersByTime(FLUSH_DELAY_MS)
        })

        const flushed = applyLastFlushToCommitted()
        expect(flushed.byUniversalId[LENS_ID]).toBeDefined()
    })

    it('keeps lens body when deleted from one room but shared by another', async () => {
        renderLensHeader(sharedLensWml, ROOM_ID)

        await act(async () => {
            fireEvent.click(screen.getByLabelText('Delete Lens reference'))
            await flushAsync()
            vi.advanceTimersByTime(FLUSH_DELAY_MS)
        })

        const flushed = applyLastFlushToCommitted()
        expect(flushed.byUniversalId[LENS_ID]).toBeDefined()
        const room2 = flushed.byUniversalId[ROOM2_ID] as StandardRoom
        expect(room2.lens.payload.length).toBe(1)
    })

    it('delete with non-empty nested lens calls confirm before disassociate', async () => {
        renderLensHeader(nestedOnlyLensWml)
        expect(screen.getByText('My Lens')).toBeTruthy()

        await act(async () => {
            fireEvent.click(screen.getByLabelText('Delete Lens reference'))
            await flushAsync()
        })

        expect(confirmOrphanClosureMock).toHaveBeenCalledTimes(1)
        expect(confirmOrphanClosureMock.mock.calls[0]![0]).toMatchObject({
            componentId: ROOM_ID
        })
    })
})
