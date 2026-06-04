/**
 * @vitest-environment jsdom
 */

import React, { useCallback } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, screen } from '@testing-library/react'
import type { AssetUUID, ComponentUUID } from '@tonylb/mtw-base/ts/schema'
import StandardGuidance from '@tonylb/mtw-wml/ts/standardize/components/guidance'
import type { StandardComponent } from '@tonylb/mtw-wml/ts/standardize/components/baseClasses'
import { MarkFacetList } from '@tonylb/mtw-wml/ts/standardize/keys/facets/mark'

import { MarkFacetsEditor } from './MarkFacetsEditor'
import {
    useWorkbenchComponent,
    type WorkbenchComponentGuard
} from '../foundations/WorkbenchComponent'
import {
    materializeComponentInAssetMock,
    mockMaterializeComponentInAsset,
    mockMaterializeComponentInAssetImport,
    renderWorkbenchComponentSession,
    resetWorkbenchAssetMock,
    updateStandardMock
} from '../foundations/WorkbenchComponent/testing/harness'

const GUIDANCE_ID = 'GUIDANCE#guid1' as ComponentUUID
const FLUSH_DELAY_MS = 100

vi.mock('react-redux', () => ({
    useDispatch: () => vi.fn()
}))

vi.mock('../foundations/useWorkbenchAsset', async () => {
    const mock = await import('../foundations/WorkbenchComponent/testing/mock')
    return {
        useWorkbenchAsset: () => mock.mockWorkbenchReturn
    }
})

vi.mock('../ImportComponentDialog', () => ({
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

const guidanceGuard: WorkbenchComponentGuard<StandardGuidance> = (
    component: StandardComponent | undefined
): component is StandardGuidance => component instanceof StandardGuidance

const guidanceWithoutMarksWml = `
    <Asset uuid=(test)>
        <Guidance uuid=(guid1)>
            <ShortName>My Guidance</ShortName>
            <Instructions>Some instructions</Instructions>
        </Guidance>
    </Asset>
`

const guidanceWithOneMarkWml = `
    <Asset uuid=(test)>
        <Guidance uuid=(guid1)>
            <ShortName>My Guidance</ShortName>
            <Mark uuid=(mark1)><Match>Test</Match></Mark>
        </Guidance>
        <Mark uuid=(mark1)><ShortName>Test Mark</ShortName></Mark>
    </Asset>
`

const flushAsync = async (): Promise<void> => {
    await act(async () => {
        await Promise.resolve()
        await Promise.resolve()
    })
}

const MarkFacetsSessionHarness: React.FunctionComponent<{ componentId: ComponentUUID }> = ({
    componentId
}) => {
    const { working, updateComponent, readonly } = useWorkbenchComponent<StandardGuidance>()

    const handleMarksChange = useCallback(
        (newMarks: MarkFacetList) => {
            updateComponent((draft) => {
                draft._payload._marks = newMarks
            })
        },
        [updateComponent]
    )

    if (!working) {
        return null
    }

    return (
        <MarkFacetsEditor
            componentId={componentId}
            marks={working.marks}
            onChange={handleMarksChange}
            readonly={readonly}
        />
    )
}

const expandMarksAccordion = (): void => {
    fireEvent.click(screen.getByRole('button', { name: /Marks/i }))
}

const renderMarkFacets = (wml: string) =>
    renderWorkbenchComponentSession<StandardGuidance>({
        options: {
            wml,
            componentId: GUIDANCE_ID,
            guard: guidanceGuard,
            flushDelayMs: FLUSH_DELAY_MS
        },
        children: <MarkFacetsSessionHarness componentId={GUIDANCE_ID} />
    })

describe('MarkFacetsEditor', () => {
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

        const { getSession } = renderMarkFacets(guidanceWithoutMarksWml)
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

    it('create new debounced flush uses updateLocal', async () => {
        mockMaterializeComponentInAsset()

        renderMarkFacets(guidanceWithoutMarksWml)
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
        expect(updateStandardMock.mock.calls[0]![0]).toMatchObject({ type: 'updateLocal' })

        const flushUpdate = updateStandardMock.mock.calls[0]![0]!.update
        const { mockWorkbenchReturn } = await import(
            '../foundations/WorkbenchComponent/testing/mock'
        )
        const draft = mockWorkbenchReturn.localStandardForm._clone()
        flushUpdate(draft)

        expect(draft.byUniversalId[materializedKey]).toBeDefined()
        const guidance = draft.byUniversalId[GUIDANCE_ID]
        expect(guidance instanceof StandardGuidance).toBe(true)
        if (guidance instanceof StandardGuidance) {
            expect(guidance.marks.items.length).toBe(1)
        }
    })

    it('import awaits materialize then associates on working', async () => {
        mockMaterializeComponentInAssetImport()

        const { getSession } = renderMarkFacets(guidanceWithoutMarksWml)
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
        const { getSession } = renderMarkFacets(guidanceWithOneMarkWml)

        const deleteButtons = screen.getAllByLabelText('remove')
        act(() => {
            fireEvent.click(deleteButtons[0])
        })

        expect(getSession().working?.marks.items.length).toBe(0)
        expect(updateStandardMock).not.toHaveBeenCalled()
    })

    it('debounced flush persists facet remove via updateLocal', () => {
        renderMarkFacets(guidanceWithOneMarkWml)

        const deleteButtons = screen.getAllByLabelText('remove')
        act(() => {
            fireEvent.click(deleteButtons[0])
            vi.advanceTimersByTime(FLUSH_DELAY_MS)
        })

        expect(updateStandardMock).toHaveBeenCalledTimes(1)
        expect(updateStandardMock.mock.calls[0]![0]).toMatchObject({ type: 'updateLocal' })
    })
})
