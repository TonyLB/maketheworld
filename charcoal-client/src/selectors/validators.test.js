import { getNeighborhoodUpdateValidator, getRoomUpdateValidator } from './validators'

const testState = {
    exits: [
        {
            FromRoomId: 'RootRoom',
            ToRoomId: 'BlueRoom',
            Name: 'blue'
        },
        {
            FromRoomId: 'BlueRoom',
            ToRoomId: 'RootRoom',
            Name: 'root'
        },
        {
            FromRoomId: 'RootRoom',
            ToRoomId: 'GreenRoom',
            Name: 'green'
        },
        {
            FromRoomId: 'GreenRoom',
            ToRoomId: 'RootRoom',
            Name: 'root'
        },
        {
            FromRoomId: 'BlueRoom',
            ToRoomId: 'GreenRoom',
            Name: 'green'
        },
        {
            FromRoomId: 'GreenRoom',
            ToRoomId: 'BlueRoom',
            Name: 'blue'
        },
        {
            FromRoomId: 'BlueRoom',
            ToRoomId: 'GoldRoom',
            Name: 'gold'
        },
        {
            FromRoomId: 'GoldRoom',
            ToRoomId: 'BlueRoom',
            Name: 'blue'
        },
        {
            FromRoomId: 'PlumRoom',
            ToRoomId: 'RootRoom',
            Name: 'root'
        },
        {
            FromRoomId: 'RootRoom',
            ToRoomId: 'PlumRoom',
            Name: 'plum'
        },
        {
            FromRoomId: 'EcruRoom',
            ToRoomId: 'RootRoom',
            Name: 'root'
        },
        {
            FromRoomId: 'RootRoom',
            ToRoomId: 'EcruRoom',
            Name: 'ecru'
        },
        {
            FromRoomId: 'AlternateRoom',
            ToRoomId: 'TaupeRoom',
            Name: 'taupe'
        },
        {
            FromRoomId: 'TaupeRoom',
            ToRoomId: 'AlternateRoom',
            Name: 'alternate'
        }
    ],
    permanentHeaders: {
        RootRoom: {
            PermanentId: 'RootRoom',
            Ancestry: 'RootRoom',
            Type: 'ROOM'
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
            Type: 'ROOM'
        },
        SubNeighborhoodAlphaOne: {
            PermanentId: 'SubNeighborhoodAlphaOne',
            ParentId: 'NeighborhoodAlpha',
            Name: 'Alpha',
            Ancestry: 'NeighborhoodAlpha:SubNeighborhoodAlphaOne',
            Topology: 'Connected'
        },
        GreenRoom: {
            PermanentId: 'GreenRoom',
            ParentId: 'SubNeighborhoodAlphaOne',
            Ancestry: 'NeighborhoodAlpha:SubNeighborhoodAlphaOne:GreenRoom',
            Type: 'ROOM'
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
            Type: 'ROOM'
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
            Type: 'ROOM'
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
            Type: 'ROOM'
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
            Type: 'ROOM'
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
            }
        ]
    },
    connection: {
        characterId: 'Valentina'
    },
    role: {
        EDITOR: {
            Actions: 'View,Edit,ExtendPrivate,ExtendPublic,ExtendConnected'
        },
        MODERATOR: {
            Actions: 'View,Edit,Moderate,ExtendPrivate,ExtendPublic,ExtendConnected'
        },
        PLAYER: {
            Actions: 'ExtendPrivate'
        }
    }
}

