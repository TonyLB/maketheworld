import { WMLEventSerializer, WMLEventUpdate, WMLEventExternal, isWMLContentUpdateEvent } from './index'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import { deIndentWML } from '@tonylb/mtw-wml/ts/schema/utils'

describe('WMLEventSerializer', () => {
    let serializer: WMLEventSerializer

    beforeEach(() => {
        serializer = new WMLEventSerializer()
    })

    describe('Content Events', () => {
        it('should serialize Content Update event to WML string', () => {
            const standardForm = new StandardForm(deIndentWML(`
                <Asset uuid=(test-asset)>
                    <Room key=(test-room) uuid=(test-room)>
                        <Name>Test Room</Name>
                        <Description>A test room for testing purposes</Description>
                    </Room>
                </Asset>
            `))

            const contentEvent: WMLEventUpdate = {
                type: 'Content Update',
                schema: standardForm
            }

            const externalEvent = serializer.serialize({ dataSourceKey: 'mtw.wml', streamKey: 'ASSET#test-asset', update: contentEvent })
            expect(externalEvent.type).toBe('Content Update')
            if (externalEvent.type === 'Content Update') {
                expect(typeof externalEvent.wml).toBe('string')
                expect(externalEvent.wml).toContain('Room')
                expect(externalEvent.wml).toContain('test-room')
            }
        })

        it('should serialize Content Removed event', () => {
            const contentEvent: WMLEventUpdate = {
                type: 'Content Removed'
            }

            const externalEvent = serializer.serialize({ dataSourceKey: 'mtw.wml', streamKey: 'ASSET#test-asset', update: contentEvent })
            expect(externalEvent.type).toBe('Content Removed')
            // Content Removed events don't have a wml property
            expect('wml' in externalEvent).toBe(false)
        })

        it('should deserialize Content Update event from WML string', () => {
            const wmlString = deIndentWML(`
                <Asset uuid=(test-asset)>
                    <Room key=(test-room) uuid=(test-room)>
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
                dataSourceKey: 'mtw.wml',
                streamKey: 'ASSET#test-asset',
                externalUpdate: externalEvent
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
                    <Room key=(test-room) uuid=(test-room)>
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
            const externalEvent = serializer.serialize({ dataSourceKey: 'mtw.wml', streamKey: 'ASSET#test-asset', update: contentEvent })
            
            // Deserialize back to internal format
            const deserializedEvent = serializer.deserialize({
                dataSourceKey: 'mtw.wml',
                streamKey: 'ASSET#test-asset',
                externalUpdate: externalEvent
            })
            
            // Verify the schema is preserved
            expect(deserializedEvent).not.toBeNull()
            expect(isWMLContentUpdateEvent(deserializedEvent!)).toBe(true)
            if (isWMLContentUpdateEvent(deserializedEvent!)) {
                expect(deserializedEvent.schema).toBeDefined()
                expect(deserializedEvent.schema).toBeInstanceOf(StandardForm)
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

            const externalEvent = serializer.serialize({ dataSourceKey: 'mtw.wml', streamKey: 'ASSET#test-asset', update: zoneEvent })
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
                dataSourceKey: 'mtw.wml',
                streamKey: 'ASSET#test-asset',
                externalUpdate: externalEvent
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
            const externalEvent = serializer.serialize({ dataSourceKey: 'mtw.wml', streamKey: 'ASSET#test-asset', update: originalEvent })
            
            // Deserialize back to internal format
            const deserializedEvent = serializer.deserialize({
                dataSourceKey: 'mtw.wml',
                streamKey: 'ASSET#test-asset',
                externalUpdate: externalEvent
            })
            
            // Verify complete round-trip
            expect(deserializedEvent).toEqual(originalEvent)
        })
    })

    describe('Error Handling', () => {
        it('should handle unknown event types', () => {
            const unknownEvent = { type: 'Unknown', AssetId: 'ASSET#test' } as any

            expect(() => {
                serializer.serialize({ dataSourceKey: 'mtw.wml', streamKey: 'ASSET#test', update: unknownEvent })
            }).toThrow('Unknown WML event type')
        })

        it('should handle invalid WML in Content Update', () => {
            const externalEvent: WMLEventExternal = {
                type: 'Content Update',
                wml: 'invalid-wml-content'
            }

            expect(() => {
                serializer.deserialize({
                    dataSourceKey: 'mtw.wml',
                    streamKey: 'ASSET#test-asset',
                    externalUpdate: externalEvent
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
                    dataSourceKey: 'mtw.wml',
                    streamKey: 'ASSET#test-asset',
                    externalUpdate: externalEvent
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

            const externalEvent = serializer.serialize({ dataSourceKey: 'mtw.wml', streamKey: 'ASSET#test-asset', update: mergeConflictEvent })
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
                dataSourceKey: 'mtw.wml',
                streamKey: 'ASSET#test-asset',
                externalUpdate: externalEvent
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
            const externalEvent = serializer.serialize({ dataSourceKey: 'mtw.wml', streamKey: 'ASSET#test-asset', update: originalEvent })
            expect(externalEvent.type).toBe('Merge Conflict')

            // Deserialize back to internal format
            const roundTripEvent = serializer.deserialize({
                dataSourceKey: 'mtw.wml',
                streamKey: 'ASSET#test-asset',
                externalUpdate: externalEvent
            })

            expect(roundTripEvent).toBeDefined()
            if (roundTripEvent && roundTripEvent.type === 'Merge Conflict') {
                expect(roundTripEvent.error).toBe(originalEvent.error)
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

            const externalEvent = serializer.serialize({ dataSourceKey: 'mtw.wml', streamKey: 'ASSET#test-asset', update: purgeEvent })
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
                dataSourceKey: 'mtw.wml',
                streamKey: 'ASSET#test-asset',
                externalUpdate: externalEvent
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
            const externalEvent = serializer.serialize({ dataSourceKey: 'mtw.wml', streamKey: 'ASSET#test-asset', update: originalEvent })
            expect(externalEvent.type).toBe('Asset Purged')

            // Deserialize back to internal format
            const roundTripEvent = serializer.deserialize({
                dataSourceKey: 'mtw.wml',
                streamKey: 'ASSET#test-asset',
                externalUpdate: externalEvent
            })

            expect(roundTripEvent).toBeDefined()
            if (roundTripEvent && roundTripEvent.type === 'Asset Purged') {
                expect(roundTripEvent.zone).toBe(originalEvent.zone)
                expect(roundTripEvent.objectsDeleted).toBe(originalEvent.objectsDeleted)
            }
        })
    })

})
