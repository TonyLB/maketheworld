/**
 * @vitest-environment jsdom
 */

import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, screen } from '@testing-library/react'
import type { ComponentUUID } from '@tonylb/mtw-base/ts/schema'
import StandardRoom from '@tonylb/mtw-wml/ts/standardize/components/room'
import type { StandardComponent } from '@tonylb/mtw-wml/ts/standardize/components/baseClasses'

import { RoomSituationsListEditor } from './RoomSituationsListEditor'
import { roomSituationsFacetAccessor } from './roomReferenceListAccessors'
import {
    materializeComponentInAssetMock,
    mockMaterializeComponentInAsset,
    renderWorkbenchComponentSession,
    resetWorkbenchAssetMock,
    updateStandardMock
} from '../foundations/WorkbenchComponent/testing/harness'

const confirmOrphanClosureMock = vi.fn().mockResolvedValue(true)

const ROOM_ID = 'ROOM#room1' as ComponentUUID
const SITUATION_ID = 'SITUATION#sit1' as ComponentUUID
const EXISTING_SITUATION_ID = 'SITUATION#sit2' as ComponentUUID
const FLUSH_DELAY_MS = 100

vi.mock('react-redux', () => ({
    useDispatch: () => vi.fn()
}))

vi.mock('../foundations/useWorkbenchAsset', async () => {
    const mock = await import('../foundations/WorkbenchComponent/testing/mock')
    return {
        useWorkbenchAsset: () => mock.mockWorkbenchReturn
    }
})

vi.mock('../foundations/consistency/confirmOrphanClosureBeforeLocalEdit', () => ({
    confirmOrphanClosureBeforeComponentDisassociate: (...args: unknown[]) =>
        confirmOrphanClosureMock(...args)
}))

vi.mock('../foundations/ComponentSelector', () => ({
    ComponentSelectorDialog: ({
        open,
        onSelect
    }: {
        open: boolean
        onSelect: (universalKey: ComponentUUID) => void
    }) =>
        open ? (
            <button
                type="button"
                data-testid="mock-situation-select"
                onClick={() => onSelect(EXISTING_SITUATION_ID)}
            >
                Mock Situation Select
            </button>
        ) : null
}))

const roomWithLensWml = `
    <Asset uuid=(test)>
        <Room uuid=(room1) key=(room1)><ShortName>R1</ShortName><Lens uuid=(lens1)/></Room>
        <Lens uuid=(lens1)><ShortName>My Lens</ShortName></Lens>
    </Asset>
`

const roomWithLensAndSituationWml = `
    <Asset uuid=(test)>
        <Room uuid=(room1) key=(room1)>
            <ShortName>R1</ShortName>
            <Lens uuid=(lens1)/>
            <Situation uuid=(sit1)><DisplayName>Evening</DisplayName></Situation>
        </Room>
        <Lens uuid=(lens1)><ShortName>My Lens</ShortName></Lens>
        <Situation uuid=(sit1)><ShortName>Evening</ShortName></Situation>
    </Asset>
`

