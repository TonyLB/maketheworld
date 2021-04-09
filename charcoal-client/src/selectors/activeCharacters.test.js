import { getActiveCharacterState, getActiveCharacters } from './activeCharacters'

describe('activeCharacters selectors', () => {
    describe('getActiveCharacterState', () => {
        const testState = {
            stateSeekingMachines: {
                machines: {
                    ['Subscribe::Character::ABC']: { currentState: 'INITIAL' }
                }
            }
        }

        it('should extract state from the object when available', () => {
            expect(getActiveCharacterState('ABC')(testState)).toEqual('INITIAL')
        })

        it('should correct return invalid when object not available', () => {
            expect(getActiveCharacterState('DEF')(testState)).toEqual('INVALID')
        })
    })

    describe('getActiveCharactersUI', () => {
        const testState = {
            stateSeekingMachines: {
                machines: {
                    ['Subscribe::Character::INITIAL']: { currentState: 'INITIAL' },
                    ['Subscribe::Character::SUBSCRIBING']: { currentState: 'SUBSCRIBING' },
                    ['Subscribe::Character::SUBSCRIBED']: { currentState: 'SUBSCRIBED' },
                    ['Subscribe::Character::SYNCHING']: { currentState: 'SYNCHING' },
                    ['Subscribe::Character::SYNCHRONIZED']: { currentState: 'SYNCHRONIZED' },
                    ['Subscribe::Character::REGISTERING']: { currentState: 'REGISTERING' },
                    ['Subscribe::Character::REGISTERED']: { currentState: 'REGISTERED' }
                }
            }
        }

        it('should correctly derive values for all states', () => {
            expect(getActiveCharacters(testState)).toEqual({
                INITIAL: {
                    isConnecting: false,
                    isConnected: false,
                    isSubscribing: false,
                    isSubscribed: false,
                    state: 'INITIAL'
                },
                SUBSCRIBING: {
                    isConnecting: false,
                    isConnected: false,
                    isSubscribing: true,
                    isSubscribed: false,
                    state: 'SUBSCRIBING'
                },
                SUBSCRIBED: {
                    isConnecting: false,
                    isConnected: false,
                    isSubscribing: false,
                    isSubscribed: true,
                    state: 'SUBSCRIBED'
                },
                SYNCHING: {
                    isConnecting: false,
                    isConnected: false,
                    isSubscribing: false,
                    isSubscribed: true,
                    state: 'SYNCHING'
                },
                SYNCHRONIZED: {
                    isConnecting: false,
                    isConnected: false,
                    isSubscribing: false,
                    isSubscribed: true,
                    state: 'SYNCHRONIZED'
                },
                REGISTERING: {
                    isConnecting: true,
                    isConnected: false,
                    isSubscribing: false,
                    isSubscribed: true,
                    state: 'REGISTERING'
                },
                REGISTERED: {
                    isConnecting: false,
                    isConnected: true,
                    isSubscribing: false,
                    isSubscribed: true,
                    state: 'REGISTERED'
                }
            })
        })

    })
})