/**
 * @vitest-environment jsdom
 */

import React, { useCallback } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, screen } from '@testing-library/react'
import type { AssetUUID, ComponentUUID } from '@tonylb/mtw-base/ts/schema'
import StandardGuidance from '@tonylb/mtw-wml/ts/standardize/components/guidance'
import type { StandardComponent } from '@tonylb/mtw-wml/ts/standardize/components/baseClasses'
import { MarkFacetList, StandardMarkFacet } from '@tonylb/mtw-wml/ts/standardize/keys/facets/mark'

import { FacetListSessionEditor } from './FacetListSessionEditor'
import { SingleLineFacetRow } from './SingleLineFacetRow'
import {
    materializeComponentInAssetMock,
    mockMaterializeComponentInAsset,
    mockMaterializeComponentInAssetImport,
    renderWorkbenchComponentSession,
    resetWorkbenchAssetMock,
    updateStandardMock
} from '../WorkbenchComponent/testing/harness'
import { guidanceMarkFacetAccessor } from '../../MarkFacetsEditor/markFacetAccessors'

vi.mock('react-redux', () => ({
    useDispatch: () => vi.fn()
}))

vi.mock('../useWorkbenchAsset', async (importOriginal) => {
    const mock = await import('../WorkbenchComponent/testing/mock')
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

const GUIDANCE_ID = 'GUIDANCE#guid1' as ComponentUUID
const FLUSH_DELAY_MS = 100

const guidanceGuard = (
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

const rebuildMarkFacetList = (items: StandardMarkFacet[]): MarkFacetList => new MarkFacetList(items)

const flushAsync = async (): Promise<void> => {
    await act(async () => {
        await Promise.resolve()
        await Promise.resolve()
    })
}

const TestFacetListSessionEditor: React.FunctionComponent = () => {
    const renderFacetRow = useCallback(
        (facet: StandardMarkFacet, _index: number, handlers: { onRemove: () => void; readonly: boolean }) => (
            <SingleLineFacetRow
                payloadSlot={<span>{facet.reference.universalKey}</span>}
                onRemove={handlers.onRemove}
                readonly={handlers.readonly}
            />
        ),
        []
    )

    return (
        <FacetListSessionEditor<StandardGuidance, StandardMarkFacet, MarkFacetList>
            title="Marks"
            facetListAccessor={guidanceMarkFacetAccessor}
            rebuildFacetList={rebuildMarkFacetList}
            tag="Mark"
            renderFacetRow={renderFacetRow}
            affordance={{
                addLabel: 'Create new Mark',
                referenceExistingLabel: 'Reference existing Mark',
                enableReferenceExisting: true,
                enableImport: true
            }}
        />
    )
}

const expandMarksAccordion = (): void => {
    fireEvent.click(screen.getByRole('button', { name: /Marks/i }))
}

describe('FacetListSessionEditor', () => {
    beforeEach(() => {
        vi.useFakeTimers()
        resetWorkbenchAssetMock()
    })

    afterEach(() => {
        vi.clearAllTimers()
        vi.useRealTimers()
    })

    it('reads facets from session working', () => {
        const { getSession } = renderWorkbenchComponentSession({
            options: {
                wml: guidanceWithOneMarkWml,
                componentId: GUIDANCE_ID,
                guard: guidanceGuard,
                flushDelayMs: FLUSH_DELAY_MS
            },
            children: <TestFacetListSessionEditor />
        })

        expect(guidanceMarkFacetAccessor.getFacetList(getSession().working!).items.length).toBe(1)
        expect(screen.getByText('MARK#mark1')).toBeDefined()
    })

    it('remove does not call updateStandard before debounce', () => {
        const { getSession } = renderWorkbenchComponentSession({
            options: {
                wml: guidanceWithOneMarkWml,
                componentId: GUIDANCE_ID,
                guard: guidanceGuard,
                flushDelayMs: FLUSH_DELAY_MS
            },
            children: <TestFacetListSessionEditor />
        })

        const deleteButtons = screen.getAllByLabelText('remove')
        act(() => {
            fireEvent.click(deleteButtons[0])
        })

        expect(guidanceMarkFacetAccessor.getFacetList(getSession().working!).items.length).toBe(0)
        expect(updateStandardMock).not.toHaveBeenCalled()
    })

    it('debounced flush persists facet remove via update', () => {
        renderWorkbenchComponentSession({
            options: {
                wml: guidanceWithOneMarkWml,
                componentId: GUIDANCE_ID,
                guard: guidanceGuard,
                flushDelayMs: FLUSH_DELAY_MS
            },
            children: <TestFacetListSessionEditor />
        })

        const deleteButtons = screen.getAllByLabelText('remove')
        act(() => {
            fireEvent.click(deleteButtons[0])
            vi.advanceTimersByTime(FLUSH_DELAY_MS)
        })

        expect(updateStandardMock).toHaveBeenCalledTimes(1)
        expect(updateStandardMock.mock.calls[0]![0]).toMatchObject({ type: 'update' })
    })

    it('create new awaits materialize then associates on working without immediate flush', async () => {
        mockMaterializeComponentInAsset()

        const { getSession } = renderWorkbenchComponentSession({
            options: {
                wml: guidanceWithoutMarksWml,
                componentId: GUIDANCE_ID,
                guard: guidanceGuard,
                flushDelayMs: FLUSH_DELAY_MS
            },
            children: <TestFacetListSessionEditor />
        })
        expandMarksAccordion()

        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: /Create new Mark/i }))
        })
        await flushAsync()

        expect(materializeComponentInAssetMock).toHaveBeenCalledTimes(1)

        const spec = materializeComponentInAssetMock.mock.calls[0]![0]!
        expect(spec.universalKey).toMatch(/^MARK#/)
        expect(spec.fromAsset).toBeUndefined()

        expect(guidanceMarkFacetAccessor.getFacetList(getSession().working!).items.length).toBe(1)
        expect(
            guidanceMarkFacetAccessor.getFacetList(getSession().working!).items[0]!.reference
                .universalKey
        ).toBe(spec.universalKey)

        expect(updateStandardMock).not.toHaveBeenCalled()
    })

    it('import awaits materialize then associates on working', async () => {
        mockMaterializeComponentInAssetImport()

        const { getSession } = renderWorkbenchComponentSession({
            options: {
                wml: guidanceWithoutMarksWml,
                componentId: GUIDANCE_ID,
                guard: guidanceGuard,
                flushDelayMs: FLUSH_DELAY_MS
            },
            children: <TestFacetListSessionEditor />
        })
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

        expect(guidanceMarkFacetAccessor.getFacetList(getSession().working!).items.length).toBe(1)
        expect(
            guidanceMarkFacetAccessor.getFacetList(getSession().working!).items[0]!.reference
                .universalKey
        ).toBe('MARK#imported')

        expect(updateStandardMock).not.toHaveBeenCalled()
    })
})
