/**
 * @vitest-environment jsdom
 */

import React, { useCallback, useMemo } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render } from '@testing-library/react'
import type { ComponentUUID } from '@tonylb/mtw-base/ts/schema'
import { StandardRender } from '@tonylb/mtw-wml/ts/standardize/render'
import StandardRoom from '@tonylb/mtw-wml/ts/standardize/components/room'
import type { StandardComponent } from '@tonylb/mtw-wml/ts/standardize/components/baseClasses'
import { SituationProseFacetPayload } from '@tonylb/mtw-wml/ts/standardize/keys/facets/situationRoom'
import { StandardLiteral } from '@tonylb/mtw-wml/ts/standardize/literal'

import { DEFAULT_SITUATION_ID } from '../../../slices/personalAssets'
import DefaultRenderEditor from './DefaultRenderEditor'
import SituationFacetRenderFieldsView from './SituationFacetRenderFieldsView'
import { useWorkbenchComponent } from './WorkbenchComponent'
import {
    findSituationFacet,
    isSituationProseParent,
    updateSituationFacetPayloadOnParent,
    type SituationProseParent
} from './workbenchMutations'
import {
    renderWorkbenchComponentSession,
    resetWorkbenchAssetMock,
    seedLayeredWorkbenchAsset,
    updateStandardMock
} from './WorkbenchComponent/testing/harness'
import { syncLayeredMockFromState } from './WorkbenchComponent/testing/mock'

vi.mock('react-redux', () => ({
    useDispatch: () => vi.fn()
}))

vi.mock('./useWorkbenchAsset', async () => {
    const mock = await import('./WorkbenchComponent/testing/mock')
    return {
        useWorkbenchAsset: () => mock.mockWorkbenchReturn
    }
})

vi.mock('../../Onboarding/TutorialPopover', () => ({
    default: () => null
}))

const ROOM_ID = 'ROOM#clifftop' as ComponentUUID
const FLUSH_DELAY_MS = 100

const roomWithDefaultSituationWml = `
    <Asset uuid=(test)>
        <Room uuid=(clifftop) key=(clifftop)>
            <ShortName>Clifftop</ShortName>
            <Situation uuid=(DEFAULT)><Summary>Hello</Summary></Situation>
        </Room>
    </Asset>
`

const roomGuard = (
    component: StandardComponent | undefined
): component is StandardRoom => component instanceof StandardRoom

const defaultSessionOptions = {
    wml: roomWithDefaultSituationWml,
    componentId: ROOM_ID,
    guard: roomGuard,
    flushDelayMs: FLUSH_DELAY_MS
}

const flushAsync = async (): Promise<void> => {
    await act(async () => {
        await Promise.resolve()
        await Promise.resolve()
    })
}

let trackedUpdateComponentCalls = 0

/** Session-bound prose fields with debounce=false and real updateComponent wiring (I3 repro). */
const WiredDefaultProseFields: React.FunctionComponent = () => {
    const { working, updateComponent } = useWorkbenchComponent<SituationProseParent>()

    const facet = useMemo(() => {
        if (!working || !isSituationProseParent(working)) {
            return undefined
        }
        return findSituationFacet(working, DEFAULT_SITUATION_ID)
    }, [working])

    const payload = facet ? (facet.payload as SituationProseFacetPayload) : undefined

    const trackedUpdateComponent = useCallback(
        (updater: (draft: SituationProseParent) => void) => {
            trackedUpdateComponentCalls++
            updateComponent(updater)
        },
        [updateComponent]
    )

    const handleSummaryChange = useCallback(
        (newSummary: StandardRender) => {
            if (!working || !isSituationProseParent(working)) {
                return
            }
            trackedUpdateComponent((draft) => {
                if (!isSituationProseParent(draft)) {
                    return
                }
                updateSituationFacetPayloadOnParent(draft, DEFAULT_SITUATION_ID, (prev) =>
                    new SituationProseFacetPayload({
                        displayName: prev._displayName?.toJSON(),
                        summary: newSummary.toJSON(),
                        description: prev._description?.toJSON()
                    })
                )
            })
        },
        [working, trackedUpdateComponent]
    )

    const noopLiteral = useCallback((_value: StandardLiteral) => {}, [])
    const noopRender = useCallback((_value: StandardRender) => {}, [])

    if (!working || !isSituationProseParent(working)) {
        return null
    }

    return (
        <SituationFacetRenderFieldsView
            payload={payload}
            debounce={false}
            onDisplayNameChange={noopLiteral}
            onSummaryChange={handleSummaryChange}
            onDescriptionChange={noopRender}
        />
    )
}

