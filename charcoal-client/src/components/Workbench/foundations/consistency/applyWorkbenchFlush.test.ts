import { describe, expect, it, vi } from 'vitest'
import { ComponentUUID } from '@tonylb/mtw-base/ts/schema'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import StandardFeature from '@tonylb/mtw-wml/ts/standardize/components/feature'
import StandardRoom from '@tonylb/mtw-wml/ts/standardize/components/room'
import StandardReference from '@tonylb/mtw-wml/ts/standardize/components/reference'
import { ReferenceList } from '@tonylb/mtw-wml/ts/standardize/keys/referenceList'
import { deIndentWML } from '@tonylb/mtw-wml/ts/schema/utils'
import { standardComponentFactory } from '@tonylb/mtw-wml/ts/standardize/componentFactory'

import { setWorkingShortNameFromString } from '../workbenchMutations'
import { roomGuidanceListAccessor } from '../../RoomEdit/roomReferenceListAccessors'
import * as materializeModule from './materializeComponent'
import { applyWorkbenchFlush } from './applyWorkbenchFlush'

const ASSET_ID = 'ASSET#test' as const
const ROOM_ID = 'ROOM#room1' as ComponentUUID
const FEATURE_ID = 'FEATURE#feat1' as ComponentUUID
const GUIDANCE_ID = 'GUIDANCE#guid1' as ComponentUUID

describe('applyWorkbenchFlush', () => {
    it('assigns working shortName to draft.byUniversalId', () => {
        const draft = new StandardForm(deIndentWML(`
            <Asset uuid=(test)>
                <Feature uuid=(feat1)><ShortName>Old</ShortName></Feature>
            </Asset>
        `))
        const working = draft.byUniversalId[FEATURE_ID]!.clone() as StandardFeature
        setWorkingShortNameFromString(working, 'New')

        applyWorkbenchFlush(draft, { componentId: FEATURE_ID, working })

        const flushed = draft.byUniversalId[FEATURE_ID]
        expect(flushed).toBeInstanceOf(StandardFeature)
        expect((flushed as StandardFeature).shortName?.toJSON()).toBe('New')
    })

    it('runs beforeAssign before assign and normalize', () => {
        const draft = new StandardForm(deIndentWML(`
            <Asset uuid=(test)>
                <Room uuid=(room1) key=(room1)><ShortName>Room</ShortName></Room>
                <Guidance uuid=(guid1) key=(guid1) />
            </Asset>
        `))
        const working = draft.byUniversalId[ROOM_ID]!.clone() as StandardRoom
        const ref = new StandardReference({ universalKey: GUIDANCE_ID, tag: 'Guidance' })
        roomGuidanceListAccessor.setReferenceList(
            working,
            roomGuidanceListAccessor.getReferenceList(working).assureItem(ref)
        )

        applyWorkbenchFlush(draft, {
            componentId: ROOM_ID,
            working,
            beforeAssign: (d) => {
                const { component } = standardComponentFactory({
                    tag: 'Guidance',
                    universalKey: GUIDANCE_ID
                })
                if (component) {
                    d.byUniversalId[GUIDANCE_ID] = component
                }
            }
        })

        const room = draft.byUniversalId[ROOM_ID] as StandardRoom
        expect(roomGuidanceListAccessor.getReferenceList(room).payload).toHaveLength(1)
        expect(draft.byUniversalId[GUIDANCE_ID]).toBeDefined()
    })

    it('normalizes orphans after beforeAssign disassociates _topLevel', () => {
        const draft = new StandardForm({
            universalKey: ASSET_ID,
            metaData: [],
            components: [
                {
                    tag: 'Room',
                    key: 'room1',
                    universalKey: ROOM_ID,
                    features: [
                        {
                            tag: 'Feature',
                            key: 'feature1',
                            universalKey: FEATURE_ID
                        }
                    ]
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
        const working = draft.byUniversalId[ROOM_ID]!.clone() as StandardRoom

        applyWorkbenchFlush(draft, {
            componentId: ROOM_ID,
            working,
            beforeAssign: (d) => {
                d._topLevel = new ReferenceList(
                    d._topLevel!.payload.filter((ref) => !ref.sameKey(roomRef))
                )
            }
        })

        expect(draft.byUniversalId[ROOM_ID]).toBeUndefined()
        expect(draft.byUniversalId[FEATURE_ID]).toBeUndefined()
    })

    it('does not call materializeComponent', () => {
        const materializeSpy = vi.spyOn(materializeModule, 'materializeComponent')
        const draft = new StandardForm(deIndentWML(`
            <Asset uuid=(test)>
                <Feature uuid=(feat1) />
            </Asset>
        `))
        const working = draft.byUniversalId[FEATURE_ID]!.clone() as StandardFeature

        applyWorkbenchFlush(draft, { componentId: FEATURE_ID, working })

        expect(materializeSpy).not.toHaveBeenCalled()
        materializeSpy.mockRestore()
    })
})
