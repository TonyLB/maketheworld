import { getNeighborhoodUpdateValidator, getRoomUpdateValidator } from './validators'

const createTestStateWithGrants = (Grants) => ({
    permanentHeaders: {
        RootRoom: {
            PermanentId: 'RootRoom',
            Ancestry: 'RootRoom',
            Type: 'ROOM',
            Exits: [{
                RoomId: 'BlueRoom',
                Name: 'blue'
            },
            {
                RoomId: 'GreenRoom',
                Name: 'green'
            }],
            Entries: [{
                RoomId: 'BlueRoom',
                Name: 'root'
            },
            {
                RoomId: 'GreenRoom',
                Name: 'root'
            }]
        },
        AlternateRoom: {
            PermanentId: 'AlternateRoom',
            Ancestry: 'AlternateRoom',
            Type: 'ROOM'
        },
        NeighborhoodAlpha: {
            PermanentId: 'NeighborhoodAlpha',
            Ancestry: 'NeighborhoodAlpha',
            Name: 'Alpha',
            Type: 'NEIGHBORHOOD',
            Topology: 'Dead-End'
        },
        BlueRoom: {
            PermanentId: 'BlueRoom',
            ParentId: 'NeighborhoodAlpha',
            Ancestry: 'NeighborhoodAlpha:BlueRoom',
            Type: 'ROOM',
            Exits: [{
                RoomId: 'GoldRoom',
                Name: 'gold'
            },
            {
                RoomId: 'RootRoom',
                Name: 'root'
            },
            {
                RoomId: 'GreenRoom',
                Name: 'green'
            }],
            Entries: [{
                RoomId: 'GoldRoom',
                Name: 'blue'
            },
            {
                RoomId: 'RootRoom',
                Name: 'blue'
            },
            {
                RoomId: 'GreenRoom',
                Name: 'blue'
            }]
        },
        SubNeighborhoodAlphaOne: {
            PermanentId: 'SubNeighborhoodAlphaOne',
            ParentId: 'NeighborhoodAlpha',
            Ancestry: 'NeighborhoodAlpha:SubNeighborhoodAlphaOne',
            Topology: 'Connected'
        },
        GreenRoom: {
            PermanentId: 'GreenRoom',
            ParentId: 'SubNeighborhoodAlphaOne',
            Ancestry: 'NeighborhoodAlpha:SubNeighborhoodAlphaOne:GreenRoom',
            Type: 'ROOM',
            Exits: [{
                RoomId: 'BlueRoom',
                Name: 'blue'
            },
            {
                RoomId: 'RootRoom',
                Name: 'root'
            }],
            Entries: [{
                RoomId: 'BlueRoom',
                Name: 'green'
            },
            {
                RoomId: 'RootRoom',
                Name: 'green'
            }]
        },
        SubNeighborhoodAlphaTwo: {
            PermanentId: 'SubNeighborhoodAlphaTwo',
            ParentId: 'NeighborhoodAlpha',
            Ancestry: 'NeighborhoodAlpha:SubNeighborhoodAlphaTwo',
            Name: 'Alpha Two',
            Type: 'NEIGHBORHOOD',
            Topology: 'Dead-End'
        },
        GoldRoom: {
            PermanentId: 'GoldRoom',
            ParentId: 'SubNeighborhoodAlphaTwo',
            Ancestry: 'NeighborhoodAlpha:SubNeighborhoodAlphaTwo:GoldRoom',
            Type: 'ROOM',
            Exits: [{
                RoomId: 'BlueRoom',
                Name: 'blue'
            }],
            Entries: [{
                RoomId: 'BlueRoom',
                Name: 'gold'
            }]
        },
        SubNeighborhoodAlphaThree: {
            PermanentId: 'SubNeighborhoodAlphaThree',
            ParentId: 'NeighborhoodAlpha',
            Ancestry: 'NeighborhoodAlpha:SubNeighborhoodAlphaThree',
            Name: 'Alpha Three',
            Type: 'NEIGHBORHOOD',
            Topology: 'Dead-End'
        },
        PlumRoom: {
            PermanentId: 'PlumRoom',
            ParentId: 'SubNeighborhoodAlphaThree',
            Ancestry: 'NeighborhoodAlpha:SubNeighborhoodAlphaThree:PlumRoom',
            Type: 'ROOM',
            Exits: [{
                RoomId: 'RootRoom',
                Name: 'root'
            }],
            Entries: [{
                RoomId: 'RootRoom',
                Name: 'plum'
            }]
        },
        NeighborhoodBeta: {
            PermanentId: 'NeighborhoodBeta',
            Ancestry: 'NeighborhoodBeta',
            Name: 'Beta',
            Type: 'NEIGHBORHOOD',
            Topology: 'Dead-End'
        },
        EcruRoom: {
            PermanentId: 'EcruRoom',
            ParentId: 'NeighborhoodBeta',
            Ancestry: 'NeighborhoodBeta:EcruRoom',
            Type: 'ROOM',
            Exits: [{
                RoomId: 'RootRoom',
                Name: 'root'
            }],
            Entries: [{
                RoomId: 'RootRoom',
                Name: 'ecru'
            }]
        },
        NeighborhoodGamma: {
            PermanentId: 'NeighborhoodGamma',
            Ancestry: 'NeighborhoodGamma',
            Name: 'Gamma',
            Type: 'NEIGHBORHOOD',
            Topology: 'Dead-End'
        },
        TaupeRoom: {
            PermanentId: 'TaupeRoom',
            ParentId: 'NeighborhoodGamma',
            Ancestry: 'NeighborhoodGamma:TaupeRoom',
            Type: 'ROOM',
            Exits: [{
                RoomId: 'AlternateRoom',
                Name: 'alternate'
            }],
            Entries: [{
                RoomId: 'AlternateRoom',
                Name: 'taupe'
            }]
        },
        NeighborhoodDelta: {
            PermanentId: 'NeighborhoodDelta',
            Ancestry: 'NeighborhoodDelta',
            Name: 'Delta',
            Type: 'NEIGHBORHOOD',
            Topology: 'Connected'
        }
    },
    myCharacters: {
        data: [
            {
                CharacterId: 'Valentina',
                Grants
            }
        ]
    },
    connection: {
        characterId: 'Valentina'
    },
    role: {
        EDITOR: {
            Actions: 'View,Edit,Moderate,ExtendPrivate,ExtendPublic,ExtendConnected'
        },
        PLAYER: {
            Actions: 'ExtendPrivate'
        }
    }
})

