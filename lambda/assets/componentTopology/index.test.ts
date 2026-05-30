import { componentTopologyDataSource } from '.'
import {
    isComponentTopologySubscribedEnvelope,
    type ComponentTopologyIncomingEvent,
} from './subscribedEvents'
import StandardArea from '@tonylb/mtw-wml/ts/standardize/components/area'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import { deIndentWML } from '@tonylb/mtw-wml/ts/schema/utils'

describe('componentTopology DataSource', () => {
    it('registers as non-replayable mtw.assets.componentTopology', () => {
        expect(componentTopologyDataSource.dataSourceKey).toBe('mtw.assets.componentTopology')
        expect(componentTopologyDataSource.replayable).toBe(false)
    })

    it('streams TopologyInvalidated for Area component updates', async () => {
        const mockStreamEvent = jest.fn().mockResolvedValue(undefined)
        const form = new StandardForm(deIndentWML(`
            <Asset uuid=(test)>
                <Area uuid=(region) key=(region)>
                    <Room uuid=(highway) key=(highway) />
                    <Exit uuid=(e1)>
                        <From>ROOM#highway</From>
                        <To>ROOM#outsideRoom</To>
                    </Exit>
                </Area>
                <Room uuid=(outsideRoom) key=(outsideRoom) />
            </Asset>
        `))
        const area = form.byUniversalId['AREA#region'] as StandardArea
        const envelope: ComponentTopologyIncomingEvent = {
            header: {
                dataSourceKey: 'mtw.assets',
                type: 'Component Updated',
                streamKey: 'ASSET#test',
                timestamp: Date.now(),
            },
            getContent: async () => ({ component: area }),
        }
        expect(isComponentTopologySubscribedEnvelope(envelope)).toBe(true)
        await componentTopologyDataSource.receiveEvents?.({
            events: [envelope],
            streamEvent: mockStreamEvent,
            streamEnvelope: jest.fn().mockResolvedValue(undefined),
        })
        expect(mockStreamEvent).toHaveBeenCalledWith(
            expect.objectContaining({
                update: expect.objectContaining({
                    type: 'TopologyInvalidated',
                    editAssetId: 'ASSET#test',
                    roomIds: expect.arrayContaining(['ROOM#highway', 'ROOM#outsideRoom']),
                    areaId: 'AREA#region',
                }),
                header: { type: 'TopologyInvalidated' },
            })
        )
    })
})
