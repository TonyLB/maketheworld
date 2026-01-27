import { ApiGatewayManagementApiClient, PostToConnectionCommand, GetConnectionCommand } from '@aws-sdk/client-apigatewaymanagementapi'

let localApiClient: ApiGatewayManagementApiClient | undefined

const apiInitialize = () => {
    localApiClient = new ApiGatewayManagementApiClient({
        apiVersion: '2018-11-29',
        endpoint: process.env.WEBSOCKET_API
    })
}

export const apiClient = {
    send: async (message: any) => {
        if (!localApiClient) {
            apiInitialize()
        }
        if (localApiClient) {
            await localApiClient.send(new PostToConnectionCommand(message))
        }
    },
    /**
     * Check if a connection exists and is ready to receive messages
     * Returns true if connection exists, false if it doesn't (GoneException)
     */
    checkConnection: async (connectionId: string): Promise<boolean> => {
        if (!localApiClient) {
            apiInitialize()
        }
        if (localApiClient) {
            try {
                await localApiClient.send(new GetConnectionCommand({ ConnectionId: connectionId }))
                return true
            } catch (error: any) {
                if (error.name === 'GoneException' || error.name === 'BadRequestException') {
                    return false
                }
                throw error
            }
        }
        return false
    }
}