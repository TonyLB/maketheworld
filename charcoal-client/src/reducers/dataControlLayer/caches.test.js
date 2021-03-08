import { DCL_FSM_INITIAL, DCL_FSM_SYNCHRONIZNG, DCL_FSM_SYNCHRONIZED } from '../../actions/dataControlLayer'
import caches from './caches'

describe('dataControlLayer/caches reducer', () => {
    const testState = {
        permanents: {
            status: DCL_FSM_SYNCHRONIZED
        },
        ephemera: {
            status: DCL_FSM_SYNCHRONIZNG
        },
        messages: {
            status: DCL_FSM_INITIAL
        }
    }
    it('should return default', () => {
        expect(caches()).toEqual({
            permanents: {
                status: DCL_FSM_INITIAL
            },
            ephemera: {
                status: DCL_FSM_INITIAL
            },
            messages: {
                status: DCL_FSM_INITIAL
            }
        })
    })
    it('should not change state on no-op', () => {
        expect(caches(testState, { type: 'NO-OP' })).toEqual(testState)
    })
    test.todo('should update status on a root-level SYNC_ATTEMPT action')
    test.todo('should update status and last-synced on a root-level SYNC_SUCCESS action')
    test.todo('should update status on a root-level SYNC_ERROR action')
    describe('message context', () => {
        test.todo('should update status on a SYNC_ATTEMPT action')
        test.todo('should update status and last-synced on a SYNC_SUCCESS action')
        test.todo('should update status on a SYNC_ERROR action')
    })
})