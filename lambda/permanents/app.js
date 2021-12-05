const { putCharacter } = require('./characters/putCharacter')

const updateDispatcher = ({ Updates = [] }) => {
    const outputs = Updates.map((update) => {
            if (update.putCharacter) {
                return putCharacter(update.putCharacter)
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

        case "updatePermanents":
            return updateDispatcher(payload)

        default:
            context.fail(JSON.stringify(`Error: Unknown action: ${action}`))
    }
}
