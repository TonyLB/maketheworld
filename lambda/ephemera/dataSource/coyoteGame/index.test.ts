jest.mock('@tonylb/mtw-utilities/ts/dynamoDB')

import { ephemeraCoyoteGameDataSource } from './index'
import { isCoyoteGameSubscribedEnvelope } from './subscribedEvents'

describe('mtw.ephemera.coyoteGame DataSource', () => {
    it('is bus-only and subscribes to Object Moved and Await RoadRunner', () => {
        expect(ephemeraCoyoteGameDataSource.dataSourceKey).toBe('mtw.ephemera.coyoteGame')
        expect(ephemeraCoyoteGameDataSource.replayable).toBe(false)
        expect(ephemeraCoyoteGameDataSource.publisherStrategy).toBe('busOnly')
        expect(ephemeraCoyoteGameDataSource.subscribedEventTypeGuard).toBe(isCoyoteGameSubscribedEnvelope)
        expect(typeof ephemeraCoyoteGameDataSource.receiveEvents).toBe('function')
    })
})
