import { EphemeraClientMessage } from "@tonylb/mtw-interfaces/dist/ephemera"
import { apiClient as rawAPIClient } from "@tonylb/mtw-utilities/dist/apiManagement/apiManagementClient"

export const apiClient = {
    send: (ConnectionId: string | undefined, message: EphemeraClientMessage) => (
        ConnectionId
            ? rawAPIClient.send({
                ConnectionId,
                Data: JSON.stringify(message)
            })
            : Promise.resolve()
    )
}
