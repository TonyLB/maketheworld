import { describe, expect, it, vi, beforeEach } from 'vitest'
import { ComponentUUID } from '@tonylb/mtw-base/ts/schema'
import type { AppDispatch } from '../../../../store'

import { confirmPurgeBeforeRemove } from './confirmPurgeBeforeRemove'
import type { PreviewPurgeClosureResult } from './previewPurgeClosure'
import StandardReference from '@tonylb/mtw-wml/ts/standardize/components/reference'

const { pushChoiceMock, choiceReturnValue } = vi.hoisted(() => ({
    pushChoiceMock: vi.fn(),
    choiceReturnValue: { current: 'cascade' as string }
}))

vi.mock('../../../../slices/UI/choiceDialog', () => ({
    pushChoice: (choice: unknown) => {
        pushChoiceMock(choice)
        return () => Promise.resolve(choiceReturnValue.current)
    }
}))

const reference = new StandardReference({
    tag: 'Room',
    key: 'room1',
    universalKey: 'ROOM#room1' as ComponentUUID
})

const emptyOnlyPreview: PreviewPurgeClosureResult = {
    targetKey: 'ROOM#room1' as ComponentUUID,
    bodiesRemoved: ['ROOM#room1'],
    bodiesRehomed: [],
    bodiesCascadeDeleted: [],
    includesNonEmpty: false,
    needsDescendantChoice: false
}

const nonEmptyPreview: PreviewPurgeClosureResult = {
    ...emptyOnlyPreview,
    includesNonEmpty: true
}

const descendantPreview: PreviewPurgeClosureResult = {
    targetKey: 'ROOM#room1' as ComponentUUID,
    bodiesRemoved: ['ROOM#room1', 'SITUATION#example1'],
    bodiesRehomed: ['SITUATION#example1'],
    bodiesCascadeDeleted: ['SITUATION#example1'],
    includesNonEmpty: true,
    needsDescendantChoice: true
}

describe('confirmPurgeBeforeRemove', () => {
    const dispatch = vi.fn((thunk: () => Promise<string>) => thunk()) as unknown as AppDispatch

    beforeEach(() => {
        pushChoiceMock.mockClear()
        choiceReturnValue.current = 'cascade'
    })

    it('returns cascade without dialog for empty-only purge', async () => {
        const result = await confirmPurgeBeforeRemove({
            dispatch,
            reference,
            preview: emptyOnlyPreview
        })

        expect(result).toBe('cascade')
        expect(pushChoiceMock).not.toHaveBeenCalled()
    })

    it('shows two-option dialog when includesNonEmpty and no descendants', async () => {
        const result = await confirmPurgeBeforeRemove({
            dispatch,
            reference,
            preview: nonEmptyPreview,
            targetLabel: 'Lobby'
        })

        expect(result).toBe('cascade')
        expect(pushChoiceMock).toHaveBeenCalledTimes(1)
        expect(pushChoiceMock.mock.calls[0][0]).toMatchObject({
            options: [
                { label: 'Cancel', returnValue: 'cancel' },
                { label: 'Remove', returnValue: 'cascade' }
            ]
        })
    })

    it('shows three-option dialog when descendants need rehome choice', async () => {
        choiceReturnValue.current = 'rehome'

        const result = await confirmPurgeBeforeRemove({
            dispatch,
            reference,
            preview: descendantPreview
        })

        expect(result).toBe('rehome')
        expect(pushChoiceMock.mock.calls[0][0].options).toHaveLength(3)
        expect(pushChoiceMock.mock.calls[0][0].options.map((o: { returnValue: string }) => o.returnValue)).toEqual([
            'cancel',
            'rehome',
            'cascade'
        ])
    })

    it('returns cancel when author cancels', async () => {
        choiceReturnValue.current = 'cancel'

        const result = await confirmPurgeBeforeRemove({
            dispatch,
            reference,
            preview: nonEmptyPreview
        })

        expect(result).toBe('cancel')
    })
})
