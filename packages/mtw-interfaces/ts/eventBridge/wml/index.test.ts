import {
    WMLEventSerializer,
    WMLEventUpdate,
    WMLEventExternal,
    isWMLContentUpdateEvent,
    isWMLMergeConflictEvent,
    WMLAggregator,
    WMLDataSourceEventSerializer,
    isWMLMaterializedView,
    isWMLContentEventExternal
} from './index'
import { maybeFetchSidecarString } from '@tonylb/mtw-lambda-patterns/ts/dataSource/sidecarResolve'

jest.mock('@tonylb/mtw-lambda-patterns/ts/dataSource/sidecarResolve', () => {
    const actual = jest.requireActual<typeof import('@tonylb/mtw-lambda-patterns/ts/dataSource/sidecarResolve')>(
        '@tonylb/mtw-lambda-patterns/ts/dataSource/sidecarResolve'
    )
    return {
        maybeFetchSidecarString: jest.fn((value: unknown, fetchFn?: typeof fetch) =>
            actual.maybeFetchSidecarString(value, fetchFn)
        )
    }
})
import type { WMLStreamingEventHeader } from './index'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import { deIndentWML } from '@tonylb/mtw-wml/ts/schema/utils'

const wmlDataSourceKey = 'mtw.wml'
const wmlStreamKey = 'ASSET#test-asset'
const wmlTimestamp = 0

function makeWmlHeader(type: string, RequestIds?: string[]): WMLStreamingEventHeader {
    return { dataSourceKey: wmlDataSourceKey, streamKey: wmlStreamKey, timestamp: wmlTimestamp, type, ...(RequestIds != null ? { RequestIds } : {}) }
}

