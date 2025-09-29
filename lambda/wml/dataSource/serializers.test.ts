import { WMLEventSerializer, WMLEventUpdate, WMLEventExternal } from './serializers'
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
                <Asset key=(test-asset)>
                    <Room key=(test-room) uuid=(test-room)>
                        <Name>Test Room</Name>
                        <Description>A test room for testing purposes</Description>
                    </Room>
                </Asset>
            `))

            const contentEvent: WMLEventUpdate = {
                type: 'Content Update',
                schema: standardForm.schema
            }

            const externalEvent = serializer.serialize({ update: contentEvent })
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

            const externalEvent = serializer.serialize({ update: contentEvent })
            expect(externalEvent.type).toBe('Content Removed')
            if (externalEvent.type === 'Content Removed') {
                expect(externalEvent.wml).toBeUndefined()
            }
        })

        it('should deserialize Content Update event from WML string', () => {
            const wmlString = deIndentWML(`
                <Asset key=(test-asset)>
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

            expect(internalEvent!.type).toBe('Content Update')
            if (internalEvent!.type === 'Content Update') {
                expect(internalEvent!.schema).toBeDefined()
            }
        })

        it('should handle Content Update round-trip correctly', () => {
            const originalForm = new StandardForm(deIndentWML(`
                <Asset key=(test-asset)>
                    <Room key=(test-room) uuid=(test-room)>
                        <Name>Test Room</Name>
                        <Description>A test room for testing purposes</Description>
                    </Room>
                </Asset>
            `))

            const contentEvent: WMLEventUpdate = {
                type: 'Content Update',
                schema: originalForm.schema
            }

            // Serialize to external format
            const externalEvent = serializer.serialize({ update: contentEvent })
            
            // Deserialize back to internal format
            const deserializedEvent = serializer.deserialize({
                dataSourceKey: 'mtw.wml',
                streamKey: 'ASSET#test-asset',
                externalUpdate: externalEvent
            })
            
            // Verify the schema is preserved
            expect(deserializedEvent!.type).toBe('Content Update')
            if (deserializedEvent!.type === 'Content Update') {
                expect(deserializedEvent!.schema).toBeDefined()
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

            const externalEvent = serializer.serialize({ update: zoneEvent })
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
            const externalEvent = serializer.serialize({ update: originalEvent })
            
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
                serializer.serialize({ update: unknownEvent })
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
    })
})
