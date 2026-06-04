/**
 * @vitest-environment jsdom
 */

import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, screen } from '@testing-library/react'
import type { AssetUUID, ComponentUUID } from '@tonylb/mtw-base/ts/schema'
import { StandardLens } from '@tonylb/mtw-wml/ts/standardize/components/worldState'
import type { StandardComponent } from '@tonylb/mtw-wml/ts/standardize/components/baseClasses'

import { LensMarkFacetsEditor } from './LensMarkFacetsEditor'
import { type WorkbenchComponentGuard } from '../../foundations/WorkbenchComponent'
import {
    materializeComponentInAssetMock,
    mockMaterializeComponentInAsset,
    mockMaterializeComponentInAssetImport,
    renderWorkbenchComponentSession,
    resetWorkbenchAssetMock,
    updateStandardMock
} from '../../foundations/WorkbenchComponent/testing/harness'

const LENS_ID = 'LENS#lens1' as ComponentUUID
const MARK_ID = 'MARK#mark1' as ComponentUUID
const FLUSH_DELAY_MS = 100

vi.mock('react-redux', () => ({
    useDispatch: () =>
        vi.fn((action: unknown) => {
            if (typeof action === 'function') {
                return (action as (dispatch: unknown) => unknown)(vi.fn())
            }
            return action
        })
}))

vi.mock('../../foundations/useWorkbenchAsset', async () => {
    const mock = await import('../../foundations/WorkbenchComponent/testing/mock')
    return {
        useWorkbenchAsset: () => mock.mockWorkbenchReturn
    }
})

vi.mock('../../ImportComponentDialog', () => ({
    default: ({
        open,
        onImportSelect
    }: {
        open: boolean
        onImportSelect: (
            fromAsset: AssetUUID,
            uuid: ComponentUUID,
            tag: 'Mark'
        ) => void
    }) =>
        open ? (
            <button
                type="button"
                data-testid="mock-import-select"
                onClick={() =>
                    onImportSelect(
                        'ASSET#source' as AssetUUID,
                        'MARK#imported' as ComponentUUID,
                        'Mark'
                    )
                }
            >
                Mock Import Select
            </button>
        ) : null
}))

const lensGuard: WorkbenchComponentGuard<StandardLens> = (
    component: StandardComponent | undefined
): component is StandardLens => component instanceof StandardLens

const lensWithoutMarksWml = `
    <Asset uuid=(test)>
        <Lens uuid=(lens1)><ShortName>My Lens</ShortName></Lens>
    </Asset>
`

const lensWithOneMarkWml = `
    <Asset uuid=(test)>
        <Lens uuid=(lens1)>
            <ShortName>My Lens</ShortName>
            <Mark uuid=(mark1)><ShortName>Test Mark</ShortName></Mark>
        </Lens>
        <Mark uuid=(mark1)><ShortName>Test Mark</ShortName></Mark>
    </Asset>
`

const flushAsync = async (): Promise<void> => {
    await act(async () => {
        await Promise.resolve()
        await Promise.resolve()
    })
}

const expandMarksAccordion = (): void => {
    fireEvent.click(screen.getByRole('button', { name: /Marks/i }))
}

const renderLensMarkFacets = (wml: string) =>
    renderWorkbenchComponentSession<StandardLens>({
        options: {
            wml,
            componentId: LENS_ID,
            guard: lensGuard,
            flushDelayMs: FLUSH_DELAY_MS
        },
        children: <LensMarkFacetsEditor />
    })

describe('LensMarkFacetsEditor', () => {
    beforeEach(() => {
        vi.useFakeTimers()
        resetWorkbenchAssetMock()
    })

    afterEach(() => {
        vi.clearAllTimers()
        vi.useRealTimers()
    })

    it('create new awaits materialize then associates on working without immediate flush', async () => {
        mockMaterializeComponentInAsset()

        const { getSession } = renderLensMarkFacets(lensWithoutMarksWml)
        expandMarksAccordion()

        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: /Create new Mark/i }))
        })
        await flushAsync()

        expect(materializeComponentInAssetMock).toHaveBeenCalledTimes(1)

        const spec = materializeComponentInAssetMock.mock.calls[0]![0]!
        expect(spec.universalKey).toMatch(/^MARK#/)
        expect(spec.fromAsset).toBeUndefined()

        expect(getSession().working?.marks.items.length).toBe(1)
        expect(getSession().working?.marks.items[0]!.reference.universalKey).toBe(
            spec.universalKey
        )

        expect(updateStandardMock).not.toHaveBeenCalled()
    })

    it('create new debounced flush uses update', async () => {
        mockMaterializeComponentInAsset()

        renderLensMarkFacets(lensWithoutMarksWml)
        expandMarksAccordion()

        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: /Create new Mark/i }))
        })
        await flushAsync()

        expect(materializeComponentInAssetMock).toHaveBeenCalledTimes(1)

        const materializedKey = materializeComponentInAssetMock.mock.calls[0]![0]!.universalKey

        act(() => {
            vi.advanceTimersByTime(FLUSH_DELAY_MS)
        })

        expect(updateStandardMock).toHaveBeenCalledTimes(1)
        expect(updateStandardMock.mock.calls[0]![0]).toMatchObject({ type: 'update' })

        const flushUpdate = updateStandardMock.mock.calls[0]![0]!.update
        const { mockWorkbenchReturn } = await import(
            '../../foundations/WorkbenchComponent/testing/mock'
        )
        const draft = mockWorkbenchReturn.localStandardForm._clone()
        flushUpdate(draft)

        expect(draft.byUniversalId[materializedKey]).toBeDefined()
        const lens = draft.byUniversalId[LENS_ID]
        expect(lens instanceof StandardLens).toBe(true)
        if (lens instanceof StandardLens) {
            expect(lens.marks.items.length).toBe(1)
        }
    })

    it('import awaits materialize then associates on working', async () => {
        mockMaterializeComponentInAssetImport()

        const { getSession } = renderLensMarkFacets(lensWithoutMarksWml)
        expandMarksAccordion()

        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: /Import/i }))
        })
        await act(async () => {
            fireEvent.click(screen.getByTestId('mock-import-select'))
        })
        await flushAsync()

        expect(materializeComponentInAssetMock).toHaveBeenCalledTimes(1)
        expect(materializeComponentInAssetMock.mock.calls[0]![0]).toEqual({
            universalKey: 'MARK#imported',
            fromAsset: 'ASSET#source'
        })

        expect(getSession().working?.marks.items.length).toBe(1)
        expect(getSession().working?.marks.items[0]!.reference.universalKey).toBe(
            'MARK#imported'
        )

        expect(updateStandardMock).not.toHaveBeenCalled()
    })

    it('remove facet row does not call updateStandard before debounce', () => {
        const { getSession } = renderLensMarkFacets(lensWithOneMarkWml)

        const deleteButtons = screen.getAllByLabelText('remove')
        act(() => {
            fireEvent.click(deleteButtons[0])
        })

        expect(getSession().working?.marks.items.length).toBe(0)
        expect(updateStandardMock).not.toHaveBeenCalled()
    })

    it('debounced flush persists facet remove via update', () => {
        renderLensMarkFacets(lensWithOneMarkWml)

        const deleteButtons = screen.getAllByLabelText('remove')
        act(() => {
            fireEvent.click(deleteButtons[0])
            vi.advanceTimersByTime(FLUSH_DELAY_MS)
        })

        expect(updateStandardMock).toHaveBeenCalledTimes(1)
        expect(updateStandardMock.mock.calls[0]![0]).toMatchObject({ type: 'update' })
    })
})
