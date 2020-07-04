const { itemReducer } = require('./app')

describe("getNodeTree", () => {

    it('should return empty from an empty scan', () => {
        const data = [].reduce(itemReducer, {})
        expect(data).toEqual({})
    })

    it('should correctly build a flat node structure', () => {
        const data = [
            {
                PermanentId: 'NEIGHBORHOOD#DEF',
                DataCategory: 'Details',
                ParentId: 'ABC',
                Name: 'Neighborhood Two',
                Description: 'Desc Two',
                Visibility: 'Private',
                Topology: 'Dead-End',
                Retired: 'RETIRED'
            },
            {
                PermanentId: 'NEIGHBORHOOD#ABC',
                DataCategory: 'Details',
                Name: 'Neighborhood One',
                Description: 'Desc One',
                Visibility: 'Public',
                Topology: 'Connected'
            },
            {
                PermanentId: 'ROOM#123',
                DataCategory: 'EXIT#456',
                Name: 'two'
            },
            {
                PermanentId: 'ROOM#123',
                DataCategory: 'Details',
                Name: 'Room One',
                Description: 'Room Desc One'
            },
            {
                PermanentId: 'ROOM#456',
                DataCategory: 'ENTRY#123',
                Name: 'two'
            },
            {
                PermanentId: 'ROOM#456',
                DataCategory: 'Details',
                ParentId: 'DEF',
                Name: 'Room Two',
                Description: 'Room Desc Two'
            }
        ].reduce(itemReducer, {})
        expect(data).toEqual({
            DEF: {
                PermanentId: 'DEF',
                Name: 'Neighborhood Two',
                Description: 'Desc Two',
                ParentId: 'ABC',
                Visibility: 'Private',
                Topology: 'Dead-End',
                Retired: true,
                __typename: 'Neighborhood'
            },
            ABC: {
                PermanentId: 'ABC',
                Name: 'Neighborhood One',
                Description: 'Desc One',
                Visibility: 'Public',
                Topology: 'Connected',
                Retired: false,
                __typename: 'Neighborhood'
            },
            '123': {
                PermanentId: '123',
                Name: 'Room One',
                Description: 'Room Desc One',
                Visibility: 'Public',
                Topology: 'Dead-End',
                Retired: false,
                Exits: [
                    {
                        Name: 'two',
                        RoomId: '456'
                    }
                ],
                __typename: 'Room'
            },
            '456': {
                PermanentId: '456',
                ParentId: 'DEF',
                Name: 'Room Two',
                Description: 'Room Desc Two',
                Visibility: 'Public',
                Topology: 'Dead-End',
                Retired: false,
                Entries: [
                    {
                        Name: 'two',
                        RoomId: '123'
                    }
                ],
                __typename: 'Room'
            }

        })
    })

})