describe('DefaultRenderEditor (I5 bounded mount)', () => {
    beforeEach(() => {
        vi.useFakeTimers()
        resetWorkbenchAssetMock()
    })

    afterEach(() => {
        vi.clearAllTimers()
        vi.useRealTimers()
    })

    it('does not storm updateComponent or flush on idle mount with stable store', async () => {
        const { getSession } = renderWorkbenchComponentSession({
            options: defaultSessionOptions,
            children: <DefaultRenderEditor />
        })

        const workingBefore = getSession().working?.clone()
        await flushAsync()

        expect(updateStandardMock.mock.calls.length).toBeLessThan(5)
        expect(getSession().working?.equals(workingBefore!)).toBe(true)
    })
})

describe('SituationFacetRenderFieldsView (I5 debounce=false)', () => {
    beforeEach(() => {
        resetWorkbenchAssetMock()
    })

    it('does not storm onChange handlers on idle mount with stable standardForm', async () => {
        const onDisplayNameChange = vi.fn()
        const onSummaryChange = vi.fn()
        const onDescriptionChange = vi.fn()

        const payload = new SituationProseFacetPayload({
            displayName: 'Base',
            summary: ['Hello'],
            description: undefined
        })

        const viewProps = {
            payload,
            debounce: false as const,
            onDisplayNameChange,
            onSummaryChange,
            onDescriptionChange
        }

        const { rerender } = render(<SituationFacetRenderFieldsView {...viewProps} />)

        await flushAsync()

        expect(onDisplayNameChange.mock.calls.length).toBeLessThan(5)
        expect(onSummaryChange.mock.calls.length).toBeLessThan(5)
        expect(onDescriptionChange.mock.calls.length).toBeLessThan(5)

        rerender(<SituationFacetRenderFieldsView {...viewProps} />)

        await flushAsync()

        expect(onDisplayNameChange.mock.calls.length).toBeLessThan(5)
        expect(onSummaryChange.mock.calls.length).toBeLessThan(5)
        expect(onDescriptionChange.mock.calls.length).toBeLessThan(5)
    })
})

describe('SituationFacetRenderFieldsView (I3 reference churn)', () => {
    beforeEach(() => {
        vi.useFakeTimers()
        resetWorkbenchAssetMock()
        seedLayeredWorkbenchAsset({
            baseWml: roomWithDefaultSituationWml,
            inheritedWml: `<Asset uuid=(test) />`,
            editWml: `<Asset uuid=(test) />`
        })
    })

    afterEach(() => {
        vi.clearAllTimers()
        vi.useRealTimers()
    })

    it('does not storm onChange when merged form reference churns but domain unchanged (debounce=false)', async () => {
        const onSummaryChange = vi.fn()
        const onDisplayNameChange = vi.fn()
        const onDescriptionChange = vi.fn()

        const { rerenderWithComponentId } = renderWorkbenchComponentSession({
            options: { ...defaultSessionOptions, skipSeedWorkbenchAsset: true },
            children: (
                <SituationFacetRenderFieldsView
                    debounce={false}
                    onDisplayNameChange={onDisplayNameChange}
                    onSummaryChange={onSummaryChange}
                    onDescriptionChange={onDescriptionChange}
                />
            )
        })

        await flushAsync()

        for (let i = 0; i < 4; i++) {
            syncLayeredMockFromState()
            rerenderWithComponentId(ROOM_ID)
            await flushAsync()
        }

        expect(onSummaryChange.mock.calls.length).toBeLessThan(5)
        expect(onDisplayNameChange.mock.calls.length).toBeLessThan(5)
        expect(onDescriptionChange.mock.calls.length).toBeLessThan(5)
    })

    it('does not storm updateComponent when merged form reference churns with debounce=false feedback loop', async () => {
        trackedUpdateComponentCalls = 0

        const { rerenderWithComponentId } = renderWorkbenchComponentSession({
            options: { ...defaultSessionOptions, skipSeedWorkbenchAsset: true },
            children: <WiredDefaultProseFields />
        })

        await flushAsync()

        for (let i = 0; i < 4; i++) {
            syncLayeredMockFromState()
            rerenderWithComponentId(ROOM_ID)
            await flushAsync()
        }

        expect(trackedUpdateComponentCalls).toBeLessThan(5)
    })
})
