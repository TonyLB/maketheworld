/**
 * @vitest-environment jsdom
 */

import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'

const act = (React as typeof React & {
    act: (callback: () => void | Promise<void>) => void | Promise<void>
}).act

import { ComponentUUID } from '@tonylb/mtw-base/ts/schema'
import StandardGuidance from '@tonylb/mtw-wml/ts/standardize/components/guidance'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'

import {
    applyLastUpdateStandardMock,
    mockWorkbenchReturn,
    resetWorkbenchAssetMock,
    updateStandardMock
} from '../foundations/WorkbenchComponent/testing/mock'
import { renderWorkbenchComponentSession } from '../foundations/WorkbenchComponent/testing/harness'
import { GuidanceEditorBody } from './GuidanceEditor'

vi.mock('react-redux', () => ({
    useDispatch: () => vi.fn(),
    useSelector: () => null
}))

vi.mock('../foundations/useWorkbenchAsset', () => ({
    useWorkbenchAsset: () => mockWorkbenchReturn
}))

vi.mock('../MarkFacetsEditor', () => ({
    MarkFacetsEditor: () => null
}))

const GUIDANCE_ID = 'GUIDANCE#guid1' as ComponentUUID

const FLUSH_DELAY_MS = 100

const guidanceWml = `
    <Asset uuid=(test)>
        <Guidance uuid=(guid1)>
            <ShortName>Original</ShortName>
            <Instructions>Original instructions</Instructions>
        </Guidance>
    </Asset>
`

const guidanceGuard = (
    component: import('@tonylb/mtw-wml/ts/standardize/components/baseClasses').StandardComponent | undefined
): component is StandardGuidance => component instanceof StandardGuidance

const defaultSessionOptions = {
    wml: guidanceWml,
    componentId: GUIDANCE_ID,
    guard: guidanceGuard,
    flushDelayMs: FLUSH_DELAY_MS
}

const getFlushedGuidance = (
    componentId: ComponentUUID,
    baseForm: StandardForm
): StandardGuidance | undefined => {
    const updated = applyLastUpdateStandardMock(baseForm._clone())
    const component = updated.byUniversalId[componentId]
    return component instanceof StandardGuidance ? component : undefined
}

describe('GuidanceEditorBody', () => {
    beforeEach(() => {
        vi.useFakeTimers()
        resetWorkbenchAssetMock()
    })

    afterEach(() => {
        vi.clearAllTimers()
        vi.useRealTimers()
    })

    it('updates working shortName immediately without updateStandard until flush', () => {
        const { getSession } = renderWorkbenchComponentSession({
            options: defaultSessionOptions,
            children: <GuidanceEditorBody componentId={GUIDANCE_ID} />
        })

        const inputs = screen.getAllByRole('textbox')
        fireEvent.change(inputs[0], { target: { value: 'Updated name' } })

        expect(getSession().working?.shortName?.toJSON()).toBe('Updated name')
        expect(updateStandardMock).not.toHaveBeenCalled()
    })

    it('updates working instructions and preserves both fields on flush', () => {
        const { getSession } = renderWorkbenchComponentSession({
            options: defaultSessionOptions,
            children: <GuidanceEditorBody componentId={GUIDANCE_ID} />
        })

        const inputs = screen.getAllByRole('textbox')
        fireEvent.change(inputs[0], { target: { value: 'New name' } })
        fireEvent.change(inputs[1], { target: { value: 'New instructions' } })

        expect(getSession().working?.instructions?.toJSON()).toBe('New instructions')

        act(() => {
            vi.advanceTimersByTime(FLUSH_DELAY_MS)
        })

        expect(updateStandardMock).toHaveBeenCalledTimes(1)
        const flushed = getFlushedGuidance(GUIDANCE_ID, mockWorkbenchReturn.standardForm)
        expect(flushed?.shortName?.toJSON()).toBe('New name')
        expect(flushed?.instructions?.toJSON()).toBe('New instructions')
    })
})
