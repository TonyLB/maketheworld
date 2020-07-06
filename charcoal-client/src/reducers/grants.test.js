import grants from './grants.js'
import { NEIGHBORHOOD_UPDATE } from '../actions/neighborhoods'

const testState = {
    TEST: [
        {
            CharacterId: 'TEST',
            Resource: 'ABC',
            Roles: 'EDITOR',
            Actions: 'View'
        }
    ]
}

describe('Grantss reducer', () => {
    it('should return an empty map by default', () => {
        expect(grants()).toEqual({})
    })

    it('should return unchanged on a different action type', () => {
        expect(grants(testState, { type: 'OTHER' })).toEqual(testState)
    })

    it('should return unchanged on an empty grant', () => {
        expect(grants(testState, { type: NEIGHBORHOOD_UPDATE, data: [] })).toEqual(testState)
    })

    it('should add a new grant to an already-tracked character', () => {
        expect(grants(testState, {
            type: NEIGHBORHOOD_UPDATE,
            data: [{
                Grant: {
                    CharacterId: 'TEST',
                    Resource: 'DEF',
                    Roles: 'MODERATOR'
                }
            }]
        })).toEqual({
            TEST: [
                {
                    CharacterId: 'TEST',
                    Resource: 'ABC',
                    Roles: 'EDITOR',
                    Actions: 'View'
                },
                {
                    CharacterId: 'TEST',
                    Resource: 'DEF',
                    Roles: 'MODERATOR',
                    Actions: ''
                }
            ]
        })
    })

    it('should update a grant on an already-tracked character', () => {
        expect(grants(testState, {
            type: NEIGHBORHOOD_UPDATE,
            data: [{
                Grant: {
                    CharacterId: 'TEST',
                    Resource: 'ABC',
                    Roles: 'MODERATOR'
                }
            }]
        })).toEqual({
            TEST: [
                {
                    CharacterId: 'TEST',
                    Resource: 'ABC',
                    Roles: 'MODERATOR',
                    Actions: ''
                }
            ]
        })
    })

    it('should add a new grant to a non-tracked character', () => {
        expect(grants(testState, {
            type: NEIGHBORHOOD_UPDATE,
            data: [{
                Grant: {
                    CharacterId: 'TESTTWO',
                    Resource: 'DEF',
                    Roles: 'MODERATOR'
                }
            }]
        })).toEqual({
            TEST: [
                {
                    CharacterId: 'TEST',
                    Resource: 'ABC',
                    Roles: 'EDITOR',
                    Actions: 'View'
                }
            ],
            TESTTWO: [
                {
                    CharacterId: 'TESTTWO',
                    Resource: 'DEF',
                    Roles: 'MODERATOR',
                    Actions: ''
                }
            ]
        })
    })

})
