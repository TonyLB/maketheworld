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
import StandardFeature from '@tonylb/mtw-wml/ts/standardize/components/feature'
import type { StandardComponent } from '@tonylb/mtw-wml/ts/standardize/components/baseClasses'
import { StandardLiteral } from '@tonylb/mtw-wml/ts/standardize/literal'

import { getFlushedFeatureShortName, mockWorkbenchReturn } from './testing/mock'

vi.mock('react-redux', () => ({
    useDispatch: () => vi.fn()
}))

vi.mock('../useWorkbenchAsset', () => ({
    useWorkbenchAsset: () => mockWorkbenchReturn
}))

import { TopLevelStandardLiteralEditor } from '../StandardLiteral'
import { WorkbenchShortNameField } from './WorkbenchShortNameField'
import {
    renderWorkbenchComponentSession,
    resetWorkbenchAssetMock,
    updateStandardMock
} from './testing/harness'

const FEATURE_ID = 'FEATURE#feat1' as ComponentUUID

const FLUSH_DELAY_MS = 100

const featureWml = `
    <Asset uuid=(test)>
        <Feature uuid=(feat1)><ShortName>Original</ShortName></Feature>
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

describe('WorkbenchShortNameField', () => {
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
            children: <WorkbenchShortNameField />
        })

        fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Updated' } })

        expect(getSession().working?.shortName?.toJSON()).toBe('Updated')
        expect(getSession().committed?.shortName?.toJSON()).toBe('Original')
        expect(updateStandardMock).not.toHaveBeenCalled()
    })

    it('flushes to Redux after session debounce delay', () => {
        const { getSession } = renderWorkbenchComponentSession({
            options: defaultSessionOptions,
            children: <WorkbenchShortNameField />
        })

        fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Persisted' } })

        expect(updateStandardMock).not.toHaveBeenCalled()

        act(() => {
            vi.advanceTimersByTime(FLUSH_DELAY_MS)
        })

        expect(updateStandardMock).toHaveBeenCalledTimes(1)
        expect(
            getFlushedFeatureShortName(FEATURE_ID, mockWorkbenchReturn.standardForm)
        ).toBe('Persisted')
        expect(getSession().isDirty).toBe(false)
    })

    it('disables input when asset is readonly', () => {
        renderWorkbenchComponentSession({
            options: { ...defaultSessionOptions, readonly: true },
            children: <WorkbenchShortNameField />
        })

        expect((screen.getByRole('textbox') as HTMLInputElement).disabled).toBe(true)
    })
})

describe('TopLevelStandardLiteralEditor debounce=false', () => {
    beforeEach(() => {
        vi.useFakeTimers()
    })

    afterEach(() => {
        vi.clearAllTimers()
        vi.useRealTimers()
    })

    it('calls onChange on first keystroke without advancing timers', () => {
        const onChange = vi.fn()
        render(
            <TopLevelStandardLiteralEditor
                value={new StandardLiteral('')}
                onChange={onChange}
                label="Short Name"
                debounce={false}
            />
        )

        fireEvent.change(screen.getByRole('textbox'), { target: { value: 'A' } })

        expect(onChange).toHaveBeenCalledTimes(1)
        expect(onChange.mock.calls[0][0].toJSON()).toBe('A')

        act(() => {
            vi.advanceTimersByTime(1000)
        })

        expect(onChange).toHaveBeenCalledTimes(1)
    })
})