describe('WMLEventSerializer', () => {
    let serializer: WMLEventSerializer

    beforeEach(() => {
        serializer = new WMLEventSerializer()
    })

    describe('Content Events', () => {
        it('should serialize Content Update event to WML string', () => {
            const standardForm = new StandardForm(deIndentWML(`
                <Asset uuid=(test-asset)>
                    <Room key=(testroom) uuid=(testroom)>
                        <ShortName>Test Room</ShortName>
                    </Room>
                </Asset>
            `))

            const contentEvent: WMLEventUpdate = { schema: standardForm }

            const externalEvent = serializer.serialize({ content: contentEvent, header: makeWmlHeader('Content Update') })
            expect('wml' in externalEvent).toBe(true)
            expect(typeof (externalEvent as { wml: string }).wml).toBe('string')
            expect((externalEvent as { wml: string }).wml).toContain('Room')
            expect((externalEvent as { wml: string }).wml).toContain('testroom')
        })



        it('should deserialize Content Update event from WML string', async () => {
            const wmlString = deIndentWML(`
                <Asset uuid=(test-asset)>
                    <Room key=(testroom) uuid=(testroom)>
                        <ShortName>Test Room</ShortName>
                    </Room>
                </Asset>
            `)

            const externalEvent: WMLEventExternal = {
                wml: wmlString
            }

            const internalEvent = await serializer.deserialize({
                content: externalEvent,
                header: makeWmlHeader('Content Update')
            })

            expect(internalEvent).not.toBeNull()
            expect(isWMLContentUpdateEvent(internalEvent!)).toBe(true)
            if (isWMLContentUpdateEvent(internalEvent!)) {
                expect(internalEvent.schema).toBeDefined()
                expect(internalEvent.schema).toBeInstanceOf(StandardForm)
            }
        })

        it('should handle Content Update round-trip correctly', async () => {
            const originalForm = new StandardForm(deIndentWML(`
                <Asset uuid=(test-asset)>
                    <Room key=(testroom) uuid=(testroom)>
                        <ShortName>Test Room</ShortName>
                    </Room>
                </Asset>
            `))

            const contentEvent: WMLEventUpdate = { schema: originalForm }

            // Serialize to external format
            const externalEvent = serializer.serialize({ content: contentEvent, header: makeWmlHeader('Content Update') })
            
            // Deserialize back to internal format
            const deserializedEvent = await serializer.deserialize({
                content: externalEvent,
                header: makeWmlHeader('Content Update')
            })
            
            // Verify the schema is preserved
            expect(deserializedEvent).not.toBeNull()
            expect(isWMLContentUpdateEvent(deserializedEvent!)).toBe(true)
            if (isWMLContentUpdateEvent(deserializedEvent!)) {
                expect(deserializedEvent.schema).toBeDefined()
                expect(deserializedEvent.schema).toBeInstanceOf(StandardForm)
            }
        })

        it('should not put RequestIds in serialized Content Update content (RequestIds is in header)', () => {
            const standardForm = new StandardForm(deIndentWML(`
                <Asset uuid=(test-asset)>
                    <Room key=(room1) uuid=(room1)><ShortName>R1</ShortName></Room>
                </Asset>
            `))
            const contentEvent: WMLEventUpdate = { schema: standardForm }
            const header = makeWmlHeader('Content Update', ['req-123'])
            const externalEvent = serializer.serialize({ content: contentEvent, header })
            expect(externalEvent).not.toHaveProperty('RequestIds')
        })

        it('should not put RequestIds in deserialized Content Update content (caller reads from header)', async () => {
            const wmlString = deIndentWML(`
                <Asset uuid=(test-asset)>
                    <Room key=(room1) uuid=(room1)><ShortName>R1</ShortName></Room>
                </Asset>
            `)
            const externalEvent: WMLEventExternal = {
                wml: wmlString
            }
            const header = makeWmlHeader('Content Update', ['req-456'])
            const internalEvent = await serializer.deserialize({
                content: externalEvent,
                header
            })
            expect(internalEvent).not.toBeNull()
            if (internalEvent && isWMLContentUpdateEvent(internalEvent)) {
                expect(internalEvent).not.toHaveProperty('RequestIds')
            }
            expect(header.RequestIds).toEqual(['req-456'])
        })

        it('should deserialize Content Update from sidecar when wml is { sidecarUrl }', async () => {
            const wmlString = deIndentWML(`
                <Asset uuid=(test-asset)>
                    <Room key=(testroom) uuid=(testroom)>
                        <ShortName>Test Room</ShortName>
                    </Room>
                </Asset>
            `)
            ;(maybeFetchSidecarString as jest.Mock).mockImplementationOnce(() => Promise.resolve(wmlString))

            const externalEvent: WMLEventExternal = {
                wml: { sidecarUrl: 'https://example.com/sidecar.wml' }
            }

            const internalEvent = await serializer.deserialize({
                content: externalEvent,
                header: makeWmlHeader('Content Update')
            })

            expect(maybeFetchSidecarString).toHaveBeenCalledWith({ sidecarUrl: 'https://example.com/sidecar.wml' })
            expect(internalEvent).not.toBeNull()
            expect(isWMLContentUpdateEvent(internalEvent!)).toBe(true)
            if (isWMLContentUpdateEvent(internalEvent!)) {
                expect(internalEvent.schema).toBeDefined()
                expect(internalEvent.schema).toBeInstanceOf(StandardForm)
            }
        })

        it('should round-trip Content Update with RequestIds in header only', async () => {
            const standardForm = new StandardForm(deIndentWML(`
                <Asset uuid=(test-asset)>
                    <Room key=(room1) uuid=(room1)><ShortName>R1</ShortName></Room>
                </Asset>
            `))
            const contentEvent: WMLEventUpdate = { schema: standardForm }
            const headerWithIds = makeWmlHeader('Content Update', ['req-roundtrip'])
            const externalEvent = serializer.serialize({ content: contentEvent, header: headerWithIds })
            expect(!('RequestIds' in externalEvent) && 'wml' in externalEvent).toBe(true)
            const deserialized = await serializer.deserialize({
                content: externalEvent,
                header: headerWithIds
            })
            expect(deserialized).not.toBeNull()
            if (deserialized && isWMLContentUpdateEvent(deserialized)) {
                expect(deserialized).not.toHaveProperty('RequestIds')
            }
            expect(headerWithIds.RequestIds).toEqual(['req-roundtrip'])
        })
    })

    describe('Zone Events', () => {
        it('should serialize Zone Changed event (pass-through)', () => {
            const zoneEvent: WMLEventUpdate = {
                fromZone: 'Library',
                toZone: 'Canon',
                player: 'alice'
            }

            const externalEvent = serializer.serialize({ content: zoneEvent, header: makeWmlHeader('Zone Changed') }) as { fromZone: string; toZone: string; player: string }
            expect(externalEvent.fromZone).toBe('Library')
            expect(externalEvent.toZone).toBe('Canon')
            expect(externalEvent.player).toBe('alice')
        })

        it('should deserialize Zone Changed event (pass-through)', async () => {
            const externalEvent: WMLEventExternal = {
                fromZone: 'Library',
                toZone: 'Canon',
                player: 'alice'
            }

            const internalEvent = await serializer.deserialize({
                content: externalEvent,
                header: makeWmlHeader('Zone Changed')
            })

            expect(internalEvent).toEqual({ fromZone: 'Library', toZone: 'Canon', player: 'alice' })
        })

        it('should handle Zone Changed round-trip correctly', async () => {
            const originalEvent: WMLEventUpdate = {
                fromZone: 'Library',
                toZone: 'Canon',
                player: 'alice',
                subFolder: 'test-folder'
            }

            // Serialize to external format
            const externalEvent = serializer.serialize({ content: originalEvent, header: makeWmlHeader('Zone Changed') })
            
            // Deserialize back to internal format
            const deserializedEvent = await serializer.deserialize({
                content: externalEvent,
                header: makeWmlHeader('Zone Changed')
            })
            
            // Verify complete round-trip (internal has no type)
            expect(deserializedEvent).toEqual(originalEvent)
        })
    })

    describe('Error Handling', () => {
        it('should handle unknown event types', () => {
            const unknownEvent = { type: 'Unknown', AssetId: 'ASSET#test' } as any

            expect(() => {
                serializer.serialize({ content: unknownEvent, header: makeWmlHeader('Unknown') })
            }).toThrow('Unknown WML event type')
        })

        it('should handle invalid WML in Content Update', async () => {
            const externalEvent: WMLEventExternal = {
                wml: 'invalid-wml-content'
            }

            await expect(serializer.deserialize({
                content: externalEvent,
                header: makeWmlHeader('Content Update')
            })).rejects.toThrow('Failed to deserialize WML')
        })

        it('should handle Content Update event missing wml property', async () => {
            const externalEvent = {
                // Missing wml property
            } as any

            await expect(serializer.deserialize({
                content: externalEvent,
                header: makeWmlHeader('Content Update')
            })).rejects.toThrow("Content Update event missing required 'wml' property")
        })
    })

    describe('Merge Conflict Events', () => {
        it('should serialize Merge Conflict event to external format', () => {
            const mergeConflictEvent: WMLEventUpdate = { error: 'Merge conflict occurred during edit application' }

            const externalEvent = serializer.serialize({ content: mergeConflictEvent, header: makeWmlHeader('Merge Conflict') }) as { error?: string }
            expect(externalEvent.error).toBe('Merge conflict occurred during edit application')
        })

        it('should deserialize Merge Conflict event from external format', async () => {
            const externalEvent: WMLEventExternal = {
                error: 'Merge conflict occurred during edit application'
            }

            const internalEvent = await serializer.deserialize({
                content: externalEvent,
                header: makeWmlHeader('Merge Conflict')
            })

            expect(internalEvent).toBeDefined()
            if (internalEvent && isWMLMergeConflictEvent(internalEvent)) {
                expect(internalEvent.error).toBe('Merge conflict occurred during edit application')
            }
        })

        it('should handle Merge Conflict round-trip correctly', async () => {
            const originalEvent: WMLEventUpdate = { error: 'Merge conflict occurred during edit application' }

            // Serialize to external format
            const externalEvent = serializer.serialize({ content: originalEvent, header: makeWmlHeader('Merge Conflict') })

            // Deserialize back to internal format
            const roundTripEvent = await serializer.deserialize({
                content: externalEvent,
                header: makeWmlHeader('Merge Conflict')
            })

            expect(roundTripEvent).toBeDefined()
            if (roundTripEvent && isWMLMergeConflictEvent(roundTripEvent)) {
                expect(roundTripEvent.error).toBe(originalEvent.error)
            }
        })

        it('should not put RequestIds in serialized Merge Conflict content (RequestIds is in header)', () => {
            const mergeConflictEvent: WMLEventUpdate = { error: 'Conflict' }
            const header = makeWmlHeader('Merge Conflict', ['req-mc-1'])
            const externalEvent = serializer.serialize({ content: mergeConflictEvent, header })
            expect(externalEvent).not.toHaveProperty('RequestIds')
        })

        it('should not put RequestIds in deserialized Merge Conflict content (caller reads from header)', async () => {
            const externalEvent: WMLEventExternal = {
                error: 'Conflict'
            }
            const header = makeWmlHeader('Merge Conflict', ['req-mc-2'])
            const internalEvent = await serializer.deserialize({
                content: externalEvent,
                header
            })
            expect(internalEvent).toBeDefined()
            if (internalEvent && isWMLMergeConflictEvent(internalEvent)) {
                expect(internalEvent).not.toHaveProperty('RequestIds')
            }
            expect(header.RequestIds).toEqual(['req-mc-2'])
        })
    })

    describe('Purge Events', () => {
        it('should serialize Asset Purged event to external format', () => {
            const purgeEvent: WMLEventUpdate = { zone: 'Draft', objectsDeleted: 42 }

            const externalEvent = serializer.serialize({ content: purgeEvent, header: makeWmlHeader('Asset Purged') }) as { zone: string; objectsDeleted: number }
            expect(externalEvent.zone).toBe('Draft')
            expect(externalEvent.objectsDeleted).toBe(42)
        })

        it('should deserialize Asset Purged event from external format', async () => {
            const externalEvent: WMLEventExternal = {
                zone: 'Archive',
                objectsDeleted: 15
            }

            const internalEvent = await serializer.deserialize({
                content: externalEvent,
                header: makeWmlHeader('Asset Purged')
            })

            expect(internalEvent).not.toBeNull()
            if (internalEvent && 'zone' in internalEvent) {
                expect(internalEvent.zone).toBe('Archive')
                expect(internalEvent.objectsDeleted).toBe(15)
            }
        })

        it('should handle Asset Purged round-trip correctly', async () => {
            const originalEvent: WMLEventUpdate = { zone: 'Draft', objectsDeleted: 100 }

            // Serialize to external format
            const externalEvent = serializer.serialize({ content: originalEvent, header: makeWmlHeader('Asset Purged') })

            // Deserialize back to internal format
            const roundTripEvent = await serializer.deserialize({
                content: externalEvent,
                header: makeWmlHeader('Asset Purged')
            })

            expect(roundTripEvent).toBeDefined()
            if (roundTripEvent && 'zone' in roundTripEvent) {
                expect(roundTripEvent.zone).toBe(originalEvent.zone)
                expect(roundTripEvent.objectsDeleted).toBe(originalEvent.objectsDeleted)
            }
        })
    })

    describe('deserialize when header and payload type disagree - header wins', () => {
        it('should deserialize as Zone Changed when header says Zone Changed but payload has Content Update shape', async () => {
            const externalEvent = {
                wml: deIndentWML(`<Asset uuid=(test)></Asset>`),
                fromZone: 'Draft',
                toZone: 'Canon'
            } as any

            const internalEvent = await serializer.deserialize({
                content: externalEvent,
                header: makeWmlHeader('Zone Changed')
            })

            expect(internalEvent).not.toBeNull()
            expect((internalEvent as any).fromZone).toBe('Draft')
            expect((internalEvent as any).toZone).toBe('Canon')
        })
    })

})