const roomWithLensAndUnlinkedSituationWml = `
    <Asset uuid=(test)>
        <Room uuid=(room1) key=(room1)><ShortName>R1</ShortName><Lens uuid=(lens1)/></Room>
        <Lens uuid=(lens1)><ShortName>My Lens</ShortName></Lens>
        <Situation uuid=(sit2)><ShortName>Orphan Sit</ShortName></Situation>
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

const expandSituationsAccordion = (): void => {
    fireEvent.click(screen.getByRole('button', { name: /Situations/i }))
}

const renderSituationsList = (wml: string) =>
    renderWorkbenchComponentSession<StandardRoom>({
        options: {
            wml,
            componentId: ROOM_ID,
            guard: roomGuard,
            flushDelayMs: FLUSH_DELAY_MS
        },
        children: <RoomSituationsListEditor RoomId={ROOM_ID} />
    })

describe('RoomSituationsListEditor', () => {
    beforeEach(() => {
        vi.useFakeTimers()
        resetWorkbenchAssetMock()
        confirmOrphanClosureMock.mockClear()
        confirmOrphanClosureMock.mockResolvedValue(true)
    })

    afterEach(() => {
        vi.clearAllTimers()
        vi.useRealTimers()
    })

    it('reads list from session working, not merged standardForm alone', () => {
        const { getSession } = renderSituationsList(roomWithLensAndSituationWml)
        expandSituationsAccordion()

        const nonDefault = roomSituationsFacetAccessor
            .getFacetList(getSession().working!)
            .items.filter((f) => f.reference?.universalKey !== 'SITUATION#DEFAULT')
        expect(nonDefault.length).toBe(1)
        expect(nonDefault[0]!.reference?.universalKey).toBe(SITUATION_ID)
        expect(screen.getAllByText('Evening').length).toBeGreaterThan(0)
    })

    it('create new awaits materialize then associates on working without immediate flush', async () => {
        mockMaterializeComponentInAsset()

        const { getSession } = renderSituationsList(roomWithLensWml)
        expandSituationsAccordion()

        await act(async () => {
            fireEvent.click(screen.getByText('Create new Situation'))
        })
        await flushAsync()

        expect(materializeComponentInAssetMock).toHaveBeenCalledTimes(1)

        const spec = materializeComponentInAssetMock.mock.calls[0]![0]!
        expect(spec.universalKey).toMatch(/^SITUATION#/)
        expect(spec.fromAsset).toBeUndefined()

        const nonDefault = roomSituationsFacetAccessor
            .getFacetList(getSession().working!)
            .items.filter((f) => f.reference?.universalKey !== 'SITUATION#DEFAULT')
        expect(nonDefault.length).toBe(1)
        expect(nonDefault[0]!.reference?.universalKey).toBe(spec.universalKey)

        expect(updateStandardMock).not.toHaveBeenCalled()
    })

    it('create new does not add situation to _topLevel on local draft', async () => {
        mockMaterializeComponentInAsset()

        renderSituationsList(roomWithLensWml)
        expandSituationsAccordion()

        const topLevelBefore =
            (await import('../foundations/WorkbenchComponent/testing/mock')).mockWorkbenchReturn
                .localStandardForm._topLevel?.payload.length ?? 0

        await act(async () => {
            fireEvent.click(screen.getByText('Create new Situation'))
        })
        await flushAsync()

        const materializedKey = materializeComponentInAssetMock.mock.calls[0]![0]!.universalKey
        const { mockWorkbenchReturn } = await import(
            '../foundations/WorkbenchComponent/testing/mock'
        )
        const onTopLevel =
            mockWorkbenchReturn.localStandardForm._topLevel?.payload.some(
                (ref) => ref.universalKey === materializedKey
            ) ?? false
        expect(onTopLevel).toBe(false)
        expect(mockWorkbenchReturn.localStandardForm._topLevel?.payload.length ?? 0).toBe(
            topLevelBefore
        )
    })

    it('create new debounced flush uses updateLocal', async () => {
        mockMaterializeComponentInAsset()

        renderSituationsList(roomWithLensWml)
        expandSituationsAccordion()

        await act(async () => {
            fireEvent.click(screen.getByText('Create new Situation'))
        })
        await flushAsync()

        const materializedKey = materializeComponentInAssetMock.mock.calls[0]![0]!.universalKey

        act(() => {
            vi.advanceTimersByTime(FLUSH_DELAY_MS)
        })

        expect(updateStandardMock).toHaveBeenCalledTimes(1)
        expect(updateStandardMock.mock.calls[0]![0]).toMatchObject({ type: 'updateLocal' })

        const flushUpdate = updateStandardMock.mock.calls[0]![0]!.update
        const { mockWorkbenchReturn } = await import(
            '../foundations/WorkbenchComponent/testing/mock'
        )
        const draft = mockWorkbenchReturn.localStandardForm._clone()
        flushUpdate(draft)

        expect(draft.byUniversalId[materializedKey]).toBeDefined()
        const room = draft.byUniversalId[ROOM_ID]
        expect(room instanceof StandardRoom).toBe(true)
        if (room instanceof StandardRoom) {
            expect(
                room.situations.items.some(
                    (f) => f.reference?.universalKey === materializedKey
                )
            ).toBe(true)
        }
    })

    it('reference existing associates on working without update before flush', async () => {
        const { getSession } = renderSituationsList(roomWithLensAndUnlinkedSituationWml)
        expandSituationsAccordion()

        await act(async () => {
            fireEvent.click(screen.getByText('Reference existing Situation'))
        })
        await act(async () => {
            fireEvent.click(screen.getByTestId('mock-situation-select'))
        })
        await flushAsync()

        const nonDefault = roomSituationsFacetAccessor
            .getFacetList(getSession().working!)
            .items.filter((f) => f.reference?.universalKey !== 'SITUATION#DEFAULT')
        expect(nonDefault.length).toBe(1)
        expect(nonDefault[0]!.reference?.universalKey).toBe(EXISTING_SITUATION_ID)
        expect(updateStandardMock).not.toHaveBeenCalled()
    })

    it('remove calls confirm then disassociates on working without immediate flush', async () => {
        const { getSession } = renderSituationsList(roomWithLensAndSituationWml)
        expandSituationsAccordion()

        const deleteButtons = screen.getAllByLabelText('remove')
        await act(async () => {
            fireEvent.click(deleteButtons[0])
            await flushAsync()
        })

        expect(confirmOrphanClosureMock).toHaveBeenCalledTimes(1)
        expect(confirmOrphanClosureMock.mock.calls[0]![0]).toMatchObject({
            componentId: ROOM_ID
        })

        const nonDefault = roomSituationsFacetAccessor
            .getFacetList(getSession().working!)
            .items.filter((f) => f.reference?.universalKey !== 'SITUATION#DEFAULT')
        expect(nonDefault.length).toBe(0)
        expect(updateStandardMock).not.toHaveBeenCalled()
    })

    it('remove cancel skips disassociate on working', async () => {
        confirmOrphanClosureMock.mockResolvedValueOnce(false)

        const { getSession } = renderSituationsList(roomWithLensAndSituationWml)
        expandSituationsAccordion()

        const deleteButtons = screen.getAllByLabelText('remove')
        await act(async () => {
            fireEvent.click(deleteButtons[0])
            await flushAsync()
        })

        const nonDefault = roomSituationsFacetAccessor
            .getFacetList(getSession().working!)
            .items.filter((f) => f.reference?.universalKey !== 'SITUATION#DEFAULT')
        expect(nonDefault.length).toBe(1)
        expect(updateStandardMock).not.toHaveBeenCalled()
    })

    it('debounced flush persists situation disassociate via updateLocal', async () => {
        renderSituationsList(roomWithLensAndSituationWml)
        expandSituationsAccordion()

        const deleteButtons = screen.getAllByLabelText('remove')
        await act(async () => {
            fireEvent.click(deleteButtons[0])
            await flushAsync()
            vi.advanceTimersByTime(FLUSH_DELAY_MS)
        })

        expect(updateStandardMock).toHaveBeenCalledTimes(1)
        expect(updateStandardMock.mock.calls[0]![0]).toMatchObject({ type: 'updateLocal' })
    })
})
