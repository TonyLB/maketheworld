import { describe, expect, it, vi } from 'vitest'
import { ComponentUUID } from '@tonylb/mtw-base/ts/schema'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import StandardFeature from '@tonylb/mtw-wml/ts/standardize/components/feature'
import StandardRoom from '@tonylb/mtw-wml/ts/standardize/components/room'
import StandardReference from '@tonylb/mtw-wml/ts/standardize/components/reference'
import { ReferenceList } from '@tonylb/mtw-wml/ts/standardize/keys/referenceList'
import { deIndentWML } from '@tonylb/mtw-wml/ts/schema/utils'
import { standardComponentFactory } from '@tonylb/mtw-wml/ts/standardize/componentFactory'

import {
    applyWorkingComponentToDraft,
    prepareComponentForFlush,
    setWorkingShortNameFromString
} from '../workbenchMutations'
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

    it('runs beforeAssign before assign only', () => {
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

    it('does not remove bodies after beforeAssign disassociates _topLevel', () => {
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

        expect(draft.byUniversalId[ROOM_ID]).toBeDefined()
        expect(draft.byUniversalId[FEATURE_ID]).toBeDefined()
    })

    describe('imported Room shortName (Phase 0 / Phase 1 fixture)', () => {
        const ROOM_LOBBY_ID = 'ROOM#lobby' as ComponentUUID
        const inheritedWml = `
            <Asset uuid=(assetC)>
                <Room uuid=(lobby) key=(lobby)><ShortName>Lobby</ShortName></Room>
            </Asset>
        `
        const baseWml = `
            <Asset uuid=(assetC)>
                <Room uuid=(lobby) from=(ASSET#assetA) ref={0} />
            </Asset>
        `
        const editWml = `
            <Asset uuid=(assetC)>
                <Room uuid=(lobby) ref={0}>
                    <ShortName><Space />in the dark</ShortName>
                </Room>
            </Asset>
        `

        const buildPhase0Forms = () => {
            const base = new StandardForm(deIndentWML(baseWml))
            const inherited = new StandardForm(deIndentWML(inheritedWml))
            const edit = new StandardForm(deIndentWML(editWml))
            const local = base.merge(edit)
            const merged = inherited.merge(local)
            const roomInMerged = merged.byUniversalId[ROOM_LOBBY_ID]
            expect(roomInMerged).toBeInstanceOf(StandardRoom)
            const working = (roomInMerged as StandardRoom).clone()
            setWorkingShortNameFromString(working, 'Lobby in the pitch-black')
            return { base, inherited, edit, local, merged, working }
        }

        it('local form has no _topLevel link and empty referencedBy before flush', () => {
            const { base, edit, local } = buildPhase0Forms()
            const roomRef = local.byUniversalId[ROOM_LOBBY_ID]!.reference

            expect(base.byUniversalId[ROOM_LOBBY_ID]).toBeDefined()
            expect(edit.byUniversalId[ROOM_LOBBY_ID]).toBeDefined()
            expect(base._topLevel?.payload ?? []).toHaveLength(0)
            expect(edit._topLevel?.payload ?? []).toHaveLength(0)
            expect(local.referencedBy(roomRef)).toEqual([])
            expect(local._topLevel?.payload ?? []).toHaveLength(0)
        })

        it('assign leaves room on draft with plain merged shortName', () => {
            const { local, working } = buildPhase0Forms()
            const draft = local._clone()

            applyWorkingComponentToDraft(draft, ROOM_LOBBY_ID, working)

            expect(draft.byUniversalId[ROOM_LOBBY_ID]).toBeInstanceOf(StandardRoom)
            expect((draft.byUniversalId[ROOM_LOBBY_ID] as StandardRoom).shortName?.toJSON()).toBe(
                'Lobby in the pitch-black'
            )
        })

        it('flush retains imported room body (assign only, no orphan GC)', () => {
            const { local, working } = buildPhase0Forms()
            const draft = local._clone()

            applyWorkbenchFlush(draft, { componentId: ROOM_LOBBY_ID, working })

            expect(draft.byUniversalId[ROOM_LOBBY_ID]).toBeInstanceOf(StandardRoom)
            expect((draft.byUniversalId[ROOM_LOBBY_ID] as StandardRoom).shortName?.toJSON()).toBe(
                'Lobby in the pitch-black'
            )
            expect(draft._topLevel?.payload ?? []).toHaveLength(0)
        })

        it('prepareComponentForFlush persists merged plain shortName not additive overlay', () => {
            const { working } = buildPhase0Forms()
            const flushed = prepareComponentForFlush(working)
            expect(flushed.shortName?.toJSON()).toBe('Lobby in the pitch-black')
            expect(typeof flushed.shortName?.toJSON()).toBe('string')
        })
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
