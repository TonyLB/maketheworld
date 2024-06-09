import { EphemeraClientMessage } from "@tonylb/mtw-interfaces/ts/ephemera"
import { apiClient as rawAPIClient } from "@tonylb/mtw-utilities/ts/apiManagement/apiManagementClient"
import { connectionDB } from "@tonylb/mtw-utilities/ts/dynamoDB"

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
                    await connectionDB.deleteItem({
                        ConnectionId,
                        DataCategory: 'Meta::Connection'
                    })
                }
                else {
                    throw err
                }
            }
        }
    }
}
