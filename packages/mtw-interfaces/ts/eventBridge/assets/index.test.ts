// Tests for Assets Data Source Event Contracts
// 
// This file contains comprehensive tests for the Assets event serializers,
// type guards, and event contracts.

import { 
    AssetsEventSerializer, 
    AssetsEventUpdate, 
    AssetsEventExternal,
    ComponentEventUpdate,
    ComponentUpdatedEvent,
    AssetLevelEventUpdate,
    isAssetsComponentUpdatedEvent,
    isAssetsComponentEvent,
    isAssetsLevelEvent
} from './index'
import { StandardCharacter } from '@tonylb/mtw-wml/ts/standardize/components/character'
import { deIndentWML } from '@tonylb/mtw-wml/ts/schema/utils'

describe('AssetsEventSerializer', () => {
    let serializer: AssetsEventSerializer

    beforeEach(() => {
        serializer = new AssetsEventSerializer()
    })

    describe('Component Events', () => {
        it('should serialize Component Updated event to external format', () => {
            const character = new StandardCharacter(deIndentWML(`
                <Character key=(test-character) uuid=(test-character)>
                    <Name>Test Character</Name>
                </Character>
            `))

            const componentEvent: ComponentUpdatedEvent = {
                type: 'Component Updated',
                assetId: 'ASSET#test-asset',
                component: character
            }

            const externalEvent = serializer.serialize({
                dataSourceKey: 'mtw.assets',
                streamKey: 'ASSET#test-asset',
                update: componentEvent
            })

            expect(externalEvent.type).toBe('Component Updated')
            expect(externalEvent.assetId).toBe('ASSET#test-asset')
            expect(externalEvent.componentId).toBe('CHARACTER#test-character')
            expect(externalEvent.wml).toBe(deIndentWML(`
                <Character uuid=(test-character) key=(test-character)>
                    <Name>Test Character</Name>
                </Character>
            `))
        })

        it('should deserialize Component Updated event from external format', () => {
            const externalEvent: AssetsEventExternal = {
                type: 'Component Updated',
                assetId: 'ASSET#test-asset',
                componentId: 'CHARACTER#test-character',
                wml: deIndentWML(`
                    <Character key=(test-character) uuid=(test-character)>
                        <Name>Test Character</Name>
                    </Character>
                `)
            }

            const internalEvent = serializer.deserialize({
                dataSourceKey: 'mtw.assets',
                detailType: 'Component Updated',
                streamKey: 'ASSET#test-asset',
                externalUpdate: externalEvent
            })

            expect(internalEvent).not.toBeNull()
            expect(internalEvent!.type).toBe('Component Updated')
            if (isAssetsComponentUpdatedEvent(internalEvent!)) {
                expect(internalEvent.assetId).toBe('ASSET#test-asset')
                expect(internalEvent.component.universalKey).toBe('CHARACTER#test-character')
                expect(internalEvent.component).toBeInstanceOf(StandardCharacter)
            }
        })

        it('should handle Component Updated round-trip correctly', () => {
            const originalCharacter = new StandardCharacter(deIndentWML(`
                <Character key=(test-character) uuid=(test-character)>
                    <Name>Test Character</Name>
                </Character>
            `))

            const originalEvent: ComponentUpdatedEvent = {
                type: 'Component Updated',
                assetId: 'ASSET#test-asset',
                component: originalCharacter
            }

            // Serialize to external format
            const externalEvent = serializer.serialize({
                dataSourceKey: 'mtw.assets',
                streamKey: 'ASSET#test-asset',
                update: originalEvent
            })

            // Deserialize back to internal format
            const deserializedEvent = serializer.deserialize({
                dataSourceKey: 'mtw.assets',
                detailType: 'Component Updated',
                streamKey: 'ASSET#test-asset',
                externalUpdate: externalEvent
            })

            // Verify the component is preserved
            expect(deserializedEvent).not.toBeNull()
            expect(isAssetsComponentUpdatedEvent(deserializedEvent!)).toBe(true)
            if (isAssetsComponentUpdatedEvent(deserializedEvent!)) {
                expect(deserializedEvent.assetId).toBe('ASSET#test-asset')
                expect(deserializedEvent.component.universalKey).toBe('CHARACTER#test-character')
                expect(deserializedEvent.component).toBeInstanceOf(StandardCharacter)
            }
        })
    })

    describe('Asset Level Events', () => {
        it('should serialize Asset Cached event (pass-through)', () => {
            const assetEvent: AssetLevelEventUpdate = {
                type: 'Asset Cached',
                assetId: 'ASSET#test-asset'
            }

            const externalEvent = serializer.serialize({
                dataSourceKey: 'mtw.assets',
                streamKey: 'ASSET#test-asset',
                update: assetEvent
            })

            expect(externalEvent.type).toBe('Asset Cached')
            expect(externalEvent.assetId).toBe('ASSET#test-asset')
        })

        it('should serialize Asset Decached event (pass-through)', () => {
            const assetEvent: AssetLevelEventUpdate = {
                type: 'Asset Decached',
                assetId: 'ASSET#test-asset'
            }

            const externalEvent = serializer.serialize({
                dataSourceKey: 'mtw.assets',
                streamKey: 'ASSET#test-asset',
                update: assetEvent
            })

            expect(externalEvent.type).toBe('Asset Decached')
            expect(externalEvent.assetId).toBe('ASSET#test-asset')
        })

        it('should serialize Asset Removed event (pass-through)', () => {
            const assetEvent: AssetLevelEventUpdate = {
                type: 'Asset Removed',
                assetId: 'ASSET#test-asset'
            }

            const externalEvent = serializer.serialize({
                dataSourceKey: 'mtw.assets',
                streamKey: 'ASSET#test-asset',
                update: assetEvent
            })

            expect(externalEvent.type).toBe('Asset Removed')
            expect(externalEvent.assetId).toBe('ASSET#test-asset')
        })

        it('should serialize Canon Updated event (pass-through)', () => {
            const assetEvent: AssetLevelEventUpdate = {
                type: 'Canon Updated',
                assetId: 'ASSET#test-asset'
            }

            const externalEvent = serializer.serialize({
                dataSourceKey: 'mtw.assets',
                streamKey: 'ASSET#test-asset',
                update: assetEvent
            })

            expect(externalEvent.type).toBe('Canon Updated')
            expect(externalEvent.assetId).toBe('ASSET#test-asset')
        })

        it('should deserialize Asset Level events (pass-through)', () => {
            const externalEvent: AssetsEventExternal = {
                type: 'Asset Cached',
                assetId: 'ASSET#test-asset'
            }

            const internalEvent = serializer.deserialize({
                dataSourceKey: 'mtw.assets',
                detailType: 'Asset Cached',
                streamKey: 'ASSET#test-asset',
                externalUpdate: externalEvent
            })

            expect(internalEvent).not.toBeNull()
            expect(internalEvent!.type).toBe('Asset Cached')
            expect(internalEvent!.assetId).toBe('ASSET#test-asset')
        })

        it('should handle Asset Level round-trip correctly', () => {
            const originalEvent: AssetLevelEventUpdate = {
                type: 'Asset Cached',
                assetId: 'ASSET#test-asset'
            }

            // Serialize to external format
            const externalEvent = serializer.serialize({
                dataSourceKey: 'mtw.assets',
                streamKey: 'ASSET#test-asset',
                update: originalEvent
            })

            // Deserialize back to internal format
            const deserializedEvent = serializer.deserialize({
                dataSourceKey: 'mtw.assets',
                detailType: 'Asset Cached',
                streamKey: 'ASSET#test-asset',
                externalUpdate: externalEvent
            })

            // Verify the event is preserved
            expect(deserializedEvent).not.toBeNull()
            expect(deserializedEvent!.type).toBe('Asset Cached')
            expect(deserializedEvent!.assetId).toBe('ASSET#test-asset')
        })
    })

    describe('Error Handling', () => {
        it('should handle unknown event types in serialize', () => {
            const unknownEvent = {
                type: 'Unknown Event',
                assetId: 'ASSET#test-asset'
            } as any

            expect(() => {
                serializer.serialize({
                    dataSourceKey: 'mtw.assets',
                    streamKey: 'ASSET#test-asset',
                    update: unknownEvent
                })
            }).toThrow('Unknown event type in AssetsEventUpdate')
        })

        it('should handle invalid WML in Component Updated deserialize', () => {
            const externalEvent: AssetsEventExternal = {
                type: 'Component Updated',
                assetId: 'ASSET#test-asset',
                componentId: 'CHARACTER#test-character',
                wml: 'invalid-wml-content'
            }

            expect(() => {
                serializer.deserialize({
                    dataSourceKey: 'mtw.assets',
                    detailType: 'Component Updated',
                    streamKey: 'ASSET#test-asset',
                    externalUpdate: externalEvent
                })
            }).toThrow()
        })

        it('should handle missing component in WML', () => {
            const externalEvent: AssetsEventExternal = {
                type: 'Component Updated',
                assetId: 'ASSET#test-asset',
                componentId: 'CHARACTER#missing-character',
                wml: deIndentWML(`
                    <Character key=(test-character) uuid=(test-character)>
                        <Name>Test Character</Name>
                    </Character>
                `)
            }

            expect(() => {
                serializer.deserialize({
                    dataSourceKey: 'mtw.assets',
                    detailType: 'Component Updated',
                    streamKey: 'ASSET#test-asset',
                    externalUpdate: externalEvent
                })
            }).toThrow('Component ID mismatch: expected CHARACTER#missing-character')
        })
    })

    describe('Type Guards', () => {
        describe('isAssetsComponentUpdatedEvent', () => {
            it('should return true for valid Component Updated events', () => {
                const character = new StandardCharacter(deIndentWML(`
                    <Character key=(test-character) uuid=(test-character)>
                        <Name>Test Character</Name>
                    </Character>
                `))

                const event = {
                    type: 'Component Updated',
                    assetId: 'ASSET#test-asset',
                    component: character
                }

                expect(isAssetsComponentUpdatedEvent(event)).toBe(true)
            })

            it('should return false for invalid events', () => {
                expect(isAssetsComponentUpdatedEvent(null)).toBe(false)
                expect(isAssetsComponentUpdatedEvent(undefined)).toBe(false)
                expect(isAssetsComponentUpdatedEvent({})).toBe(false)
                expect(isAssetsComponentUpdatedEvent({ type: 'Asset Cached' })).toBe(false)
                expect(isAssetsComponentUpdatedEvent({ type: 'Component Updated' })).toBe(false)
            })
        })

        describe('isAssetsComponentEvent', () => {
            it('should return true for valid component events', () => {
                const character = new StandardCharacter(deIndentWML(`
                    <Character key=(test-character) uuid=(test-character)>
                        <Name>Test Character</Name>
                    </Character>
                `))

                const event = {
                    type: 'Component Updated',
                    assetId: 'ASSET#test-asset',
                    component: character
                }

                expect(isAssetsComponentEvent(event)).toBe(true)
            })
        })

        describe('isAssetsLevelEvent', () => {
            it('should return true for asset level events', () => {
                const assetEvent: AssetLevelEventUpdate = {
                    type: 'Asset Cached',
                    assetId: 'ASSET#test-asset'
                }

                expect(isAssetsLevelEvent(assetEvent)).toBe(true)
            })

            it('should return false for component events', () => {
                const componentEvent: ComponentUpdatedEvent = {
                    type: 'Component Updated',
                    assetId: 'ASSET#test-asset',
                    component: new StandardCharacter(deIndentWML(`
                        <Character key=(test-character) uuid=(test-character)>
                            <Name>Test Character</Name>
                        </Character>
                    `))
                }

                expect(isAssetsLevelEvent(componentEvent)).toBe(false)
            })
        })
    })
})
