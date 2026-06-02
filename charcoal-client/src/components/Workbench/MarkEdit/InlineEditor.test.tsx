/**
 * @vitest-environment jsdom
 */

import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

/** React 18.3+ `act` (not the deprecated `react-dom/test-utils` re-export from RTL). */
const act = (React as typeof React & {
    act: (callback: () => void | Promise<void>) => void | Promise<void>
}).act
import { ComponentUUID } from '@tonylb/mtw-base/ts/schema'
import StandardMark from '@tonylb/mtw-wml/ts/standardize/components/worldState'
import type { StandardComponent } from '@tonylb/mtw-wml/ts/standardize/components/baseClasses'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'

import {
    applyLastUpdateStandardMock,
    mockWorkbenchReturn,
    resetWorkbenchAssetMock,
    seedWorkbenchAsset,
    updateStandardMock
} from '../foundations/WorkbenchComponent/testing/mock'
import {
    MarkInlineEditor,
    MarkInlineEditorWithSession
} from './InlineEditor'
import {
    renderWorkbenchComponentSession,
} from '../foundations/WorkbenchComponent/testing/harness'

vi.mock('react-redux', () => ({
    useDispatch: () => vi.fn()
}))

vi.mock('../foundations/useWorkbenchAsset', () => ({
    useWorkbenchAsset: () => mockWorkbenchReturn
}))

const MARK_ID = 'MARK#mark1' as ComponentUUID

const FLUSH_DELAY_MS = 100

const markWml = `
    <Asset uuid=(test)>
        <Mark uuid=(mark1)><ShortName>Original</ShortName></Mark>
    </Asset>
`

const markGuard = (
    component: StandardComponent | undefined
): component is StandardMark => component instanceof StandardMark

const defaultSessionOptions = {
    wml: markWml,
    componentId: MARK_ID,
    guard: markGuard,
    flushDelayMs: FLUSH_DELAY_MS
}

const getFlushedMarkShortName = (
    componentId: ComponentUUID,
    baseForm: StandardForm
): string | undefined => {
    const updated = applyLastUpdateStandardMock(baseForm._clone())
    const component = updated.byUniversalId[componentId]
    if (!(component instanceof StandardMark)) {
        return undefined
    }
    const shortNameJson = component.shortName?.toJSON()
    return typeof shortNameJson === 'string' ? shortNameJson : undefined
}

describe('MarkInlineEditor', () => {
    beforeEach(() => {
        vi.useFakeTimers()
        resetWorkbenchAssetMock()
    })

    afterEach(() => {
        vi.clearAllTimers()
        vi.useRealTimers()
    })

    it('updates working immediately on input without waiting for flush debounce', () => {
        const { getSession } = renderWorkbenchComponentSession({
            options: defaultSessionOptions,
            children: <MarkInlineEditor />
        })

        fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Updated' } })

        expect(getSession().working?.shortName?.toJSON()).toBe('Updated')
        expect(getSession().committed?.shortName?.toJSON()).toBe('Original')
        expect(updateStandardMock).not.toHaveBeenCalled()
    })

    it('flushes to Redux after session debounce delay', () => {
        const { getSession } = renderWorkbenchComponentSession({
            options: defaultSessionOptions,
            children: <MarkInlineEditor />
        })

        fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Persisted' } })

        expect(updateStandardMock).not.toHaveBeenCalled()

        act(() => {
            vi.advanceTimersByTime(FLUSH_DELAY_MS)
        })

        expect(updateStandardMock).toHaveBeenCalledTimes(1)
        expect(getFlushedMarkShortName(MARK_ID, mockWorkbenchReturn.standardForm)).toBe('Persisted')
        expect(getSession().isDirty).toBe(false)
    })

    it('disables input when asset is readonly', () => {
        renderWorkbenchComponentSession({
            options: { ...defaultSessionOptions, readonly: true },
            children: <MarkInlineEditor />
        })

        expect((screen.getByRole('textbox') as HTMLInputElement).disabled).toBe(true)
    })
})

describe('MarkInlineEditorWithSession', () => {
    beforeEach(() => {
        vi.useFakeTimers()
        resetWorkbenchAssetMock()
    })

    afterEach(() => {
        vi.clearAllTimers()
        vi.useRealTimers()
    })

    it('renders inline editor under per-row Mark session', () => {
        seedWorkbenchAsset(markWml)
        render(
            <MarkInlineEditorWithSession markId={MARK_ID} flushDelayMs={FLUSH_DELAY_MS} />
        )

        expect(screen.getByRole('textbox')).toBeTruthy()
        expect((screen.getByRole('textbox') as HTMLInputElement).value).toBe('Original')
    })
})
