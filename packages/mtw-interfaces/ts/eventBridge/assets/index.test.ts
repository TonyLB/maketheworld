// Tests for Assets Data Source Event Contracts
// 
// This file contains comprehensive tests for the Assets event serializers,
// type guards, and event contracts.

import { 
    AssetsEventSerializer, 
    AssetsEventUpdate, 
    AssetsEventExternal,
    ComponentEventUpdate,
    ComponentRepublishedEvent,
    ComponentUpdatedEvent,
    ComponentRemovedEvent,
    AssetLevelEventUpdate,
    AssetCachedEventUpdate,
    isAssetsComponentRepublishedEvent,
    isAssetsComponentUpdatedEvent,
    isAssetsComponentRemovedEvent,
    isAssetsComponentEvent,
    isAssetsLevelEvent
} from './index'
import type { StreamingEventHeader } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'
import { StandardCharacter } from '@tonylb/mtw-wml/ts/standardize/components/character'
import { deIndentWML } from '@tonylb/mtw-wml/ts/schema/utils'

const assetsDataSourceKey = 'mtw.assets'
const assetsStreamKey = 'ASSET#test-asset'
const assetsTimestamp = 0

function makeAssetsHeader(type: string): StreamingEventHeader {
    return { dataSourceKey: assetsDataSourceKey, streamKey: assetsStreamKey, timestamp: assetsTimestamp, type }
}

