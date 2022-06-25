import { InternalMessageBus } from './index'

describe('InternalMessageBus', () => {
    it('should initialize an empty stream', () => {
        expect(new InternalMessageBus()._stream).toEqual([])
    })
})