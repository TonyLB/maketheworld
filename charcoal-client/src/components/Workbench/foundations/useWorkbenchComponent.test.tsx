/**
 * @vitest-environment jsdom
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import { ComponentUUID } from '@tonylb/mtw-base/ts/schema'
import StandardFeature from '@tonylb/mtw-wml/ts/standardize/components/feature'
import type { StandardComponent } from '@tonylb/mtw-wml/ts/standardize/components/baseClasses'

import { mockWorkbenchReturn } from './useWorkbenchComponent.testMock'

vi.mock('./useWorkbenchAsset', () => ({
    useWorkbenchAsset: () => mockWorkbenchReturn
}))

import { useWorkbenchComponentContext } from './useWorkbenchComponent'
import {
    renderWorkbenchComponentSession,
    resetWorkbenchAssetMock,
    setWorkingShortName,
    updateStandardMock
} from './useWorkbenchComponent.testHarness'

const FEATURE_ID = 'FEATURE#feat1' as ComponentUUID
const ROOM_ID = 'ROOM#room1' as ComponentUUID
const OTHER_FEATURE_ID = 'FEATURE#feat2' as ComponentUUID

const featureWml = `
    <Asset uuid=(test)>
        <Feature uuid=(feat1)><ShortName>Original</ShortName></Feature>
        <Feature uuid=(feat2)><ShortName>Other</ShortName></Feature>
    </Asset>
`

const featureGuard = (
    component: StandardComponent | undefined
): component is StandardFeature => component instanceof StandardFeature

describe('useWorkbenchComponent', () => {
    beforeEach(() => {
        resetWorkbenchAssetMock()
    })

    it('initializes working and lastReceived from committed on mount', () => {
        const { getSession } = renderWorkbenchComponentSession({
            options: {
                wml: featureWml,
                componentId: FEATURE_ID,
                guard: featureGuard
            }
        })

        const session = getSession()
        expect(session.missing).toBe(false)
        expect(session.working?.shortName?.toJSON()).toBe('Original')
        expect(session.lastReceived?.shortName?.toJSON()).toBe('Original')
        expect(session.committed?.shortName?.toJSON()).toBe('Original')
        expect(session.working).not.toBe(session.committed)
        expect(session.working?.equals(session.committed!)).toBe(true)
    })

    it('updateComponent mutates working without calling updateStandard', async () => {
        const { getSession } = renderWorkbenchComponentSession({
            options: {
                wml: featureWml,
                componentId: FEATURE_ID,
                guard: featureGuard
            }
        })

        getSession().updateComponent((draft) => {
            setWorkingShortName(draft, 'Updated')
        })

        await waitFor(() => {
            expect(getSession().working?.shortName?.toJSON()).toBe('Updated')
        })
        expect(getSession().committed?.shortName?.toJSON()).toBe('Original')
        expect(updateStandardMock).not.toHaveBeenCalled()
    })

    it('isDirty is false on mount and true after local edit', async () => {
        const { getSession } = renderWorkbenchComponentSession({
            options: {
                wml: featureWml,
                componentId: FEATURE_ID,
                guard: featureGuard
            }
        })

        expect(getSession().isDirty).toBe(false)

        getSession().updateComponent((draft) => {
            setWorkingShortName(draft, 'Updated')
        })

        await waitFor(() => {
            expect(getSession().isDirty).toBe(true)
        })
    })

    it('reports missing when component id is absent', () => {
        const { getSession } = renderWorkbenchComponentSession({
            options: {
                wml: featureWml,
                componentId: 'FEATURE#missing' as ComponentUUID,
                guard: featureGuard
            }
        })

        const session = getSession()
        expect(session.missing).toBe(true)
        expect(session.working).toBeUndefined()
        expect(session.lastReceived).toBeUndefined()
    })

    it('reports missing when guard rejects component type', () => {
        const { getSession } = renderWorkbenchComponentSession({
            options: {
                wml: `
                    <Asset uuid=(test)>
                        <Room uuid=(room1)><ShortName>Room</ShortName></Room>
                    </Asset>
                `,
                componentId: ROOM_ID,
                guard: featureGuard
            }
        })

        const session = getSession()
        expect(session.missing).toBe(true)
        expect(session.working).toBeUndefined()
    })

    it('propagates readonly from useWorkbenchAsset', () => {
        const { getSession } = renderWorkbenchComponentSession({
            options: {
                wml: featureWml,
                componentId: FEATURE_ID,
                guard: featureGuard,
                readonly: true
            }
        })

        expect(getSession().readonly).toBe(true)
    })

    it('re-seeds session when componentId changes', async () => {
        const { getSession, rerenderWithComponentId } = renderWorkbenchComponentSession({
            options: {
                wml: featureWml,
                componentId: FEATURE_ID,
                guard: featureGuard
            }
        })

        getSession().updateComponent((draft) => {
            setWorkingShortName(draft, 'Local edit')
        })

        await waitFor(() => {
            expect(getSession().working?.shortName?.toJSON()).toBe('Local edit')
        })

        rerenderWithComponentId(OTHER_FEATURE_ID)

        await waitFor(() => {
            const session = getSession()
            expect(session.componentId).toBe(OTHER_FEATURE_ID)
            expect(session.working?.shortName?.toJSON()).toBe('Other')
            expect(session.isDirty).toBe(false)
        })
    })

    it('throws when useWorkbenchComponentContext is used outside provider', () => {
        const OutsideProvider = (): null => {
            useWorkbenchComponentContext()
            return null
        }

        expect(() => render(<OutsideProvider />)).toThrow(
            'useWorkbenchComponentContext must be used within WorkbenchComponentProvider'
        )
    })

    it('does not dispatch updateStandard from flush stubs in slice 396-397', () => {
        const { getSession } = renderWorkbenchComponentSession({
            options: {
                wml: featureWml,
                componentId: FEATURE_ID,
                guard: featureGuard
            }
        })

        getSession().flushToStandardForm()
        getSession().flushNow()
        expect(updateStandardMock).not.toHaveBeenCalled()
    })
})
