/**
 * @vitest-environment jsdom
 */

import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render } from '@testing-library/react'
import { StandardLiteral } from '@tonylb/mtw-wml/ts/standardize/literal'

import {
    applyLastFlushToCommitted,
    getFlushedAssetMetaShortName,
    mockWorkbenchReturn
} from './testing/mock'

vi.mock('react-redux', () => ({
    useDispatch: () => vi.fn()
}))

vi.mock('../useWorkbenchAsset', () => ({
    useWorkbenchAsset: () => mockWorkbenchReturn
}))

import { useWorkbenchAssetMetaContext } from './useWorkbenchAssetMeta'
import {
    renderWorkbenchAssetMetaSession,
    resetWorkbenchAssetMock,
    updateStandardMock
} from './testing/harness'

const FLUSH_DELAY_MS = 100

const defaultWml = `
    <Asset uuid=(test)>
        <ShortName>Original</ShortName>
    </Asset>
`

const defaultSessionOptions = {
    wml: defaultWml,
    flushDelayMs: FLUSH_DELAY_MS
}

describe('useWorkbenchAssetMeta', () => {
    beforeEach(() => {
        vi.useFakeTimers()
        resetWorkbenchAssetMock()
    })

    afterEach(() => {
        vi.clearAllTimers()
        vi.useRealTimers()
    })

    it('initializes working and lastReceived from committed on mount', () => {
        const { getSession } = renderWorkbenchAssetMetaSession({
            options: defaultSessionOptions
        })

        const session = getSession()
        expect(session.working?.shortName?.toJSON()).toBe('Original')
        expect(session.lastReceived?.shortName?.toJSON()).toBe('Original')
        expect(session.committed?.shortName?.toJSON()).toBe('Original')
        expect(session.working).not.toBe(session.committed)
    })

    it('updateAssetMeta mutates working without calling updateStandard before debounce', () => {
        const { getSession } = renderWorkbenchAssetMetaSession({
            options: defaultSessionOptions
        })

        act(() => {
            getSession().updateAssetMeta((draft) => {
                draft.shortName = new StandardLiteral('Updated')
            })
        })

        expect(getSession().working?.shortName?.toJSON()).toBe('Updated')
        expect(getSession().committed?.shortName?.toJSON()).toBe('Original')
        expect(updateStandardMock).not.toHaveBeenCalled()
    })

    it('isDirty is false on mount and true after local edit', () => {
        const { getSession } = renderWorkbenchAssetMetaSession({
            options: defaultSessionOptions
        })

        expect(getSession().isDirty).toBe(false)

        act(() => {
            getSession().updateAssetMeta((draft) => {
                draft.shortName = new StandardLiteral('Updated')
            })
        })

        expect(getSession().isDirty).toBe(true)
    })

    it('propagates readonly from useWorkbenchAsset', () => {
        const { getSession } = renderWorkbenchAssetMetaSession({
            options: { ...defaultSessionOptions, readonly: true }
        })

        expect(getSession().readonly).toBe(true)
    })

    it('throws when useWorkbenchAssetMetaContext is used outside provider', () => {
        const OutsideProvider = (): null => {
            useWorkbenchAssetMetaContext()
            return null
        }

        expect(() => render(<OutsideProvider />)).toThrow(
            'useWorkbenchAssetMetaContext must be used within WorkbenchAssetMetaProvider'
        )
    })

    it('flushNow persists working immediately', () => {
        const { getSession } = renderWorkbenchAssetMetaSession({
            options: defaultSessionOptions
        })

        act(() => {
            getSession().updateAssetMeta((draft) => {
                draft.shortName = new StandardLiteral('Immediate')
            })
        })

        act(() => {
            getSession().flushNow()
        })

        expect(updateStandardMock).toHaveBeenCalledTimes(1)
        expect(getFlushedAssetMetaShortName(mockWorkbenchReturn.standardForm)).toBe('Immediate')
        expect(updateStandardMock.mock.calls[0][0]).toMatchObject({ type: 'updateLocal' })
    })

    it('debounces flush after updateAssetMeta', () => {
        const { getSession } = renderWorkbenchAssetMetaSession({
            options: defaultSessionOptions
        })

        act(() => {
            getSession().updateAssetMeta((draft) => {
                draft.shortName = new StandardLiteral('Debounced')
            })
        })

        expect(updateStandardMock).not.toHaveBeenCalled()

        act(() => {
            vi.advanceTimersByTime(FLUSH_DELAY_MS)
        })

        expect(updateStandardMock).toHaveBeenCalledTimes(1)
        expect(getFlushedAssetMetaShortName(mockWorkbenchReturn.standardForm)).toBe('Debounced')
    })

    it('batches multiple updateAssetMeta calls into one debounced flush', () => {
        const { getSession } = renderWorkbenchAssetMetaSession({
            options: defaultSessionOptions
        })

        act(() => {
            getSession().updateAssetMeta((draft) => {
                draft.shortName = new StandardLiteral('First')
            })
            vi.advanceTimersByTime(50)
            getSession().updateAssetMeta((draft) => {
                draft.shortName = new StandardLiteral('Second')
            })
            vi.advanceTimersByTime(FLUSH_DELAY_MS)
        })

        expect(updateStandardMock).toHaveBeenCalledTimes(1)
        expect(getFlushedAssetMetaShortName(mockWorkbenchReturn.standardForm)).toBe('Second')
    })

    it('flushToStandardForm schedules debounced flush without persisting immediately', () => {
        const { getSession } = renderWorkbenchAssetMetaSession({
            options: defaultSessionOptions
        })

        act(() => {
            getSession().updateAssetMeta((draft) => {
                draft.shortName = new StandardLiteral('Scheduled')
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
        const { getSession } = renderWorkbenchAssetMetaSession({
            options: defaultSessionOptions
        })

        act(() => {
            getSession().updateAssetMeta((draft) => {
                draft.shortName = new StandardLiteral('Persisted')
            })
        })

        act(() => {
            vi.advanceTimersByTime(FLUSH_DELAY_MS)
        })

        const session = getSession()
        expect(session.isDirty).toBe(false)
        expect(session.lastReceived?.shortName?.toJSON()).toBe('Persisted')
    })

    it('flushNow on unmount persists pending edits', () => {
        const { getSession, unmount } = renderWorkbenchAssetMetaSession({
            options: defaultSessionOptions
        })

        act(() => {
            getSession().updateAssetMeta((draft) => {
                draft.shortName = new StandardLiteral('Unmount flush')
            })
        })

        act(() => {
            unmount()
        })

        expect(updateStandardMock).toHaveBeenCalledTimes(1)
        expect(getFlushedAssetMetaShortName(mockWorkbenchReturn.standardForm)).toBe('Unmount flush')
    })

    it('does not dispatch updateStandard when flushNow is called with no local edits', () => {
        const { getSession } = renderWorkbenchAssetMetaSession({
            options: defaultSessionOptions
        })

        getSession().flushNow()
        getSession().flushToStandardForm()
        vi.advanceTimersByTime(FLUSH_DELAY_MS)

        expect(updateStandardMock).not.toHaveBeenCalled()
    })

    it('flush normalizes whitespace-only shortName to omitted on persist (D11)', () => {
        const { getSession } = renderWorkbenchAssetMetaSession({
            options: defaultSessionOptions
        })

        act(() => {
            getSession().updateAssetMeta((draft) => {
                draft.shortName = new StandardLiteral('   ')
            })
        })

        act(() => {
            vi.advanceTimersByTime(FLUSH_DELAY_MS)
        })

        expect(getFlushedAssetMetaShortName(mockWorkbenchReturn.standardForm)).toBeUndefined()
    })

    it('does not flush when working is deep-unequal but semantically equal to lastReceived (D12)', () => {
        const { getSession } = renderWorkbenchAssetMetaSession({
            options: defaultSessionOptions
        })

        const priorLiteral = getSession().lastReceived!.shortName

        act(() => {
            getSession().updateAssetMeta((draft) => {
                draft.shortName = new StandardLiteral('Original')
            })
        })

        const { lastReceived, working } = getSession()
        expect(working).toBeDefined()
        expect(lastReceived).toBeDefined()
        expect(working!.shortName).not.toBe(priorLiteral)
        expect(working!.shortName?.toJSON()).toBe('Original')
        expect(getSession().isDirty).toBe(false)

        act(() => {
            getSession().flushNow()
            vi.advanceTimersByTime(FLUSH_DELAY_MS)
        })

        expect(updateStandardMock).not.toHaveBeenCalled()
    })

    it('adopts external committed change when session is clean', () => {
        const { getSession, setCommittedWml } = renderWorkbenchAssetMetaSession({
            options: defaultSessionOptions
        })

        act(() => {
            setCommittedWml(`
                <Asset uuid=(test)>
                    <ShortName>Imported</ShortName>
                </Asset>
            `)
        })

        const session = getSession()
        expect(session.working?.shortName?.toJSON()).toBe('Imported')
        expect(session.lastReceived?.shortName?.toJSON()).toBe('Imported')
        expect(updateStandardMock).not.toHaveBeenCalled()
    })

    it('merges local shortName with external topLevel change', () => {
        const { getSession, setCommittedWml } = renderWorkbenchAssetMetaSession({
            options: defaultSessionOptions
        })

        act(() => {
            getSession().updateAssetMeta((draft) => {
                draft.shortName = new StandardLiteral('Local')
            })
        })

        act(() => {
            setCommittedWml(`
                <Asset uuid=(test)>
                    <ShortName>Original</ShortName>
                    <Room uuid=(room1) key=(room1) ref={1} />
                    <Room uuid=(room1) key=(room1)><ShortName>Room</ShortName></Room>
                </Asset>
            `)
        })

        const session = getSession()
        expect(session.working?.shortName?.toJSON()).toBe('Local')
        expect(session.working?.topLevel.payload).toHaveLength(1)
        expect(updateStandardMock).not.toHaveBeenCalled()
    })

    it('supersedes local edits on conflicting external shortName change', () => {
        const onSuperseded = vi.fn()
        const { getSession, setCommittedWml } = renderWorkbenchAssetMetaSession({
            options: { ...defaultSessionOptions, onSuperseded }
        })

        act(() => {
            getSession().updateAssetMeta((draft) => {
                draft.shortName = new StandardLiteral('Local')
            })
        })

        act(() => {
            setCommittedWml(`
                <Asset uuid=(test)>
                    <ShortName>External</ShortName>
                </Asset>
            `)
        })

        const session = getSession()
        expect(session.working?.shortName?.toJSON()).toBe('External')
        expect(onSuperseded).toHaveBeenCalledTimes(1)
        expect(updateStandardMock).not.toHaveBeenCalled()
    })

    it('does not flush pre-reconcile working after external merge (D14c)', () => {
        const { getSession, setCommittedWml } = renderWorkbenchAssetMetaSession({
            options: defaultSessionOptions
        })

        act(() => {
            getSession().updateAssetMeta((draft) => {
                draft.shortName = new StandardLiteral('Local')
            })
        })

        act(() => {
            setCommittedWml(`
                <Asset uuid=(test)>
                    <ShortName>Original</ShortName>
                    <Room uuid=(room1) key=(room1) ref={1} />
                    <Room uuid=(room1) key=(room1)><ShortName>Room</ShortName></Room>
                </Asset>
            `)
        })

        act(() => {
            vi.advanceTimersByTime(FLUSH_DELAY_MS)
        })

        expect(updateStandardMock).toHaveBeenCalledTimes(1)
        expect(getFlushedAssetMetaShortName(mockWorkbenchReturn.standardForm)).toBe('Local')
    })

    it('skips reconcile on echo of last flush while preserving newer local edits (D14a)', () => {
        const { getSession, setCommittedWml } = renderWorkbenchAssetMetaSession({
            options: defaultSessionOptions
        })

        act(() => {
            getSession().updateAssetMeta((draft) => {
                draft.shortName = new StandardLiteral('Persisted')
            })
            vi.advanceTimersByTime(FLUSH_DELAY_MS)
        })

        act(() => {
            applyLastFlushToCommitted()
            setCommittedWml(mockWorkbenchReturn.standardForm)
        })

        act(() => {
            getSession().updateAssetMeta((draft) => {
                draft.shortName = new StandardLiteral('After echo')
            })
        })

        expect(getSession().working?.shortName?.toJSON()).toBe('After echo')
        expect(getSession().isDirty).toBe(true)
    })

    it('does not supersede when committed gains component body but asset-meta unchanged (D10)', () => {
        const onSuperseded = vi.fn()
        const { getSession, setCommittedWml } = renderWorkbenchAssetMetaSession({
            options: { ...defaultSessionOptions, onSuperseded }
        })

        const workingBefore = getSession().working?.shortName?.toJSON()

        act(() => {
            setCommittedWml(`
                <Asset uuid=(test)>
                    <ShortName>Original</ShortName>
                    <Room uuid=(room1) key=(room1)><ShortName>Room</ShortName></Room>
                </Asset>
            `)
        })

        const session = getSession()
        expect(session.working?.shortName?.toJSON()).toBe(workingBefore)
        expect(onSuperseded).not.toHaveBeenCalled()
        expect(updateStandardMock).not.toHaveBeenCalled()
    })

    it('updateAssetMeta does not mutate when readonly', () => {
        const { getSession } = renderWorkbenchAssetMetaSession({
            options: { ...defaultSessionOptions, readonly: true }
        })

        act(() => {
            getSession().updateAssetMeta((draft) => {
                draft.shortName = new StandardLiteral('Blocked')
            })
        })

        expect(getSession().working?.shortName?.toJSON()).toBe('Original')
    })
})
