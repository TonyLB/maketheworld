/**
 * @vitest-environment jsdom
 */

import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, screen } from '@testing-library/react'
import { ComponentUUID } from '@tonylb/mtw-base/ts/schema'
import StandardRoom from '@tonylb/mtw-wml/ts/standardize/components/room'
import type { StandardComponent } from '@tonylb/mtw-wml/ts/standardize/components/baseClasses'

import { ReferenceListSessionEditor } from './ReferenceListSessionEditor'
import {
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

const roomGuard = (
    component: StandardComponent | undefined
): component is StandardRoom => component instanceof StandardRoom

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
})
