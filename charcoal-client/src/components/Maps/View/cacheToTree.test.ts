import cacheToTree from './cacheToTree'

describe('cacheToTree', () => {
    it('should convert empty cache to empty tree', () => {
        expect(cacheToTree({ MapId: 'MAP#123', Name: '', fileURL: '', rooms: []})).toEqual([])
    })

    it('should convert rooms and exits to items', () => {
        const testCache = {
            MapId: 'MAP#123',
            Name: 'TestMap',
            rooms: {
                VORTEX: {
                    
                }
            }
        }
    })
})