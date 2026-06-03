import { describe, expect, it, vi, beforeEach } from 'vitest'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import { deIndentWML } from '@tonylb/mtw-wml/ts/schema/utils'
import { projectAssetMetaFromStandardForm } from '../workbenchMutations'
import { removeReferenceFromListById } from '../ReferenceList/referenceListMutations'
import { confirmOrphanClosureBeforeAssetMetaDisassociate } from './confirmOrphanClosureBeforeLocalEdit'

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
