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
import StandardObject from '@tonylb/mtw-wml/ts/standardize/components/object'
import type { StandardComponent } from '@tonylb/mtw-wml/ts/standardize/components/baseClasses'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'

import {
    applyLastUpdateStandardMock,
    mockWorkbenchReturn,
    resetWorkbenchAssetMock,
    updateStandardMock
} from '../foundations/WorkbenchComponent/testing/mock'
import { renderWorkbenchComponentSession } from '../foundations/WorkbenchComponent/testing/harness'
import { ObjectEditorBody } from './ObjectEditor'

vi.mock('react-redux', () => ({
    useDispatch: () => vi.fn(),
    useSelector: () => null
}))

vi.mock('../foundations/useWorkbenchAsset', () => ({
    useWorkbenchAsset: () => mockWorkbenchReturn
}))

const OBJECT_ID = 'OBJECT#obj1' as ComponentUUID

const FLUSH_DELAY_MS = 100

const objectWml = `
    <Asset uuid=(test)>
        <Object uuid=(obj1)>
            <ShortName>Original</ShortName>
            <Gloss>A worn wooden sign.</Gloss>
        </Object>
    </Asset>
`

const objectGuard = (
    component: StandardComponent | undefined
): component is StandardObject => component instanceof StandardObject

const defaultSessionOptions = {
    wml: objectWml,
    componentId: OBJECT_ID,
    guard: objectGuard,
    flushDelayMs: FLUSH_DELAY_MS
}

const getFlushedObject = (
    componentId: ComponentUUID,
    baseForm: StandardForm
): StandardObject | undefined => {
    const updated = applyLastUpdateStandardMock(baseForm._clone())
    const component = updated.byUniversalId[componentId]
    return component instanceof StandardObject ? component : undefined
}

describe('ObjectEditorBody', () => {
    beforeEach(() => {
        vi.useFakeTimers()
        resetWorkbenchAssetMock()
    })

    afterEach(() => {
        vi.clearAllTimers()
        vi.useRealTimers()
    })

    it('updates working shortName and gloss immediately without updateStandard until flush', () => {
        const { getSession } = renderWorkbenchComponentSession({
            options: defaultSessionOptions,
            children: <ObjectEditorBody />
        })

        const inputs = screen.getAllByRole('textbox')
        fireEvent.change(inputs[0], { target: { value: 'Updated name' } })
        fireEvent.change(inputs[1], { target: { value: 'A tarnished brass key.' } })

        expect(getSession().working?.shortName?.toJSON()).toBe('Updated name')
        expect(getSession().working?.gloss?.toJSON()).toBe('A tarnished brass key.')
        expect(updateStandardMock).not.toHaveBeenCalled()
    })

    it('flushes both ShortName and Gloss together after the session debounce', () => {
        renderWorkbenchComponentSession({
            options: defaultSessionOptions,
            children: <ObjectEditorBody />
        })

        const inputs = screen.getAllByRole('textbox')
        fireEvent.change(inputs[0], { target: { value: 'New name' } })
        fireEvent.change(inputs[1], { target: { value: 'A dusty leather satchel.' } })

        act(() => {
            vi.advanceTimersByTime(FLUSH_DELAY_MS)
        })

        expect(updateStandardMock).toHaveBeenCalledTimes(1)
        const flushed = getFlushedObject(OBJECT_ID, mockWorkbenchReturn.standardForm)
        expect(flushed?.shortName?.toJSON()).toBe('New name')
        expect(flushed?.gloss?.toJSON()).toBe('A dusty leather satchel.')
    })
})
