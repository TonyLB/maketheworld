import { describe, expect, it, vi, beforeEach } from 'vitest'
import { ComponentUUID } from '@tonylb/mtw-base/ts/schema'
import type { AppDispatch } from '../../../../store'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import StandardRoom from '@tonylb/mtw-wml/ts/standardize/components/room'
import StandardReference from '@tonylb/mtw-wml/ts/standardize/components/reference'
import ReferenceList from '@tonylb/mtw-wml/ts/standardize/keys/referenceList'
import { deIndentWML } from '@tonylb/mtw-wml/ts/schema/utils'
import { SingleReference } from '@tonylb/mtw-wml/ts/standardize/keys/singleReference'

import {
    confirmSiteDisassociateBeforeAssetMetaDisassociate,
    confirmSiteDisassociateBeforeComponentDisassociate
} from './confirmSiteDisassociateBeforeLocalEdit'

const { pushChoiceMock, choiceReturnValue } = vi.hoisted(() => ({
    pushChoiceMock: vi.fn(),
    choiceReturnValue: { current: 'confirm' as string }
}))

vi.mock('../../../../slices/UI/choiceDialog', () => ({
    pushChoice: (choice: unknown) => {
        pushChoiceMock(choice)
        return () => Promise.resolve(choiceReturnValue.current)
    }
}))

const ASSET_ID = 'ASSET#test' as const
const ROOM_ID = 'ROOM#room1' as ComponentUUID
const FEATURE_ID = 'FEATURE#feature1' as ComponentUUID

describe('confirmSiteDisassociateBeforeLocalEdit', () => {
    const dispatch = vi.fn((thunk: () => Promise<string>) => thunk()) as unknown as AppDispatch

    beforeEach(() => {
        pushChoiceMock.mockClear()
        choiceReturnValue.current = 'confirm'
    })

    describe('confirmSiteDisassociateBeforeAssetMetaDisassociate', () => {
        it('skips dialog when target has no non-empty local body', async () => {
            const localStandardForm = new StandardForm({
                universalKey: ASSET_ID,
                metaData: [],
                components: []
            })
            const standardForm = localStandardForm._clone()
            const working = {
                shortName: undefined,
                summary: undefined,
                topLevel: new ReferenceList([
                    new StandardReference({ tag: 'Room', key: 'room1', universalKey: ROOM_ID })
                ])
            }

            const result = await confirmSiteDisassociateBeforeAssetMetaDisassociate({
                dispatch,
                localStandardForm,
                standardForm,
                working,
                removeId: ROOM_ID
            })

            expect(result).toBe(true)
            expect(pushChoiceMock).not.toHaveBeenCalled()
        })

        it('shows asset-level retention copy when no remaining referrers', async () => {
            const localStandardForm = new StandardForm({
                universalKey: ASSET_ID,
                metaData: [],
                components: [
                    {
                        tag: 'Room',
                        key: 'room1',
                        universalKey: ROOM_ID,
                        shortName: 'Hall'
                    }
                ]
            })
            const standardForm = localStandardForm._clone()
            const working = {
                shortName: undefined,
                summary: undefined,
                topLevel: new ReferenceList([
                    new StandardReference({ tag: 'Room', key: 'room1', universalKey: ROOM_ID })
                ])
            }

            const result = await confirmSiteDisassociateBeforeAssetMetaDisassociate({
                dispatch,
                localStandardForm,
                standardForm,
                working,
                removeId: ROOM_ID
            })

            expect(result).toBe(true)
            expect(pushChoiceMock).toHaveBeenCalledTimes(1)
            const choice = pushChoiceMock.mock.calls[0]![0] as { message: string; options: unknown[] }
            expect(choice.message).toContain('remain in this asset')
            expect(choice.message).toContain('asset level')
            expect(choice.message).toContain('Purge on the Components list')
            expect(choice.options).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({ label: 'Remove link' })
                ])
            )
        })

        it('lists remaining referrers when still referenced elsewhere', async () => {
            const localStandardForm = new StandardForm(deIndentWML(`
                <Asset uuid=(test)>
                    <Feature uuid=(feature1) key=(feature1)><ShortName>Clock</ShortName></Feature>
                    <Room uuid=(room1) key=(room1)><Feature key=(feature1)/></Room>
                    <Room uuid=(room2) key=(room2)><Feature key=(feature1)/></Room>
                </Asset>
            `))
            localStandardForm._topLevel = new ReferenceList([
                new StandardReference({
                    tag: 'Feature',
                    key: 'feature1',
                    universalKey: FEATURE_ID
                })
            ])
            const standardForm = localStandardForm._clone()
            const working = {
                shortName: undefined,
                summary: undefined,
                topLevel: localStandardForm._topLevel.clone()
            }

            await confirmSiteDisassociateBeforeAssetMetaDisassociate({
                dispatch,
                localStandardForm,
                standardForm,
                working,
                removeId: FEATURE_ID
            })

            const choice = pushChoiceMock.mock.calls[0]![0] as { message: string }
            expect(choice.message).toContain('still referenced from')
            expect(choice.message).toMatch(/room1|room2/)
        })

        it('returns false when author cancels', async () => {
            choiceReturnValue.current = 'cancel'
            const localStandardForm = new StandardForm({
                universalKey: ASSET_ID,
                metaData: [],
                components: [
                    {
                        tag: 'Room',
                        key: 'room1',
                        universalKey: ROOM_ID,
                        shortName: 'Hall'
                    }
                ]
            })
            const working = {
                shortName: undefined,
                summary: undefined,
                topLevel: new ReferenceList([
                    new StandardReference({ tag: 'Room', key: 'room1', universalKey: ROOM_ID })
                ])
            }

            const result = await confirmSiteDisassociateBeforeAssetMetaDisassociate({
                dispatch,
                localStandardForm,
                standardForm: localStandardForm._clone(),
                working,
                removeId: ROOM_ID
            })

            expect(result).toBe(false)
        })
    })

    describe('confirmSiteDisassociateBeforeComponentDisassociate', () => {
        const LENS_ID = 'LENS#lens1' as ComponentUUID

        it('shows retention copy without Purge hint for component-site disassociate', async () => {
            const localStandardForm = new StandardForm(deIndentWML(`
                <Asset uuid=(test)>
                    <Room uuid=(room1) key=(room1)><ShortName>R1</ShortName><Lens uuid=(lens1)/></Room>
                    <Lens uuid=(lens1)><ShortName>My Lens</ShortName></Lens>
                </Asset>
            `))
            const standardForm = localStandardForm._clone()
            const room = localStandardForm.byUniversalId[ROOM_ID] as StandardRoom
            const working = room.clone() as StandardRoom
            const lensRef = new StandardReference({
                tag: 'Lens',
                key: 'lens1',
                universalKey: LENS_ID
            })

            await confirmSiteDisassociateBeforeComponentDisassociate({
                dispatch,
                localStandardForm,
                standardForm,
                componentId: ROOM_ID,
                working,
                target: lensRef,
                siteLabel: "this Room's Lens",
                applyDisassociateOnWorking: (sim) => {
                    sim._payload._lens = new SingleReference([])
                }
            })

            expect(pushChoiceMock).toHaveBeenCalledTimes(1)
            const choice = pushChoiceMock.mock.calls[0]![0] as { message: string }
            expect(choice.message).toContain("this Room's Lens")
            expect(choice.message).toContain('remain in this asset')
            expect(choice.message).not.toContain('Purge on the Components list')
        })
    })
})
