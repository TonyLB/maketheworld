import type { EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraCacheId } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { MessageBus } from '../../../messageBus/baseClasses'
import type { EphemeraCacheDynamoItem } from '../../../renderCache/baseClasses'
import { apiClient } from '@tonylb/mtw-utilities/ts/apiManagement/apiManagementClient'
import { CONVERSATION_PAYLOAD_STUB } from '../baseClasses'
import {
    CONVERSATION_TYPE_GENERATE_ROOM_PREVIEW,
    type StorableConversationRecordGenerateRoomPreview,
} from './baseClasses'
import { materializeGenerateRoomPreview } from './materialize'
import * as renderResolveMap from './renderResolveOutputToGenerateRoomPreviewResult'

jest.mock('@tonylb/mtw-utilities/ts/apiManagement/apiManagementClient', () => ({
    apiClient: {
        send: jest.fn().mockResolvedValue(undefined),
    },
}))

describe('materializeGenerateRoomPreview', () => {
    describe('enrichRenderResolveForPreview (inlined in materialize)', () => {
        const roomId = 'ROOM#one' as EphemeraRoomId

        const baseRecord: StorableConversationRecordGenerateRoomPreview = {
            conversationId: '550e8400-e29b-41d4-a716-446655440000',
            type: CONVERSATION_TYPE_GENERATE_ROOM_PREVIEW,
            routing: {
                roomId,
                perspectiveId: 'P#1',
            },
            payload: CONVERSATION_PAYLOAD_STUB,
        }

        const baseDeps = () => ({
            messageBus: {} as MessageBus,
            getConnectionId: jest.fn().mockResolvedValue('connection-id'),
        })

        it('passes terminal RenderResolveOutput through identity enrichment into renderResolveOutputToGenerateRoomPreviewResult', async () => {
            const spy = jest.spyOn(renderResolveMap, 'renderResolveOutputToGenerateRoomPreviewResult')
            const cacheRecord: EphemeraCacheDynamoItem = {
                EphemeraId: roomId,
                DataCategory: 'CACHE#valid',
                markState: { markValue: [{ mark: 'MARK#a', value: 'one' }] },
                renderedContent: { description: [] },
                provenance: { type: 'authored' },
                perspectiveId: 'PERSPECTIVE#legacy',
                perspectiveMatcher: { requiredAssetIds: ['ASSET#base'], forbiddenAssetIds: [] },
            }
            const terminalOutput = {
                type: 'resolved' as const,
                renderedContent: cacheRecord.renderedContent,
                cacheId: 'CACHE#valid' as EphemeraCacheId,
                cacheRecord,
            }
            const handle = materializeGenerateRoomPreview(baseRecord, baseDeps())
            await handle.sendMessage(terminalOutput)
            expect(spy).toHaveBeenCalledWith(terminalOutput)
            spy.mockRestore()
            expect(jest.mocked(apiClient.send)).toHaveBeenCalled()
        })
    })
})
