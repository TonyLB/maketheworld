/**
 * @vitest-environment jsdom
 */

import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render } from '@testing-library/react'
import { ComponentUUID } from '@tonylb/mtw-base/ts/schema'
import StandardFeature from '@tonylb/mtw-wml/ts/standardize/components/feature'
import StandardRoom from '@tonylb/mtw-wml/ts/standardize/components/room'
import type { StandardComponent } from '@tonylb/mtw-wml/ts/standardize/components/baseClasses'
import { StandardLiteral } from '@tonylb/mtw-wml/ts/standardize/literal'

import {
    applyLastFlushToCommitted,
    getFlushedFeatureShortName,
    mockWorkbenchReturn
} from './testing/mock'

vi.mock('react-redux', () => ({
    useDispatch: () => vi.fn()
}))

vi.mock('../useWorkbenchAsset', () => ({
    useWorkbenchAsset: () => mockWorkbenchReturn
}))

import { useWorkbenchComponentContext } from './useWorkbenchComponent'
import { setWorkingShortNameFromString } from '../workbenchMutations'
import {
    renderWorkbenchComponentSession,
    resetWorkbenchAssetMock,
    updateStandardMock
} from './testing/harness'

const FEATURE_ID = 'FEATURE#feat1' as ComponentUUID
const ROOM_ID = 'ROOM#room1' as ComponentUUID
const OTHER_FEATURE_ID = 'FEATURE#feat2' as ComponentUUID

const FLUSH_DELAY_MS = 100

const roomWml = `
    <Asset uuid=(test)>
        <Room uuid=(room1)><ShortName>Room</ShortName></Room>
    </Asset>
`

const roomGuard = (
    component: StandardComponent | undefined
): component is StandardRoom => component instanceof StandardRoom

