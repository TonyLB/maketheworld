/**
 * Outbound stream payloads for mtw.ephemera.messageOrchestration.
 * No meaningful publishes: output is a direct messageBus.publish (PublishMessage) call once a
 * bundle completes or settles, not a further stream republish. See dataSource/messageOrchestration/AGENT.md.
 */
export const EPHEMERA_MESSAGE_ORCHESTRATION_DATA_SOURCE_KEY = 'mtw.ephemera.messageOrchestration' as const

export type MessageOrchestrationNoopPublishedPayload = {
    type: 'Message Orchestration noop';
}

export type MessageOrchestrationPublishedPayload = MessageOrchestrationNoopPublishedPayload
