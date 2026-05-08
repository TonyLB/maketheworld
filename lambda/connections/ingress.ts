import { coreFormatToStreamingEnvelope } from "@tonylb/mtw-lambda-patterns/ts/dataSource"
import { fromEventBridgeFormat } from "@tonylb/mtw-lambda-patterns/ts/dataSource/formatTransform"
import { isEphemeraCharacterId } from "@tonylb/mtw-interfaces/ts/baseClasses"
import messageBus from "./messageBus"
import { ConnectionsAPIPayload, sendApiConnectionsEvent } from "./dataSource/apiConnections"
import { diagnosticsDeserializer } from "./dataSource"
import { isConnectionsSubscribedEnvelope } from "./dataSource/subscribedEvents"
import "./dataSource"

const normalizeApiIngress = (event: any): ConnectionsAPIPayload | undefined => {
    const { connectionId, routeKey, resourcePath } = event.requestContext || {}
    if (routeKey === '$disconnect' && connectionId) {
        return { type: '$disconnect', connectionId }
    }
    if (resourcePath && event.body) {
        const json = JSON.parse(event.body)
        if (resourcePath === '/validateInvitation' && typeof json === 'object' && 'invitationCode' in json) {
            return { type: 'validateInvitation', invitationCode: json.invitationCode }
        }
        if (resourcePath === '/signIn' && typeof json === 'object' && 'userName' in json && 'password' in json) {
            return { type: 'signIn', userName: json.userName, password: json.password }
        }
        if (resourcePath === '/signUp' && typeof json === 'object' && 'userName' in json && 'inviteCode' in json && 'password' in json) {
            return { type: 'signUp', userName: json.userName, inviteCode: json.inviteCode, password: json.password }
        }
        if (resourcePath === '/accessToken' && typeof json === 'object' && 'RefreshToken' in json) {
            return { type: 'accessToken', RefreshToken: json.RefreshToken }
        }
    }
    if (routeKey === 'connections' && connectionId && event.body) {
        const json = JSON.parse(event.body)
        if (
            typeof json === 'object' &&
            json !== null &&
            json.message === 'registercharacter' &&
            typeof json.CharacterId === 'string' &&
            isEphemeraCharacterId(json.CharacterId)
        ) {
            return {
                type: 'registerCharacter',
                connectionId,
                characterId: json.CharacterId,
                ...(typeof json.RequestId === 'string' ? { requestId: json.RequestId } : {})
            }
        }
    }
    if (event.message === 'dropConnection') {
        return { type: 'dropConnection', sessionId: event.sessionId, connectionId: event.connectionId }
    }
    if (event.message === 'checkSession') {
        return { type: 'checkSession', sessionId: event.sessionId }
    }
    if (event.message === 'generateInvitation') {
        return { type: 'generateInvitation' }
    }
    return
}

const normalizeEventBridgeIngress = async (event: any) => {
    const coreFormat = fromEventBridgeFormat(event)
    const envelope = coreFormatToStreamingEnvelope(coreFormat, async () =>
        diagnosticsDeserializer.deserialize({ content: coreFormat.update as any, header: coreFormat.header })
    )
    return envelope
}

export const routeConnectionsIngress = async (event: any) => {
    if (event?.source && event['detail-type']) {
        const envelope = await normalizeEventBridgeIngress(event)
        if (!isConnectionsSubscribedEnvelope(envelope as any)) {
            throw new Error('Invalid subscribed event for mtw.connections DataSource')
        }
        messageBus.send({
            type: 'StreamingEvent',
            dataSourceKey: envelope.header.dataSourceKey,
            streamKey: envelope.header.streamKey,
            timestamp: envelope.header.timestamp,
            header: envelope.header,
            getContent: envelope.getContent
        })
        return
    }

    const apiContent = normalizeApiIngress(event)
    if (apiContent) {
        sendApiConnectionsEvent(messageBus, apiContent)
        return
    }

    throw new Error('Invalid parameters')
}