const roomSessionOptions = {
    wml: roomWml,
    componentId: ROOM_ID,
    guard: roomGuard,
    flushDelayMs: FLUSH_DELAY_MS
}

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
                setWorkingShortNameFromString(draft, 'Updated')
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
                setWorkingShortNameFromString(draft, 'Updated')
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
                setWorkingShortNameFromString(draft, 'Local edit')
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
                setWorkingShortNameFromString(draft, 'Immediate')
            })
        })

        act(() => {
            getSession().flushNow()
        })

        expect(updateStandardMock).toHaveBeenCalledTimes(1)
        expect(
            getFlushedFeatureShortName(FEATURE_ID, mockWorkbenchReturn.standardForm)
        ).toBe('Immediate')
        expect(updateStandardMock.mock.calls[0][0]).toMatchObject({ type: 'updateLocal' })
    })

    it('debounces flush after updateComponent', () => {
        const { getSession } = renderWorkbenchComponentSession({
            options: defaultSessionOptions
        })

        act(() => {
            getSession().updateComponent((draft) => {
                setWorkingShortNameFromString(draft, 'Debounced')
            })
        })

        expect(updateStandardMock).not.toHaveBeenCalled()

        act(() => {
            vi.advanceTimersByTime(FLUSH_DELAY_MS)
        })

        expect(updateStandardMock).toHaveBeenCalledTimes(1)
        expect(updateStandardMock.mock.calls[0][0]).toMatchObject({ type: 'updateLocal' })
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
                setWorkingShortNameFromString(draft, 'First')
            })
            vi.advanceTimersByTime(50)
            getSession().updateComponent((draft) => {
                setWorkingShortNameFromString(draft, 'Second')
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
                setWorkingShortNameFromString(draft, 'Scheduled')
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
                setWorkingShortNameFromString(draft, 'Persisted')
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
                setWorkingShortNameFromString(draft, 'Unmount flush')
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

    it('flush normalizes whitespace-only shortName to omitted on persist (D11)', () => {
        const { getSession } = renderWorkbenchComponentSession({
            options: defaultSessionOptions
        })

        act(() => {
            getSession().updateComponent((draft) => {
                setWorkingShortNameFromString(draft, '   ')
            })
        })

        act(() => {
            vi.advanceTimersByTime(FLUSH_DELAY_MS)
        })

        expect(
            getFlushedFeatureShortName(FEATURE_ID, mockWorkbenchReturn.standardForm)
        ).toBeUndefined()
    })

    it('does not flush when working is deep-unequal but semantically equal to lastReceived (D12)', () => {
        const { getSession } = renderWorkbenchComponentSession({
            options: defaultSessionOptions
        })

        const priorLiteral = getSession().lastReceived!.shortName

        act(() => {
            getSession().updateComponent((draft) => {
                draft._payload._shortName = new StandardLiteral('Original')
            })
        })

        const { lastReceived, working } = getSession()
        expect(working).toBeDefined()
        expect(lastReceived).toBeDefined()
        expect(working!.shortName).not.toBe(priorLiteral)
        expect(working!.shortName?.toJSON()).toBe('Original')
        expect(lastReceived!.shortName?.toJSON()).toBe('Original')
        expect(working).not.toBe(lastReceived)
        expect(lastReceived!.diff(working!)).toBeUndefined()
        expect(getSession().isDirty).toBe(false)

        act(() => {
            getSession().flushNow()
            vi.advanceTimersByTime(FLUSH_DELAY_MS)
        })

        expect(updateStandardMock).not.toHaveBeenCalled()
    })

    it('adopts external committed change when session is clean', () => {
        const { getSession, setCommittedWml } = renderWorkbenchComponentSession({
            options: defaultSessionOptions
        })

        act(() => {
            setCommittedWml(`
                <Asset uuid=(test)>
                    <Feature uuid=(feat1)><ShortName>Imported</ShortName></Feature>
                    <Feature uuid=(feat2)><ShortName>Other</ShortName></Feature>
                </Asset>
            `)
        })

        const session = getSession()
        expect(session.working?.shortName?.toJSON()).toBe('Imported')
        expect(session.lastReceived?.shortName?.toJSON()).toBe('Imported')
        expect(session.committed?.shortName?.toJSON()).toBe('Imported')
        expect(updateStandardMock).not.toHaveBeenCalled()
    })

    it('merges local shortName with external change on another field', () => {
        const { getSession, setCommittedWml } = renderWorkbenchComponentSession({
            options: defaultSessionOptions
        })

        act(() => {
            getSession().updateComponent((draft) => {
                setWorkingShortNameFromString(draft, 'Local')
            })
        })

        act(() => {
            setCommittedWml(`
                <Asset uuid=(test)>
                    <Feature uuid=(feat1)>
                        <ShortName>Original</ShortName>
                        <Situation uuid=(night)><DisplayName>Night</DisplayName></Situation>
                        <Situation uuid=(DEFAULT)><DisplayName>Base</DisplayName></Situation>
                    </Feature>
                    <Feature uuid=(feat2)><ShortName>Other</ShortName></Feature>
                </Asset>
            `)
        })

        const session = getSession()
        expect(session.working?.shortName?.toJSON()).toBe('Local')
        expect(
            session.working?.situations.items.some(
                (item) => item.reference.universalKey === 'SITUATION#night'
            )
        ).toBe(true)
        expect(updateStandardMock).not.toHaveBeenCalled()
    })

    it('supersedes local edits on conflicting external shortName change', () => {
        const onSuperseded = vi.fn()
        const { getSession, setCommittedWml } = renderWorkbenchComponentSession({
            options: { ...defaultSessionOptions, onSuperseded }
        })

        act(() => {
            getSession().updateComponent((draft) => {
                setWorkingShortNameFromString(draft, 'Local')
            })
        })

        act(() => {
            setCommittedWml(`
                <Asset uuid=(test)>
                    <Feature uuid=(feat1)><ShortName>External</ShortName></Feature>
                    <Feature uuid=(feat2)><ShortName>Other</ShortName></Feature>
                </Asset>
            `)
        })

        const session = getSession()
        expect(session.working?.shortName?.toJSON()).toBe('External')
        expect(onSuperseded).toHaveBeenCalledTimes(1)
        expect(updateStandardMock).not.toHaveBeenCalled()
    })

    it('does not flush pre-reconcile working after external update (D14c)', () => {
        const { getSession, setCommittedWml } = renderWorkbenchComponentSession({
            options: defaultSessionOptions
        })

        act(() => {
            getSession().updateComponent((draft) => {
                setWorkingShortNameFromString(draft, 'Local')
            })
        })

        act(() => {
            setCommittedWml(`
                <Asset uuid=(test)>
                    <Feature uuid=(feat1)>
                        <ShortName>Original</ShortName>
                        <Situation uuid=(night)><DisplayName>Night</DisplayName></Situation>
                        <Situation uuid=(DEFAULT)><DisplayName>Base</DisplayName></Situation>
                    </Feature>
                    <Feature uuid=(feat2)><ShortName>Other</ShortName></Feature>
                </Asset>
            `)
        })

        act(() => {
            vi.advanceTimersByTime(FLUSH_DELAY_MS)
        })

        expect(updateStandardMock).toHaveBeenCalledTimes(1)
        expect(
            getFlushedFeatureShortName(FEATURE_ID, mockWorkbenchReturn.standardForm)
        ).toBe('Local')
    })

    it('skips reconcile on echo of last flush while preserving newer local edits (D14a)', () => {
        const { getSession, setCommittedWml } = renderWorkbenchComponentSession({
            options: defaultSessionOptions
        })

        act(() => {
            getSession().updateComponent((draft) => {
                setWorkingShortNameFromString(draft, 'Persisted')
            })
            vi.advanceTimersByTime(FLUSH_DELAY_MS)
        })

        act(() => {
            applyLastFlushToCommitted()
            setCommittedWml(mockWorkbenchReturn.standardForm)
        })

        act(() => {
            getSession().updateComponent((draft) => {
                setWorkingShortNameFromString(draft, 'After echo')
            })
        })

        const session = getSession()
        expect(session.working?.shortName?.toJSON()).toBe('After echo')
        expect(session.isDirty).toBe(true)
    })
})
