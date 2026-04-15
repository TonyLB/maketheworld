jest.mock('@tonylb/mtw-utilities/ts/dynamoDB')

import { ephemeraCoyoteGameDataSource } from './index'

describe('mtw.ephemera.coyoteGame DataSource', () => {
    it('is a bus-only stub with no subscription hooks', () => {
        expect(ephemeraCoyoteGameDataSource.dataSourceKey).toBe('mtw.ephemera.coyoteGame')
        expect(ephemeraCoyoteGameDataSource.replayable).toBe(false)
        expect(ephemeraCoyoteGameDataSource.publisherStrategy).toBe('busOnly')
        expect(ephemeraCoyoteGameDataSource.subscribedEventTypeGuard).toBeUndefined()
        expect(ephemeraCoyoteGameDataSource.receiveEvents).toBeUndefined()
    })
})
