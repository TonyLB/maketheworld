import { API, graphqlOperation } from 'aws-amplify'
import { createBackup as createBackupQL, restoreBackup as restoreBackupQL } from '../graphql/mutations'
import { STORAGE_API_URI } from '../config.js'

export const RECEIVE_BACKUP_CHANGES = 'RECEIVE_BACKUP_CHANGES'

export const receiveBackupChanges = (backupChanges) => ({
    type: RECEIVE_BACKUP_CHANGES,
    backupChanges
})

export const createBackup = ({ Name, Description }) => (dispatch) => {
    return API.graphql(graphqlOperation(createBackupQL, { Name, Description }))
}

export const restoreBackup = ({ PermanentId }) => (dispatch) => {
    return API.graphql(graphqlOperation(restoreBackupQL, { PermanentId }))
}

export const uploadBackup = ({ file, onError = () => {} }) => (dispatch) => {
    let fileReader = new FileReader()
    fileReader.onload = () => {
        try {
            let body = {}
            try {
                body = JSON.parse(fileReader.result)
            }
            catch (err) {
                onError(`Parse error: ${err}`)
                return {}
            }
            return fetch(`${STORAGE_API_URI}/backups?`, {
                method: 'POST',
                mode: 'cors',
                cache: 'no-cache',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(body)
            })
            .then((response) => {
                if (response.ok) {
                    return response.json()
                }
                else {
                    return response.json()
                        .then(({ errorMessage }) => { onError(errorMessage) })
                }
            })
        }
        catch (err) {
            onError('Import error, internal (unknown)!')
        }
    }
    fileReader.readAsText(file)
}

