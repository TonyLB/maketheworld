import { describe, expect, it, vi } from 'vitest'
import { ComponentUUID } from '@tonylb/mtw-base/ts/schema'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import StandardRoom from '@tonylb/mtw-wml/ts/standardize/components/room'
import StandardReference from '@tonylb/mtw-wml/ts/standardize/components/reference'
import { ReferenceList } from '@tonylb/mtw-wml/ts/standardize/keys/referenceList'
import { StandardLiteral } from '@tonylb/mtw-wml/ts/standardize/literal'
import { StandardRender } from '@tonylb/mtw-wml/ts/standardize/render'
import { deIndentWML } from '@tonylb/mtw-wml/ts/schema/utils'

import {
    projectAssetMetaFromStandardForm,
    prepareAssetMetaForFlush
} from '../workbenchMutations'
import * as materializeModule from './materializeComponent'
import { applyAssetMetaFlush } from './applyAssetMetaFlush'

const ASSET_ID = 'ASSET#test' as const
const ROOM_ID = 'ROOM#room1' as ComponentUUID
const FEATURE_ID = 'FEATURE#feat1' as ComponentUUID

describe('applyAssetMetaFlush', () => {
    it('assigns working shortName, summary, and topLevel to draft', () => {
        const draft = new StandardForm(deIndentWML(`
            <Asset uuid=(test)>
                <ShortName>Old</ShortName>
                <Summary>Old summary</Summary>
            </Asset>
        `))
        const working = {
            shortName: new StandardLiteral('New'),
            summary: new StandardRender(['New summary']),
            topLevel: new ReferenceList([
                new StandardReference({ tag: 'Room', key: 'room1', universalKey: ROOM_ID })
            ])
        }

        applyAssetMetaFlush(draft, { working })

        expect(draft.shortName?.toJSON()).toBe('New')
        expect(draft.summary?.toJSON()).toEqual(['New summary'])
        expect(draft._topLevel?.payload).toHaveLength(1)
        expect(draft._topLevel?.payload[0].universalKey).toBe(ROOM_ID)
    })

    it('invokes beforeAssign before assign only', () => {
        const draft = new StandardForm(deIndentWML(`
            <Asset uuid=(test)>
                <ShortName>Old</ShortName>
            </Asset>
        `))
        let beforeAssignRan = false
        const working = {
            shortName: new StandardLiteral('New'),
            summary: undefined,
            topLevel: new ReferenceList([])
        }

        applyAssetMetaFlush(draft, {
            working,
            beforeAssign: () => {
                beforeAssignRan = true
            }
        })

        expect(beforeAssignRan).toBe(true)
        expect(draft.shortName?.toJSON()).toBe('New')
    })

    it('does not remove bodies after working disassociates topLevel', () => {
        const draft = new StandardForm({
            universalKey: ASSET_ID,
            metaData: [],
            components: [
                {
                    tag: 'Room',
                    key: 'room1',
                    universalKey: ROOM_ID,
                    ludicGraph: { nodes: [
                        {
                            tag: 'Feature',
                            key: 'feature1',
                            universalKey: FEATURE_ID
                        }
                    ] }
                },
                {
                    tag: 'Feature',
                    key: 'feature1',
                    universalKey: FEATURE_ID
                }
            ],
            topLevel: [
                {
                    tag: 'Room',
                    key: 'room1',
                    universalKey: ROOM_ID,
                    ref: 1
                }
            ]
        })
        const roomRef = new StandardReference({
            tag: 'Room',
            key: 'room1',
            universalKey: ROOM_ID
        })
        const working = projectAssetMetaFromStandardForm(draft)
        working.topLevel = new ReferenceList(
            working.topLevel.payload.filter((ref) => !ref.sameKey(roomRef))
        )

        applyAssetMetaFlush(draft, { working })

        expect(draft.byUniversalId[ROOM_ID]).toBeDefined()
        expect(draft.byUniversalId[FEATURE_ID]).toBeDefined()
        expect(draft._topLevel?.payload ?? []).toHaveLength(0)
    })

    it('omits whitespace-only shortName on flush (D11)', () => {
        const draft = new StandardForm(deIndentWML(`
            <Asset uuid=(test)>
                <ShortName>Old</ShortName>
            </Asset>
        `))
        const working = {
            shortName: new StandardLiteral('   '),
            summary: undefined,
            topLevel: new ReferenceList([])
        }

        applyAssetMetaFlush(draft, { working })

        expect(draft.shortName).toBeUndefined()
    })

    it('does not call materializeComponent', () => {
        const materializeSpy = vi.spyOn(materializeModule, 'materializeComponent')
        const draft = new StandardForm(deIndentWML(`
            <Asset uuid=(test)>
                <ShortName>Old</ShortName>
            </Asset>
        `))
        const working = prepareAssetMetaForFlush({
            shortName: new StandardLiteral('New'),
            summary: undefined,
            topLevel: new ReferenceList([])
        })

        applyAssetMetaFlush(draft, { working })

        expect(materializeSpy).not.toHaveBeenCalled()
        materializeSpy.mockRestore()
    })
})
