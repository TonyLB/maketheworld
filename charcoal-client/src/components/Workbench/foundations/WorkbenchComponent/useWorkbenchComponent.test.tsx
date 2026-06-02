/**
 * @vitest-environment jsdom
 */

import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render } from '@testing-library/react'
import { ComponentUUID } from '@tonylb/mtw-base/ts/schema'
import StandardFeature from '@tonylb/mtw-wml/ts/standardize/components/feature'
import type { StandardComponent } from '@tonylb/mtw-wml/ts/standardize/components/baseClasses'

import { getFlushedFeatureShortName, mockWorkbenchReturn } from './testing/mock'

vi.mock('../useWorkbenchAsset', () => ({
    useWorkbenchAsset: () => mockWorkbenchReturn
}))

import { useWorkbenchComponentContext } from './useWorkbenchComponent'
import {
    renderWorkbenchComponentSession,
    resetWorkbenchAssetMock,
    setWorkingShortName,
    updateStandardMock
} from './testing/harness'

const FEATURE_ID = 'FEATURE#feat1' as ComponentUUID
const ROOM_ID = 'ROOM#room1' as ComponentUUID
const OTHER_FEATURE_ID = 'FEATURE#feat2' as ComponentUUID

const FLUSH_DELAY_MS = 100

const featureWml = `
    <Asset uuid=(test)>
        <Feature uuid=(feat1)><ShortName>Original</ShortName></Feature>
        <Feature uuid=(feat2)><ShortName>Other</ShortName></Feature>
    </Asset>
`

const featureGuard = (
    component: StandardComponent | undefined
): component is StandardFeature => component instanceof StandardFeature

const defaultSessionOptions = {
    wml: featureWml,
    componentId: FEATURE_ID,
    guard: featureGuard,
    flushDelayMs: FLUSH_DELAY_MS
}

