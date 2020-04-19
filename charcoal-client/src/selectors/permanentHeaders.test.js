import { getPermanentHeaders, getRoomIdsInNeighborhood } from './permanentHeaders'

const testState = {
    permanentHeaders: {
        ABC: {
            permanentId: 'ABC',
            ancestry: 'ABC',
            type: 'NEIGHBORHOOD'
        },
        BCD: {
            permanentId: 'BCD',
            ancestry: 'ABC:BCD',
            type: 'ROOM'
        },
        CDE: {
            permanentId: 'CDE',
            ancestry: 'ABC:CDE',
            type: 'NEIGHBORHOOD'
        },
        DEF: {
            permanentId: 'DEF',
            ancestry: 'ABC:CDE:DEF',
            type: 'ROOM'
        },
        EFG: {
            permanentId: 'EFG',
            ancestry: 'ABC:CDE:EFG',
            type: 'ROOM'
        },
        FGH: {
            pemanentId: 'FGH',
            ancestry: 'FGH',
            type: 'NEIGHBORHOOD'
        },
        GHI: {
            permanentId: 'GHI',
            ancestry: 'FGH:GHI',
            type: 'ROOM'
        }
    }
}

describe('permanentHeader selectors', () => {
    it('should extract permanentHeaders', () => {
        expect(getPermanentHeaders(testState)).toEqual(testState.permanentHeaders)
    })

    it('should correctly pull direct rooms from neighborhood', () => {
        expect(getRoomIdsInNeighborhood('FGH')(testState)).toEqual(['GHI'])
    })

    it('should correctly pull rooms from nested neighborhoods', () => {
        expect(getRoomIdsInNeighborhood('ABC')(testState)).toEqual(['BCD', 'DEF', 'EFG'])
    })

    it('should pull all rooms when no neighborhood provided', () => {
        expect(getRoomIdsInNeighborhood()(testState)).toEqual(['BCD', 'DEF', 'EFG', 'GHI'])
    })
})
