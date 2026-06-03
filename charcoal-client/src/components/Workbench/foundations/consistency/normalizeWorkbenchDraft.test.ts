import { describe, expect, it } from 'vitest'
import { ComponentUUID } from '@tonylb/mtw-base/ts/schema'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import StandardArea from '@tonylb/mtw-wml/ts/standardize/components/area'
import StandardRoom from '@tonylb/mtw-wml/ts/standardize/components/room'
import StandardReference from '@tonylb/mtw-wml/ts/standardize/components/reference'
import { ReferenceList } from '@tonylb/mtw-wml/ts/standardize/keys/referenceList'
import { deIndentWML } from '@tonylb/mtw-wml/ts/schema/utils'

import {
    normalizeSinglePass,
    normalizeWorkbenchDraft,
    scrubReferences
} from './normalizeWorkbenchDraft'

const ASSET_ID = 'ASSET#test' as const

describe('normalizeWorkbenchDraft', () => {
    it('is a no-op when every component is referenced', () => {
        const draft = new StandardForm(deIndentWML(`
            <Asset uuid=(test)>
                <Room uuid=(room1) key=(room1)>
                    <Feature uuid=(feature1) key=(feature1) />
                </Room>
            </Asset>
        `))
        const before = draft.toJSON()

        normalizeWorkbenchDraft(draft)

        expect(draft.toJSON()).toEqual(before)
        expect(draft._components).toHaveLength(2)
    })

    it('removes a non-empty orphan (D3)', () => {
        const draft = new StandardForm({
            universalKey: ASSET_ID,
            metaData: [],
            components: [
                {
                    tag: 'Room',
                    key: 'room1',
                    universalKey: 'ROOM#room1' as ComponentUUID,
                    shortName: 'Hall'
                }
            ]
        })

        normalizeWorkbenchDraft(draft)

        expect(draft._components).toHaveLength(0)
        expect(draft.byUniversalId['ROOM#room1']).toBeUndefined()
    })

    it('removes an empty orphan (D3)', () => {
        const draft = new StandardForm({
            universalKey: ASSET_ID,
            metaData: [],
            components: [
                {
                    tag: 'Feature',
                    key: 'feature1',
                    universalKey: 'FEATURE#feature1' as ComponentUUID
                }
            ]
        })

        normalizeWorkbenchDraft(draft)

        expect(draft._components).toHaveLength(0)
    })

    it('preserves a component referenced only on _topLevel', () => {
        const draft = new StandardForm({
            universalKey: ASSET_ID,
            metaData: [],
            components: [
                {
                    tag: 'Feature',
                    key: 'feat1',
                    universalKey: 'FEATURE#feat1' as ComponentUUID
                }
            ],
            topLevel: [
                {
                    tag: 'Feature',
                    key: 'feat1',
                    universalKey: 'FEATURE#feat1',
                    ref: 0
                }
            ]
        })

        normalizeWorkbenchDraft(draft)

        expect(draft._components).toHaveLength(1)
        expect(draft.byUniversalId['FEATURE#feat1']).toBeDefined()
    })

    it('transitively removes Room and nested Feature after _topLevel disassociate (D4)', () => {
        const draft = new StandardForm({
            universalKey: ASSET_ID,
            metaData: [],
            components: [
                {
                    tag: 'Room',
                    key: 'room1',
                    universalKey: 'ROOM#room1' as ComponentUUID,
                    features: [
                        {
                            tag: 'Feature',
                            key: 'feature1',
                            universalKey: 'FEATURE#feature1'
                        }
                    ]
                },
                {
                    tag: 'Feature',
                    key: 'feature1',
                    universalKey: 'FEATURE#feature1' as ComponentUUID
                }
            ],
            topLevel: [
                {
                    tag: 'Room',
                    key: 'room1',
                    universalKey: 'ROOM#room1',
                    ref: 1
                }
            ]
        })
        const roomRef = new StandardReference({
            tag: 'Room',
            key: 'room1',
            universalKey: 'ROOM#room1'
        })
        draft._topLevel = new ReferenceList(
            draft._topLevel!.payload.filter((ref) => !ref.sameKey(roomRef))
        )

        normalizeWorkbenchDraft(draft)

        expect(draft.byUniversalId['ROOM#room1']).toBeUndefined()
        expect(draft.byUniversalId['FEATURE#feature1']).toBeUndefined()
    })

    it('transitively removes orphans in a fixpoint (D4)', () => {
        const draft = new StandardForm(deIndentWML(`
            <Asset uuid=(test)>
                <Area uuid=(area1) key=(area1)>
                    <Room uuid=(room1) key=(room1)>
                        <Feature uuid=(feature1) key=(feature1) />
                    </Room>
                </Area>
            </Asset>
        `))

        const area = draft.byUniversalId['AREA#area1']
        const roomRef = new StandardReference({
            tag: 'Room',
            key: 'room1',
            universalKey: 'ROOM#room1'
        })
        if (area instanceof StandardArea) {
            draft.byUniversalId['AREA#area1'] = area.removeReferences([roomRef]) as StandardArea
        }

        normalizeWorkbenchDraft(draft)

        expect(draft.byUniversalId['AREA#area1']).toBeDefined()
        expect(draft.byUniversalId['ROOM#room1']).toBeUndefined()
        expect(draft.byUniversalId['FEATURE#feature1']).toBeUndefined()
    })

    it('does not alter surviving lists on the happy disassociate path (scrub no-op)', () => {
        const base = new StandardForm(deIndentWML(`
            <Asset uuid=(test)>
                <Room uuid=(room1) key=(room1)>
                    <Feature uuid=(feature1) key=(feature1) />
                </Room>
            </Asset>
        `))
        const draft = base._clone()
        const featureRef = new StandardReference({
            tag: 'Feature',
            key: 'feature1',
            universalKey: 'FEATURE#feature1'
        })
        const room = draft.byUniversalId['ROOM#room1']
        if (room instanceof StandardRoom) {
            draft.byUniversalId['ROOM#room1'] = room.removeReferences([featureRef]) as StandardRoom
        }
        const roomFeaturesBefore =
            (draft.byUniversalId['ROOM#room1'] as StandardRoom).features.toJSON()

        normalizeWorkbenchDraft(draft)

        const roomAfter = draft.byUniversalId['ROOM#room1'] as StandardRoom
        expect(roomAfter.features.toJSON()).toEqual(roomFeaturesBefore)
        expect(draft.byUniversalId['FEATURE#feature1']).toBeUndefined()
    })
})

