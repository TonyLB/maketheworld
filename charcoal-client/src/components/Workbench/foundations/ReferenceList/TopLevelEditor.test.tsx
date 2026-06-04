/**
 * @vitest-environment jsdom
 */

import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, screen } from '@testing-library/react'
import type { ComponentUUID } from '@tonylb/mtw-base/ts/schema'

import { TopLevelEditor } from './TopLevelEditor'
import {
    applyLastFlushToCommitted,
    getFlushedTopLevelUniversalKeys,
    renderWorkbenchAssetMetaSession,
    resetWorkbenchAssetMock,
    updateStandardMock
} from '../WorkbenchAssetMeta/testing/harness'
import {
    materializeComponentInAssetMock,
    mockMaterializeComponentInAsset
} from '../WorkbenchComponent/testing/mock'

const pushChoiceMock = vi.fn()

vi.mock('react-redux', () => ({
    useDispatch: () => vi.fn((thunk: () => Promise<string>) => thunk())
}))

vi.mock('../useWorkbenchAsset', async (importOriginal) => {
    const mock = await import('../WorkbenchComponent/testing/mock')
    return {
        useWorkbenchAsset: () => mock.mockWorkbenchReturn
    }
})

vi.mock('../../../../slices/UI/choiceDialog', () => ({
    pushChoice: (choice: { options?: { returnValue: string }[] }) => {
        pushChoiceMock(choice)
        const values = choice.options?.map((o) => o.returnValue) ?? []
        if (values.includes('cascade')) {
            return () => Promise.resolve('cascade')
        }
        return () => Promise.resolve('confirm')
    }
}))

vi.mock('../../ImportComponentDialog', () => ({
    default: () => null
}))

vi.mock('../ComponentSelector', () => ({
    ComponentSelectorDialog: () => null
}))

vi.mock('../../ImageHeader', () => ({
    default: () => null
}))

const purgeComponentFromAssetFlowMock = vi.fn()

vi.mock('../consistency/purgeComponentFromAssetFlow', () => ({
    purgeComponentFromAssetFlow: (...args: unknown[]) => purgeComponentFromAssetFlowMock(...args)
}))

const FLUSH_DELAY_MS = 100

const assetWithRoomWml = `
    <Asset uuid=(test)>
        <Room uuid=(room1) key=(room1)><ShortName>Room One</ShortName></Room>
    </Asset>
`

const assetWithRoomAndFeatureWml = `
    <Asset uuid=(test)>
        <Room uuid=(room1) key=(room1)>
            <ShortName>Room One</ShortName>
            <Feature uuid=(feat1) key=(feat1)><ShortName>Feature One</ShortName></Feature>
        </Room>
    </Asset>
`

const flushAsync = async (): Promise<void> => {
    await act(async () => {
        await Promise.resolve()
        await Promise.resolve()
    })
}

