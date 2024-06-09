import { apiClient as apiClientImport } from "@tonylb/mtw-utilities/ts/apiManagement/apiManagementClient"
import { connectionDB } from '@tonylb/mtw-utilities/ts/dynamoDB'

export const apiClient = {
    send: (message: any) => {
        return apiClientImport.send(message)
            .catch(async (err: any) => {
                if (err.name === 'GoneException' || err.name === 'BadRequestException') {
                    await connectionDB.deleteItem({
                        ConnectionId: message.ConnectionId,
                        DataCategory: 'Meta::Connection'
                    })
                }
                else {
                    console.log(`Error: ${err.name}`)
                    throw err
                }
            })
    }
}
