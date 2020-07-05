const { restoreBackup } = require('./admin/restoreBackup')
const { uploadBackup } = require('./admin/uploadBackup')
const { getSettings, putSettings } = require('./admin/adminSettings')
const { getBackups, putBackup, createBackup } = require('./admin/backup')

exports.handler = (event, context) => {
    const { action, ...payload } = event

    switch(action) {
        case "getBackups":
            return getBackups()
        case "putBackup":
            return putBackup(payload)
        case "createBackup":
            return createBackup(payload)
        case "restoreBackup":
            return restoreBackup(payload)
        case "uploadBackup":
            return uploadBackup(payload, context)
                .then(({ PermanentId }) => {
                    if (!PermanentId) {
                        return {}
                    }
                    return putBackup({ PermanentId, Status: 'Uploaded.'})
                })
                .then(() => ({
                    statusCode: 200,
                    body: JSON.stringify({
                        message: "Upload completed."
                    })
                }))
        case "getSettings":
            return getSettings()
        case "putSettings":
            return putSettings(payload)
        default:
            context.fail(JSON.stringify(`Error: Unknown action: ${action}`))
    }
}