describe('getNeighborhoodUpdateValidator selector', () => {

    it('should allow a moderator to make a Dead-end sub-neighborhood Connected', () => {
        const testState = createTestStateWithGrants([{
            Resource: 'NeighborhoodAlpha',
            Roles: 'EDITOR'
        }])
        expect(getNeighborhoodUpdateValidator(testState)({
            PermanentId: 'SubNeighborhoodAlphaTwo',
            Topology: 'Connected'
        })).toEqual({ valid: true })
    })

    it('should deny a non-permitted character making a Dead-end neighborhood Connected', () => {
        const testState = createTestStateWithGrants([{
            Resource: 'SubNeighborhoodAlphaTwo',
            Roles: 'EDITOR'
        }])
        expect(getNeighborhoodUpdateValidator(testState)({
            PermanentId: 'SubNeighborhoodAlphaTwo',
            Topology: 'Connected'
        })).toEqual({
            valid: false,
            error: 'You do not have permission to make a connected neighborhood within Alpha'
        })
    })

    it('should deny a non-permitted character altering a sub-neighborhood', () => {
        const testState = createTestStateWithGrants([{
            Resource: 'NeighborhoodAlpha',
            Actions: 'ExtendPrivate,ExtendPublic,ExtendConnected'
        }])
        expect(getNeighborhoodUpdateValidator(testState)({
            PermanentId: 'SubNeighborhoodAlphaTwo',
            Topology: 'Connected'
        })).toEqual({
            valid: false,
            error: 'You do not have permission to moderate neighborhood Alpha Two'
        })
    })

    it('should deny a non-permitted character making a sub-neighborhood Public', () => {
        const testState = createTestStateWithGrants([{
            Resource: 'NeighborhoodAlpha',
            Actions: 'ExtendPrivate,ExtendConnected'
        },
        {
            Resource: 'SubNeighborhoodAlphaTwo',
            Roles: 'EDITOR'
        }])
        expect(getNeighborhoodUpdateValidator(testState)({
            PermanentId: 'SubNeighborhoodAlphaTwo',
            Visibility: 'Public'
        })).toEqual({
            valid: false,
            error: 'You do not have permission to make a public neighborhood within Alpha'
        })
    })

    it('should deny any character setting a neighborhood with multiple external exits Dead-End', () => {
        const testState = createTestStateWithGrants([{
            Resource: 'NeighborhoodAlpha',
            Actions: 'ExtendPublic,ExtendPrivate,ExtendConnected'
        },
        {
            Resource: 'SubNeighborhoodAlphaOne',
            Roles: 'EDITOR'
        }])
        expect(getNeighborhoodUpdateValidator(testState)({
            PermanentId: 'SubNeighborhoodAlphaOne',
            Topology: 'Dead-End'
        })).toEqual({
            valid: false,
            error: 'You may not set a neighborhood Dead-End when it has external exits to multiple rooms'
        })
    })

    it('should allow setting a neighborhood with a single external exit Dead-End', () => {
        const testState = createTestStateWithGrants([{
            Resource: 'NeighborhoodAlpha',
            Roles: 'EDITOR'
        }])
        expect(getNeighborhoodUpdateValidator({
            ...testState,
            permanentHeaders: {
                ...testState.permanentHeaders,
                NeighborhoodAlpha: {
                    ...testState.permanentHeaders.NeighborhoodAlpha,
                    Topology: 'Connected'
                }
            }
        })({
            PermanentId: 'NeighborhoodAlpha',
            Topology: 'Dead-End'
        })).toEqual({
            valid: true
        })
    })

    it('should allow reparenting a neighborhood when character does not have Moderate permission', () => {
        const testState = createTestStateWithGrants([{
            Resource: 'NeighborhoodBeta',
            Roles: 'PLAYER'
        },
        {
            Resource: 'SubNeighborhoodAlphaThree',
            Roles: 'PLAYER'
        }])
        expect(getNeighborhoodUpdateValidator(testState)({
            PermanentId: 'SubNeighborhoodAlphaThree',
            ParentId: 'NeighborhoodBeta'
        })).toEqual({
            valid: false,
            error: 'You do not have permission to reparent Alpha Three'
        })
    })

    it('should allow reparenting a neighborhood when that would not generate a broken state', () => {
        const testState = createTestStateWithGrants([{
            Resource: 'NeighborhoodBeta',
            Roles: 'PLAYER'
        },
        {
            Resource: 'SubNeighborhoodAlphaThree',
            Roles: 'EDITOR'
        }])
        expect(getNeighborhoodUpdateValidator(testState)({
            PermanentId: 'SubNeighborhoodAlphaThree',
            ParentId: 'NeighborhoodBeta'
        })).toEqual({
            valid: true
        })
    })

    it('should prevent reparenting a neighborhood when the receiving neighborhood would have too many exits', () => {
        const testState = createTestStateWithGrants([{
            Resource: 'NeighborhoodGamma',
            Roles: 'PLAYER'
        },
        {
            Resource: 'SubNeighborhoodAlphaTwo',
            Roles: 'EDITOR'
        }])
        expect(getNeighborhoodUpdateValidator(testState)({
            PermanentId: 'SubNeighborhoodAlphaTwo',
            ParentId: 'NeighborhoodGamma'
        })).toEqual({
            valid: false,
            error: "Reparenting this way would make too many external paths on Gamma"
        })
    })

    it('should prevent reparenting a neighborhood when one of its connected neighborhood would then have too many exits', () => {
        const testState = createTestStateWithGrants([{
            Resource: 'NeighborhoodDelta',
            Roles: 'PLAYER'
        },
        {
            Resource: 'SubNeighborhoodAlphaOne',
            Roles: 'EDITOR'
        }])
        expect(getNeighborhoodUpdateValidator(testState)({
            PermanentId: 'SubNeighborhoodAlphaOne',
            ParentId: 'NeighborhoodDelta'
        })).toEqual({
            valid: false,
            error: "Reparenting this way would make too many external paths on Alpha"
        })
    })

})