describe('useWorkbenchComponent', () => {
    beforeEach(() => {
        vi.useFakeTimers()
        resetWorkbenchAssetMock()
    })

    afterEach(() => {
        vi.clearAllTimers()
        vi.useRealTimers()
    })

    it('initializes working and lastReceived from committed on mount', () => {
        const { getSession } = renderWorkbenchComponentSession({
            options: defaultSessionOptions
        })

        const session = getSession()
        expect(session.missing).toBe(false)
        expect(session.working?.shortName?.toJSON()).toBe('Original')
        expect(session.lastReceived?.shortName?.toJSON()).toBe('Original')
        expect(session.committed?.shortName?.toJSON()).toBe('Original')
        expect(session.working).not.toBe(session.committed)
        expect(session.working?.equals(session.committed!)).toBe(true)
    })

    it('updateComponent mutates working without calling updateStandard before debounce', () => {
        const { getSession } = renderWorkbenchComponentSession({
            options: defaultSessionOptions
        })

        act(() => {
            getSession().updateComponent((draft) => {
                setWorkingShortName(draft, 'Updated')
            })
        })

        expect(getSession().working?.shortName?.toJSON()).toBe('Updated')
        expect(getSession().committed?.shortName?.toJSON()).toBe('Original')
        expect(updateStandardMock).not.toHaveBeenCalled()
    })

    it('isDirty is false on mount and true after local edit', () => {
        const { getSession } = renderWorkbenchComponentSession({
            options: defaultSessionOptions
        })

        expect(getSession().isDirty).toBe(false)

        act(() => {
            getSession().updateComponent((draft) => {
                setWorkingShortName(draft, 'Updated')
            })
        })

        expect(getSession().isDirty).toBe(true)
    })

    it('reports missing when component id is absent', () => {
        const { getSession } = renderWorkbenchComponentSession({
            options: {
                ...defaultSessionOptions,
                componentId: 'FEATURE#missing' as ComponentUUID
            }
        })

        const session = getSession()
        expect(session.missing).toBe(true)
        expect(session.working).toBeUndefined()
        expect(session.lastReceived).toBeUndefined()
    })

    it('reports missing when guard rejects component type', () => {
        const { getSession } = renderWorkbenchComponentSession({
            options: {
                wml: `
                    <Asset uuid=(test)>
                        <Room uuid=(room1)><ShortName>Room</ShortName></Room>
                    </Asset>
                `,
                componentId: ROOM_ID,
                guard: featureGuard,
                flushDelayMs: FLUSH_DELAY_MS
            }
        })

        const session = getSession()
        expect(session.missing).toBe(true)
        expect(session.working).toBeUndefined()
    })

    it('propagates readonly from useWorkbenchAsset', () => {
        const { getSession } = renderWorkbenchComponentSession({
            options: {
                ...defaultSessionOptions,
                readonly: true
            }
        })

        expect(getSession().readonly).toBe(true)
    })

    it('re-seeds session when componentId changes and flushes outgoing edits', () => {
        const { getSession, rerenderWithComponentId } = renderWorkbenchComponentSession({
            options: defaultSessionOptions
        })

        act(() => {
            getSession().updateComponent((draft) => {
                setWorkingShortName(draft, 'Local edit')
            })
        })

        expect(getSession().working?.shortName?.toJSON()).toBe('Local edit')

        act(() => {
            rerenderWithComponentId(OTHER_FEATURE_ID)
        })

        expect(updateStandardMock).toHaveBeenCalledTimes(1)
        expect(
            getFlushedFeatureShortName(FEATURE_ID, mockWorkbenchReturn.standardForm)
        ).toBe('Local edit')

        const session = getSession()
        expect(session.componentId).toBe(OTHER_FEATURE_ID)
        expect(session.working?.shortName?.toJSON()).toBe('Other')
        expect(session.isDirty).toBe(false)
    })

    it('throws when useWorkbenchComponentContext is used outside provider', () => {
        const OutsideProvider = (): null => {
            useWorkbenchComponentContext()
            return null
        }

        expect(() => render(<OutsideProvider />)).toThrow(
            'useWorkbenchComponentContext must be used within WorkbenchComponentProvider'
        )
    })

    it('flushNow persists working immediately', () => {
        const { getSession } = renderWorkbenchComponentSession({
            options: defaultSessionOptions
        })

        act(() => {
            getSession().updateComponent((draft) => {
                setWorkingShortName(draft, 'Immediate')
            })
        })

        act(() => {
            getSession().flushNow()
        })

        expect(updateStandardMock).toHaveBeenCalledTimes(1)
        expect(
            getFlushedFeatureShortName(FEATURE_ID, mockWorkbenchReturn.standardForm)
        ).toBe('Immediate')
    })

    it('debounces flush after updateComponent', () => {
        const { getSession } = renderWorkbenchComponentSession({
            options: defaultSessionOptions
        })

        act(() => {
            getSession().updateComponent((draft) => {
                setWorkingShortName(draft, 'Debounced')
            })
        })

        expect(updateStandardMock).not.toHaveBeenCalled()

        act(() => {
            vi.advanceTimersByTime(FLUSH_DELAY_MS)
        })

        expect(updateStandardMock).toHaveBeenCalledTimes(1)
        expect(
            getFlushedFeatureShortName(FEATURE_ID, mockWorkbenchReturn.standardForm)
        ).toBe('Debounced')
    })

    it('batches multiple updateComponent calls into one debounced flush', () => {
        const { getSession } = renderWorkbenchComponentSession({
            options: defaultSessionOptions
        })

        act(() => {
            getSession().updateComponent((draft) => {
                setWorkingShortName(draft, 'First')
            })
            vi.advanceTimersByTime(50)
            getSession().updateComponent((draft) => {
                setWorkingShortName(draft, 'Second')
            })
            vi.advanceTimersByTime(FLUSH_DELAY_MS)
        })

        expect(updateStandardMock).toHaveBeenCalledTimes(1)
        expect(
            getFlushedFeatureShortName(FEATURE_ID, mockWorkbenchReturn.standardForm)
        ).toBe('Second')
    })

    it('flushToStandardForm schedules debounced flush without persisting immediately', () => {
        const { getSession } = renderWorkbenchComponentSession({
            options: defaultSessionOptions
        })

        act(() => {
            getSession().updateComponent((draft) => {
                setWorkingShortName(draft, 'Scheduled')
            })
        })

        act(() => {
            getSession().flushToStandardForm()
        })

        expect(updateStandardMock).not.toHaveBeenCalled()

        act(() => {
            vi.advanceTimersByTime(FLUSH_DELAY_MS)
        })

        expect(updateStandardMock).toHaveBeenCalledTimes(1)
    })

    it('clears isDirty after debounced flush and advances lastReceived', () => {
        const { getSession } = renderWorkbenchComponentSession({
            options: defaultSessionOptions
        })

        act(() => {
            getSession().updateComponent((draft) => {
                setWorkingShortName(draft, 'Persisted')
            })
        })

        expect(getSession().isDirty).toBe(true)

        act(() => {
            vi.advanceTimersByTime(FLUSH_DELAY_MS)
        })

        const session = getSession()
        expect(session.isDirty).toBe(false)
        expect(session.lastReceived?.shortName?.toJSON()).toBe('Persisted')
        expect(session.lastReceived?.equals(session.working!)).toBe(true)
    })

    it('flushNow on unmount persists pending edits', () => {
        const { getSession, unmount } = renderWorkbenchComponentSession({
            options: defaultSessionOptions
        })

        act(() => {
            getSession().updateComponent((draft) => {
                setWorkingShortName(draft, 'Unmount flush')
            })
        })

        expect(getSession().isDirty).toBe(true)

        act(() => {
            unmount()
        })

        expect(updateStandardMock).toHaveBeenCalledTimes(1)
        expect(
            getFlushedFeatureShortName(FEATURE_ID, mockWorkbenchReturn.standardForm)
        ).toBe('Unmount flush')
    })

    it('does not dispatch updateStandard when flushNow is called with no local edits', () => {
        const { getSession } = renderWorkbenchComponentSession({
            options: defaultSessionOptions
        })

        getSession().flushNow()
        getSession().flushToStandardForm()
        vi.advanceTimersByTime(FLUSH_DELAY_MS)

        expect(updateStandardMock).not.toHaveBeenCalled()
    })
})
