import { getNeighborhoodSubtree, getExternalTree, getByAncestry } from './neighborhoods'

const testTree = {
    neighborhoods: {
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
}

describe('getNeighborhoodSubtree selector' , () => {

    test('returns tree except room on root room', () => {
        expect(getNeighborhoodSubtree({ roomId: 'VORTEX', ancestry: 'VORTEX' })(testTree)).toEqual({
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
        })
    })

    test('returns subtree', () => {
        expect(getNeighborhoodSubtree({ roomId: '567', ancestry: '123:567' })(testTree)).toEqual({
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
            }
        })
    })

})

describe('getExternalTree selector' , () => {

    test('returns nothing root room', () => {
        expect(getExternalTree({ roomId: 'VORTEX', ancestry: 'VORTEX' })(testTree)).toEqual({})
    })

    test('excludes subtree', () => {
        expect(getExternalTree({ roomId: '456', ancestry: '123:234:456' })(testTree)).toEqual({
            VORTEX: {
                ancestry: 'VORTEX',
                name: 'The Vortex',
                permanentId: 'VORTEX',
                type: 'ROOM'
            },
            '123': {
                permanentId: '123',
                children: {
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
        })
    })

    test('excludes  toplevel subtree', () => {
        expect(getExternalTree({ roomId: '567', ancestry: '123:567' })(testTree)).toEqual({
            VORTEX: {
                ancestry: 'VORTEX',
                name: 'The Vortex',
                permanentId: 'VORTEX',
                type: 'ROOM'
            }
        })
    })

})

describe('getByAncestry selector' , () => {

    test('returns root room', () => {
        expect(getByAncestry('VORTEX')(testTree)).toEqual({
            ancestry: 'VORTEX',
            name: 'The Vortex',
            permanentId: 'VORTEX',
            type: 'ROOM'
        })
    })

})
