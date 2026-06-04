import { beforeEach, describe, expect, it, vi } from 'vitest'
import produce from 'immer'
import { ComponentUUID, type AssetUUID } from '@tonylb/mtw-base/ts/schema'
import { deIndentWML } from '@tonylb/mtw-wml/ts/schema/utils'
import { Schema } from '@tonylb/mtw-wml/ts/schema'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import StandardReference from '@tonylb/mtw-wml/ts/standardize/components/reference'
import StandardRoom from '@tonylb/mtw-wml/ts/standardize/components/room'

import type { PersonalAssetsPublic } from '../../../../slices/personalAssets/baseClasses'
import { getLocalStandardForm } from '../../../../slices/personalAssets'
import { updateStandard as updateStandardReducer } from '../../../../slices/personalAssets/reducers'
import { getWMLBase } from '../../../../slices/wmlDataSource/selectors'
const assetId = 'ASSET#test' as AssetUUID

const { setIntentMock, heartbeatMock, updateStandardCaptured } = vi.hoisted(() => ({
    setIntentMock: vi.fn((payload: unknown) => ({ type: 'setIntent', payload })),
    heartbeatMock: vi.fn(() => ({ type: 'heartbeat' })),
    updateStandardCaptured: { calls: [] as { key: string; payload: unknown }[] }
}))

vi.mock('../../../../slices/personalAssets', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../../../slices/personalAssets')>()
    return {
        ...actual,
        setIntent: setIntentMock,
        updateStandard: (key: string) => (payload: unknown) => async (dispatch: any, getState: any) => {
            updateStandardCaptured.calls.push({ key, payload })
            const state = getState()
            const base = getWMLBase(state, key) ?? {
                universalKey: key,
                components: [],
                metaData: []
            }
            const entry = state.personalAssets?.byId?.[key]
            if (!entry?.publicData) {
                return
            }
            entry.publicData = produce(entry.publicData, (draft: PersonalAssetsPublic) => {
                updateStandardReducer(draft, {
                    type: 'updateStandard',
                    payload: { ...(payload as object), base } as any
                })
            })
        }
    }
})

vi.mock('../../../../slices/stateSeekingMachine/ssmHeartbeat', () => ({
    heartbeat: heartbeatMock
}))

import { materializeComponentInAsset } from './materializeComponentInAsset'

const standardFormDataFromWML = (wml: string) => {
    const schema = new Schema()
    schema.loadWML(deIndentWML(wml))
    return new StandardForm(schema.schema[0]).toJSON()
}

const baseStateFromWML = (baseWml: string, editWml?: string) => {
    const materializedView = standardFormDataFromWML(baseWml)
    const edit = editWml
        ? standardFormDataFromWML(editWml)
        : { universalKey: assetId, components: [], metaData: [] }
    return {
        personalAssets: {
            byId: {
                [assetId]: {
                    publicData: {
                        edit,
                        pendingEdits: [],
                        inherited: { universalKey: assetId, components: [], metaData: [] }
                    }
                }
            }
        },
        wmlDataSource: {
            publicData: {
                subscribedStreams: {
                    [assetId]: {
                        materializedView,
                        recentEvents: []
                    }
                }
            }
        }
    }
}

const runThunk = async (state: ReturnType<typeof baseStateFromWML>, spec: Parameters<ReturnType<typeof materializeComponentInAsset>>[0]) => {
    const dispatched: unknown[] = []
    const getState = () => state
    const dispatch = (action: unknown): unknown => {
        dispatched.push(action)
        if (typeof action === 'function') {
            return (action as (d: typeof dispatch, g: typeof getState) => unknown)(dispatch, getState)
        }
        return action
    }
    const ref = await materializeComponentInAsset(assetId)(spec)(dispatch, getState)
    return { ref, dispatched, getState }
}

describe('materializeComponentInAsset', () => {
    beforeEach(() => {
        setIntentMock.mockClear()
        heartbeatMock.mockClear()
        updateStandardCaptured.calls = []
    })

    it('creates a new Room on the local draft via updateLocal', async () => {
        const state = baseStateFromWML(`<Asset uuid=(test) />`)
        const roomId = 'ROOM#newRoom' as ComponentUUID
        const { ref } = await runThunk(state, { universalKey: roomId })

        expect(ref.universalKey).toBe(roomId)
        expect(updateStandardCaptured.calls).toHaveLength(1)
        expect(updateStandardCaptured.calls[0].payload).toMatchObject({ type: 'updateLocal' })
        expect(setIntentMock).toHaveBeenCalledWith({ key: assetId, intent: ['SCHEMADIRTY'] })
        expect(heartbeatMock).toHaveBeenCalled()

        const local = new StandardForm(getLocalStandardForm(assetId)(state)!)
        expect(local.byUniversalId[roomId]).toBeDefined()
        expect(local.byUniversalId[roomId] instanceof StandardRoom).toBe(true)
    })

    it('early-exits when the component is already on the local draft', async () => {
        const state = baseStateFromWML(
            `<Asset uuid=(test) />`,
            `
                <Asset uuid=(test)>
                    <Room uuid=(existing) key=(existing) />
                </Asset>
            `
        )
        const existingId = 'ROOM#existing' as ComponentUUID
        const localBefore = new StandardForm(getLocalStandardForm(assetId)(state)!)
        const expectedRef = localBefore.byUniversalId[existingId]!.reference!

        const { ref } = await runThunk(state, { universalKey: existingId })

        expect(ref.sameKey(expectedRef)).toBe(true)
        expect(updateStandardCaptured.calls).toHaveLength(0)
        expect(setIntentMock).not.toHaveBeenCalled()
        expect(heartbeatMock).not.toHaveBeenCalled()
    })

    it('second call after create hits early exit', async () => {
        const state = baseStateFromWML(`<Asset uuid=(test) />`)
        const roomId = 'ROOM#once' as ComponentUUID

        await runThunk(state, { universalKey: roomId })
        updateStandardCaptured.calls = []
        setIntentMock.mockClear()
        heartbeatMock.mockClear()

        const { ref } = await runThunk(state, { universalKey: roomId })

        expect(ref.universalKey).toBe(roomId)
        expect(updateStandardCaptured.calls).toHaveLength(0)
        expect(setIntentMock).not.toHaveBeenCalled()
    })

    it('dispatches updateLocal for import when the body is already on the local draft', async () => {
        const state = baseStateFromWML(
            `
                <Asset uuid=(test)>
                    <Room uuid=(testRoom) key=(testRoom) />
                </Asset>
            `
        )
        const roomId = 'ROOM#testRoom' as ComponentUUID

        await runThunk(state, {
            universalKey: roomId,
            fromAsset: 'ASSET#newSource'
        })

        expect(updateStandardCaptured.calls).toHaveLength(1)
        expect(updateStandardCaptured.calls[0].payload).toMatchObject({ type: 'updateLocal' })

        const local = new StandardForm(getLocalStandardForm(assetId)(state)!)
        const draft = local._clone()
        const updated = updateStandardCaptured.calls[0].payload.update(draft)
        expect(updated.byUniversalId[roomId]?.toJSON()).toMatchObject({
            from: 'ASSET#newSource'
        })
    })

})