describe('WMLAggregator', () => {
    const aggregator = new WMLAggregator()

    describe('createEmpty', () => {
        it('should return empty StandardFormData shape', () => {
            const empty = aggregator.createEmpty()
            expect(empty).toBeDefined()
            expect(empty.universalKey).toBeDefined()
            expect(Array.isArray(empty.components)).toBe(true)
            expect(empty.components).toHaveLength(0)
            expect(empty.metaData).toBeDefined()
        })
    })

    describe('applyUpdate', () => {
        it('should merge Content Update onto view and return new snapshot', () => {
            const view = aggregator.createEmpty()
            const delta = new StandardForm(deIndentWML(`
                <Asset uuid=(test-asset)>
                    <Room key=(room1) uuid=(room1)>
                        <ShortName>Room One</ShortName>
                    </Room>
                </Asset>
            `))
            const result = aggregator.applyUpdate(view, { header: makeWmlHeader('Content Update'), content: { schema: delta } })
            expect(result.success).toBe(true)
            if (result.success) {
                expect(result.snapshot).toBeDefined()
                expect(result.snapshot.components).toBeDefined()
                expect(Array.isArray(result.snapshot.components)).toBe(true)
            }
        })

        it('should return success false and unchanged snapshot for Merge Conflict', () => {
            const view = aggregator.createEmpty()
            const result = aggregator.applyUpdate(view, { header: makeWmlHeader('Merge Conflict'), content: { error: 'conflict' } })
            expect(result.success).toBe(false)
            expect(result.snapshot).toBe(view)
        })
    })
})

