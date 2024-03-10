import { ApiGatewayManagementApiClient, PostToConnectionCommand } from '@aws-sdk/client-apigatewaymanagementapi'

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
    }
}