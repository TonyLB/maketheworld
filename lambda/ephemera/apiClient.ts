import { EphemeraClientMessage } from "@tonylb/mtw-interfaces/ts/ephemera"
import { apiClient as rawAPIClient } from "@tonylb/mtw-utilities/dist/apiManagement/apiManagementClient"
import messageBus from "./messageBus"

export const apiClient = {
    send: async (ConnectionId: string | undefined, message: EphemeraClientMessage) => {
        if (ConnectionId) {
            try {
                await rawAPIClient.send({
                    ConnectionId,
                    Data: JSON.stringify(message)
                })
            }
            catch (err: any) {
                if (err.name === 'GoneException' || err.name === 'BadRequestException') {
                    messageBus.send({
                        type: 'Disconnect',
                        connectionId: ConnectionId
                    })
                }
                else {
                    throw err
                }
            }
        }
    }
}
