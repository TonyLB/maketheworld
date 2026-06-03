import { describe, expect, it } from 'vitest'
import { ComponentUUID } from '@tonylb/mtw-base/ts/schema'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import StandardArea from '@tonylb/mtw-wml/ts/standardize/components/area'
import StandardRoom from '@tonylb/mtw-wml/ts/standardize/components/room'
import StandardReference from '@tonylb/mtw-wml/ts/standardize/components/reference'
import { deIndentWML } from '@tonylb/mtw-wml/ts/schema/utils'

import { normalizeWorkbenchDraft } from './normalizeWorkbenchDraft'
import { previewOrphanClosure } from './previewOrphanClosure'

const ASSET_ID = 'ASSET#test' as const

function keysRemovedByNormalize(
    localDraft: StandardForm,
    applyLocal?: (draft: StandardForm) => void
): ComponentUUID[] {
    const draft = localDraft._clone()
    applyLocal?.(draft)
    const before = new Set(
        draft._components
            .map((c) => c.universalKey)
            .filter((k): k is ComponentUUID => k !== undefined)
    )
    normalizeWorkbenchDraft(draft)
    const after = new Set(
        draft._components
            .map((c) => c.universalKey)
            .filter((k): k is ComponentUUID => k !== undefined)
    )
    return [...before].filter((k) => !after.has(k))
}

describe('previewOrphanClosure', () => {
    it('returns empty when every component is referenced', () => {
        const localDraft = new StandardForm(deIndentWML(`
            <Asset uuid=(test)>
                <Room uuid=(room1) key=(room1)>
                    <Feature uuid=(feature1) key=(feature1) />
                </Room>
            </Asset>
        `))

        expect(previewOrphanClosure(localDraft)).toEqual({
            removedKeys: [],
            includesNonEmpty: false
        })
    })

    it('does not mutate localDraft', () => {
        const localDraft = new StandardForm({
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
        const before = localDraft.toJSON()

        previewOrphanClosure(localDraft)

        expect(localDraft.toJSON()).toEqual(before)
        expect(localDraft._components).toHaveLength(1)
    })

    it('reports a single non-empty orphan (D3)', () => {
        const localDraft = new StandardForm({
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

        expect(previewOrphanClosure(localDraft)).toEqual({
            removedKeys: ['ROOM#room1'],
            includesNonEmpty: true
        })
    })

    it('reports empty orphan without includesNonEmpty', () => {
        const localDraft = new StandardForm({
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

        expect(previewOrphanClosure(localDraft)).toEqual({
            removedKeys: ['FEATURE#feature1'],
            includesNonEmpty: false
        })
    })

    it('previews closure after applyLocal disassociate', () => {
        const base = new StandardForm(deIndentWML(`
            <Asset uuid=(test)>
                <Room uuid=(room1) key=(room1)>
                    <Feature uuid=(feature1) key=(feature1) />
                </Room>
            </Asset>
        `))
        const localDraft = base._clone()
        const featureRef = new StandardReference({
            tag: 'Feature',
            key: 'feature1',
            universalKey: 'FEATURE#feature1'
        })

        const result = previewOrphanClosure(localDraft, {
            applyLocal: (draft) => {
                const room = draft.byUniversalId['ROOM#room1']
                if (room instanceof StandardRoom) {
                    draft.byUniversalId['ROOM#room1'] = room.removeReferences([
                        featureRef
                    ]) as StandardRoom
                }
            }
        })

        expect(result).toEqual({
            removedKeys: ['FEATURE#feature1'],
            includesNonEmpty: false
        })
        expect(localDraft.byUniversalId['FEATURE#feature1']).toBeDefined()
    })

    it('previews transitive orphan closure (D4)', () => {
        const localDraft = new StandardForm(deIndentWML(`
            <Asset uuid=(test)>
                <Area uuid=(area1) key=(area1)>
                    <Room uuid=(room1) key=(room1)>
                        <Feature uuid=(feature1) key=(feature1) />
                    </Room>
                </Area>
            </Asset>
        `))
        const roomRef = new StandardReference({
            tag: 'Room',
            key: 'room1',
            universalKey: 'ROOM#room1'
        })

        const result = previewOrphanClosure(localDraft, {
            applyLocal: (draft) => {
                const area = draft.byUniversalId['AREA#area1']
                if (area instanceof StandardArea) {
                    draft.byUniversalId['AREA#area1'] = area.removeReferences([
                        roomRef
                    ]) as StandardArea
                }
            }
        })

        expect(result.removedKeys).toEqual([
            'ROOM#room1',
            'FEATURE#feature1'
        ])
        expect(result.includesNonEmpty).toBe(true)
    })

    it('matches normalizeWorkbenchDraft on a clone with the same applyLocal', () => {
        const localDraft = new StandardForm(deIndentWML(`
            <Asset uuid=(test)>
                <Area uuid=(area1) key=(area1)>
                    <Room uuid=(room1) key=(room1)>
                        <Feature uuid=(feature1) key=(feature1) />
                    </Room>
                </Area>
            </Asset>
        `))
        const roomRef = new StandardReference({
            tag: 'Room',
            key: 'room1',
            universalKey: 'ROOM#room1'
        })
        const applyLocal = (draft: StandardForm) => {
            const area = draft.byUniversalId['AREA#area1']
            if (area instanceof StandardArea) {
                draft.byUniversalId['AREA#area1'] = area.removeReferences([
                    roomRef
                ]) as StandardArea
            }
        }

        const preview = previewOrphanClosure(localDraft, { applyLocal })
        const normalizedKeys = keysRemovedByNormalize(localDraft, applyLocal)

        expect(preview.removedKeys).toEqual(normalizedKeys)
    })
})
