import {
    THINKING_RESULT_HEADER_TYPE,
    isThinkingResultEvent,
} from '@tonylb/mtw-interfaces/ts/eventBridge/ephemera/thinking'

import * as apiEphemera from '../../../apiEphemera'
import type { StreamingEventMessage } from '../../../../messageBus/baseClasses'
import * as persistModule from '../../../thinking/results/persistThinkingResult'
import { ephemeraThinkingResultsDataSource } from '../../../thinking/results/index'

import {
    ACME_ORDER_ENRICH_SEGMENT,
    EPHEMERA_ACTIONS_DATA_SOURCE_KEY,
    acmeOrderEnrichErrorCodeForFailureKind,
    bootstrapAcmeOrderThinkingAtRunStart,
    buildAcmeOrderEnrichFailureVerbose,
    buildAcmeOrderEnrichSuccessVerbose,
    emitAcmeOrderThinkingResult,
    finalizeAcmeOrderThinkingOnFailure,
    mintAcmeOrderThinkingIds,
    sendActionsThinkingResult,
    thinkingStreamKey,
} from './acmeOrderThinkingPersistence'

jest.mock('@tonylb/mtw-utilities/ts/dynamoDB')

jest.mock('../../../apiEphemera', () => ({
    sendPutThinkingJobCreate: jest.fn(),
    sendPutThinkingSchedule: jest.fn(),
    sendPutThinkingJobError: jest.fn(),
}))

const sendPutThinkingJobCreate = apiEphemera.sendPutThinkingJobCreate as jest.MockedFunction<
    typeof apiEphemera.sendPutThinkingJobCreate
>
const sendPutThinkingSchedule = apiEphemera.sendPutThinkingSchedule as jest.MockedFunction<
    typeof apiEphemera.sendPutThinkingSchedule
>
const sendPutThinkingJobError = apiEphemera.sendPutThinkingJobError as jest.MockedFunction<
    typeof apiEphemera.sendPutThinkingJobError
>

