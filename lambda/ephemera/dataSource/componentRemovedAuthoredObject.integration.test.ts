/**
 * Cross-boundary check for `Component Removed` (authoredObjectPopulation Slice 2): the event
 * `cacheAsset` publishes is round-tripped through JSON and the real `EphemeraEventSerializer`
 * (the wire path into this lambda), then handed to the real, unmocked `receiveEvents` ->
 * `removeAuthoredObject` -> `executeMembershipTransfer` -> kernel compile. Only leaf I/O is
 * mocked: `internalCache` reads and the final `commitStepSequence` write. The EventBridge leg
 * itself stays a manual `aws events put-events` check (repo convention).
 */
jest.mock('../internalCache', () => ({
    __esModule: true,
    default: { Positions: { getMembershipContainers: jest.fn(), getLudicGraph: jest.fn() } },
}))
jest.mock('./positions/manipulation/kernel/commitStepSequence', () => ({
    __esModule: true,
    commitStepSequence: jest.fn(),
}))
jest.mock('../messageBus', () => ({ send: jest.fn(), publish: jest.fn(), flush: jest.fn(), subscribe: jest.fn() }))

import { EphemeraEventSerializer } from '@tonylb/mtw-interfaces/ts/eventBridge/ephemera'
import StandardObject from '@tonylb/mtw-wml/ts/standardize/components/object'
import type { EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import internalCache from '../internalCache'
import { ephemeraDataSource } from './index'
import { commitStepSequence } from './positions/manipulation/kernel/commitStepSequence'
import { presenceBindingNode, testLudicGraph } from './positions/ludicGraph/testFixtures'

const ROOM = 'ROOM#cafe' as EphemeraRoomId

describe('Component Removed for an authored Object', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        ;(commitStepSequence as jest.Mock).mockResolvedValue({ ok: true, beatAnchorTime: 1, steps: [], captures: new Map() })
        ;(internalCache.Positions.getMembershipContainers as jest.Mock).mockResolvedValue([ROOM])
        // the Object holds one binding, in the room; every other host is empty
        ;(internalCache.Positions.getLudicGraph as jest.Mock).mockImplementation(async (id: any) =>
            testLudicGraph(id, { nodes: id === 'OBJECT#cup' ? [presenceBindingNode('cup-in-cafe', ROOM)] : [] })
        )
    })

    it('reaches the real handler off the wire and commits a release of the Object\'s binding', async () => {
        const serializer = new EphemeraEventSerializer()
        const component = new StandardObject('OBJECT#cup' as any)
        const wire = JSON.parse(JSON.stringify(serializer.serialize({
            content: { component } as any,
            header: { dataSourceKey: 'mtw.assets', streamKey: 'ASSET#a', timestamp: 1, type: 'Component Removed' } as any,
        })))
        const events = [{
            header: { dataSourceKey: 'mtw.assets' as const, streamKey: 'ASSET#a', timestamp: 1, type: 'Component Removed' },
            getContent: () => serializer.deserialize({ content: wire, header: { type: 'Component Removed' } as any }),
        }]

        await ephemeraDataSource.receiveEvents?.({ events: events as any, streamEvent: jest.fn().mockResolvedValue(undefined), streamEnvelope: jest.fn() })

        expect(commitStepSequence).toHaveBeenCalledTimes(1)
        const [{ steps }] = (commitStepSequence as jest.Mock).mock.calls[0]
        expect(steps.find((step: any) => step.kind === 'releasePresenceBinding')).toMatchObject({
            hostId: 'OBJECT#cup',
            from: { host: ROOM },
        })
    })
})
