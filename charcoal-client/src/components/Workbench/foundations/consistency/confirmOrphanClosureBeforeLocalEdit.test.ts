import { describe, expect, it, vi, beforeEach } from 'vitest'
import { ComponentUUID } from '@tonylb/mtw-base/ts/schema'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import StandardRoom from '@tonylb/mtw-wml/ts/standardize/components/room'
import { SingleReference } from '@tonylb/mtw-wml/ts/standardize/keys/singleReference'
import { deIndentWML } from '@tonylb/mtw-wml/ts/schema/utils'
import { projectAssetMetaFromStandardForm } from '../workbenchMutations'
import { removeReferenceFromListById } from '../ReferenceList/referenceListMutations'
import {
    confirmOrphanClosureBeforeAssetMetaDisassociate,
    confirmOrphanClosureBeforeComponentDisassociate
} from './confirmOrphanClosureBeforeLocalEdit'

const ROOM_ID = 'ROOM#room1' as ComponentUUID

const pushChoiceMock = vi.fn()

vi.mock('../../../../slices/UI/choiceDialog', () => ({
    pushChoice: (choice: unknown) => {
        pushChoiceMock(choice)
        return () => Promise.resolve('confirm')
    }
}))

describe('confirmOrphanClosureBeforeAssetMetaDisassociate', () => {
    beforeEach(() => {
        pushChoiceMock.mockClear()
    })

    it('returns true without dialog when closure is empty-only', async () => {
        const local = new StandardForm(deIndentWML(`
            <Asset uuid=(test)>
                <Room uuid=(room1) key=(room1) />
            </Asset>
        `))
        const working = projectAssetMetaFromStandardForm(local)

        const dispatch = vi.fn((thunk: () => Promise<string>) => thunk()) as never

        const proceed = await confirmOrphanClosureBeforeAssetMetaDisassociate({
            dispatch,
            localStandardForm: local,
            working,
            removeId: 'ROOM#room1'
        })

        expect(proceed).toBe(true)
        expect(pushChoiceMock).not.toHaveBeenCalled()
    })

    it('shows dialog when closure includes non-empty components', async () => {
        const local = new StandardForm(deIndentWML(`
            <Asset uuid=(test)>
                <Room uuid=(room1) key=(room1)>
                    <Feature uuid=(feat1) key=(feat1)><ShortName>Feature One</ShortName></Feature>
                </Room>
            </Asset>
        `))
        const working = projectAssetMetaFromStandardForm(local)

        const dispatch = vi.fn((thunk: () => Promise<string>) => thunk()) as never

        const proceed = await confirmOrphanClosureBeforeAssetMetaDisassociate({
            dispatch,
            localStandardForm: local,
            working,
            removeId: 'ROOM#room1'
        })

        expect(proceed).toBe(true)
        expect(pushChoiceMock).toHaveBeenCalledTimes(1)
        expect(pushChoiceMock.mock.calls[0]![0]).toMatchObject({
            title: 'Remove component?',
            message: expect.stringContaining('remove the component')
        })
    })

    it('applyLocal simulates disassociate on working topLevel', async () => {
        const local = new StandardForm(deIndentWML(`
            <Asset uuid=(test)>
                <Room uuid=(room1) key=(room1)>
                    <Feature uuid=(feat1) key=(feat1) />
                </Room>
            </Asset>
        `))
        const working = projectAssetMetaFromStandardForm(local)
        const simulated = {
            shortName: working.shortName?.clone(),
            summary: working.summary?.clone(),
            topLevel: working.topLevel.clone()
        }
        removeReferenceFromListById(simulated.topLevel, 'ROOM#room1')
        expect(simulated.topLevel.payload).toHaveLength(0)
        expect(working.topLevel.payload.length).toBeGreaterThan(0)
    })
})

describe('confirmOrphanClosureBeforeComponentDisassociate', () => {
    beforeEach(() => {
        pushChoiceMock.mockClear()
    })

    it('returns true without dialog when nested lens clear is empty-only', async () => {
        const local = new StandardForm(deIndentWML(`
            <Asset uuid=(test)>
                <Room uuid=(room1) key=(room1)><ShortName>R1</ShortName><Lens uuid=(lens1)/></Room>
                <Lens uuid=(lens1)></Lens>
            </Asset>
        `))
        const working = local.byUniversalId[ROOM_ID]!.clone() as StandardRoom

        const dispatch = vi.fn((thunk: () => Promise<string>) => thunk()) as never

        const proceed = await confirmOrphanClosureBeforeComponentDisassociate({
            dispatch,
            localStandardForm: local,
            componentId: ROOM_ID,
            working,
            applyDisassociateOnWorking: (sim) => {
                sim._payload._lens = new SingleReference([])
            }
        })

        expect(proceed).toBe(true)
        expect(pushChoiceMock).not.toHaveBeenCalled()
    })

    it('shows dialog when lens clear would orphan non-empty nested lens', async () => {
        const local = new StandardForm(deIndentWML(`
            <Asset uuid=(test)>
                <Room uuid=(room1) key=(room1)><ShortName>R1</ShortName><Lens uuid=(lens1)><ShortName>My Lens</ShortName></Lens></Room>
            </Asset>
        `))
        const working = local.byUniversalId[ROOM_ID]!.clone() as StandardRoom

        const dispatch = vi.fn((thunk: () => Promise<string>) => thunk()) as never

        const proceed = await confirmOrphanClosureBeforeComponentDisassociate({
            dispatch,
            localStandardForm: local,
            componentId: ROOM_ID,
            working,
            applyDisassociateOnWorking: (sim) => {
                sim._payload._lens = new SingleReference([])
            }
        })

        expect(proceed).toBe(true)
        expect(pushChoiceMock).toHaveBeenCalledTimes(1)
        expect(pushChoiceMock.mock.calls[0]![0]).toMatchObject({
            title: 'Remove component?',
            message: expect.stringContaining('remove the component')
        })
    })

    it('applyDisassociateOnWorking simulates lens clear without mutating input working', async () => {
        const local = new StandardForm(deIndentWML(`
            <Asset uuid=(test)>
                <Room uuid=(room1) key=(room1)><ShortName>R1</ShortName><Lens uuid=(lens1)/></Room>
                <Lens uuid=(lens1)></Lens>
            </Asset>
        `))
        const working = local.byUniversalId[ROOM_ID]!.clone() as StandardRoom
        const simulated = working.clone() as StandardRoom
        simulated._payload._lens = new SingleReference([])
        expect(working.lens.payload.length).toBe(1)
        expect(simulated.lens.payload.length).toBe(0)
    })
})
