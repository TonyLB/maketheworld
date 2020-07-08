import backups from './backups.js'
import { NEIGHBORHOOD_UPDATE } from '../actions/neighborhoods'

const testState = {
    TEST: {
        PermanentId: 'TEST',
        Name: 'Test Backup',
        Description: 'This is a test'
    }
}

describe('Backups reducer', () => {
    it('should return an empty map by default', () => {
        expect(backups()).toEqual({})
    })

    it('should return unchanged on a different action type', () => {
        expect(backups(testState, { type: 'OTHER' })).toEqual(testState)
    })

    it('should return unchanged on an empty array', () => {
        expect(backups(testState, { type: NEIGHBORHOOD_UPDATE, data: [] })).toEqual(testState)
    })

    it('should add a new backup', () => {
        expect(backups(testState, {
            type: NEIGHBORHOOD_UPDATE,
            data: [{ Backup:
                {
                    PermanentId: 'TESTTWO',
                    Name: 'Second test backup',
                    Description: 'Do it again!',
                    Status: 'Creating...'
                }
            }]
        })).toEqual({
            TEST: {
                PermanentId: 'TEST',
                Name: 'Test Backup',
                Description: 'This is a test'
            },
            TESTTWO: {
                PermanentId: 'TESTTWO',
                Name: 'Second test backup',
                Description: 'Do it again!',
                Status: 'Creating...'
            }
        })
    })

    it('should update an existing backup', () => {
        expect(backups(testState, {
            type: NEIGHBORHOOD_UPDATE,
            data: [{ Backup:
                {
                    PermanentId: 'TEST',
                    Name: 'Test One',
                    Status: 'Completed.'
                }
            }]
        })).toEqual({
            TEST: {
                PermanentId: 'TEST',
                Name: 'Test One',
                Description: 'This is a test',
                Status: 'Completed.'
            }
        })
    })

})
