import { beforeEach, describe, expect, it, vi } from 'vitest'
import { deIndentWML } from '@tonylb/mtw-wml/ts/schema/utils'
import { Schema } from '@tonylb/mtw-wml/ts/schema'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import StandardRoom from '@tonylb/mtw-wml/ts/standardize/components/room'
import { SituationRoomFacetPayload } from '@tonylb/mtw-wml/ts/standardize/keys/facets/situationRoom'
import type { AssetUUID, ComponentUUID } from '@tonylb/mtw-base/ts/schema'
import { requestLLMGeneration, DEFAULT_SITUATION_ID } from '.'

const { socketDispatchPromiseMock } = vi.hoisted(() => ({
    socketDispatchPromiseMock: vi.fn()
}))

vi.mock('../lifeLine', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../lifeLine')>()
    return {
        ...actual,
        socketDispatchPromise: socketDispatchPromiseMock
    }
})

const assetId = 'ASSET#test' as AssetUUID
const roomId = 'ROOM#testRoom' as ComponentUUID

const standardFormDataFromWML = (wml: string) => {
    const schema = new Schema()
    schema.loadWML(deIndentWML(wml))
    return new StandardForm(schema.schema[0]).toJSON()
}

const baseStateFromWML = (wml: string) => {
    const materializedView = standardFormDataFromWML(wml)
    return {
        personalAssets: {
            byId: {
                [assetId]: {
                    publicData: {
                        edit: { universalKey: assetId, components: [], metaData: [] },
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

describe('requestLLMGeneration', () => {
    beforeEach(() => {
        socketDispatchPromiseMock.mockReset()
    })

    it('writes generated Room prose to default situation payload', async () => {
        socketDispatchPromiseMock.mockImplementation(() => () => Promise.resolve({
            description: ' Generated description ',
            summary: ' Generated summary '
        }))
        const state = baseStateFromWML(`
            <Asset uuid=(test)>
                <Room uuid=(testRoom)>
                    <ShortName>Test Room</ShortName>
                </Room>
            </Asset>
        `)
        const dispatched: any[] = []
        const getState = () => state
        const dispatch = (action: any): any => {
            dispatched.push(action)
            if (typeof action === 'function') {
                return action(dispatch, getState)
            }
            return action
        }

        await requestLLMGeneration({ assetId, roomId })(dispatch, getState)
        await Promise.resolve()

        const updateAction = dispatched.find(
            (action) => action && typeof action === 'object' && action.payload?.type === 'update' && typeof action.payload?.update === 'function'
        )
        expect(updateAction).toBeDefined()

        const draft = new StandardForm(standardFormDataFromWML(`
            <Asset uuid=(test)>
                <Room uuid=(testRoom)>
                    <ShortName>Test Room</ShortName>
                </Room>
            </Asset>
        `))
        const updated = updateAction.payload.update(draft)
        const room = updated.byUniversalId[roomId]
        expect(room).toBeInstanceOf(StandardRoom)
        if (!(room instanceof StandardRoom)) {
            return
        }
        const defaultFacet = room.situations.items.find(({ reference }) => reference?.universalKey === DEFAULT_SITUATION_ID)
        expect(defaultFacet).toBeDefined()
        const payload = defaultFacet?.payload instanceof SituationRoomFacetPayload
            ? defaultFacet.payload
            : new SituationRoomFacetPayload(defaultFacet!.payload)
        expect(payload._summary?.plainString).toBe('Generated summary')
        expect(payload._description?.plainString).toBe('Generated description')
        expect(updated.byUniversalId[DEFAULT_SITUATION_ID]?._from).toBe('ASSET#primitives')
    })

    it('does nothing when target room is missing', async () => {
        socketDispatchPromiseMock.mockImplementation(() => () => Promise.resolve({
            description: 'desc',
            summary: 'sum'
        }))
        const state = baseStateFromWML(`
            <Asset uuid=(test)>
                <Room uuid=(differentRoom)>
                    <ShortName>Other Room</ShortName>
                </Room>
            </Asset>
        `)
        const dispatched: any[] = []
        const getState = () => state
        const dispatch = (action: any): any => {
            dispatched.push(action)
            if (typeof action === 'function') {
                return action(dispatch, getState)
            }
            return action
        }

        await requestLLMGeneration({ assetId, roomId })(dispatch, getState)
        await Promise.resolve()

        expect(socketDispatchPromiseMock).not.toHaveBeenCalled()
        const updateAction = dispatched.find(
            (action) => action && typeof action === 'object' && action.payload?.type === 'update'
        )
        expect(updateAction).toBeUndefined()
    })

    it('does not dispatch SCHEMADIRTY intent when generated prose is empty', async () => {
        socketDispatchPromiseMock.mockImplementation(() => () => Promise.resolve({
            description: '',
            summary: ''
        }))
        const state = baseStateFromWML(`
            <Asset uuid=(test)>
                <Room uuid=(testRoom)>
                    <ShortName>Test Room</ShortName>
                </Room>
            </Asset>
        `)
        const dispatched: any[] = []
        const getState = () => state
        const dispatch = (action: any): any => {
            dispatched.push(action)
            if (typeof action === 'function') {
                return action(dispatch, getState)
            }
            return action
        }

        await requestLLMGeneration({ assetId, roomId })(dispatch, getState)
        await Promise.resolve()

        const intentAction = dispatched.find(
            (action) => action && typeof action === 'object' && typeof action.type === 'string' && action.type.includes('/setIntent')
        )
        expect(intentAction).toBeUndefined()
    })
})
