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
import StandardMark from '@tonylb/mtw-wml/ts/standardize/components/worldState'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'

import {
    applyLastUpdateStandardMock,
    mockWorkbenchReturn,
    resetWorkbenchAssetMock,
    updateStandardMock
} from '../foundations/WorkbenchComponent/testing/mock'
import { renderWorkbenchComponentSession } from '../foundations/WorkbenchComponent/testing/harness'
import { MarkEditorBody } from './MarkEditor'

vi.mock('react-redux', () => ({
    useDispatch: () => vi.fn(),
    useSelector: () => null
}))

vi.mock('../foundations/useWorkbenchAsset', () => ({
    useWorkbenchAsset: () => mockWorkbenchReturn
}))

vi.mock('../foundations/StandardRender', () => ({
    StandardRenderEditor: () => null
}))

const MARK_ID = 'MARK#mark1' as ComponentUUID

const FLUSH_DELAY_MS = 100

const markWml = `
    <Asset uuid=(test)>
        <Mark uuid=(mark1)>
            <ShortName>Original</ShortName>
            <Description>Original description</Description>
        </Mark>
    </Asset>
`

const markGuard = (
    component: import('@tonylb/mtw-wml/ts/standardize/components/baseClasses').StandardComponent | undefined
): component is StandardMark => component instanceof StandardMark

const defaultSessionOptions = {
    wml: markWml,
    componentId: MARK_ID,
    guard: markGuard,
    flushDelayMs: FLUSH_DELAY_MS
}

const getFlushedMark = (
    componentId: ComponentUUID,
    baseForm: StandardForm
): StandardMark | undefined => {
    const updated = applyLastUpdateStandardMock(baseForm._clone())
    const component = updated.byUniversalId[componentId]
    return component instanceof StandardMark ? component : undefined
}

describe('MarkEditorBody', () => {
    beforeEach(() => {
        vi.useFakeTimers()
        resetWorkbenchAssetMock()
    })

    afterEach(() => {
        vi.clearAllTimers()
        vi.useRealTimers()
    })

    it('flushes shortName and description together after session debounce', () => {
        const { getSession } = renderWorkbenchComponentSession({
            options: defaultSessionOptions,
            children: <MarkEditorBody />
        })

        fireEvent.change(screen.getByRole('textbox'), { target: { value: 'New name' } })

        expect(getSession().working?.shortName?.toJSON()).toBe('New name')

        act(() => {
            vi.advanceTimersByTime(FLUSH_DELAY_MS)
        })

        expect(updateStandardMock).toHaveBeenCalledTimes(1)
        const flushed = getFlushedMark(MARK_ID, mockWorkbenchReturn.standardForm)
        expect(flushed?.shortName?.toJSON()).toBe('New name')
    })
})