describe('acmeOrderThinkingPersistence', () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    describe('acmeOrderEnrichErrorCodeForFailureKind', () => {
        it('maps failure kinds to stable error codes', () => {
            expect(acmeOrderEnrichErrorCodeForFailureKind('placed_objects_cap')).toBe(
                'acme_enrich_placed_objects_cap'
            )
            expect(acmeOrderEnrichErrorCodeForFailureKind('invoke_failed')).toBe(
                'acme_enrich_invoke_failed'
            )
            expect(acmeOrderEnrichErrorCodeForFailureKind('parse_failed')).toBe(
                'acme_enrich_parse_failed'
            )
            expect(acmeOrderEnrichErrorCodeForFailureKind('unknown')).toBe('acme_enrich_unknown')
        })
    })

    describe('mintAcmeOrderThinkingIds', () => {
        it('returns generationId and one acmeOrderEnrich work item', () => {
            const ids = mintAcmeOrderThinkingIds()
            expect(ids.generationId).toMatch(
                /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
            )
            expect(ids.workItems.acmeOrderEnrich).toMatch(
                /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
            )
            expect(ids.workItems.acmeOrderEnrich).not.toBe(ids.generationId)
        })
    })

    describe('thinkingStreamKey', () => {
        it('returns JOB# prefix', () => {
            expect(thinkingStreamKey('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee')).toBe(
                'JOB#aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
            )
        })
    })

    describe('buildAcmeOrderEnrichSuccessVerbose', () => {
        it('includes bedrockPrompt when enrichPromptParts are provided', () => {
            const verbose = buildAcmeOrderEnrichSuccessVerbose({
                command: 'order rope',
                enrichPromptParts: {
                    invariantPrefix: 'STATIC_',
                    dynamicSuffix: 'DYNAMIC',
                },
            })
            expect(verbose.bedrockPrompt).toEqual({
                invariantPrefix: 'STATIC_',
                dynamicSuffix: 'DYNAMIC',
                fullText: 'STATIC_DYNAMIC',
            })
        })
    })

    describe('buildAcmeOrderEnrichFailureVerbose', () => {
        it('includes full occupiedStableKeys and cap fields for placement cap failures', () => {
            const verbose = buildAcmeOrderEnrichFailureVerbose({
                command: 'order rope',
                occupiedStableKeys: ['key-a', 'key-b'],
                placedObjectsCount: 21,
                result: { type: 'Error', errorMessage: 'cap' },
            })
            expect(verbose).toMatchObject({
                command: 'order rope',
                occupiedStableKeys: ['key-a', 'key-b'],
                placedObjectsCount: 21,
                placementCap: 20,
                resultType: 'Error',
            })
            expect(verbose.bedrockPrompt).toBeUndefined()
        })

        it('includes bedrockPrompt when enrichPromptParts are provided', () => {
            const verbose = buildAcmeOrderEnrichFailureVerbose({
                command: 'order rope',
                enrichPromptParts: {
                    invariantPrefix: 'RULES',
                    dynamicSuffix: '## Player command\n\norder rope',
                },
                enrichInvoke: { success: false, errorMessage: 'timeout' },
            })
            expect(verbose).toMatchObject({
                bedrockPrompt: {
                    invariantPrefix: 'RULES',
                    dynamicSuffix: '## Player command\n\norder rope',
                    fullText: 'RULES## Player command\n\norder rope',
                },
            })
        })
    })

    describe('bootstrapAcmeOrderThinkingAtRunStart', () => {
        const makeBus = () => ({
            messageBus: {
                publish: jest.fn(),
            },
        })

        it('publishes job create and one schedule via publish path', () => {
            const { messageBus } = makeBus()
            const ids = bootstrapAcmeOrderThinkingAtRunStart({ messageBus })

            expect(ids.workItems.acmeOrderEnrich).toBeDefined()

            expect(sendPutThinkingJobCreate).toHaveBeenCalledTimes(1)
            expect(sendPutThinkingJobCreate.mock.calls[0]).toHaveLength(3)

            expect(sendPutThinkingSchedule).toHaveBeenCalledTimes(1)
            expect(sendPutThinkingSchedule.mock.calls[0]).toHaveLength(3)
            expect(sendPutThinkingSchedule.mock.calls[0][2].segment).toBe(ACME_ORDER_ENRICH_SEGMENT)

            const streamKey = sendPutThinkingJobCreate.mock.calls[0][1]
            expect(streamKey).toBe(thinkingStreamKey(ids.generationId))
            expect(sendPutThinkingJobCreate.mock.calls[0][2]).toMatchObject({
                schemaVersion: 1,
                generationId: ids.generationId,
                jobStatus: 'running',
                workItemIds: [ids.workItems.acmeOrderEnrich],
            })
        })
    })

    describe('sendActionsThinkingResult', () => {
        const findThinkingResultMessage = (
            publish: jest.Mock
        ): StreamingEventMessage | undefined => {
            for (const call of publish.mock.calls) {
                const msg = call[0] as StreamingEventMessage
                if (
                    msg?.type === 'StreamingEvent' &&
                    msg.dataSourceKey === EPHEMERA_ACTIONS_DATA_SOURCE_KEY &&
                    msg.header?.type === THINKING_RESULT_HEADER_TYPE
                ) {
                    return msg
                }
            }
            return undefined
        }

        it('posts Actions Thinking Result envelope with load-bearing getContent', async () => {
            const publish = jest.fn()
            const ids = mintAcmeOrderThinkingIds()
            const verbose = { command: 'order rope', occupiedStableKeys: ['a'] }
            const workItemId = ids.workItems.acmeOrderEnrich
            const generationId = ids.generationId
            const streamKey = thinkingStreamKey(generationId)

            sendActionsThinkingResult(
                { publish },
                streamKey,
                {
                    schemaVersion: 1,
                    generationId,
                    workItemId,
                    segment: ACME_ORDER_ENRICH_SEGMENT,
                    ok: true,
                    completedAt: '2026-05-15T12:00:00.000Z',
                    verbose,
                }
            )

            expect(publish).toHaveBeenCalledTimes(1)
            const msg = findThinkingResultMessage(publish)!
            expect(msg.streamKey).toBe(streamKey)
            expect(msg.header.dataSourceKey).toBe(EPHEMERA_ACTIONS_DATA_SOURCE_KEY)
            expect(msg.header.type).toBe(THINKING_RESULT_HEADER_TYPE)

            const content = await msg.getContent()
            expect(isThinkingResultEvent(content)).toBe(true)
            if (isThinkingResultEvent(content)) {
                expect(content.segment).toBe(ACME_ORDER_ENRICH_SEGMENT)
                expect(content.ok).toBe(true)
                expect(content.verbose).toMatchObject({
                    command: 'order rope',
                    occupiedStableKeys: ['a'],
                })
            }
        })
    })

    describe('emitAcmeOrderThinkingResult', () => {
        const findThinkingResultMessage = (
            publish: jest.Mock
        ): StreamingEventMessage | undefined => {
            for (const call of publish.mock.calls) {
                const msg = call[0] as StreamingEventMessage
                if (
                    msg?.type === 'StreamingEvent' &&
                    msg.dataSourceKey === EPHEMERA_ACTIONS_DATA_SOURCE_KEY &&
                    msg.header?.type === THINKING_RESULT_HEADER_TYPE
                ) {
                    return msg
                }
            }
            return undefined
        }

        it('publishes Thinking Result then completed schedule', () => {
            const publish = jest.fn()
            const ids = mintAcmeOrderThinkingIds()
            const workItemId = ids.workItems.acmeOrderEnrich

            emitAcmeOrderThinkingResult(
                { messageBus: { publish } },
                ids,
                { ok: true, verbose: { command: 'order rope', resultType: 'AcmeOrder' } }
            )

            expect(publish).toHaveBeenCalledTimes(1)
            expect(findThinkingResultMessage(publish)).toBeDefined()
            expect(sendPutThinkingSchedule).toHaveBeenCalledTimes(1)
            expect(sendPutThinkingSchedule.mock.calls[0][1]).toBe(thinkingStreamKey(ids.generationId))
            expect(sendPutThinkingSchedule.mock.calls[0][2]).toMatchObject({
                generationId: ids.generationId,
                workItemId,
                segment: ACME_ORDER_ENRICH_SEGMENT,
                scheduleStatus: 'completed',
            })
            expect(sendPutThinkingSchedule.mock.calls[0]).toHaveLength(3)
        })
    })

    describe('finalizeAcmeOrderThinkingOnFailure', () => {
        const findThinkingResultMessage = (
            publish: jest.Mock
        ): StreamingEventMessage | undefined => {
            for (const call of publish.mock.calls) {
                const msg = call[0] as StreamingEventMessage
                if (
                    msg?.type === 'StreamingEvent' &&
                    msg.dataSourceKey === EPHEMERA_ACTIONS_DATA_SOURCE_KEY &&
                    msg.header?.type === THINKING_RESULT_HEADER_TYPE
                ) {
                    return msg
                }
            }
            return undefined
        }

        it('emits acmeOrderEnrich failure result and job error via publish', async () => {
            const publish = jest.fn()
            const ids = mintAcmeOrderThinkingIds()
            const verbose = buildAcmeOrderEnrichFailureVerbose({
                command: 'order rope',
                occupiedStableKeys: ['stable-1', 'stable-2'],
                placedObjectsCount: 25,
            })

            finalizeAcmeOrderThinkingOnFailure(
                { messageBus: { publish } },
                {
                    ids,
                    errorCode: 'acme_enrich_placed_objects_cap',
                    errorMessage: 'placement cap exceeded',
                    verbose,
                }
            )

            expect(publish).toHaveBeenCalledTimes(1)
            expect(sendPutThinkingJobError).toHaveBeenCalledTimes(1)
            expect(sendPutThinkingJobError.mock.calls[0]).toHaveLength(3)
            expect(
                sendPutThinkingSchedule.mock.calls.filter((call) => call[2].scheduleStatus === 'completed')
            ).toHaveLength(0)

            const msg = findThinkingResultMessage(publish)!
            const content = await msg.getContent()
            expect(isThinkingResultEvent(content)).toBe(true)
            if (isThinkingResultEvent(content)) {
                expect(content.segment).toBe(ACME_ORDER_ENRICH_SEGMENT)
                expect(content.ok).toBe(false)
                expect(content.errorCode).toBe('acme_enrich_placed_objects_cap')
                expect(content.workItemId).toBe(ids.workItems.acmeOrderEnrich)
                expect(content.verbose).toMatchObject({
                    command: 'order rope',
                    occupiedStableKeys: ['stable-1', 'stable-2'],
                    placedObjectsCount: 25,
                })
            }

            expect(sendPutThinkingJobError.mock.calls[0][2]).toMatchObject({
                generationId: ids.generationId,
                jobStatus: 'failed',
                lastFailedWorkItemId: ids.workItems.acmeOrderEnrich,
            })
        })
    })

    describe('bus to persistThinkingResult', () => {
        it('receiveEvents persists Actions Thinking Result with ok false from mock bus envelope', async () => {
            const publish = jest.fn()
            const ids = mintAcmeOrderThinkingIds()
            const generationId = ids.generationId
            const workItemId = ids.workItems.acmeOrderEnrich
            const streamKey = thinkingStreamKey(generationId)
            const completedAt = '2026-05-15T12:00:00.000Z'

            sendActionsThinkingResult(
                { publish },
                streamKey,
                {
                    schemaVersion: 1,
                    generationId,
                    workItemId,
                    segment: ACME_ORDER_ENRICH_SEGMENT,
                    ok: false,
                    completedAt,
                    errorCode: 'acme_enrich_invoke_failed',
                    errorMessage: 'invoke failed',
                    verbose: { command: 'order rope' },
                }
            )

            const msg = publish.mock.calls[0][0] as StreamingEventMessage
            const spy = jest.spyOn(persistModule, 'persistThinkingResult').mockResolvedValue('written')
            await ephemeraThinkingResultsDataSource.receiveEvents!({
                events: [
                    {
                        header: msg.header,
                        getContent: msg.getContent,
                    } as never,
                ],
                streamEvent: jest.fn(),
                streamEnvelope: jest.fn(),
            })
            expect(spy).toHaveBeenCalledWith(
                expect.objectContaining({
                    generationId,
                    workItemId,
                    segment: ACME_ORDER_ENRICH_SEGMENT,
                    ok: false,
                    errorCode: 'acme_enrich_invoke_failed',
                })
            )
            spy.mockRestore()
        })

        it('receiveEvents persists Actions Thinking Result from mock bus envelope', async () => {
            const publish = jest.fn()
            const ids = mintAcmeOrderThinkingIds()
            const generationId = ids.generationId
            const workItemId = ids.workItems.acmeOrderEnrich
            const streamKey = thinkingStreamKey(generationId)
            const completedAt = '2026-05-15T12:00:00.000Z'

            sendActionsThinkingResult(
                { publish },
                streamKey,
                {
                    schemaVersion: 1,
                    generationId,
                    workItemId,
                    segment: ACME_ORDER_ENRICH_SEGMENT,
                    ok: true,
                    completedAt,
                    verbose: { command: 'order rope', resultType: 'AcmeOrder' },
                }
            )

            const msg = publish.mock.calls[0][0] as StreamingEventMessage
            const spy = jest.spyOn(persistModule, 'persistThinkingResult').mockResolvedValue('written')
            await ephemeraThinkingResultsDataSource.receiveEvents!({
                events: [
                    {
                        header: msg.header,
                        getContent: msg.getContent,
                    } as never,
                ],
                streamEvent: jest.fn(),
                streamEnvelope: jest.fn(),
            })
            expect(spy).toHaveBeenCalledWith(
                expect.objectContaining({
                    generationId,
                    workItemId,
                    segment: ACME_ORDER_ENRICH_SEGMENT,
                    ok: true,
                    completedAt,
                })
            )
            spy.mockRestore()
        })
    })
})
