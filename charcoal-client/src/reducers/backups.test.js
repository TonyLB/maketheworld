import backups from './backups.js'
import { RECEIVE_BACKUP_CHANGES } from '../actions/backups.js'

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
        expect(backups(testState, { type: RECEIVE_BACKUP_CHANGES, backupChanges: [] })).toEqual(testState)
    })

    it('should add a new backup', () => {
        expect(backups(testState, {
            type: RECEIVE_BACKUP_CHANGES,
            backupChanges: [{
                PermanentId: 'TESTTWO',
                Name: 'Second test backup',
                Description: 'Do it again!',
                Status: 'Creating...'
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
            type: RECEIVE_BACKUP_CHANGES,
            backupChanges: [{
                PermanentId: 'TEST',
                Name: 'Test One',
                Status: 'Completed.'
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