describe('scrubReferences (defensive path)', () => {
    it('strips removed keys from _topLevel when body was deleted without disassociate', () => {
        const featureRef = new StandardReference({
            tag: 'Feature',
            key: 'feature1',
            universalKey: 'FEATURE#feature1'
        })
        const draft = new StandardForm({
            universalKey: ASSET_ID,
            metaData: [],
            components: [
                {
                    tag: 'Room',
                    key: 'room1',
                    universalKey: 'ROOM#room1' as ComponentUUID
                }
            ],
            topLevel: [
                {
                    tag: 'Room',
                    key: 'room1',
                    universalKey: 'ROOM#room1',
                    ref: 1
                },
                {
                    tag: 'Feature',
                    key: 'feature1',
                    universalKey: 'FEATURE#feature1',
                    ref: 1
                }
            ]
        })

        draft._components = draft._components.filter(
            (component) => component.universalKey !== 'FEATURE#feature1'
        )

        scrubReferences(draft, [featureRef])

        expect(
            draft._topLevel?.payload.some((ref) => ref.sameKey(featureRef)) ?? false
        ).toBe(false)
        expect(
            draft._topLevel?.payload.some((ref) => ref.universalKey === 'ROOM#room1') ?? false
        ).toBe(true)
    })

    it('removes dangling refs from a survivor component list', () => {
        const draft = new StandardForm(deIndentWML(`
            <Asset uuid=(test)>
                <Room uuid=(room1) key=(room1)>
                    <Feature uuid=(feature1) key=(feature1) />
                </Room>
                <Room uuid=(room2) key=(room2) />
            </Asset>
        `))
        const featureRef = new StandardReference({
            tag: 'Feature',
            key: 'feature1',
            universalKey: 'FEATURE#feature1'
        })
        const room2 = draft.byUniversalId['ROOM#room2']
        if (room2 instanceof StandardRoom) {
            draft.byUniversalId['ROOM#room2'] = room2.withChild(featureRef) as StandardRoom
        }

        scrubReferences(draft, [featureRef])

        const updatedRoom2 = draft.byUniversalId['ROOM#room2'] as StandardRoom
        expect(
            updatedRoom2.features.payload.some((ref) => ref.sameKey(featureRef))
        ).toBe(false)
    })
})

describe('normalizeSinglePass', () => {
    it('returns zero when no orphans remain', () => {
        const draft = new StandardForm(deIndentWML(`
            <Asset uuid=(test)>
                <Room uuid=(room1) key=(room1) />
            </Asset>
        `))

        expect(normalizeSinglePass(draft)).toHaveLength(0)
    })
})
