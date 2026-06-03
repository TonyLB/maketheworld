import { describe, expect, it } from 'vitest'
import { ComponentUUID } from '@tonylb/mtw-base/ts/schema'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import StandardReference from '@tonylb/mtw-wml/ts/standardize/components/reference'
import { deIndentWML } from '@tonylb/mtw-wml/ts/schema/utils'

import { isReferencedInAssetLayer } from './isReferencedInAssetLayer'
import { normalizeWorkbenchDraft } from './normalizeWorkbenchDraft'
import { previewOrphanClosure } from './previewOrphanClosure'

const ASSET_ID = 'ASSET#test' as const

const localFormWithTopLevelRef = (ref: number) =>
    new StandardForm({
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
                ref
            }
        ]
    })

describe('isReferencedInAssetLayer', () => {
    it('returns true when target is only on _topLevel (referencedBy empty)', () => {
        const localForm = localFormWithTopLevelRef(0)
        const roomRef = new StandardReference({
            tag: 'Room',
            key: 'room1',
            universalKey: 'ROOM#room1'
        })

        expect(localForm.referencedBy(roomRef)).toEqual([])
        expect(isReferencedInAssetLayer(localForm, roomRef)).toBe(true)
    })

    it('returns true for ref={0} top-level stub regardless of ref magnitude', () => {
        const localForm = new StandardForm({
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
        const featureRef = new StandardReference({
            tag: 'Feature',
            key: 'feat1',
            universalKey: 'FEATURE#feat1'
        })

        expect(isReferencedInAssetLayer(localForm, featureRef)).toBe(true)
    })

    it('returns true when target is referenced only in a nested list', () => {
        const localForm = new StandardForm(deIndentWML(`
            <Asset uuid=(test)>
                <Room uuid=(room1) key=(room1)>
                    <Feature uuid=(feature1) key=(feature1) />
                </Room>
            </Asset>
        `))
        const featureRef = new StandardReference({
            tag: 'Feature',
            key: 'feature1',
            universalKey: 'FEATURE#feature1'
        })

        expect(localForm.referencedBy(featureRef).length).toBeGreaterThan(0)
        expect(
            localForm._topLevel?.payload.some((r) => r.sameKey(featureRef)) ?? false
        ).toBe(false)
        expect(isReferencedInAssetLayer(localForm, featureRef)).toBe(true)
    })

    it('returns false when target is not on _topLevel and referencedBy is empty', () => {
        const localForm = new StandardForm(deIndentWML(`
            <Asset uuid=(test)>
                <Room uuid=(room1) key=(room1) />
            </Asset>
        `))
        const nonExistentRef = new StandardReference({
            tag: 'Feature',
            key: 'nonexistent',
            universalKey: 'FEATURE#nonexistent'
        })

        expect(isReferencedInAssetLayer(localForm, nonExistentRef)).toBe(false)
    })

    it('matches by sameKey when query uses universalKey and top-level has key + universalKey', () => {
        const localForm = localFormWithTopLevelRef(0)
        const queryRef = new StandardReference({
            tag: 'Room',
            universalKey: 'ROOM#room1'
        })

        expect(isReferencedInAssetLayer(localForm, queryRef)).toBe(true)
    })

    it('does not count inherited-only references (local form vs merged display)', () => {
        const inherited = new StandardForm(deIndentWML(`
            <Asset uuid=(test)>
                <Room uuid=(room1) key=(room1)>
                    <Feature uuid=(feature1) key=(feature1) />
                </Room>
            </Asset>
        `))
        const local = new StandardForm({
            universalKey: ASSET_ID,
            metaData: [],
            components: [
                {
                    tag: 'Feature',
                    key: 'feature1',
                    universalKey: 'FEATURE#feature1' as ComponentUUID,
                    shortName: 'Glow'
                }
            ]
        })
        const merged = inherited.merge(local)
        const featureRef = new StandardReference({
            tag: 'Feature',
            key: 'feature1',
            universalKey: 'FEATURE#feature1'
        })

        expect(merged.referencedBy(featureRef).length).toBeGreaterThan(0)
        expect(isReferencedInAssetLayer(merged, featureRef)).toBe(true)
        expect(isReferencedInAssetLayer(local, featureRef)).toBe(false)

        const localClone = local._clone()
        normalizeWorkbenchDraft(localClone)
        expect(localClone.byUniversalId['FEATURE#feature1']).toBeUndefined()

        expect(previewOrphanClosure(local)).toEqual({
            removedKeys: ['FEATURE#feature1'],
            includesNonEmpty: true
        })
    })
})