describe('getNeighborhoodUpdateValidator selector', () => {

    it('should forbit a player from making a new private sub-neighborhood without permission', () => {
        expect(getNeighborhoodUpdateValidator(testState)({
            ParentId: 'NeighborhoodAlpha',
            Visibility: 'Private',
            Topology: 'Dead-End'
        })).toEqual({
            valid: false,
            error: 'You do not have permission to make a private neighborhood within Alpha'
        })
    })

    it('should allow a player to make a new Dead-end private sub-neighborhood with permission', () => {
        expect(getNeighborhoodUpdateValidator({ ...testState, grants: { 'Valentina': [{ CharacterId: 'Valentina', Resource: 'NeighborhoodAlpha', Roles: 'PLAYER' }]}})({
            ParentId: 'NeighborhoodAlpha',
            Visibility: 'Private',
            Topology: 'Dead-End'
        })).toEqual({
            valid: true
        })
    })

    it('should forbid a player from making a new public sub-neighborhood without permission', () => {
        expect(getNeighborhoodUpdateValidator({ ...testState, grants: { 'Valentina': [{ CharacterId: 'Valentina', Resource: 'NeighborhoodAlpha', Roles: 'PLAYER' }]}})({
            ParentId: 'NeighborhoodAlpha',
            Visibility: 'Public',
            Topology: 'Dead-End'
        })).toEqual({
            valid: false,
            error: 'You do not have permission to make a public neighborhood within Alpha'
        })
    })

    it('should allow a player to make a new Dead-end private sub-neighborhood with permission', () => {
        expect(getNeighborhoodUpdateValidator({ ...testState, grants: { 'Valentina': [{ CharacterId: 'Valentina', Resource: 'NeighborhoodAlpha', Actions: 'ExtendPublic' }]}})({
            ParentId: 'NeighborhoodAlpha',
            Visibility: 'Public',
            Topology: 'Dead-End'
        })).toEqual({
            valid: true
        })
    })

    it('should allow a moderator to make a Dead-end sub-neighborhood Connected', () => {
        expect(getNeighborhoodUpdateValidator({ ...testState, grants: { 'Valentina': [{ CharacterId: 'Valentina', Resource: 'NeighborhoodAlpha', Roles: 'MODERATOR' }]}})({
            PermanentId: 'SubNeighborhoodAlphaTwo',
            Topology: 'Connected'
        })).toEqual({ valid: true })
    })

    it('should deny a non-permitted character making a Dead-end neighborhood Connected', () => {
        expect(getNeighborhoodUpdateValidator({ ...testState, grants: { 'Valentina': [{ CharacterId: 'Valentina', Resource: 'SubNeighborhoodAlphaTwo', Roles: 'EDITOR' }]}})({
            PermanentId: 'SubNeighborhoodAlphaTwo',
            Topology: 'Connected'
        })).toEqual({
            valid: false,
            error: 'You do not have permission to make a connected neighborhood within Alpha'
        })
    })

    it('should deny a non-permitted character altering a sub-neighborhood', () => {
        expect(getNeighborhoodUpdateValidator({ ...testState, grants: { 'Valentina': [{ CharacterId: 'Valentina', Resource: 'NeighborhoodAlpha', Actions: 'ExtendPrivate,ExtendPublic,ExtendConnected' }]}})({
            PermanentId: 'SubNeighborhoodAlphaTwo',
            Topology: 'Connected'
        })).toEqual({
            valid: false,
            error: 'You do not have permission to moderate neighborhood Alpha Two'
        })
    })

    it('should deny a non-permitted character making a sub-neighborhood Public', () => {
        expect(getNeighborhoodUpdateValidator({
            ...testState,
            grants: {
                Valentina: [
                    {
                        CharacterId: 'Valentina',
                        Resource: 'NeighborhoodAlpha',
                        Actions: 'ExtendPrivate,ExtendConnected'
                    },
                    {
                        CharacterId: 'Valentina',
                        Resource: 'SubNeighborhoodAlphaTwo',
                        Roles: 'EDITOR'
                    }
                ]
        }})({
            PermanentId: 'SubNeighborhoodAlphaTwo',
            Visibility: 'Public'
        })).toEqual({
            valid: false,
            error: 'You do not have permission to make a public neighborhood within Alpha'
        })
    })

    it('should deny any character setting a neighborhood with multiple external exits Dead-End', () => {
        expect(getNeighborhoodUpdateValidator({
            ...testState,
            grants: {
                Valentina: [
                    {
                        CharacterId: 'Valentina',
                        Resource: 'NeighborhoodAlpha',
                        Actions: 'ExtendPublic,ExtendPrivate,ExtendConnected'
                    },
                    {
                        CharacterId: 'Valentina',
                        Resource: 'SubNeighborhoodAlphaOne',
                        Roles: 'EDITOR'
                    }
                ]
        }})({
            PermanentId: 'SubNeighborhoodAlphaOne',
            Topology: 'Dead-End'
        })).toEqual({
            valid: false,
            error: 'You may not set a neighborhood Dead-End when it has external exits to multiple rooms'
        })
    })

    it('should allow setting a neighborhood with a single external exit Dead-End', () => {
        expect(getNeighborhoodUpdateValidator({
            ...testState,
            grants: {
                Valentina: [
                    {
                        CharacterId: 'Valentina',
                        Resource: 'NeighborhoodAlpha',
                        Roles: 'EDITOR'
                    }
                ]
            },
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
        expect(getNeighborhoodUpdateValidator({
            ...testState,
            grants: {
                Valentina: [
                    {
                        CharacterId: 'Valentina',
                        Resource: 'NeighborhoodBeta',
                        Roles: 'PLAYER'
                    },
                    {
                        CharacterId: 'Valentina',
                        Resource: 'SubNeighborhoodAlphaThree',
                        Roles: 'PLAYER'
                    }
                ]
        }})({
            PermanentId: 'SubNeighborhoodAlphaThree',
            ParentId: 'NeighborhoodBeta'
        })).toEqual({
            valid: false,
            error: 'You do not have permission to reparent Alpha Three'
        })
    })

    it('should allow reparenting a neighborhood when that would not generate a broken state', () => {
        expect(getNeighborhoodUpdateValidator({
            ...testState,
            grants: {
                Valentina: [
                    {
                        CharacterId: 'Valentina',
                        Resource: 'NeighborhoodBeta',
                        Roles: 'PLAYER'
                    },
                    {
                        CharacterId: 'Valentina',
                        Resource: 'SubNeighborhoodAlphaThree',
                        Roles: 'MODERATOR'
                    }
                ]
        }})({
            PermanentId: 'SubNeighborhoodAlphaThree',
            ParentId: 'NeighborhoodBeta'
        })).toEqual({
            valid: true
        })
    })

    it('should prevent reparenting a neighborhood when the receiving neighborhood would have too many exits', () => {
        expect(getNeighborhoodUpdateValidator({
            ...testState,
            grants: {
                Valentina: [
                    {
                        CharacterId: 'Valentina',
                        Resource: 'NeighborhoodGamma',
                        Roles: 'PLAYER'
                    },
                    {
                        CharacterId: 'Valentina',
                        Resource: 'SubNeighborhoodAlphaTwo',
                        Roles: 'MODERATOR'
                    }
                ]
        }})({
            PermanentId: 'SubNeighborhoodAlphaTwo',
            ParentId: 'NeighborhoodGamma'
        })).toEqual({
            valid: false,
            error: "Reparenting this way would make too many external paths on Gamma"
        })
    })

    it('should prevent reparenting a neighborhood when one of its connected neighborhood would then have too many exits', () => {
        expect(getNeighborhoodUpdateValidator({
            ...testState,
            grants: {
                Valentina: [
                    {
                        CharacterId: 'Valentina',
                        Resource: 'NeighborhoodDelta',
                        Roles: 'PLAYER'
                    },
                    {
                        CharacterId: 'Valentina',
                        Resource: 'SubNeighborhoodAlphaOne',
                        Roles: 'MODERATOR'
                    }
                ]
        }})({
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
        expect(getRoomUpdateValidator({
            ...testState,
            grants: {
                Valentina: [
                    {
                        CharacterId: 'Valentina',
                        Resource: 'SubNeighborhoodAlphaOne',
                        Roles: 'EDITOR'
                    }
                ]
        }})({
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
        expect(getRoomUpdateValidator({
            ...testState,
            grants: {
                Valentina: [
                    {
                        CharacterId: 'Valentina',
                        Resource: 'SubNeighborhoodAlphaOne',
                        Roles: 'EDITOR'
                    }
                ]
        }})({
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
        expect(getRoomUpdateValidator({
            ...testState,
            grants: {
                Valentina: [
                    {
                        CharacterId: 'Valentina',
                        Resource: 'SubNeighborhoodAlphaOne',
                        Roles: 'EDITOR'
                    }
                ]
        }})({
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
        expect(getRoomUpdateValidator({
            ...testState,
            grants: {
                Valentina: [
                    {
                        CharacterId: 'Valentina',
                        Resource: 'SubNeighborhoodAlphaTwo',
                        Roles: 'EDITOR'
                    }
                ]
        }})({
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
        expect(getRoomUpdateValidator({
            ...testState,
            grants: {
                Valentina: [
                    {
                        CharacterId: 'Valentina',
                        Resource: 'SubNeighborhoodAlphaOne',
                        Roles: 'EDITOR'
                    },
                    {
                        CharacterId: 'Valentina',
                        Resource: 'NeighborhoodBeta',
                        Roles: 'EDITOR'
                    }
                ]
        }})({
            PermanentId: 'GreenRoom',
            ParentId: 'NeighborhoodBeta'
        })).toEqual({
            valid: false,
            error: 'Editing this way would make too many external paths on Beta'
        })
    })

    it('should prevent reparenting a room in a way that violates Dead-End restrictions on the source', () => {
        expect(getRoomUpdateValidator({
            ...testState,
            grants: {
                Valentina: [
                    {
                        CharacterId: 'Valentina',
                        Resource: 'SubNeighborhoodAlphaOne',
                        Roles: 'EDITOR'
                    },
                    {
                        CharacterId: 'Valentina',
                        Resource: 'NeighborhoodDelta',
                        Roles: 'EDITOR'
                    }
                ]
        }})({
            PermanentId: 'GreenRoom',
            ParentId: 'NeighborhoodDelta'
        })).toEqual({
            valid: false,
            error: 'Editing this way would make too many external paths on Alpha'
        })
    })

    it('should prevent reparenting a room to a neighborhood you cannot edit', () => {
        expect(getRoomUpdateValidator({
            ...testState,
            grants: {
                Valentina: [
                    {
                        CharacterId: 'Valentina',
                        Resource: 'ROOT',
                        Roles: 'EDITOR'
                    }
                ]
        }})({
            PermanentId: 'AlternateRoom',
            ParentId: 'NeighborhoodDelta'
        })).toEqual({
            valid: false,
            error: 'You do not have permission to reparent rooms to Delta'
        })
    })

    it('should allow reparenting a room to a neighborhood you can edit', () => {
        expect(getRoomUpdateValidator({
            ...testState,
            grants: {
                Valentina: [
                    {
                        CharacterId: 'Valentina',
                        Resource: 'ROOT',
                        Roles: 'EDITOR'
                    },
                    {
                        CharacterId: 'Valentina',
                        Resource: 'NeighborhoodDelta',
                        Roles: 'EDITOR'
                    }
                ]
        }})({
            PermanentId: 'AlternateRoom',
            ParentId: 'NeighborhoodDelta'
        })).toEqual({
            valid: true
        })
    })

})
