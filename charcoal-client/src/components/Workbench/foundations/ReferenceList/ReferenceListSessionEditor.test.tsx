/**
 * @vitest-environment jsdom
 */

import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, screen } from '@testing-library/react'
import type { AssetUUID, ComponentUUID } from '@tonylb/mtw-base/ts/schema'
import StandardRoom from '@tonylb/mtw-wml/ts/standardize/components/room'
import type { StandardComponent } from '@tonylb/mtw-wml/ts/standardize/components/baseClasses'

import { ReferenceListSessionEditor } from './ReferenceListSessionEditor'
import {
    materializeComponentInAssetMock,
    mockMaterializeComponentInAsset,
    mockMaterializeComponentInAssetImport,
    renderWorkbenchComponentSession,
    resetWorkbenchAssetMock,
    updateStandardMock
} from '../WorkbenchComponent/testing/harness'
import { roomGuidanceListAccessor } from '../../RoomEdit/roomReferenceListAccessors'

vi.mock('react-redux', () => ({
    useDispatch: () => vi.fn()
}))

vi.mock('../useWorkbenchAsset', async (importOriginal) => {
    const mock = await import('../WorkbenchComponent/testing/mock')
    return {
        useWorkbenchAsset: () => mock.mockWorkbenchReturn
    }
})

vi.mock('../../ImportComponentDialog', () => ({
    default: ({
        open,
        onImportSelect
    }: {
        open: boolean
        onImportSelect: (
            fromAsset: AssetUUID,
            uuid: ComponentUUID,
            tag: 'Guidance'
        ) => void
    }) =>
        open ? (
            <button
                type="button"
                data-testid="mock-import-select"
                onClick={() =>
                    onImportSelect(
                        'ASSET#source' as AssetUUID,
                        'GUIDANCE#imported' as ComponentUUID,
                        'Guidance'
                    )
                }
            >
                Mock Import Select
            </button>
        ) : null
}))

const ROOM_ID = 'ROOM#room1' as ComponentUUID
const FLUSH_DELAY_MS = 100

const roomWithGuidanceWml = `
    <Asset uuid=(test)>
        <Room uuid=(room1)>
            <ShortName>Test Room</ShortName>
            <Guidance uuid=(guid1)><ShortName>Guidance One</ShortName></Guidance>
        </Room>
    </Asset>
`

const roomWithoutGuidanceWml = `
    <Asset uuid=(test)>
        <Room uuid=(room1)>
            <ShortName>Test Room</ShortName>
        </Room>
    </Asset>
`

const roomGuard = (
    component: StandardComponent | undefined
): component is StandardRoom => component instanceof StandardRoom

const flushAsync = async (): Promise<void> => {
    await act(async () => {
        await Promise.resolve()
        await Promise.resolve()
    })
}

