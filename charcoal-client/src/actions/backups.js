import { API, graphqlOperation } from 'aws-amplify'
import { getBackups } from '../graphql/queries'
import { createBackup as createBackupQL, restoreBackup as restoreBackupQL } from '../graphql/mutations'
import { STORAGE_API_URI } from '../config.js'

export const RECEIVE_BACKUP_CHANGES = 'RECEIVE_BACKUP_CHANGES'

export const receiveBackupChanges = (backupChanges) => ({
    type: RECEIVE_BACKUP_CHANGES,
    backupChanges
})

export const fetchBackups = (dispatch) => {
    return API.graphql(graphqlOperation(getBackups))
        .then(({ data }) => (data || {}))
        .then(({ getBackups }) => (getBackups || []))
        .then((backupChanges) => (dispatch(receiveBackupChanges(backupChanges))))
}

export const createBackup = ({ Name, Description }) => (dispatch) => {
    return API.graphql(graphqlOperation(createBackupQL, { Name, Description }))
}

export const restoreBackup = ({ PermanentId }) => (dispatch) => {
    return API.graphql(graphqlOperation(restoreBackupQL, { PermanentId }))
}

export const uploadBackup = (file) => (dispatch) => {
    let fileReader = new FileReader()
    fileReader.onload = () => {
        return fetch(`${STORAGE_API_URI}/backups?`, {
            method: 'POST',
            mode: 'cors',
            cache: 'no-cache',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: fileReader.result
        })
    }
    fileReader.readAsText(file)
}

