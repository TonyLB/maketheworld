const { restoreBackup } = require('./admin/restoreBackup')
const { uploadBackup } = require('./admin/uploadBackup')
const { getSettings, putSettings } = require('./admin/adminSettings')
const { getBackups, putBackup, createBackup } = require('./admin/backup')

const { getCharacter } = require('./characters/getCharacter')
const { getPlayerCharacters } = require('./characters/getPlayerCharacters')
const { getAllCharacters } = require('./characters/getAllCharacters')
const { putCharacter } = require('./characters/putCharacter')

const { getMaps, putMap } = require('./maps/map')

const { getNeighborhood, putNeighborhood } = require('./neighborhoods/neighborhood')

const { getNodeTree } = require('./nodeTree/nodeTree')

const { putRoom } = require('./putRoom/putRoom')

const { putGrant } = require('./grants/putGrant')
const { getGrants } = require('./grants/getGrants')
const { revokeGrant } = require('./grants/revokeGrant')

const { getExits } = require('./exits/getExits')
const { putExit } = require('./exits/putExit')
const { deleteExit } = require('./exits/deleteExit')
const { sync } = require('./sync')

const updateDispatcher = ({ Updates = [] }) => {
    const outputs = Updates.map((update) => {
            if (update.putNeighborhood) {
                return putNeighborhood({ arguments: update.putNeighborhood })
            }
            if (update.putMap) {
                return putMap(update.putMap)
            }
            if (update.putSettings) {
                return putSettings(update.putSettings)
            }
            if (update.putBackup) {
                return putBackup(update.putBackup)
            }
            if (update.putRoom) {
                return putRoom({ arguments: update.putRoom })
            }
            if (update.putGrant) {
                return putGrant(update.putGrant)
            }
            if (update.putCharacter) {
                return putCharacter(update.putCharacter)
            }
            if (update.revokeGrant) {
                return revokeGrant(update.revokeGrant)
            }
            if (update.putExit) {
                return putExit(update.putExit)
            }
            if (update.deleteExit) {
                return deleteExit(update.deleteExit)
            }
            return Promise.resolve([])
        }
    )

    return Promise.all(outputs)
        .then((finalOutputs) => finalOutputs.reduce((previous, output) => ([ ...previous, ...output ]), []))
}

exports.handler = (event, context) => {
    const { action, ...payload } = event

    switch(action) {

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

        case "getPlayerCharacters":
            return getPlayerCharacters(payload)

        case "sync":
            return sync(payload)

        case "updatePermanents":
            return updateDispatcher(payload)

        default:
            context.fail(JSON.stringify(`Error: Unknown action: ${action}`))
    }
}