describe('ReferenceListSessionEditor', () => {
    beforeEach(() => {
        vi.useFakeTimers()
        resetWorkbenchAssetMock()
    })

    afterEach(() => {
        vi.clearAllTimers()
        vi.useRealTimers()
    })

    it('reads list from session working, not live Redux alone', () => {
        const { getSession } = renderWorkbenchComponentSession({
            options: {
                wml: roomWithGuidanceWml,
                componentId: ROOM_ID,
                guard: roomGuard,
                flushDelayMs: FLUSH_DELAY_MS
            },
            children: (
                <ReferenceListSessionEditor
                    title="Guidance"
                    listAccessor={roomGuidanceListAccessor}
                    tag="Guidance"
                />
            )
        })

        expect(
            roomGuidanceListAccessor.getReferenceList(getSession().working!).payload.length
        ).toBe(1)
        expect(screen.getAllByText('Guidance One').length).toBeGreaterThan(0)
    })

    it('remove does not call updateStandard before debounce', () => {
        const { getSession } = renderWorkbenchComponentSession({
            options: {
                wml: roomWithGuidanceWml,
                componentId: ROOM_ID,
                guard: roomGuard,
                flushDelayMs: FLUSH_DELAY_MS
            },
            children: (
                <ReferenceListSessionEditor
                    title="Guidance"
                    listAccessor={roomGuidanceListAccessor}
                    tag="Guidance"
                />
            )
        })

        const deleteButtons = screen.getAllByLabelText('remove')
        act(() => {
            fireEvent.click(deleteButtons[0])
        })

        expect(
            roomGuidanceListAccessor.getReferenceList(getSession().working!).payload.length
        ).toBe(0)
        expect(updateStandardMock).not.toHaveBeenCalled()
    })

    it('debounced flush persists list-only remove', () => {
        renderWorkbenchComponentSession({
            options: {
                wml: roomWithGuidanceWml,
                componentId: ROOM_ID,
                guard: roomGuard,
                flushDelayMs: FLUSH_DELAY_MS
            },
            children: (
                <ReferenceListSessionEditor
                    title="Guidance"
                    listAccessor={roomGuidanceListAccessor}
                    tag="Guidance"
                />
            )
        })

        const deleteButtons = screen.getAllByLabelText('remove')
        act(() => {
            fireEvent.click(deleteButtons[0])
            vi.advanceTimersByTime(FLUSH_DELAY_MS)
        })

        expect(updateStandardMock).toHaveBeenCalledTimes(1)
    })

    it('create new awaits materialize then associates on working without immediate flush', async () => {
        mockMaterializeComponentInAsset()

        const { getSession } = renderWorkbenchComponentSession({
            options: {
                wml: roomWithoutGuidanceWml,
                componentId: ROOM_ID,
                guard: roomGuard,
                flushDelayMs: FLUSH_DELAY_MS
            },
            children: (
                <ReferenceListSessionEditor
                    title="Guidance"
                    listAccessor={roomGuidanceListAccessor}
                    tag="Guidance"
                />
            )
        })

        await act(async () => {
            fireEvent.click(screen.getByText('Add Guidance'))
        })
        await flushAsync()

        expect(materializeComponentInAssetMock).toHaveBeenCalledTimes(1)

        const spec = materializeComponentInAssetMock.mock.calls[0]![0]!
        expect(spec.universalKey).toMatch(/^GUIDANCE#/)
        expect(spec.fromAsset).toBeUndefined()

        expect(
            roomGuidanceListAccessor.getReferenceList(getSession().working!).payload.length
        ).toBe(1)
        expect(
            roomGuidanceListAccessor
                .getReferenceList(getSession().working!)
                .payload[0]!.universalKey
        ).toBe(spec.universalKey)

        expect(updateStandardMock).not.toHaveBeenCalled()
    })

    it('create new debounced flush uses updateLocal without inline byUniversalId create', async () => {
        mockMaterializeComponentInAsset()

        const { getSession } = renderWorkbenchComponentSession({
            options: {
                wml: roomWithoutGuidanceWml,
                componentId: ROOM_ID,
                guard: roomGuard,
                flushDelayMs: FLUSH_DELAY_MS
            },
            children: (
                <ReferenceListSessionEditor
                    title="Guidance"
                    listAccessor={roomGuidanceListAccessor}
                    tag="Guidance"
                />
            )
        })

        await act(async () => {
            fireEvent.click(screen.getByText('Add Guidance'))
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
        const { mockWorkbenchReturn } = await import('../WorkbenchComponent/testing/mock')
        const draft = mockWorkbenchReturn.localStandardForm._clone()
        expect(draft.byUniversalId[materializedKey]).toBeDefined()

        flushUpdate(draft)

        expect(draft.byUniversalId[materializedKey]).toBeDefined()
        const room = draft.byUniversalId[ROOM_ID]
        expect(room instanceof StandardRoom).toBe(true)
        if (room instanceof StandardRoom) {
            expect(roomGuidanceListAccessor.getReferenceList(room).payload.length).toBe(1)
        }
        expect(getSession().working).toBeDefined()
    })

    it('import awaits materialize then associates on working', async () => {
        mockMaterializeComponentInAssetImport()

        const { getSession } = renderWorkbenchComponentSession({
            options: {
                wml: roomWithoutGuidanceWml,
                componentId: ROOM_ID,
                guard: roomGuard,
                flushDelayMs: FLUSH_DELAY_MS
            },
            children: (
                <ReferenceListSessionEditor
                    title="Guidance"
                    listAccessor={roomGuidanceListAccessor}
                    tag="Guidance"
                    affordance={{ enableImport: true }}
                />
            )
        })

        await act(async () => {
            fireEvent.click(screen.getByText('Import'))
        })
        await act(async () => {
            fireEvent.click(screen.getByTestId('mock-import-select'))
        })
        await flushAsync()

        expect(materializeComponentInAssetMock).toHaveBeenCalledTimes(1)

        expect(materializeComponentInAssetMock.mock.calls[0]![0]).toEqual({
            universalKey: 'GUIDANCE#imported',
            fromAsset: 'ASSET#source'
        })

        expect(
            roomGuidanceListAccessor.getReferenceList(getSession().working!).payload.length
        ).toBe(1)
        expect(
            roomGuidanceListAccessor
                .getReferenceList(getSession().working!)
                .payload[0]!.universalKey
        ).toBe('GUIDANCE#imported')

        expect(updateStandardMock).not.toHaveBeenCalled()
    })
})
