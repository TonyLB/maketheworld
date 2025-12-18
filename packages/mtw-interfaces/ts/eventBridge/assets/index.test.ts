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
    ComponentRemovedEvent,
    AssetLevelEventUpdate,
    AssetCachedEventUpdate,
    isAssetsComponentUpdatedEvent,
    isAssetsComponentRemovedEvent,
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
                component: character
            }

            const externalEvent = serializer.serialize({
                dataSourceKey: 'mtw.assets',
                streamKey: 'ASSET#test-asset',
                update: componentEvent
            })

            expect(externalEvent.type).toBe('Component Updated')
            if (externalEvent.type === 'Component Updated') {
                expect(externalEvent.componentId).toBe('CHARACTER#test-character')
                expect(externalEvent.wml).toBe(deIndentWML(`
                <Character uuid=(test-character) key=(test-character)>
                    <Name>Test Character</Name>
                </Character>
            `))
            }
        })

        it('should deserialize Component Updated event from external format', () => {
            const externalEvent: AssetsEventExternal = {
                type: 'Component Updated',
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
                expect(deserializedEvent.component.universalKey).toBe('CHARACTER#test-character')
                expect(deserializedEvent.component).toBeInstanceOf(StandardCharacter)
            }
        })

        it('should serialize Component Removed event to external format', () => {
            const character = new StandardCharacter(deIndentWML(`
                <Character key=(test-character) uuid=(test-character)>
                    <Name>Test Character</Name>
                </Character>
            `))

            const componentEvent: ComponentRemovedEvent = {
                type: 'Component Removed',
                component: character
            }

            const externalEvent = serializer.serialize({
                dataSourceKey: 'mtw.assets',
                streamKey: 'ASSET#test-asset',
                update: componentEvent
            })

            expect(externalEvent.type).toBe('Component Removed')
            if (externalEvent.type === 'Component Removed') {
                expect(externalEvent.componentId).toBe('CHARACTER#test-character')
                expect(externalEvent.wml).toBe(deIndentWML(`
                <Character uuid=(test-character) key=(test-character)>
                    <Name>Test Character</Name>
                </Character>
            `))
            }
        })

        it('should deserialize Component Removed event from external format', () => {
            const externalEvent: AssetsEventExternal = {
                type: 'Component Removed',
                componentId: 'CHARACTER#test-character',
                wml: deIndentWML(`
                    <Character key=(test-character) uuid=(test-character)>
                        <Name>Test Character</Name>
                    </Character>
                `)
            }

            const internalEvent = serializer.deserialize({
                dataSourceKey: 'mtw.assets',
                detailType: 'Component Removed',
                streamKey: 'ASSET#test-asset',
                externalUpdate: externalEvent
            })

            expect(internalEvent).not.toBeNull()
            expect(internalEvent!.type).toBe('Component Removed')
            if (isAssetsComponentRemovedEvent(internalEvent!)) {
                expect(internalEvent.component.universalKey).toBe('CHARACTER#test-character')
                expect(internalEvent.component).toBeInstanceOf(StandardCharacter)
            }
        })

        it('should handle Component Removed round-trip correctly', () => {
            const originalCharacter = new StandardCharacter(deIndentWML(`
                <Character key=(test-character) uuid=(test-character)>
                    <Name>Test Character</Name>
                </Character>
            `))

            const originalEvent: ComponentRemovedEvent = {
                type: 'Component Removed',
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
                detailType: 'Component Removed',
                streamKey: 'ASSET#test-asset',
                externalUpdate: externalEvent
            })

            // Verify the component is preserved
            expect(deserializedEvent).not.toBeNull()
            expect(isAssetsComponentRemovedEvent(deserializedEvent!)).toBe(true)
            if (isAssetsComponentRemovedEvent(deserializedEvent!)) {
                expect(deserializedEvent.component.universalKey).toBe('CHARACTER#test-character')
                expect(deserializedEvent.component).toBeInstanceOf(StandardCharacter)
            }
        })
    })

    describe('Asset Level Events', () => {
        it('should serialize Asset Cached event (pass-through)', () => {
            const assetEvent: AssetLevelEventUpdate = {
                type: 'Asset Cached',
                zone: 'Canon'
            }

            const externalEvent = serializer.serialize({
                dataSourceKey: 'mtw.assets',
                streamKey: 'ASSET#test-asset',
                update: assetEvent
            })

            expect(externalEvent.type).toBe('Asset Cached')
            if (externalEvent.type === 'Asset Cached') {
                expect(externalEvent.zone).toBe('Canon')
            }
        })

        it('should serialize Asset Decached event (pass-through)', () => {
            const assetEvent: AssetLevelEventUpdate = {
                type: 'Asset Decached'
            }

            const externalEvent = serializer.serialize({
                dataSourceKey: 'mtw.assets',
                streamKey: 'ASSET#test-asset',
                update: assetEvent
            })

            expect(externalEvent.type).toBe('Asset Decached')
        })

        it('should serialize Asset Removed event (pass-through)', () => {
            const assetEvent: AssetLevelEventUpdate = {
                type: 'Asset Removed',
                zone: 'Canon'
            }

            const externalEvent = serializer.serialize({
                dataSourceKey: 'mtw.assets',
                streamKey: 'ASSET#test-asset',
                update: assetEvent
            })

            expect(externalEvent.type).toBe('Asset Removed')
            if (externalEvent.type === 'Asset Removed') {
                expect(externalEvent.zone).toBe('Canon')
            }
        })

        it('should serialize Canon Updated event (pass-through)', () => {
            const assetEvent: AssetLevelEventUpdate = {
                type: 'Canon Updated',
                assetIds: ['ASSET#test-asset']
            }

            const externalEvent = serializer.serialize({
                dataSourceKey: 'mtw.assets',
                streamKey: 'ASSET#test-asset',
                update: assetEvent
            })

            expect(externalEvent.type).toBe('Canon Updated')
            if (externalEvent.type === 'Canon Updated') {
                expect(externalEvent.assetIds).toEqual(['ASSET#test-asset'])
            }
        })

        it('should deserialize Asset Level events (pass-through)', () => {
            const externalEvent: AssetsEventExternal = {
                type: 'Asset Cached',
                zone: 'Canon'
            }

            const internalEvent = serializer.deserialize({
                dataSourceKey: 'mtw.assets',
                detailType: 'Asset Cached',
                streamKey: 'ASSET#test-asset',
                externalUpdate: externalEvent
            })

            expect(internalEvent).not.toBeNull()
            expect(internalEvent!.type).toBe('Asset Cached')
            if (internalEvent!.type === 'Asset Cached') {
                const assetEvent = internalEvent as AssetCachedEventUpdate
                expect(assetEvent.zone).toBe('Canon')
            }
        })

        it('should handle Asset Level round-trip correctly', () => {
            const originalEvent: AssetLevelEventUpdate = {
                type: 'Asset Cached',
                zone: 'Canon'
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
            if (deserializedEvent!.type === 'Asset Cached') {
                const assetEvent = deserializedEvent as AssetCachedEventUpdate
                expect(assetEvent.zone).toBe('Canon')
            }
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
                    component: character
                }

                expect(isAssetsComponentEvent(event)).toBe(true)
            })
        })

        describe('isAssetsComponentRemovedEvent', () => {
            it('should return true for valid Component Removed events', () => {
                const character = new StandardCharacter(deIndentWML(`
                    <Character key=(test-character) uuid=(test-character)>
                        <Name>Test Character</Name>
                    </Character>
                `))

                const event = {
                    type: 'Component Removed',
                    component: character
                }

                expect(isAssetsComponentRemovedEvent(event)).toBe(true)
            })

            it('should return false for invalid events', () => {
                expect(isAssetsComponentRemovedEvent(null)).toBe(false)
                expect(isAssetsComponentRemovedEvent(undefined)).toBe(false)
                expect(isAssetsComponentRemovedEvent({})).toBe(false)
                expect(isAssetsComponentRemovedEvent({ type: 'Asset Cached' })).toBe(false)
                expect(isAssetsComponentRemovedEvent({ type: 'Component Removed' })).toBe(false)
            })
        })

        describe('isAssetsLevelEvent', () => {
            it('should return true for asset level events', () => {
                const assetEvent: AssetLevelEventUpdate = {
                    type: 'Asset Cached',
                    zone: 'Canon'
                }

                expect(isAssetsLevelEvent(assetEvent)).toBe(true)
            })

            it('should return false for component events', () => {
                const componentEvent: ComponentUpdatedEvent = {
                    type: 'Component Updated',
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
