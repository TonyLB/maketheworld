import {
    WMLEventSerializer,
    WMLEventUpdate,
    WMLEventExternal,
    isWMLContentUpdateEvent,
    WMLAggregator,
    WMLDataSourceEventSerializer,
    isWMLMaterializedView
} from './index'
import type { StreamingEventHeader } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import { deIndentWML } from '@tonylb/mtw-wml/ts/schema/utils'

const wmlDataSourceKey = 'mtw.wml'
const wmlStreamKey = 'ASSET#test-asset'
const wmlTimestamp = 0

function makeWmlHeader(type: string): StreamingEventHeader {
    return { dataSourceKey: wmlDataSourceKey, streamKey: wmlStreamKey, timestamp: wmlTimestamp, type }
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
                        <Name>Test Room</Name>
                        <Description>A test room for testing purposes</Description>
                    </Room>
                </Asset>
            `))

            const contentEvent: WMLEventUpdate = {
                type: 'Content Update',
                schema: standardForm
            }

            const externalEvent = serializer.serialize({ update: contentEvent, header: makeWmlHeader('Content Update') })
            expect(externalEvent.type).toBe('Content Update')
            if (externalEvent.type === 'Content Update') {
                expect(typeof externalEvent.wml).toBe('string')
                expect(externalEvent.wml).toContain('Room')
                expect(externalEvent.wml).toContain('testroom')
            }
        })



        it('should deserialize Content Update event from WML string', () => {
            const wmlString = deIndentWML(`
                <Asset uuid=(test-asset)>
                    <Room key=(testroom) uuid=(testroom)>
                        <Name>Test Room</Name>
                        <Description>A test room for testing purposes</Description>
                    </Room>
                </Asset>
            `)

            const externalEvent: WMLEventExternal = {
                type: 'Content Update',
                wml: wmlString
            }

            const internalEvent = serializer.deserialize({
                externalUpdate: externalEvent,
                header: makeWmlHeader('Content Update')
            })

            expect(internalEvent).not.toBeNull()
            expect(isWMLContentUpdateEvent(internalEvent!)).toBe(true)
            if (isWMLContentUpdateEvent(internalEvent!)) {
                expect(internalEvent.schema).toBeDefined()
                expect(internalEvent.schema).toBeInstanceOf(StandardForm)
            }
        })

        it('should handle Content Update round-trip correctly', () => {
            const originalForm = new StandardForm(deIndentWML(`
                <Asset uuid=(test-asset)>
                    <Room key=(testroom) uuid=(testroom)>
                        <Name>Test Room</Name>
                        <Description>A test room for testing purposes</Description>
                    </Room>
                </Asset>
            `))

            const contentEvent: WMLEventUpdate = {
                type: 'Content Update',
                schema: originalForm
            }

            // Serialize to external format
            const externalEvent = serializer.serialize({ update: contentEvent, header: makeWmlHeader('Content Update') })
            
            // Deserialize back to internal format
            const deserializedEvent = serializer.deserialize({
                externalUpdate: externalEvent,
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

        it('should include RequestIds in serialized Content Update when present', () => {
            const standardForm = new StandardForm(deIndentWML(`
                <Asset uuid=(test-asset)>
                    <Room key=(room1) uuid=(room1)><Name>R1</Name></Room>
                </Asset>
            `))
            const contentEvent: WMLEventUpdate = {
                type: 'Content Update',
                schema: standardForm,
                RequestIds: ['req-123']
            }
            const externalEvent = serializer.serialize({ update: contentEvent, header: makeWmlHeader('Content Update') })
            expect(externalEvent.type).toBe('Content Update')
            if (externalEvent.type === 'Content Update') {
                expect(externalEvent.RequestIds).toEqual(['req-123'])
            }
        })

        it('should preserve RequestIds when deserializing Content Update', () => {
            const wmlString = deIndentWML(`
                <Asset uuid=(test-asset)>
                    <Room key=(room1) uuid=(room1)><Name>R1</Name></Room>
                </Asset>
            `)
            const externalEvent: WMLEventExternal = {
                type: 'Content Update',
                wml: wmlString,
                RequestIds: ['req-456']
            }
            const internalEvent = serializer.deserialize({
                externalUpdate: externalEvent,
                header: makeWmlHeader('Content Update')
            })
            expect(internalEvent).not.toBeNull()
            if (internalEvent && internalEvent.type === 'Content Update') {
                expect(internalEvent.RequestIds).toEqual(['req-456'])
            }
        })

        it('should round-trip Content Update with RequestIds', () => {
            const standardForm = new StandardForm(deIndentWML(`
                <Asset uuid=(test-asset)>
                    <Room key=(room1) uuid=(room1)><Name>R1</Name></Room>
                </Asset>
            `))
            const contentEvent: WMLEventUpdate = {
                type: 'Content Update',
                schema: standardForm,
                RequestIds: ['req-roundtrip']
            }
            const externalEvent = serializer.serialize({ update: contentEvent, header: makeWmlHeader('Content Update') })
            const deserialized = serializer.deserialize({
                externalUpdate: externalEvent,
                header: makeWmlHeader('Content Update')
            })
            expect(deserialized).not.toBeNull()
            if (deserialized && deserialized.type === 'Content Update') {
                expect(deserialized.RequestIds).toEqual(['req-roundtrip'])
            }
        })
    })

    describe('Zone Events', () => {
        it('should serialize Zone Changed event (pass-through)', () => {
            const zoneEvent: WMLEventUpdate = {
                type: 'Zone Changed',
                fromZone: 'Library',
                toZone: 'Canon',
                player: 'alice'
            }

            const externalEvent = serializer.serialize({ update: zoneEvent, header: makeWmlHeader('Zone Changed') })
            expect(externalEvent).toEqual(zoneEvent)
        })

        it('should deserialize Zone Changed event (pass-through)', () => {
            const externalEvent: WMLEventExternal = {
                type: 'Zone Changed',
                fromZone: 'Library',
                toZone: 'Canon',
                player: 'alice'
            }

            const internalEvent = serializer.deserialize({
                externalUpdate: externalEvent,
                header: makeWmlHeader('Zone Changed')
            })

            expect(internalEvent).toEqual(externalEvent)
        })

        it('should handle Zone Changed round-trip correctly', () => {
            const originalEvent: WMLEventUpdate = {
                type: 'Zone Changed',
                fromZone: 'Library',
                toZone: 'Canon',
                player: 'alice',
                subFolder: 'test-folder'
            }

            // Serialize to external format
            const externalEvent = serializer.serialize({ update: originalEvent, header: makeWmlHeader('Zone Changed') })
            
            // Deserialize back to internal format
            const deserializedEvent = serializer.deserialize({
                externalUpdate: externalEvent,
                header: makeWmlHeader('Zone Changed')
            })
            
            // Verify complete round-trip
            expect(deserializedEvent).toEqual(originalEvent)
        })
    })

    describe('Error Handling', () => {
        it('should handle unknown event types', () => {
            const unknownEvent = { type: 'Unknown', AssetId: 'ASSET#test' } as any

            expect(() => {
                serializer.serialize({ update: unknownEvent, header: makeWmlHeader('Unknown') })
            }).toThrow('Unknown WML event type')
        })

        it('should handle invalid WML in Content Update', () => {
            const externalEvent: WMLEventExternal = {
                type: 'Content Update',
                wml: 'invalid-wml-content'
            }

            expect(() => {
                serializer.deserialize({
                    externalUpdate: externalEvent,
                    header: makeWmlHeader('Content Update')
                })
            }).toThrow('Failed to deserialize WML')
        })

        it('should handle Content Update event missing wml property', () => {
            const externalEvent = {
                type: 'Content Update'
                // Missing wml property
            } as any

            expect(() => {
                serializer.deserialize({
                    externalUpdate: externalEvent,
                    header: makeWmlHeader('Content Update')
                })
            }).toThrow("Content Update event missing required 'wml' property")
        })
    })

    describe('Merge Conflict Events', () => {
        it('should serialize Merge Conflict event to external format', () => {
            const mergeConflictEvent: WMLEventUpdate = {
                type: 'Merge Conflict',
                error: 'Merge conflict occurred during edit application'
            }

            const externalEvent = serializer.serialize({ update: mergeConflictEvent, header: makeWmlHeader('Merge Conflict') })
            expect(externalEvent.type).toBe('Merge Conflict')
            if (externalEvent.type === 'Merge Conflict') {
                expect(externalEvent.error).toBe('Merge conflict occurred during edit application')
            }
        })

        it('should deserialize Merge Conflict event from external format', () => {
            const externalEvent: WMLEventExternal = {
                type: 'Merge Conflict',
                error: 'Merge conflict occurred during edit application'
            }

            const internalEvent = serializer.deserialize({
                externalUpdate: externalEvent,
                header: makeWmlHeader('Merge Conflict')
            })

            expect(internalEvent).toBeDefined()
            if (internalEvent && internalEvent.type === 'Merge Conflict') {
                expect(internalEvent.error).toBe('Merge conflict occurred during edit application')
            }
        })

        it('should handle Merge Conflict round-trip correctly', () => {
            const originalEvent: WMLEventUpdate = {
                type: 'Merge Conflict',
                error: 'Merge conflict occurred during edit application'
            }

            // Serialize to external format
            const externalEvent = serializer.serialize({ update: originalEvent, header: makeWmlHeader('Merge Conflict') })
            expect(externalEvent.type).toBe('Merge Conflict')

            // Deserialize back to internal format
            const roundTripEvent = serializer.deserialize({
                externalUpdate: externalEvent,
                header: makeWmlHeader('Merge Conflict')
            })

            expect(roundTripEvent).toBeDefined()
            if (roundTripEvent && roundTripEvent.type === 'Merge Conflict') {
                expect(roundTripEvent.error).toBe(originalEvent.error)
            }
        })

        it('should include RequestIds in serialized Merge Conflict when present', () => {
            const mergeConflictEvent: WMLEventUpdate = {
                type: 'Merge Conflict',
                error: 'Conflict',
                RequestIds: ['req-mc-1']
            }
            const externalEvent = serializer.serialize({ update: mergeConflictEvent, header: makeWmlHeader('Merge Conflict') })
            expect(externalEvent.type).toBe('Merge Conflict')
            if (externalEvent.type === 'Merge Conflict') {
                expect(externalEvent.RequestIds).toEqual(['req-mc-1'])
            }
        })

        it('should preserve RequestIds when deserializing Merge Conflict', () => {
            const externalEvent: WMLEventExternal = {
                type: 'Merge Conflict',
                error: 'Conflict',
                RequestIds: ['req-mc-2']
            }
            const internalEvent = serializer.deserialize({
                externalUpdate: externalEvent,
                header: makeWmlHeader('Merge Conflict')
            })
            expect(internalEvent).toBeDefined()
            if (internalEvent && internalEvent.type === 'Merge Conflict') {
                expect(internalEvent.RequestIds).toEqual(['req-mc-2'])
            }
        })
    })

    describe('Purge Events', () => {
        it('should serialize Asset Purged event to external format', () => {
            const purgeEvent: WMLEventUpdate = {
                type: 'Asset Purged',
                zone: 'Draft',
                objectsDeleted: 42
            }

            const externalEvent = serializer.serialize({ update: purgeEvent, header: makeWmlHeader('Asset Purged') })
            expect(externalEvent.type).toBe('Asset Purged')
            if (externalEvent.type === 'Asset Purged') {
                expect(externalEvent.zone).toBe('Draft')
                expect(externalEvent.objectsDeleted).toBe(42)
            }
        })

        it('should deserialize Asset Purged event from external format', () => {
            const externalEvent: WMLEventExternal = {
                type: 'Asset Purged',
                zone: 'Archive',
                objectsDeleted: 15
            }

            const internalEvent = serializer.deserialize({
                externalUpdate: externalEvent,
                header: makeWmlHeader('Asset Purged')
            })

            expect(internalEvent).not.toBeNull()
            if (internalEvent && internalEvent.type === 'Asset Purged') {
                expect(internalEvent.zone).toBe('Archive')
                expect(internalEvent.objectsDeleted).toBe(15)
            }
        })

        it('should handle Asset Purged round-trip correctly', () => {
            const originalEvent: WMLEventUpdate = {
                type: 'Asset Purged',
                zone: 'Draft',
                objectsDeleted: 100
            }

            // Serialize to external format
            const externalEvent = serializer.serialize({ update: originalEvent, header: makeWmlHeader('Asset Purged') })
            expect(externalEvent.type).toBe('Asset Purged')

            // Deserialize back to internal format
            const roundTripEvent = serializer.deserialize({
                externalUpdate: externalEvent,
                header: makeWmlHeader('Asset Purged')
            })

            expect(roundTripEvent).toBeDefined()
            if (roundTripEvent && roundTripEvent.type === 'Asset Purged') {
                expect(roundTripEvent.zone).toBe(originalEvent.zone)
                expect(roundTripEvent.objectsDeleted).toBe(originalEvent.objectsDeleted)
            }
        })
    })

    describe('deserialize when header and payload type disagree - header wins', () => {
        it('should deserialize as Zone Changed when header says Zone Changed but payload has Content Update shape', () => {
            const externalEvent = {
                type: 'Content Update',
                wml: deIndentWML(`<Asset uuid=(test)></Asset>`),
                fromZone: 'Draft',
                toZone: 'Canon'
            } as any

            const internalEvent = serializer.deserialize({
                externalUpdate: externalEvent,
                header: makeWmlHeader('Zone Changed')
            })

            expect(internalEvent).not.toBeNull()
            expect(internalEvent!.type).toBe('Zone Changed')
            expect((internalEvent as any).fromZone).toBe('Draft')
            expect((internalEvent as any).toZone).toBe('Canon')
            expect((internalEvent as any).wml).toBeDefined()
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
            const result = aggregator.applyUpdate(view, { header: makeWmlHeader('Content Update'), content: { type: 'Content Update', schema: delta } })
            expect(result.success).toBe(true)
            if (result.success) {
                expect(result.snapshot).toBeDefined()
                expect(result.snapshot.components).toBeDefined()
                expect(Array.isArray(result.snapshot.components)).toBe(true)
            }
        })

        it('should return success false and unchanged snapshot for Merge Conflict', () => {
            const view = aggregator.createEmpty()
            const result = aggregator.applyUpdate(view, { header: makeWmlHeader('Merge Conflict'), content: { type: 'Merge Conflict', error: 'conflict' } })
            expect(result.success).toBe(false)
            expect(result.snapshot).toBe(view)
        })
    })
})

describe('WMLDataSourceEventSerializer', () => {
    const serializer = new WMLDataSourceEventSerializer()

    it('should deserialize Content Update external to internal', () => {
        const wml = deIndentWML(`<Asset uuid=(test)></Asset>`)
        const result = serializer.deserialize({
            externalUpdate: { type: 'Content Update', wml },
            header: makeWmlHeader('Content Update')
        })
        expect(result).not.toBeNull()
        expect(result!.type).toBe('Content Update')
        if (result && result.type === 'Content Update') {
            expect(result.schema).toBeInstanceOf(StandardForm)
        }
    })

    it('should deserialize Merge Conflict external to internal', () => {
        const result = serializer.deserialize({
            externalUpdate: { type: 'Merge Conflict', error: 'Conflict' },
            header: makeWmlHeader('Merge Conflict')
        })
        expect(result).not.toBeNull()
        expect(result!.type).toBe('Merge Conflict')
    })

    it('should return null for non-content external event (Zone Changed)', () => {
        const result = serializer.deserialize({
            externalUpdate: { type: 'Zone Changed', fromZone: 'Draft', toZone: 'Canon' } as any,
            header: makeWmlHeader('Zone Changed')
        })
        expect(result).toBeNull()
    })

    it('should deserializeSnapshot as identity', () => {
        const snapshot = {
            universalKey: 'ASSET#test' as any,
            components: [],
            metaData: []
        }
        const result = serializer.deserializeSnapshot(snapshot)
        expect(result).toBe(snapshot)
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
        expect(isWMLMaterializedView({ type: 'Content Update', schema: {} })).toBe(false)
    })
})