describe('AssetsEventSerializer', () => {
    let serializer: AssetsEventSerializer

    beforeEach(() => {
        serializer = new AssetsEventSerializer()
    })

    describe('Component Events', () => {
        it('should serialize Component Updated event to external format', () => {
            const character = new StandardCharacter(deIndentWML(`
                <Character key=(testcharacter) uuid=(testcharacter)>
                    <DisplayName>Test Character</DisplayName>
                </Character>
            `))

            const componentEvent: ComponentUpdatedEvent = {
                component: character
            }

            const externalEvent = serializer.serialize({
                content: componentEvent,
                header: makeAssetsHeader('Component Updated')
            })

            expect('componentId' in externalEvent).toBe(true)
            expect('wml' in externalEvent).toBe(true)
            if ('componentId' in externalEvent) {
                expect(externalEvent.componentId).toBe('CHARACTER#testcharacter')
                expect(externalEvent.wml).toBe(deIndentWML(`
                <Character uuid=(testcharacter) key=(testcharacter)>
                    <DisplayName>Test Character</DisplayName>
                </Character>
            `))
            }
        })

        it('should deserialize Component Updated event from external format', async () => {
            const externalEvent: AssetsEventExternal = {
                componentId: 'CHARACTER#testcharacter',
                wml: deIndentWML(`
                    <Character key=(testcharacter) uuid=(testcharacter)>
                        <DisplayName>Test Character</DisplayName>
                    </Character>
                `)
            }

            const internalEvent = await serializer.deserialize({
                content: externalEvent,
                header: makeAssetsHeader('Component Updated')
            })

            expect(internalEvent).not.toBeNull()
            expect(isAssetsComponentUpdatedEvent(internalEvent!)).toBe(true)
            if (isAssetsComponentUpdatedEvent(internalEvent!)) {
                expect(internalEvent.component.universalKey).toBe('CHARACTER#testcharacter')
                expect(internalEvent.component).toBeInstanceOf(StandardCharacter)
            }
        })

        it('should handle Component Updated round-trip correctly', async () => {
            const originalCharacter = new StandardCharacter(deIndentWML(`
                <Character key=(testcharacter) uuid=(testcharacter)>
                    <DisplayName>Test Character</DisplayName>
                </Character>
            `))

            const originalEvent: ComponentUpdatedEvent = {
                component: originalCharacter
            }

            // Serialize to external format
            const externalEvent = serializer.serialize({
                content: originalEvent,
                header: makeAssetsHeader('Component Updated')
            })

            // Deserialize back to internal format
            const deserializedEvent = await serializer.deserialize({
                content: externalEvent,
                header: makeAssetsHeader('Component Updated')
            })

            // Verify the component is preserved
            expect(deserializedEvent).not.toBeNull()
            expect(isAssetsComponentUpdatedEvent(deserializedEvent!)).toBe(true)
            if (isAssetsComponentUpdatedEvent(deserializedEvent!)) {
                expect(deserializedEvent.component.universalKey).toBe('CHARACTER#testcharacter')
                expect(deserializedEvent.component).toBeInstanceOf(StandardCharacter)
            }
        })

        it('should handle Component Republished round-trip correctly', async () => {
            const originalCharacter = new StandardCharacter(deIndentWML(`
                <Character key=(testcharacter) uuid=(testcharacter)>
                    <DisplayName>Test Character</DisplayName>
                </Character>
            `))

            const originalEvent: ComponentRepublishedEvent = {
                component: originalCharacter
            }

            const externalEvent = serializer.serialize({
                content: originalEvent,
                header: makeAssetsHeader('Component Republished')
            })

            const deserializedEvent = await serializer.deserialize({
                content: externalEvent,
                header: makeAssetsHeader('Component Republished')
            })

            expect(deserializedEvent).not.toBeNull()
            expect(isAssetsComponentRepublishedEvent(deserializedEvent!)).toBe(true)
            if (isAssetsComponentRepublishedEvent(deserializedEvent!)) {
                expect(deserializedEvent.component.universalKey).toBe('CHARACTER#testcharacter')
                expect(deserializedEvent.component).toBeInstanceOf(StandardCharacter)
            }
        })

        it('should serialize Component Removed event to external format', () => {
            const character = new StandardCharacter(deIndentWML(`
                <Character key=(testcharacter) uuid=(testcharacter)>
                    <DisplayName>Test Character</DisplayName>
                </Character>
            `))

            const componentEvent: ComponentRemovedEvent = {
                component: character
            }

            const externalEvent = serializer.serialize({
                content: componentEvent,
                header: makeAssetsHeader('Component Removed')
            })

            expect('componentId' in externalEvent).toBe(true)
            expect('wml' in externalEvent).toBe(true)
            if ('componentId' in externalEvent) {
                expect(externalEvent.componentId).toBe('CHARACTER#testcharacter')
                expect(externalEvent.wml).toBe(deIndentWML(`
                <Character uuid=(testcharacter) key=(testcharacter)>
                    <DisplayName>Test Character</DisplayName>
                </Character>
            `))
            }
        })

        it('should deserialize Component Removed event from external format', async () => {
            const externalEvent: AssetsEventExternal = {
                componentId: 'CHARACTER#testcharacter',
                wml: deIndentWML(`
                    <Character key=(testcharacter) uuid=(testcharacter)>
                        <DisplayName>Test Character</DisplayName>
                    </Character>
                `)
            }

            const internalEvent = await serializer.deserialize({
                content: externalEvent,
                header: makeAssetsHeader('Component Removed')
            })

            expect(internalEvent).not.toBeNull()
            expect(isAssetsComponentRemovedEvent(internalEvent!)).toBe(true)
            if (isAssetsComponentRemovedEvent(internalEvent!)) {
                expect(internalEvent.component.universalKey).toBe('CHARACTER#testcharacter')
                expect(internalEvent.component).toBeInstanceOf(StandardCharacter)
            }
        })

        it('should handle Component Removed round-trip correctly', async () => {
            const originalCharacter = new StandardCharacter(deIndentWML(`
                <Character key=(testcharacter) uuid=(testcharacter)>
                    <DisplayName>Test Character</DisplayName>
                </Character>
            `))

            const originalEvent: ComponentRemovedEvent = {
                component: originalCharacter
            }

            // Serialize to external format
            const externalEvent = serializer.serialize({
                content: originalEvent,
                header: makeAssetsHeader('Component Removed')
            })

            // Deserialize back to internal format
            const deserializedEvent = await serializer.deserialize({
                content: externalEvent,
                header: makeAssetsHeader('Component Removed')
            })

            // Verify the component is preserved
            expect(deserializedEvent).not.toBeNull()
            expect(isAssetsComponentRemovedEvent(deserializedEvent!)).toBe(true)
            if (isAssetsComponentRemovedEvent(deserializedEvent!)) {
                expect(deserializedEvent.component.universalKey).toBe('CHARACTER#testcharacter')
                expect(deserializedEvent.component).toBeInstanceOf(StandardCharacter)
            }
        })
    })

    describe('Asset Level Events', () => {
        it('should serialize Asset Cached event (pass-through)', () => {
            const assetEvent: AssetLevelEventUpdate = {
                zone: 'Canon'
            }

            const externalEvent = serializer.serialize({
                content: assetEvent,
                header: makeAssetsHeader('Asset Cached')
            })

            expect('zone' in externalEvent).toBe(true)
            if ('zone' in externalEvent) {
                expect(externalEvent.zone).toBe('Canon')
            }
        })

        it('should serialize Asset Decached event (pass-through)', () => {
            const assetEvent: AssetLevelEventUpdate = {}

            const externalEvent = serializer.serialize({
                content: assetEvent,
                header: makeAssetsHeader('Asset Decached')
            })

            expect(externalEvent).toEqual({})
        })

        it('should serialize Asset Removed event (pass-through)', () => {
            const assetEvent: AssetLevelEventUpdate = {
                zone: 'Canon'
            }

            const externalEvent = serializer.serialize({
                content: assetEvent,
                header: makeAssetsHeader('Asset Removed')
            })

            expect('zone' in externalEvent).toBe(true)
            if ('zone' in externalEvent) {
                expect(externalEvent.zone).toBe('Canon')
            }
        })

        it('should serialize Canon Updated event (pass-through)', () => {
            const assetEvent: AssetLevelEventUpdate = {
                assetIds: ['ASSET#test-asset']
            }

            const externalEvent = serializer.serialize({
                content: assetEvent,
                header: makeAssetsHeader('Canon Updated')
            })

            expect('assetIds' in externalEvent).toBe(true)
            if ('assetIds' in externalEvent) {
                expect(externalEvent.assetIds).toEqual(['ASSET#test-asset'])
            }
        })

        it('should deserialize Asset Level events (pass-through)', async () => {
            const externalEvent: AssetsEventExternal = {
                zone: 'Canon'
            }

            const internalEvent = await serializer.deserialize({
                content: externalEvent,
                header: makeAssetsHeader('Asset Cached')
            })

            expect(internalEvent).not.toBeNull()
            expect((internalEvent as AssetCachedEventUpdate).zone).toBe('Canon')
        })

        it('should handle Asset Level round-trip correctly', async () => {
            const originalEvent: AssetLevelEventUpdate = {
                zone: 'Canon'
            }

            // Serialize to external format
            const externalEvent = serializer.serialize({
                content: originalEvent,
                header: makeAssetsHeader('Asset Cached')
            })

            // Deserialize back to internal format
            const deserializedEvent = await serializer.deserialize({
                content: externalEvent,
                header: makeAssetsHeader('Asset Cached')
            })

            // Verify the event is preserved
            expect(deserializedEvent).not.toBeNull()
            expect((deserializedEvent as AssetCachedEventUpdate).zone).toBe('Canon')
        })
    })

    describe('deserialize when header and payload type disagree - header wins', () => {
        it('should deserialize as Component Removed when header says Component Removed but payload has Component Updated shape', async () => {
            const externalEvent: AssetsEventExternal = {
                componentId: 'CHARACTER#testcharacter',
                wml: deIndentWML(`
                    <Character key=(testcharacter) uuid=(testcharacter)>
                        <DisplayName>Test Character</DisplayName>
                    </Character>
                `)
            }

            const internalEvent = await serializer.deserialize({
                content: externalEvent,
                header: makeAssetsHeader('Component Removed')
            })

            expect(internalEvent).not.toBeNull()
            expect(isAssetsComponentRemovedEvent(internalEvent!)).toBe(true)
            if (isAssetsComponentRemovedEvent(internalEvent!)) {
                expect(internalEvent.component.universalKey).toBe('CHARACTER#testcharacter')
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
                    content: unknownEvent,
                    header: makeAssetsHeader('Unknown Event')
                })
            }).toThrow('Unknown event type in AssetsEventUpdate')
        })

        it('should handle invalid WML in Component Updated deserialize', async () => {
            const externalEvent: AssetsEventExternal = {
                componentId: 'CHARACTER#testcharacter',
                wml: 'invalid-wml-content'
            }

            await expect(serializer.deserialize({
                content: externalEvent,
                header: makeAssetsHeader('Component Updated')
            })).rejects.toThrow()
        })

        it('should handle missing component in WML', async () => {
            const externalEvent: AssetsEventExternal = {
                componentId: 'CHARACTER#missing-character',
                wml: deIndentWML(`
                    <Character key=(testcharacter) uuid=(testcharacter)>
                        <DisplayName>Test Character</DisplayName>
                    </Character>
                `)
            }

            await expect(serializer.deserialize({
                content: externalEvent,
                header: makeAssetsHeader('Component Updated')
            })).rejects.toThrow('Component ID mismatch: expected CHARACTER#missing-character')
        })
    })

    describe('Type Guards', () => {
        describe('isAssetsComponentUpdatedEvent', () => {
            it('should return true for valid Component Updated events', () => {
                const character = new StandardCharacter(deIndentWML(`
                    <Character key=(testcharacter) uuid=(testcharacter)>
                        <DisplayName>Test Character</DisplayName>
                    </Character>
                `))

                const event = {
                    component: character
                }

                expect(isAssetsComponentUpdatedEvent(event)).toBe(true)
            })

            it('should return false for invalid events', () => {
                expect(isAssetsComponentUpdatedEvent(null)).toBe(false)
                expect(isAssetsComponentUpdatedEvent(undefined)).toBe(false)
                expect(isAssetsComponentUpdatedEvent({})).toBe(false)
                expect(isAssetsComponentUpdatedEvent({ zone: 'Canon' })).toBe(false)
                expect(isAssetsComponentUpdatedEvent({ componentId: 'x', wml: 'y' })).toBe(false)
            })
        })

        describe('isAssetsComponentRepublishedEvent', () => {
            it('should return true for valid Component Republished events', () => {
                const character = new StandardCharacter(deIndentWML(`
                    <Character key=(testcharacter) uuid=(testcharacter)>
                        <DisplayName>Test Character</DisplayName>
                    </Character>
                `))

                const event = {
                    component: character
                }

                expect(isAssetsComponentRepublishedEvent(event)).toBe(true)
            })

            it('should return false for invalid events', () => {
                expect(isAssetsComponentRepublishedEvent(null)).toBe(false)
                expect(isAssetsComponentRepublishedEvent(undefined)).toBe(false)
                expect(isAssetsComponentRepublishedEvent({})).toBe(false)
                expect(isAssetsComponentRepublishedEvent({ zone: 'Canon' })).toBe(false)
                expect(isAssetsComponentRepublishedEvent({ componentId: 'x', wml: 'y' })).toBe(false)
            })
        })

        describe('isAssetsComponentEvent', () => {
            it('should return true for valid component events', () => {
                const character = new StandardCharacter(deIndentWML(`
                    <Character key=(testcharacter) uuid=(testcharacter)>
                        <DisplayName>Test Character</DisplayName>
                    </Character>
                `))

                const event = {
                    component: character
                }

                expect(isAssetsComponentEvent(event)).toBe(true)
            })
        })

        describe('isAssetsComponentRemovedEvent', () => {
            it('should return true for valid Component Removed events', () => {
                const character = new StandardCharacter(deIndentWML(`
                    <Character key=(testcharacter) uuid=(testcharacter)>
                        <DisplayName>Test Character</DisplayName>
                    </Character>
                `))

                const event = {
                    component: character
                }

                expect(isAssetsComponentRemovedEvent(event)).toBe(true)
            })

            it('should return false for invalid events', () => {
                expect(isAssetsComponentRemovedEvent(null)).toBe(false)
                expect(isAssetsComponentRemovedEvent(undefined)).toBe(false)
                expect(isAssetsComponentRemovedEvent({})).toBe(false)
                expect(isAssetsComponentRemovedEvent({ zone: 'Canon' })).toBe(false)
                expect(isAssetsComponentRemovedEvent({ componentId: 'x', wml: 'y' })).toBe(false)
            })
        })

        describe('isAssetsLevelEvent', () => {
            it('should return true for asset level events', () => {
                const assetEvent: AssetLevelEventUpdate = {
                    zone: 'Canon'
                }

                expect(isAssetsLevelEvent(assetEvent)).toBe(true)
            })

            it('should return false for component events', () => {
                const componentEvent: ComponentUpdatedEvent = {
                    component: new StandardCharacter(deIndentWML(`
                        <Character key=(testcharacter) uuid=(testcharacter)>
                            <DisplayName>Test Character</DisplayName>
                        </Character>
                    `))
                }

                expect(isAssetsLevelEvent(componentEvent)).toBe(false)
            })
        })
    })
})