describe('WMLDataSourceEventSerializer', () => {
    const serializer = new WMLDataSourceEventSerializer()

    it('should deserialize Content Update external to internal', async () => {
        const wml = deIndentWML(`<Asset uuid=(test)></Asset>`)
        const result = await serializer.deserialize({
            content: { wml },
            header: makeWmlHeader('Content Update')
        })
        expect(result).not.toBeNull()
        expect(isWMLContentUpdateEvent(result!)).toBe(true)
        if (result && isWMLContentUpdateEvent(result)) {
            expect(result.schema).toBeInstanceOf(StandardForm)
        }
    })

    it('should deserialize Merge Conflict external to internal', async () => {
        const result = await serializer.deserialize({
            content: { error: 'Conflict' },
            header: makeWmlHeader('Merge Conflict')
        })
        expect(result).not.toBeNull()
        expect(isWMLMergeConflictEvent(result!)).toBe(true)
    })

    it('should return null for non-content external event (Zone Changed)', async () => {
        const result = await serializer.deserialize({
            content: { fromZone: 'Draft', toZone: 'Canon' } as any,
            header: makeWmlHeader('Zone Changed')
        })
        expect(result).toBeNull()
    })

    it('should deserializeSnapshot from WML string into StandardFormData', async () => {
        const wml = deIndentWML(`
            <Asset uuid=(test-asset)>
                <Room key=(room1) uuid=(room1)>
                    <ShortName>Room One</ShortName>
                </Room>
            </Asset>
        `)
        const result = await serializer.deserializeSnapshot({ wml })
        expect(result).not.toBeNull()
        if (result) {
            expect(result.universalKey).toBeDefined()
            expect(Array.isArray(result.components)).toBe(true)
            expect(result.metaData).toBeDefined()
        }
    })

    it('should deserializeSnapshot from sidecar when wml is { sidecarUrl }', async () => {
        const wml = deIndentWML(`
            <Asset uuid=(test-asset)>
                <Room key=(room1) uuid=(room1)>
                    <ShortName>Room One</ShortName>
                </Room>
            </Asset>
        `)
        ;(maybeFetchSidecarString as jest.Mock).mockImplementationOnce(() => Promise.resolve(wml))

        const result = await serializer.deserializeSnapshot({
            wml: { sidecarUrl: 'https://example.com/snapshot.wml' }
        })

        expect(maybeFetchSidecarString).toHaveBeenCalledWith({ sidecarUrl: 'https://example.com/snapshot.wml' })
        expect(result).not.toBeNull()
        if (result) {
            expect(result.universalKey).toBeDefined()
            expect(Array.isArray(result.components)).toBe(true)
            expect(result.metaData).toBeDefined()
        }
    })
})

describe('isWMLMaterializedView', () => {
    it('should return true for StandardFormData-shaped object', () => {
        expect(isWMLMaterializedView({
            universalKey: 'ASSET#test',
            components: [],
            metaData: []
        })).toBe(true)
    })

    it('should return false for Content Update event', () => {
        expect(isWMLMaterializedView({ schema: {} })).toBe(false)
    })
})

describe('isWMLContentEventExternal', () => {
    it('should return true for Content Update payload without type (consumer compatibility)', () => {
        expect(isWMLContentEventExternal({ wml: '<Asset />' })).toBe(true)
    })

    it('should return true for Merge Conflict payload without type', () => {
        expect(isWMLContentEventExternal({ error: 'Conflict' })).toBe(true)
    })

    it('should return true for Merge Conflict payload with no properties', () => {
        expect(isWMLContentEventExternal({})).toBe(true)
    })

    it('should return false for payload with invalid wml type', () => {
        expect(isWMLContentEventExternal({ wml: 123 })).toBe(false)
    })

    it('should return true for Content Update payload with sidecar descriptor', () => {
        expect(isWMLContentEventExternal({ wml: { sidecarUrl: 'https://example.com/sidecar.wml' } })).toBe(true)
    })
})