describe('TopLevelEditor', () => {
    beforeEach(() => {
        vi.useFakeTimers()
        resetWorkbenchAssetMock()
        pushChoiceMock.mockClear()
        purgeComponentFromAssetFlowMock.mockClear()
        purgeComponentFromAssetFlowMock.mockResolvedValue(undefined)
    })

    afterEach(() => {
        vi.clearAllTimers()
        vi.useRealTimers()
    })

    it('reads topLevel from asset-meta working', () => {
        const { getSession } = renderWorkbenchAssetMetaSession({
            options: { wml: assetWithRoomWml, flushDelayMs: FLUSH_DELAY_MS },
            children: <TopLevelEditor />
        })

        expect(getSession().working?.topLevel.payload.length).toBe(1)
        expect(screen.getAllByText('Room One').length).toBeGreaterThan(0)
    })

    it('remove disassociates on working without removeComponent', async () => {
        const { getSession } = renderWorkbenchAssetMetaSession({
            options: { wml: assetWithRoomWml, flushDelayMs: FLUSH_DELAY_MS },
            children: <TopLevelEditor />
        })

        const deleteButtons = screen.getAllByLabelText('remove')
        await act(async () => {
            fireEvent.click(deleteButtons[0])
            await flushAsync()
        })

        expect(pushChoiceMock).toHaveBeenCalled()
        expect(getSession().working?.topLevel.payload.length).toBe(0)
        expect(updateStandardMock).not.toHaveBeenCalledWith(
            expect.objectContaining({ type: 'removeComponent' })
        )
    })

    it('purge invokes purgeComponentFromAssetFlow for row', async () => {
        renderWorkbenchAssetMetaSession({
            options: { wml: assetWithRoomWml, flushDelayMs: FLUSH_DELAY_MS },
            children: <TopLevelEditor />
        })

        const purgeButtons = screen.getAllByLabelText('purge from asset')
        await act(async () => {
            fireEvent.click(purgeButtons[0])
            await flushAsync()
        })

        expect(purgeComponentFromAssetFlowMock).toHaveBeenCalledTimes(1)
        expect(purgeComponentFromAssetFlowMock.mock.calls[0]![0]).toMatchObject({
            reference: expect.objectContaining({ universalKey: 'ROOM#room1' })
        })
    })

    it('debounced flush persists topLevel disassociate via updateLocal', async () => {
        renderWorkbenchAssetMetaSession({
            options: { wml: assetWithRoomWml, flushDelayMs: FLUSH_DELAY_MS },
            children: <TopLevelEditor />
        })

        const deleteButtons = screen.getAllByLabelText('remove')
        await act(async () => {
            fireEvent.click(deleteButtons[0])
            await flushAsync()
            vi.advanceTimersByTime(FLUSH_DELAY_MS)
        })

        expect(updateStandardMock).toHaveBeenCalledTimes(1)
        expect(updateStandardMock.mock.calls[0]![0]).toMatchObject({ type: 'updateLocal' })
        expect(getFlushedTopLevelUniversalKeys()).toEqual([])
    })

    it('remove with non-empty body prompts site-local confirm before disassociate', async () => {
        renderWorkbenchAssetMetaSession({
            options: { wml: assetWithRoomAndFeatureWml, flushDelayMs: FLUSH_DELAY_MS },
            children: <TopLevelEditor />
        })

        const deleteButtons = screen.getAllByLabelText('remove')
        await act(async () => {
            fireEvent.click(deleteButtons[0])
            await flushAsync()
        })

        expect(pushChoiceMock).toHaveBeenCalledTimes(1)
    })

    it('create awaits materialize then associates on working without immediate flush', async () => {
        mockMaterializeComponentInAsset()

        const { getSession } = renderWorkbenchAssetMetaSession({
            options: { wml: '<Asset uuid=(test) />', flushDelayMs: FLUSH_DELAY_MS },
            children: <TopLevelEditor />
        })

        await act(async () => {
            fireEvent.click(screen.getByLabelText('Expand to add component'))
        })
        await act(async () => {
            fireEvent.click(screen.getByText('Room'))
        })
        await flushAsync()

        expect(materializeComponentInAssetMock).toHaveBeenCalledTimes(1)
        const spec = materializeComponentInAssetMock.mock.calls[0]![0]!
        expect(spec.universalKey).toMatch(/^ROOM#/)
        expect(getSession().working?.topLevel.payload.length).toBe(1)
        expect(getSession().working?.topLevel.payload[0]!.universalKey).toBe(spec.universalKey)
        expect(updateStandardMock).not.toHaveBeenCalled()
    })

    it('debounced flush after create uses updateLocal with topLevel on draft', async () => {
        mockMaterializeComponentInAsset()

        renderWorkbenchAssetMetaSession({
            options: { wml: '<Asset uuid=(test) />', flushDelayMs: FLUSH_DELAY_MS },
            children: <TopLevelEditor />
        })

        await act(async () => {
            fireEvent.click(screen.getByLabelText('Expand to add component'))
        })
        await act(async () => {
            fireEvent.click(screen.getByText('Room'))
            await flushAsync()
            vi.advanceTimersByTime(FLUSH_DELAY_MS)
        })

        expect(updateStandardMock).toHaveBeenCalledTimes(1)
        const keys = getFlushedTopLevelUniversalKeys()
        expect(keys.length).toBe(1)
        expect(keys[0]).toMatch(/^ROOM#/)
    })

    it('flush remove retains room and nested feature in byUniversalId (assign only)', async () => {
        renderWorkbenchAssetMetaSession({
            options: { wml: assetWithRoomAndFeatureWml, flushDelayMs: FLUSH_DELAY_MS },
            children: <TopLevelEditor />
        })

        const deleteButtons = screen.getAllByLabelText('remove')
        await act(async () => {
            fireEvent.click(deleteButtons[0])
            await flushAsync()
            vi.advanceTimersByTime(FLUSH_DELAY_MS)
        })

        const flushed = applyLastFlushToCommitted()
        expect(flushed.byUniversalId['ROOM#room1' as ComponentUUID]).toBeDefined()
        expect(flushed.byUniversalId['FEATURE#feat1' as ComponentUUID]).toBeDefined()
        expect(flushed._topLevel?.payload ?? []).toHaveLength(0)
    })
})