describe('getRoomUpdateValidator selector', () => {

    it('should prevent making a new exit that exceeds Dead-End restrictions', () => {
        const testState = createTestStateWithGrants([{
            Resource: 'SubNeighborhoodAlphaOne',
            Roles: 'EDITOR'
        }])
        expect(getRoomUpdateValidator(testState)({
            PermanentId: 'GreenRoom',
            ParentId: 'SubNeighborhoodAlphaOne',
            Exits: [{
                RoomId: 'BlueRoom',
                Name: 'blue'
            },
            {
                RoomId: 'RootRoom',
                Name: 'root'
            },
            {
                RoomId: 'AlternateRoom',
                Name: 'alternate'
            }],
            Entries: [{
                RoomId: 'BlueRoom',
                Name: 'green'
            },
            {
                RoomId: 'RootRoom',
                Name: 'green'
            }]
        })).toEqual({
            valid: false,
            error: 'Editing this way would make too many external paths on Alpha'
        })
    })

    it('should prevent making a new entry that exceeds Dead-End restrictions', () => {
        const testState = createTestStateWithGrants([{
            Resource: 'SubNeighborhoodAlphaOne',
            Roles: 'EDITOR'
        }])
        expect(getRoomUpdateValidator(testState)({
            PermanentId: 'GreenRoom',
            ParentId: 'SubNeighborhoodAlphaOne',
            Exits: [{
                RoomId: 'BlueRoom',
                Name: 'blue'
            },
            {
                RoomId: 'RootRoom',
                Name: 'root'
            }],
            Entries: [{
                RoomId: 'BlueRoom',
                Name: 'green'
            },
            {
                RoomId: 'RootRoom',
                Name: 'green'
            },
            {
                RoomId: 'AlternateRoom',
                Name: 'green'
            }]
        })).toEqual({
            valid: false,
            error: 'Editing this way would make too many external paths on Alpha'
        })
    })

    it('should prevent switching one exit for another in a way that violates Dead-End restrictions', () => {
        const testState = createTestStateWithGrants([{
            Resource: 'SubNeighborhoodAlphaOne',
            Roles: 'EDITOR'
        }])
        expect(getRoomUpdateValidator(testState)({
            PermanentId: 'GreenRoom',
            ParentId: 'SubNeighborhoodAlphaOne',
            Exits: [{
                RoomId: 'BlueRoom',
                Name: 'blue'
            },
            {
                RoomId: 'AlternateRoom',
                Name: 'alternate'
            }],
            Entries: [{
                RoomId: 'BlueRoom',
                Name: 'green'
            },
            {
                RoomId: 'AlternateRoom',
                Name: 'green'
            }]
        })).toEqual({
            valid: false,
            error: 'Editing this way would make too many external paths on Alpha'
        })
    })

    it('should allow switching one exit for another in a way that preserves Dead-End restrictions', () => {
        const testState = createTestStateWithGrants([{
            Resource: 'SubNeighborhoodAlphaTwo',
            Roles: 'EDITOR'
        }])
        expect(getRoomUpdateValidator(testState)({
            PermanentId: 'GoldRoom',
            ParentId: 'SubNeighborhoodAlphaTwo',
            Exits: [{
                RoomId: 'GreenRoom',
                Name: 'green'
            }],
            Entries: [{
                RoomId: 'GreenRoom',
                Name: 'gold'
            }]
        })).toEqual({
            valid: true
        })
    })

    it('should prevent reparenting a room in a way that violates Dead-End restrictions on the destination', () => {
        const testState = createTestStateWithGrants([{
            Resource: 'SubNeighborhoodAlphaOne',
            Roles: 'EDITOR'
        },
        {
            Resource: 'NeighborhoodBeta',
            Roles: 'EDITOR'
        }])
        expect(getRoomUpdateValidator(testState)({
            PermanentId: 'GreenRoom',
            ParentId: 'NeighborhoodBeta'
        })).toEqual({
            valid: false,
            error: 'Editing this way would make too many external paths on Beta'
        })
    })

    it('should prevent reparenting a room in a way that violates Dead-End restrictions on the source', () => {
        const testState = createTestStateWithGrants([{
            Resource: 'SubNeighborhoodAlphaOne',
            Roles: 'EDITOR'
        },
        {
            Resource: 'NeighborhoodDelta',
            Roles: 'EDITOR'
        }])
        expect(getRoomUpdateValidator(testState)({
            PermanentId: 'GreenRoom',
            ParentId: 'NeighborhoodDelta'
        })).toEqual({
            valid: false,
            error: 'Editing this way would make too many external paths on Alpha'
        })
    })

    it('should prevent reparenting a room to a neighborhood you cannot edit', () => {
        const testState = createTestStateWithGrants([{
            Resource: 'ROOT',
            Roles: 'EDITOR'
        }])
        expect(getRoomUpdateValidator(testState)({
            PermanentId: 'AlternateRoom',
            ParentId: 'NeighborhoodDelta'
        })).toEqual({
            valid: false,
            error: 'You do not have permission to reparent rooms to Delta'
        })
    })

    it('should allow reparenting a room to a neighborhood you can edit', () => {
        const testState = createTestStateWithGrants([{
            Resource: 'ROOT',
            Roles: 'EDITOR'
        },
        {
            Resource: 'NeighborhoodDelta',
            Roles: 'EDITOR'
        }])
        expect(getRoomUpdateValidator(testState)({
            PermanentId: 'AlternateRoom',
            ParentId: 'NeighborhoodDelta'
        })).toEqual({
            valid: true
        })
    })

})
