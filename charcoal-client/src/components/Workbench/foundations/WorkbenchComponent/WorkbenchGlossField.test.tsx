/**
 * @vitest-environment jsdom
 */

import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'

/** React 18.3+ `act` (not the deprecated `react-dom/test-utils` re-export from RTL). */
const act = (React as typeof React & {
    act: (callback: () => void | Promise<void>) => void | Promise<void>
}).act
import { ComponentUUID } from '@tonylb/mtw-base/ts/schema'
import StandardFeature from '@tonylb/mtw-wml/ts/standardize/components/feature'
import type { StandardComponent } from '@tonylb/mtw-wml/ts/standardize/components/baseClasses'

import { getFlushedFeatureGloss, mockWorkbenchReturn } from './testing/mock'

vi.mock('react-redux', () => ({
    useDispatch: () => vi.fn()
}))

vi.mock('../useWorkbenchAsset', () => ({
    useWorkbenchAsset: () => mockWorkbenchReturn
}))

import { WorkbenchGlossField } from './WorkbenchGlossField'
import {
    renderWorkbenchComponentSession,
    resetWorkbenchAssetMock,
    updateStandardMock
} from './testing/harness'

const FEATURE_ID = 'FEATURE#feat1' as ComponentUUID

const FLUSH_DELAY_MS = 100

const featureWml = `
    <Asset uuid=(test)>
        <Feature uuid=(feat1)><ShortName>Original</ShortName><Gloss>A worn wooden sign.</Gloss></Feature>
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

describe('WorkbenchGlossField', () => {
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
            children: <WorkbenchGlossField />
        })

        fireEvent.change(screen.getByRole('textbox'), { target: { value: 'A cracked clay pot.' } })

        expect(getSession().working?.gloss?.toJSON()).toBe('A cracked clay pot.')
        expect(getSession().committed?.gloss?.toJSON()).toBe('A worn wooden sign.')
        expect(updateStandardMock).not.toHaveBeenCalled()
    })

    it('flushes to Redux after session debounce delay', () => {
        const { getSession } = renderWorkbenchComponentSession({
            options: defaultSessionOptions,
            children: <WorkbenchGlossField />
        })

        fireEvent.change(screen.getByRole('textbox'), { target: { value: 'A cracked clay pot.' } })

        expect(updateStandardMock).not.toHaveBeenCalled()

        act(() => {
            vi.advanceTimersByTime(FLUSH_DELAY_MS)
        })

        expect(updateStandardMock).toHaveBeenCalledTimes(1)
        expect(
            getFlushedFeatureGloss(FEATURE_ID, mockWorkbenchReturn.standardForm)
        ).toBe('A cracked clay pot.')
        expect(getSession().isDirty).toBe(false)
    })

    it('disables input when asset is readonly', () => {
        renderWorkbenchComponentSession({
            options: { ...defaultSessionOptions, readonly: true },
            children: <WorkbenchGlossField />
        })

        expect((screen.getByRole('textbox') as HTMLInputElement).disabled).toBe(true)
    })
})
