import neighborhoods from './neighborhoods.js'
import { NEIGHBORHOOD_MERGE } from '../actions/neighborhoods.js'

const testTree = {
    VORTEX: {
        ancestry: 'VORTEX',
        name: 'The Vortex',
        permanentId: 'VORTEX',
        type: 'ROOM'
    },
    '123': {
        permanentId: '123',
        children: {
            '234': {
                ancestry: '123:234',
                parentId: '123',
                name: 'Back Rooms',
                permanentId: '234',
                type: 'NEIGHBORHOOD',
                children: {
                    '456': {
                        ancestry: '123:234:456',
                        parentId: '234',
                        name: 'Lobby',
                        permanentId: '456',
                        type: 'ROOM'
                    },
                    '789': {
                        ancestry: '123:234:789',
                        parentId: '234',
                        name: 'Office',
                        permanentId: '789',
                        type: 'ROOM'
                    }
                }
            },
            '567': {
                ancestry: '123:567',
                parentId: '123',
                permanentId: '567',
                name: 'Frozen Yogurt Shop',
                type: 'ROOM'
            }
        },
        ancestry: '123',
        name: 'The Good Place',
        type: 'NEIGHBORHOOD'
    }
}

describe('Neighborhoods reducer', () => {
    it('should return an empty map by default', () => {
        expect(neighborhoods()).toEqual({})
    })

    it('should add a new permanent at the room of the tree', () => {
        expect(neighborhoods(testTree, {
            type: NEIGHBORHOOD_MERGE,
            permanentData: [{
                ancestry: '543',
                parentId: '',
                name: 'Closet',
                permanentId: '543',
                type: 'ROOM'
            }]
        })).toEqual({
            ...testTree,
            '543': {
                ancestry: '543',
                parentId: '',
                name: 'Closet',
                permanentId: '543',
                type: 'ROOM'
            }
        })
    })

    it('should add a new permanent in the middle of the tree', () => {
        expect(neighborhoods(testTree, {
            type: NEIGHBORHOOD_MERGE,
            permanentData: [{
                ancestry: '123:234:543',
                parentId: '234',
                name: 'Closet',
                permanentId: '543',
                type: 'ROOM'
            }]
        })).toEqual({
            ...testTree,
            '123': {
                ...testTree['123'],
                children: {
                    ...testTree['123'].children,
                    '234': {
                        ...testTree['123'].children['234'],
                        children: {
                            ...testTree['123'].children['234'].children,
                            '543': {
                                ancestry: '123:234:543',
                                parentId: '234',
                                name: 'Closet',
                                permanentId: '543',
                                type: 'ROOM'
                            }
                        }
                    }
                }
            }
        })
    })

})
