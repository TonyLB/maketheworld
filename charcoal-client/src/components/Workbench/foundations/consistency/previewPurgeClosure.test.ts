import { describe, expect, it, vi } from 'vitest'
import { ComponentUUID } from '@tonylb/mtw-base/ts/schema'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import StandardReference from '@tonylb/mtw-wml/ts/standardize/components/reference'
import { deIndentWML } from '@tonylb/mtw-wml/ts/schema/utils'

import { previewPurgeClosure } from './previewPurgeClosure'

const ASSET_ID = 'ASSET#test' as const

describe('previewPurgeClosure', () => {
    it('does not mutate localDraft', () => {
        const localDraft = new StandardForm(deIndentWML(`
            <Asset uuid=(test)>
                <Room uuid=(room1) key=(room1) />
            </Asset>
        `))
        const before = localDraft.toJSON()
        const roomRef = new StandardReference({
            tag: 'Room',
            key: 'room1',
            universalKey: 'ROOM#room1' as ComponentUUID
        })

        previewPurgeClosure(localDraft, roomRef)

        expect(localDraft.toJSON()).toEqual(before)
    })

    it('returns empty preview when target has no body', () => {
        const localDraft = new StandardForm({
            universalKey: ASSET_ID,
            metaData: [],
            components: []
        })
        const missingRef = new StandardReference({
            tag: 'Room',
            key: 'missing',
            universalKey: 'ROOM#missing' as ComponentUUID
        })

        expect(previewPurgeClosure(localDraft, missingRef)).toEqual({
            targetKey: 'ROOM#missing',
            bodiesRemoved: [],
            bodiesRehomed: [],
            bodiesCascadeDeleted: [],
            includesNonEmpty: false,
            needsDescendantChoice: false
        })
    })

    it('purges only target when there are no implicit descendants with bodies', () => {
        const localDraft = new StandardForm(deIndentWML(`
            <Asset uuid=(test)>
                <Room uuid=(room1) key=(room1) />
                <Room uuid=(room2) key=(room2) />
            </Asset>
        `))
        const room1Ref = new StandardReference({
            tag: 'Room',
            key: 'room1',
            universalKey: 'ROOM#room1' as ComponentUUID
        })

        const preview = previewPurgeClosure(localDraft, room1Ref)

        expect(preview.needsDescendantChoice).toBe(false)
        expect(preview.bodiesRehomed).toEqual([])
        expect(preview.bodiesCascadeDeleted).toEqual([])
        expect(preview.bodiesRemoved).toEqual(['ROOM#room1'])
        expect(preview.targetKey).toBe('ROOM#room1')
    })

    it('offers rehome vs cascade when implicit descendants survive rehome only', () => {
        const localDraft = new StandardForm(deIndentWML(`
            <Asset uuid=(test)>
                <Room uuid=(room1) key=(room1)>
                    <Feature uuid=(feature1) key=(feature1)>
                        <Situation uuid=(example1) key=(example1) />
                    </Feature>
                </Room>
            </Asset>
        `))
        const room1Ref = new StandardReference({
            tag: 'Room',
            key: 'room1',
            universalKey: 'ROOM#room1' as ComponentUUID
        })

        const preview = previewPurgeClosure(localDraft, room1Ref)

        expect(preview.needsDescendantChoice).toBe(true)
        expect(preview.bodiesRehomed).toEqual(
            expect.arrayContaining(['FEATURE#feature1', 'SITUATION#example1'])
        )
        expect(preview.bodiesCascadeDeleted).toEqual(preview.bodiesRehomed)
        expect(preview.bodiesRemoved).toEqual(
            expect.arrayContaining(['ROOM#room1', 'FEATURE#feature1', 'SITUATION#example1'])
        )
        expect(preview.targetKey).toBe('ROOM#room1')
    })

    it('removes only target when rehome and cascade yield the same component set', () => {
        const localDraft = new StandardForm(deIndentWML(`
            <Asset uuid=(test)>
                <Room uuid=(room1) key=(room1)>
                    <Situation ref={0} uuid=(example1) key=(example1) />
                </Room>
            </Asset>
        `))
        const room1Ref = new StandardReference({
            tag: 'Room',
            key: 'room1',
            universalKey: 'ROOM#room1' as ComponentUUID
        })

        const preview = previewPurgeClosure(localDraft, room1Ref)

        expect(preview.needsDescendantChoice).toBe(false)
        expect(preview.bodiesRehomed).toEqual([])
        expect(preview.bodiesRemoved).toEqual(['ROOM#room1'])
    })

    it('cascade-deletes nested hierarchy bodies', () => {
        const localDraft = new StandardForm(deIndentWML(`
            <Asset uuid=(test)>
                <Room uuid=(room1) key=(room1)>
                    <Feature uuid=(feature1) key=(feature1)>
                        <Situation uuid=(example1) key=(example1) />
                    </Feature>
                </Room>
            </Asset>
        `))
        const room1Ref = new StandardReference({
            tag: 'Room',
            key: 'room1',
            universalKey: 'ROOM#room1' as ComponentUUID
        })

        const preview = previewPurgeClosure(localDraft, room1Ref)

        expect(preview.bodiesRemoved).toEqual(
            expect.arrayContaining(['ROOM#room1', 'FEATURE#feature1', 'SITUATION#example1'])
        )
        expect(preview.bodiesRemoved).toHaveLength(3)
        expect(preview.bodiesRehomed).toEqual(
            expect.arrayContaining(['FEATURE#feature1', 'SITUATION#example1'])
        )
        expect(preview.needsDescendantChoice).toBe(true)
    })

    it('reports includesNonEmpty when removed or rehomed bodies have content', () => {
        const localDraft = new StandardForm({
            universalKey: ASSET_ID,
            metaData: [],
            components: [
                {
                    tag: 'Room',
                    key: 'room1',
                    universalKey: 'ROOM#room1' as ComponentUUID,
                    shortName: 'Lobby'
                }
            ]
        })
        const room1Ref = new StandardReference({
            tag: 'Room',
            key: 'room1',
            universalKey: 'ROOM#room1' as ComponentUUID
        })

        expect(previewPurgeClosure(localDraft, room1Ref).includesNonEmpty).toBe(true)
    })

    it('runs applyLocal on the clone before simulating', () => {
        const localDraft = new StandardForm(deIndentWML(`
            <Asset uuid=(test)>
                <Room uuid=(room1) key=(room1) />
            </Asset>
        `))
        const room1Ref = new StandardReference({
            tag: 'Room',
            key: 'room1',
            universalKey: 'ROOM#room1' as ComponentUUID
        })
        const applyLocal = vi.fn((draft: StandardForm) => {
            draft._components = []
        })

        const preview = previewPurgeClosure(localDraft, room1Ref, { applyLocal })

        expect(applyLocal).toHaveBeenCalledTimes(1)
        expect(preview.bodiesRemoved).toEqual([])
    })
})
