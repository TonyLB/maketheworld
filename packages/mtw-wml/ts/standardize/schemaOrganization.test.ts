import { SchemaOrganization, createOrganizationContext } from './schemaOrganization'
import { ReferenceList, StandardKey } from './components/reference'
import StandardRoom from './components/room'
import StandardFeature from './components/feature'
import StandardExample from './components/example'
import { StandardComponent } from './components/baseClasses'
import { deIndentWML } from '../schema/utils'
import { StandardForm } from './index'
import { KeyLookup } from './keyLookup'

describe('SchemaOrganization', () => {
    describe('getImplicitParent', () => {
        it('should return undefined for asset-level components', () => {
            const room1 = new StandardRoom(deIndentWML(`<Room uuid=(room1) key=(room1) />`))
            const components = [room1]
            const keyLookup = new KeyLookup(components)
            const organization = new SchemaOrganization({
                components,
                assetUUID: 'ASSET#test' as const,
                keyLookup
            })

            const key = new StandardKey({ key: 'room1' })
            const implicitParent = organization.getImplicitParent(key)

            expect(implicitParent).toBeUndefined()
        })

        it('should return implicit parent for nested components', () => {
            const testWML = deIndentWML(`
                <Asset uuid=(test)>
                    <Room uuid=(testRoom) key=(testRoom)>
                        <Feature uuid=(testFeature) key=(testFeature)>
                            <Example uuid=(testExample) />
                        </Feature>
                    </Room>
                </Asset>
            `)
            const form = new StandardForm(testWML)

            const keyLookup = new KeyLookup(form._components)
            const organization = new SchemaOrganization({
                components: form._components,
                assetUUID: form._universalKey,
                topLevel: form._topLevel,
                keyLookup
            })

            const example = form._lookup('EXAMPLE#testExample')
            const feature = form._lookup('FEATURE#testFeature')
            const room = form._lookup('ROOM#testRoom')

            expect(example).toBeDefined()
            expect(feature).toBeDefined()
            expect(room).toBeDefined()

            // Example should have Feature as implicitParent
            const exampleKey = example!._key.plain
            const exampleImplicitParent = organization.getImplicitParent(exampleKey)
            expect(exampleImplicitParent).toBeDefined()
            if (exampleImplicitParent && feature?._key.plain) {
                expect(exampleImplicitParent.equals(feature._key.plain)).toBe(true)
            }

            // Feature should have Room as implicitParent
            const featureKey = feature!._key.plain
            const featureImplicitParent = organization.getImplicitParent(featureKey)
            expect(featureImplicitParent).toBeDefined()
            if (featureImplicitParent && room?._key.plain) {
                expect(featureImplicitParent.equals(room._key.plain)).toBe(true)
            }

            // Room should be at Asset level (undefined implicitParent)
            const roomKey = room!._key.plain
            const roomImplicitParent = organization.getImplicitParent(roomKey)
            expect(roomImplicitParent).toBeUndefined()
        })

        it('should handle multiple asset-level components', () => {
            const room1 = new StandardRoom(deIndentWML(`<Room uuid=(room1) key=(room1) />`))
            const room2 = new StandardRoom(deIndentWML(`<Room uuid=(room2) key=(room2) />`))
            const feature1 = new StandardFeature(deIndentWML(`<Feature uuid=(feature1) key=(feature1) />`))
            const components = [room1, room2, feature1]
            const keyLookup = new KeyLookup(components)
            const organization = new SchemaOrganization({
                components,
                assetUUID: 'ASSET#test' as const,
                keyLookup
            })

            const room1Key = new StandardKey({ key: 'room1' })
            const room2Key = new StandardKey({ key: 'room2' })
            const feature1Key = new StandardKey({ key: 'feature1' })

            expect(organization.getImplicitParent(room1Key)).toBeUndefined()
            expect(organization.getImplicitParent(room2Key)).toBeUndefined()
            expect(organization.getImplicitParent(feature1Key)).toBeUndefined()
        })

        it('should handle empty component list', () => {
            const components: StandardComponent[] = []
            const keyLookup = new KeyLookup(components)
            const organization = new SchemaOrganization({
                components,
                assetUUID: 'ASSET#test' as const,
                keyLookup
            })

            const key = new StandardKey({ key: 'nonexistent' })
            const implicitParent = organization.getImplicitParent(key)

            expect(implicitParent).toBeUndefined()
        })

        it('should correctly calculate implicit parents for nested hierarchy', () => {
            const testWML = deIndentWML(`
                <Asset uuid=(test)>
                    <Room uuid=(testRoom) key=(testRoom)>
                        <Feature uuid=(testFeature) key=(testFeature)>
                            <Example uuid=(testExample)>
                                <Description>Test Example</Description>
                            </Example>
                        </Feature>
                    </Room>
                </Asset>
            `)
            const form = new StandardForm(testWML)

            const keyLookup = new KeyLookup(form._components)
            const organization = new SchemaOrganization({
                components: form._components,
                assetUUID: form._universalKey,
                topLevel: form._topLevel,
                keyLookup
            })

            // Verify implicit parent calculations
            const exampleKey = form._lookup('EXAMPLE#testExample')!._key.plain
            const featureKey = form._lookup('FEATURE#testFeature')!._key.plain
            const roomKey = form._lookup('ROOM#testRoom')!._key.plain

            // Example should have Feature as implicitParent
            const exampleImplicitParent = organization.getImplicitParent(exampleKey)
            expect(exampleImplicitParent).toBeDefined()
            expect(exampleImplicitParent?.equals(featureKey)).toBe(true)

            // Feature should have Room as implicitParent
            const featureImplicitParent = organization.getImplicitParent(featureKey)
            expect(featureImplicitParent).toBeDefined()
            expect(featureImplicitParent?.equals(roomKey)).toBe(true)

            // Room should be at Asset level (undefined implicitParent)
            const roomImplicitParent = organization.getImplicitParent(roomKey)
            expect(roomImplicitParent).toBeUndefined()
        })

        it('should handle components with explicit parents correctly', () => {
            const testWML = deIndentWML(`
                <Asset uuid=(test)>
                    <Room uuid=(room1) key=(room1) />
                    <Feature uuid=(feature1) key=(feature1)>
                        <Parent>ROOM#room1</Parent>
                    </Feature>
                </Asset>
            `)
            const form = new StandardForm(testWML)

            const keyLookup = new KeyLookup(form._components)
            const organization = new SchemaOrganization({
                components: form._components,
                assetUUID: form._universalKey,
                topLevel: form._topLevel,
                keyLookup
            })

            const room = form._lookup('ROOM#room1')
            const feature = form._lookup('FEATURE#feature1')

            expect(room).toBeDefined()
            expect(feature).toBeDefined()

            // Room should be at Asset level
            const roomKey = room!._key.plain
            expect(organization.getImplicitParent(roomKey)).toBeUndefined()

            // Feature should have Room as implicitParent (even though it has explicit parent)
            const featureKey = feature!._key.plain
            const featureImplicitParent = organization.getImplicitParent(featureKey)
            // The implicit parent calculation should still work correctly
            expect(featureImplicitParent).toBeUndefined()
        })

        it('should handle components with different types correctly', () => {
            const testWML = deIndentWML(`
                <Asset uuid=(test)>
                    <Room uuid=(room1) key=(room1)>
                        <Feature uuid=(feature1) key=(feature1) />
                        <Character uuid=(char1) key=(char1) />
                    </Room>
                </Asset>
            `)
            const form = new StandardForm(testWML)

            const keyLookup = new KeyLookup(form._components)
            const organization = new SchemaOrganization({
                components: form._components,
                assetUUID: form._universalKey,
                topLevel: form._topLevel,
                keyLookup
            })

            const room = form._lookup('ROOM#room1')
            const feature = form._lookup('FEATURE#feature1')
            const character = form._lookup('CHARACTER#char1')

            expect(room).toBeDefined()
            expect(feature).toBeDefined()
            expect(character).toBeDefined()

            // Room should be at Asset level
            const roomKey = room!._key.plain
            expect(organization.getImplicitParent(roomKey)).toBeUndefined()

            // Feature and Character should both have Room as implicitParent
            const featureKey = feature!._key.plain
            const characterKey = character!._key.plain

            const featureImplicitParent = organization.getImplicitParent(featureKey)
            const characterImplicitParent = organization.getImplicitParent(characterKey)

            expect(featureImplicitParent).toBeDefined()
            expect(characterImplicitParent).toBeDefined()
            if (featureImplicitParent && room?._key.plain) {
                expect(featureImplicitParent.equals(room._key.plain)).toBe(true)
            }
            if (characterImplicitParent && room?._key.plain) {
                expect(characterImplicitParent.equals(room._key.plain)).toBe(true)
            }
        })

        it('should handle complex nested hierarchies', () => {
            const testWML = deIndentWML(`
                <Asset uuid=(test)>
                    <Room uuid=(room1) key=(room1)>
                        <Feature uuid=(feature1) key=(feature1)>
                            <Example uuid=(example1) />
                        </Feature>
                        <Feature uuid=(feature2) key=(feature2) />
                    </Room>
                    <Room uuid=(room2) key=(room2) />
                </Asset>
            `)
            const form = new StandardForm(testWML)

            const keyLookup = new KeyLookup(form._components)
            const organization = new SchemaOrganization({
                components: form._components,
                assetUUID: form._universalKey,
                topLevel: form._topLevel,
                keyLookup
            })

            const room1 = form._lookup('ROOM#room1')
            const room2 = form._lookup('ROOM#room2')
            const feature1 = form._lookup('FEATURE#feature1')
            const feature2 = form._lookup('FEATURE#feature2')
            const example1 = form._lookup('EXAMPLE#example1')

            expect(room1).toBeDefined()
            expect(room2).toBeDefined()
            expect(feature1).toBeDefined()
            expect(feature2).toBeDefined()
            expect(example1).toBeDefined()

            // Both rooms should be at Asset level
            expect(organization.getImplicitParent(room1!._key.plain)).toBeUndefined()
            expect(organization.getImplicitParent(room2!._key.plain)).toBeUndefined()

            // Both features should have room1 as implicitParent
            const feature1ImplicitParent = organization.getImplicitParent(feature1!._key.plain)
            const feature2ImplicitParent = organization.getImplicitParent(feature2!._key.plain)
            expect(feature1ImplicitParent).toBeDefined()
            expect(feature2ImplicitParent).toBeDefined()
            if (feature1ImplicitParent && room1?._key.plain) {
                expect(feature1ImplicitParent.equals(room1._key.plain)).toBe(true)
            }
            if (feature2ImplicitParent && room1?._key.plain) {
                expect(feature2ImplicitParent.equals(room1._key.plain)).toBe(true)
            }

            // Example should have feature1 as implicitParent
            const example1ImplicitParent = organization.getImplicitParent(example1!._key.plain)
            expect(example1ImplicitParent).toBeDefined()
            if (example1ImplicitParent && feature1?._key.plain) {
                expect(example1ImplicitParent.equals(feature1._key.plain)).toBe(true)
            }
        })

        it('should return undefined for keys not in organization', () => {
            const room1 = new StandardRoom(deIndentWML(`<Room uuid=(room1) key=(room1) />`))
            const components = [room1]
            const keyLookup = new KeyLookup(components)
            const organization = new SchemaOrganization({
                components,
                assetUUID: 'ASSET#test' as const,
                keyLookup
            })

            const nonexistentKey = new StandardKey({ key: 'nonexistent' })
            const implicitParent = organization.getImplicitParent(nonexistentKey)

            expect(implicitParent).toBeUndefined()
        })
    })

    describe('getExplicitParent', () => {
        it('should return undefined for component with no explicit parent', () => {
            const room1 = new StandardRoom(deIndentWML(`<Room uuid=(room1) key=(room1) />`))
            const components = [room1]
            const keyLookup = new KeyLookup(components)
            const organization = new SchemaOrganization({
                components,
                assetUUID: 'ASSET#test' as const,
                keyLookup
            })

            const key = new StandardKey({ key: 'room1' })
            const explicitParent = organization.getExplicitParent(key)

            expect(explicitParent).toBeUndefined()
        })

        it('should return explicit parent when set to a StandardKey', () => {
            const testWML = deIndentWML(`
                <Asset uuid=(test)>
                    <Room uuid=(room1) key=(room1) />
                    <Feature uuid=(feature1) key=(feature1)>
                        <Parent>ROOM#room1</Parent>
                    </Feature>
                </Asset>
            `)
            const form = new StandardForm(testWML)

            const keyLookup = new KeyLookup(form._components)
            const organization = new SchemaOrganization({
                components: form._components,
                assetUUID: form._universalKey,
                topLevel: form._topLevel,
                keyLookup
            })

            const room = form._lookup('ROOM#room1')
            const feature = form._lookup('FEATURE#feature1')

            expect(room).toBeDefined()
            expect(feature).toBeDefined()

            const featureKey = feature!._key.plain
            const explicitParent = organization.getExplicitParent(featureKey)

            expect(explicitParent).toBeDefined()
            expect(explicitParent?.explicitParent).toBeDefined()
            if (explicitParent?.explicitParent && room?._key.plain) {
                expect(explicitParent.explicitParent.equals(room._key.plain)).toBe(true)
            }
        })

        it('should return undefined when explicit parent is set to ASSET', () => {
            const testWML = deIndentWML(`
                <Asset uuid=(test)>
                    <Room uuid=(room1) key=(room1)>
                        <Feature uuid=(feature1) key=(feature1)>
                            <Parent />
                        </Feature>
                    </Room>
                </Asset>
            `)
            const form = new StandardForm(testWML)

            const keyLookup = new KeyLookup(form._components)
            const organization = new SchemaOrganization({
                components: form._components,
                assetUUID: form._universalKey,
                topLevel: form._topLevel,
                keyLookup
            })

            const feature = form._lookup('FEATURE#feature1')
            expect(feature).toBeDefined()

            const featureKey = feature!._key.plain
            const explicitParent = organization.getExplicitParent(featureKey)

            // ASSET-level parentage should return { explicitParent: undefined }
            expect(explicitParent).toBeDefined()
            expect(explicitParent?.explicitParent).toBeUndefined()
        })

        it('should return undefined for StandardExplicitParentRemove', () => {
            const testWML = deIndentWML(`
                <Asset uuid=(test)>
                    <Room uuid=(room1) key=(room1) />
                    <Feature uuid=(feature1) key=(feature1)>
                        <Remove>
                            <Parent>ROOM#room1</Parent>
                        </Remove>
                    </Feature>
                </Asset>
            `)
            const form = new StandardForm(testWML)

            const keyLookup = new KeyLookup(form._components)
            const organization = new SchemaOrganization({
                components: form._components,
                assetUUID: form._universalKey,
                topLevel: form._topLevel,
                keyLookup
            })

            const feature = form._lookup('FEATURE#feature1')
            expect(feature).toBeDefined()

            const featureKey = feature!._key.plain
            const explicitParent = organization.getExplicitParent(featureKey)

            // Remove should result in undefined (no explicit parent)
            expect(explicitParent).toBeUndefined()
        })

        it('should use replacement value for StandardExplicitParentReplace', () => {
            const testWML = deIndentWML(`
                <Asset uuid=(test)>
                    <Room uuid=(room1) key=(room1) />
                    <Room uuid=(room2) key=(room2) />
                    <Feature uuid=(feature1) key=(feature1)>
                        <Replace><Parent>ROOM#room1</Parent></Replace>
                        <With><Parent>ROOM#room2</Parent></With>
                    </Feature>
                </Asset>
            `)
            const form = new StandardForm(testWML)

            const keyLookup = new KeyLookup(form._components)
            const organization = new SchemaOrganization({
                components: form._components,
                assetUUID: form._universalKey,
                topLevel: form._topLevel,
                keyLookup
            })

            const room2 = form._lookup('ROOM#room2')
            const feature = form._lookup('FEATURE#feature1')
            expect(room2).toBeDefined()
            expect(feature).toBeDefined()

            const featureKey = feature!._key.plain
            const explicitParent = organization.getExplicitParent(featureKey)

            // Should use replacement value (room2)
            expect(explicitParent).toBeDefined()
            expect(explicitParent?.explicitParent).toBeDefined()
            if (explicitParent?.explicitParent && room2?._key.plain) {
                expect(explicitParent.explicitParent.equals(room2._key.plain)).toBe(true)
            }
        })

        it('should handle multiple components with different explicit parents', () => {
            const testWML = deIndentWML(`
                <Asset uuid=(test)>
                    <Room uuid=(room1) key=(room1) />
                    <Room uuid=(room2) key=(room2) />
                    <Feature uuid=(feature1) key=(feature1)>
                        <Parent>ROOM#room1</Parent>
                    </Feature>
                    <Feature uuid=(feature2) key=(feature2)>
                        <Parent>ROOM#room2</Parent>
                    </Feature>
                    <Feature uuid=(feature3) key=(feature3)>
                        <Parent />
                    </Feature>
                </Asset>
            `)
            const form = new StandardForm(testWML)

            const keyLookup = new KeyLookup(form._components)
            const organization = new SchemaOrganization({
                components: form._components,
                assetUUID: form._universalKey,
                topLevel: form._topLevel,
                keyLookup
            })

            const room1 = form._lookup('ROOM#room1')
            const room2 = form._lookup('ROOM#room2')
            const feature1 = form._lookup('FEATURE#feature1')
            const feature2 = form._lookup('FEATURE#feature2')
            const feature3 = form._lookup('FEATURE#feature3')

            expect(room1).toBeDefined()
            expect(room2).toBeDefined()
            expect(feature1).toBeDefined()
            expect(feature2).toBeDefined()
            expect(feature3).toBeDefined()

            // Feature1 should have room1 as explicit parent
            const feature1ExplicitParent = organization.getExplicitParent(feature1!._key.plain)
            expect(feature1ExplicitParent).toBeDefined()
            expect(feature1ExplicitParent?.explicitParent).toBeDefined()
            if (feature1ExplicitParent?.explicitParent && room1?._key.plain) {
                expect(feature1ExplicitParent.explicitParent.equals(room1._key.plain)).toBe(true)
            }

            // Feature2 should have room2 as explicit parent
            const feature2ExplicitParent = organization.getExplicitParent(feature2!._key.plain)
            expect(feature2ExplicitParent).toBeDefined()
            expect(feature2ExplicitParent?.explicitParent).toBeDefined()
            if (feature2ExplicitParent?.explicitParent && room2?._key.plain) {
                expect(feature2ExplicitParent.explicitParent.equals(room2._key.plain)).toBe(true)
            }

            // Feature3 should have { explicitParent: undefined } (ASSET-level)
            const feature3ExplicitParent = organization.getExplicitParent(feature3!._key.plain)
            expect(feature3ExplicitParent).toBeDefined()
            expect(feature3ExplicitParent?.explicitParent).toBeUndefined()
        })

        it('should return undefined for keys not in organization', () => {
            const room1 = new StandardRoom(deIndentWML(`<Room uuid=(room1) key=(room1) />`))
            const components = [room1]
            const keyLookup = new KeyLookup(components)
            const organization = new SchemaOrganization({
                components,
                assetUUID: 'ASSET#test' as const,
                keyLookup
            })

            const nonexistentKey = new StandardKey({ key: 'nonexistent' })
            const explicitParent = organization.getExplicitParent(nonexistentKey)

            expect(explicitParent).toBeUndefined()
        })

        it('should verify explicit parent takes precedence over implicit parent when both exist', () => {
            const testWML = deIndentWML(`
                <Asset uuid=(test)>
                    <Room uuid=(room1) key=(room1)>
                        <Feature uuid=(feature1) key=(feature1) />
                    </Room>
                    <Room uuid=(room2) key=(room2) />
                    <Feature uuid=(feature2) key=(feature2)>
                        <Parent>ROOM#room2</Parent>
                    </Feature>
                </Asset>
            `)
            const form = new StandardForm(testWML)

            const keyLookup = new KeyLookup(form._components)
            const organization = new SchemaOrganization({
                components: form._components,
                assetUUID: form._universalKey,
                topLevel: form._topLevel,
                keyLookup
            })

            const room1 = form._lookup('ROOM#room1')
            const room2 = form._lookup('ROOM#room2')
            const feature1 = form._lookup('FEATURE#feature1')
            const feature2 = form._lookup('FEATURE#feature2')

            expect(room1).toBeDefined()
            expect(room2).toBeDefined()
            expect(feature1).toBeDefined()
            expect(feature2).toBeDefined()

            // Feature1 has implicit parent room1 (nested), no explicit parent
            const feature1ImplicitParent = organization.getImplicitParent(feature1!._key.plain)
            const feature1ExplicitParent = organization.getExplicitParent(feature1!._key.plain)
            expect(feature1ImplicitParent).toBeDefined()
            expect(feature1ExplicitParent).toBeUndefined()
            if (feature1ImplicitParent && room1?._key.plain) {
                expect(feature1ImplicitParent.equals(room1._key.plain)).toBe(true)
            }

            // Feature2 has explicit parent room2 (overrides implicit parent)
            const feature2ImplicitParent = organization.getImplicitParent(feature2!._key.plain)
            const feature2ExplicitParent = organization.getExplicitParent(feature2!._key.plain)
            // Implicit parent might be room1 or undefined depending on nesting
            // But explicit parent should be room2
            expect(feature2ExplicitParent).toBeDefined()
            expect(feature2ExplicitParent?.explicitParent).toBeDefined()
            if (feature2ExplicitParent?.explicitParent && room2?._key.plain) {
                expect(feature2ExplicitParent.explicitParent.equals(room2._key.plain)).toBe(true)
            }
        })
    })

    describe('getChildrenOfParent', () => {
        it('should return top-level children with no explicit parent and no implicit parent', () => {
            const testWML = deIndentWML(`
                <Asset uuid=(test)>
                    <Room uuid=(room1) key=(room1) />
                    <Feature uuid=(feature1) key=(feature1) />
                </Asset>
            `)
            const form = new StandardForm(testWML)

            const keyLookup = new KeyLookup(form._components)
            const organization = new SchemaOrganization({
                components: form._components,
                assetUUID: form._universalKey,
                topLevel: form._topLevel,
                keyLookup
            })

            const children = organization.getChildrenOfParent(undefined)
            expect(children.length).toBeGreaterThan(0)
            
            const room1 = form._lookup('ROOM#room1')
            const feature1 = form._lookup('FEATURE#feature1')
            expect(room1).toBeDefined()
            expect(feature1).toBeDefined()

            const childKeys = children.map(child => child.standardKey.toJSON())
            expect(childKeys).toContainEqual(room1!._key.plain.toJSON())
            expect(childKeys).toContainEqual(feature1!._key.plain.toJSON())
        })

        it('should return children with explicit asset-level parent', () => {
            const testWML = deIndentWML(`
                <Asset uuid=(test)>
                    <Room uuid=(room1) key=(room1)>
                        <Feature uuid=(feature1) key=(feature1)>
                            <Parent />
                        </Feature>
                    </Room>
                </Asset>
            `)
            const form = new StandardForm(testWML)

            const keyLookup = new KeyLookup(form._components)
            const organization = new SchemaOrganization({
                components: form._components,
                assetUUID: form._universalKey,
                topLevel: form._topLevel,
                keyLookup
            })

            const feature1 = form._lookup('FEATURE#feature1')
            expect(feature1).toBeDefined()

            const children = organization.getChildrenOfParent(undefined)
            const childKeys = children.map(child => child.standardKey.toJSON())
            expect(childKeys).toContainEqual(feature1!._key.plain.toJSON())
        })

        it('should return children with explicit parent matching StandardKey', () => {
            const testWML = deIndentWML(`
                <Asset uuid=(test)>
                    <Room uuid=(room1) key=(room1) />
                    <Feature uuid=(feature1) key=(feature1)>
                        <Parent>ROOM#room1</Parent>
                    </Feature>
                </Asset>
            `)
            const form = new StandardForm(testWML)

            const keyLookup = new KeyLookup(form._components)
            const organization = new SchemaOrganization({
                components: form._components,
                assetUUID: form._universalKey,
                topLevel: form._topLevel,
                keyLookup
            })

            const room1 = form._lookup('ROOM#room1')
            const feature1 = form._lookup('FEATURE#feature1')
            expect(room1).toBeDefined()
            expect(feature1).toBeDefined()

            const room1Key = room1!._key.plain
            const children = organization.getChildrenOfParent(room1Key)
            expect(children.length).toBe(1)
            expect(children[0].standardKey.toJSON()).toEqual(feature1!._key.plain.toJSON())
        })

        it('should return children with implicit parent when no explicit parent', () => {
            const testWML = deIndentWML(`
                <Asset uuid=(test)>
                    <Room uuid=(room1) key=(room1)>
                        <Feature uuid=(feature1) key=(feature1) />
                    </Room>
                </Asset>
            `)
            const form = new StandardForm(testWML)

            const keyLookup = new KeyLookup(form._components)
            const organization = new SchemaOrganization({
                components: form._components,
                assetUUID: form._universalKey,
                topLevel: form._topLevel,
                keyLookup
            })

            const room1 = form._lookup('ROOM#room1')
            const feature1 = form._lookup('FEATURE#feature1')
            expect(room1).toBeDefined()
            expect(feature1).toBeDefined()

            const room1Key = room1!._key.plain
            const children = organization.getChildrenOfParent(room1Key)
            const childKeys = children.map(child => child.standardKey.toJSON())
            expect(childKeys).toContainEqual(feature1!._key.plain.toJSON())
        })

        it('should prioritize explicit parent over implicit parent', () => {
            const testWML = deIndentWML(`
                <Asset uuid=(test)>
                    <Room uuid=(room1) key=(room1)>
                        <Feature uuid=(feature1) key=(feature1) />
                    </Room>
                    <Room uuid=(room2) key=(room2) />
                    <Feature uuid=(feature2) key=(feature2)>
                        <Parent>ROOM#room2</Parent>
                    </Feature>
                </Asset>
            `)
            const form = new StandardForm(testWML)

            const keyLookup = new KeyLookup(form._components)
            const organization = new SchemaOrganization({
                components: form._components,
                assetUUID: form._universalKey,
                topLevel: form._topLevel,
                keyLookup
            })

            const room1 = form._lookup('ROOM#room1')
            const room2 = form._lookup('ROOM#room2')
            const feature2 = form._lookup('FEATURE#feature2')
            expect(room1).toBeDefined()
            expect(room2).toBeDefined()
            expect(feature2).toBeDefined()

            const room1Key = room1!._key.plain
            const room2Key = room2!._key.plain

            const room1Children = organization.getChildrenOfParent(room1Key)
            const room1ChildKeys = room1Children.map(child => child.standardKey.toJSON())
            expect(room1ChildKeys).not.toContainEqual(feature2!._key.plain.toJSON())

            const room2Children = organization.getChildrenOfParent(room2Key)
            const room2ChildKeys = room2Children.map(child => child.standardKey.toJSON())
            expect(room2ChildKeys).toContainEqual(feature2!._key.plain.toJSON())
        })

        it('should return empty array for parent with no children', () => {
            const testWML = deIndentWML(`
                <Asset uuid=(test)>
                    <Room uuid=(room1) key=(room1) />
                </Asset>
            `)
            const form = new StandardForm(testWML)

            const keyLookup = new KeyLookup(form._components)
            const organization = new SchemaOrganization({
                components: form._components,
                assetUUID: form._universalKey,
                topLevel: form._topLevel,
                keyLookup
            })

            const room1 = form._lookup('ROOM#room1')
            expect(room1).toBeDefined()

            const room1Key = room1!._key.plain
            const children = organization.getChildrenOfParent(room1Key)
            expect(children).toEqual([])
        })

        it('should return empty array for non-existent parent key', () => {
            const testWML = deIndentWML(`
                <Asset uuid=(test)>
                    <Room uuid=(room1) key=(room1) />
                </Asset>
            `)
            const form = new StandardForm(testWML)

            const keyLookup = new KeyLookup(form._components)
            const organization = new SchemaOrganization({
                components: form._components,
                assetUUID: form._universalKey,
                topLevel: form._topLevel,
                keyLookup
            })

            const nonexistentKey = new StandardKey({ key: 'nonexistent' })
            const children = organization.getChildrenOfParent(nonexistentKey)
            expect(children).toEqual([])
        })

        it('should return multiple children with correct reference properties', () => {
            const testWML = deIndentWML(`
                <Asset uuid=(test)>
                    <Room uuid=(room1) key=(room1) />
                    <Feature uuid=(feature1) key=(feature1)>
                        <Parent>ROOM#room1</Parent>
                    </Feature>
                    <Feature uuid=(feature2) key=(feature2)>
                        <Parent>ROOM#room1</Parent>
                    </Feature>
                    <Knowledge uuid=(knowledge1) key=(knowledge1)>
                        <Parent>ROOM#room1</Parent>
                    </Knowledge>
                </Asset>
            `)
            const form = new StandardForm(testWML)

            const keyLookup = new KeyLookup(form._components)
            const organization = new SchemaOrganization({
                components: form._components,
                assetUUID: form._universalKey,
                topLevel: form._topLevel,
                keyLookup
            })

            const room1 = form._lookup('ROOM#room1')
            const feature1 = form._lookup('FEATURE#feature1')
            const feature2 = form._lookup('FEATURE#feature2')
            const knowledge1 = form._lookup('KNOWLEDGE#knowledge1')
            expect(room1).toBeDefined()
            expect(feature1).toBeDefined()
            expect(feature2).toBeDefined()
            expect(knowledge1).toBeDefined()

            const room1Key = room1!._key.plain
            const children = organization.getChildrenOfParent(room1Key)
            expect(children.length).toBe(3)

            const childKeys = children.map(child => child.standardKey.toJSON())
            expect(childKeys).toContainEqual(feature1!._key.plain.toJSON())
            expect(childKeys).toContainEqual(feature2!._key.plain.toJSON())
            expect(childKeys).toContainEqual(knowledge1!._key.plain.toJSON())

            // Verify references have correct properties
            children.forEach(child => {
                expect(child.tag).toBeDefined()
                expect(child.standardKey).toBeDefined()
            })
        })

        it('should handle mixed explicit and implicit asset-level children', () => {
            const testWML = deIndentWML(`
                <Asset uuid=(test)>
                    <Room uuid=(room1) key=(room1)>
                        <Feature uuid=(feature1) key=(feature1)>
                            <Parent />
                        </Feature>
                    </Room>
                    <Feature uuid=(feature2) key=(feature2) />
                </Asset>
            `)
            const form = new StandardForm(testWML)

            const keyLookup = new KeyLookup(form._components)
            const organization = new SchemaOrganization({
                components: form._components,
                assetUUID: form._universalKey,
                topLevel: form._topLevel,
                keyLookup
            })

            const feature1 = form._lookup('FEATURE#feature1')
            const feature2 = form._lookup('FEATURE#feature2')
            expect(feature1).toBeDefined()
            expect(feature2).toBeDefined()

            const children = organization.getChildrenOfParent(undefined)
            const childKeys = children.map(child => child.standardKey.toJSON())
            expect(childKeys).toContainEqual(feature1!._key.plain.toJSON())
            expect(childKeys).toContainEqual(feature2!._key.plain.toJSON())
        })
    })

    describe('createOrganizationContext', () => {
        it('should return an object implementing OrganizationContext', () => {
            const testWML = deIndentWML(`
                <Asset uuid=(test)>
                    <Room uuid=(room1) key=(room1) />
                </Asset>
            `)
            const form = new StandardForm(testWML)

            const keyLookup = new KeyLookup(form._components)
            const organization = new SchemaOrganization({
                components: form._components,
                assetUUID: form._universalKey,
                topLevel: form._topLevel,
                keyLookup
            })

            const context = createOrganizationContext(organization)
            expect(context).toBeDefined()
            expect(typeof context.getImplicitParent).toBe('function')
            expect(typeof context.getChildrenOfParent).toBe('function')
        })

        it('should delegate getImplicitParent correctly', () => {
            const testWML = deIndentWML(`
                <Asset uuid=(test)>
                    <Room uuid=(room1) key=(room1)>
                        <Feature uuid=(feature1) key=(feature1) />
                    </Room>
                </Asset>
            `)
            const form = new StandardForm(testWML)

            const keyLookup = new KeyLookup(form._components)
            const organization = new SchemaOrganization({
                components: form._components,
                assetUUID: form._universalKey,
                topLevel: form._topLevel,
                keyLookup
            })

            const context = createOrganizationContext(organization)
            const room1 = form._lookup('ROOM#room1')
            const feature1 = form._lookup('FEATURE#feature1')
            expect(room1).toBeDefined()
            expect(feature1).toBeDefined()

            const room1Key = room1!._key.plain
            const feature1Key = feature1!._key.plain

            // Room should have undefined implicit parent (asset-level)
            expect(context.getImplicitParent(room1Key)).toBeUndefined()
            // Feature should have room1 as implicit parent
            expect(context.getImplicitParent(feature1Key)).toBeDefined()
            expect(context.getImplicitParent(feature1Key)?.equals(room1Key)).toBe(true)
        })

        it('should delegate getChildrenOfParent correctly for StandardKey parent', () => {
            const testWML = deIndentWML(`
                <Asset uuid=(test)>
                    <Room uuid=(room1) key=(room1)>
                        <Feature uuid=(feature1) key=(feature1) />
                        <Feature uuid=(feature2) key=(feature2) />
                    </Room>
                </Asset>
            `)
            const form = new StandardForm(testWML)

            const keyLookup = new KeyLookup(form._components)
            const organization = new SchemaOrganization({
                components: form._components,
                assetUUID: form._universalKey,
                topLevel: form._topLevel,
                keyLookup
            })

            const context = createOrganizationContext(organization)
            const room1 = form._lookup('ROOM#room1')
            const feature1 = form._lookup('FEATURE#feature1')
            const feature2 = form._lookup('FEATURE#feature2')
            expect(room1).toBeDefined()
            expect(feature1).toBeDefined()
            expect(feature2).toBeDefined()

            const room1Key = room1!._key.plain
            const children = context.getChildrenOfParent(room1Key)
            expect(children.length).toBe(2)

            const childKeys = children.map(child => child.standardKey.toJSON())
            expect(childKeys).toContainEqual(feature1!._key.plain.toJSON())
            expect(childKeys).toContainEqual(feature2!._key.plain.toJSON())
        })

        it('should convert AssetUUID to undefined for getChildrenOfParent', () => {
            const testWML = deIndentWML(`
                <Asset uuid=(test)>
                    <Room uuid=(room1) key=(room1) />
                    <Feature uuid=(feature1) key=(feature1) />
                </Asset>
            `)
            const form = new StandardForm(testWML)

            const keyLookup = new KeyLookup(form._components)
            const organization = new SchemaOrganization({
                components: form._components,
                assetUUID: form._universalKey,
                topLevel: form._topLevel,
                keyLookup
            })

            const context = createOrganizationContext(organization)
            const room1 = form._lookup('ROOM#room1')
            const feature1 = form._lookup('FEATURE#feature1')
            expect(room1).toBeDefined()
            expect(feature1).toBeDefined()

            // Pass AssetUUID instead of undefined
            const assetUUID = form._universalKey
            const children = context.getChildrenOfParent(assetUUID)
            expect(children.length).toBeGreaterThan(0)

            const childKeys = children.map(child => child.standardKey.toJSON())
            expect(childKeys).toContainEqual(room1!._key.plain.toJSON())
            expect(childKeys).toContainEqual(feature1!._key.plain.toJSON())
        })

        it('should work with existing SchemaOrganization instances', () => {
            const testWML = deIndentWML(`
                <Asset uuid=(test)>
                    <Room uuid=(room1) key=(room1)>
                        <Feature uuid=(feature1) key=(feature1)>
                            <Parent />
                        </Feature>
                    </Room>
                </Asset>
            `)
            const form = new StandardForm(testWML)

            const keyLookup = new KeyLookup(form._components)
            const organization = new SchemaOrganization({
                components: form._components,
                assetUUID: form._universalKey,
                topLevel: form._topLevel,
                keyLookup
            })

            // Create context from existing organization
            const context = createOrganizationContext(organization)
            
            // Verify it works with explicit parent scenarios
            const feature1 = form._lookup('FEATURE#feature1')
            expect(feature1).toBeDefined()

            const feature1Key = feature1!._key.plain
            const implicitParent = context.getImplicitParent(feature1Key)
            
            // Feature has explicit parent of ASSET, so implicit parent should be undefined
            expect(implicitParent).toBeUndefined()

            // But it should appear in asset-level children
            const assetChildren = context.getChildrenOfParent(form._universalKey)
            const assetChildKeys = assetChildren.map(child => child.standardKey.toJSON())
            expect(assetChildKeys).toContainEqual(feature1!._key.plain.toJSON())
        })
    })

    describe('isParentContext', () => {
        it('should return true for component with explicit parent matching parentCandidate', () => {
            const testWML = deIndentWML(`
                <Asset uuid=(test)>
                    <Room uuid=(room1) key=(room1) />
                    <Feature uuid=(feature1) key=(feature1)>
                        <Parent>ROOM#room1</Parent>
                    </Feature>
                </Asset>
            `)
            const form = new StandardForm(testWML)

            const keyLookup = new KeyLookup(form._components)
            const organization = new SchemaOrganization({
                components: form._components,
                assetUUID: form._universalKey,
                topLevel: form._topLevel,
                keyLookup
            })

            const room1 = form._lookup('ROOM#room1')
            const feature1 = form._lookup('FEATURE#feature1')
            expect(room1).toBeDefined()
            expect(feature1).toBeDefined()

            const room1Key = room1!._key.plain
            const feature1Key = feature1!._key.plain

            expect(organization.isParentContext(feature1Key, room1Key)).toBe(true)
        })

        it('should return false for component with explicit parent not matching parentCandidate', () => {
            const testWML = deIndentWML(`
                <Asset uuid=(test)>
                    <Room uuid=(room1) key=(room1) />
                    <Room uuid=(room2) key=(room2) />
                    <Feature uuid=(feature1) key=(feature1)>
                        <Parent>ROOM#room1</Parent>
                    </Feature>
                </Asset>
            `)
            const form = new StandardForm(testWML)

            const keyLookup = new KeyLookup(form._components)
            const organization = new SchemaOrganization({
                components: form._components,
                assetUUID: form._universalKey,
                topLevel: form._topLevel,
                keyLookup
            })

            const room2 = form._lookup('ROOM#room2')
            const feature1 = form._lookup('FEATURE#feature1')
            expect(room2).toBeDefined()
            expect(feature1).toBeDefined()

            const room2Key = room2!._key.plain
            const feature1Key = feature1!._key.plain

            expect(organization.isParentContext(feature1Key, room2Key)).toBe(false)
        })

        it('should return true for component with implicit parent matching parentCandidate', () => {
            const testWML = deIndentWML(`
                <Asset uuid=(test)>
                    <Room uuid=(room1) key=(room1)>
                        <Feature uuid=(feature1) key=(feature1) />
                    </Room>
                </Asset>
            `)
            const form = new StandardForm(testWML)

            const keyLookup = new KeyLookup(form._components)
            const organization = new SchemaOrganization({
                components: form._components,
                assetUUID: form._universalKey,
                topLevel: form._topLevel,
                keyLookup
            })

            const room1 = form._lookup('ROOM#room1')
            const feature1 = form._lookup('FEATURE#feature1')
            expect(room1).toBeDefined()
            expect(feature1).toBeDefined()

            const room1Key = room1!._key.plain
            const feature1Key = feature1!._key.plain

            expect(organization.isParentContext(feature1Key, room1Key)).toBe(true)
        })

        it('should return false for component with implicit parent not matching parentCandidate', () => {
            const testWML = deIndentWML(`
                <Asset uuid=(test)>
                    <Room uuid=(room1) key=(room1)>
                        <Feature uuid=(feature1) key=(feature1) />
                    </Room>
                    <Room uuid=(room2) key=(room2) />
                </Asset>
            `)
            const form = new StandardForm(testWML)

            const keyLookup = new KeyLookup(form._components)
            const organization = new SchemaOrganization({
                components: form._components,
                assetUUID: form._universalKey,
                topLevel: form._topLevel,
                keyLookup
            })

            const room2 = form._lookup('ROOM#room2')
            const feature1 = form._lookup('FEATURE#feature1')
            expect(room2).toBeDefined()
            expect(feature1).toBeDefined()

            const room2Key = room2!._key.plain
            const feature1Key = feature1!._key.plain

            expect(organization.isParentContext(feature1Key, room2Key)).toBe(false)
        })

        it('should return true for asset-level component with undefined parentCandidate', () => {
            const testWML = deIndentWML(`
                <Asset uuid=(test)>
                    <Room uuid=(room1) key=(room1) />
                </Asset>
            `)
            const form = new StandardForm(testWML)

            const keyLookup = new KeyLookup(form._components)
            const organization = new SchemaOrganization({
                components: form._components,
                assetUUID: form._universalKey,
                topLevel: form._topLevel,
                keyLookup
            })

            const room1 = form._lookup('ROOM#room1')
            expect(room1).toBeDefined()

            const room1Key = room1!._key.plain

            expect(organization.isParentContext(room1Key, undefined)).toBe(true)
        })

        it('should return false for nested component with undefined parentCandidate', () => {
            const testWML = deIndentWML(`
                <Asset uuid=(test)>
                    <Room uuid=(room1) key=(room1)>
                        <Feature uuid=(feature1) key=(feature1) />
                    </Room>
                </Asset>
            `)
            const form = new StandardForm(testWML)

            const keyLookup = new KeyLookup(form._components)
            const organization = new SchemaOrganization({
                components: form._components,
                assetUUID: form._universalKey,
                topLevel: form._topLevel,
                keyLookup
            })

            const feature1 = form._lookup('FEATURE#feature1')
            expect(feature1).toBeDefined()

            const feature1Key = feature1!._key.plain

            expect(organization.isParentContext(feature1Key, undefined)).toBe(false)
        })

        it('should prioritize explicit parent over implicit parent', () => {
            const testWML = deIndentWML(`
                <Asset uuid=(test)>
                    <Room uuid=(room1) key=(room1)>
                        <Feature uuid=(feature1) key=(feature1) />
                    </Room>
                    <Room uuid=(room2) key=(room2) />
                    <Feature uuid=(feature2) key=(feature2)>
                        <Parent>ROOM#room2</Parent>
                    </Feature>
                </Asset>
            `)
            const form = new StandardForm(testWML)

            const keyLookup = new KeyLookup(form._components)
            const organization = new SchemaOrganization({
                components: form._components,
                assetUUID: form._universalKey,
                topLevel: form._topLevel,
                keyLookup
            })

            const room1 = form._lookup('ROOM#room1')
            const room2 = form._lookup('ROOM#room2')
            const feature2 = form._lookup('FEATURE#feature2')
            expect(room1).toBeDefined()
            expect(room2).toBeDefined()
            expect(feature2).toBeDefined()

            const room1Key = room1!._key.plain
            const room2Key = room2!._key.plain
            const feature2Key = feature2!._key.plain

            // Feature2 has explicit parent room2, so it should match room2, not room1 (even though implicit would be room1)
            expect(organization.isParentContext(feature2Key, room2Key)).toBe(true)
            expect(organization.isParentContext(feature2Key, room1Key)).toBe(false)
        })
    })

    describe('buildAncestryChain', () => {
        it('should return single-item chain for asset-level component', () => {
            const room1 = new StandardRoom(deIndentWML(`<Room uuid=(room1) key=(room1) />`))
            const components = [room1]
            const keyLookup = new KeyLookup(components)
            const organization = new SchemaOrganization({
                components,
                assetUUID: 'ASSET#test' as const,
                keyLookup
            })

            const key = new StandardKey({ key: 'room1', universalKey: 'ROOM#room1' })
            const chain = organization.buildAncestryChain(key)

            expect(chain.length).toBe(1)
            expect(chain[0].standardKey.equals(key)).toBe(true)
            expect(chain[0].tag).toBe('Room')
        })

        it('should return full chain for nested component', () => {
            const testWML = deIndentWML(`
                <Asset uuid=(test)>
                    <Room uuid=(testRoom) key=(testRoom)>
                        <Feature uuid=(testFeature) key=(testFeature)>
                            <Example uuid=(testExample) />
                        </Feature>
                    </Room>
                </Asset>
            `)
            const form = new StandardForm(testWML)

            const keyLookup = new KeyLookup(form._components)
            const organization = new SchemaOrganization({
                components: form._components,
                assetUUID: form._universalKey,
                topLevel: form._topLevel,
                keyLookup
            })

            const example = form._lookup('EXAMPLE#testExample')
            const exampleKey = example?._key.plain
            expect(exampleKey).toBeDefined()

            const chain = organization.buildAncestryChain(exampleKey!)

            // Should have: Room, Feature, Example (from Asset level to component)
            expect(chain.length).toBe(3)
            expect(chain[0].tag).toBe('Room')
            expect(chain[1].tag).toBe('Feature')
            expect(chain[2].tag).toBe('Example')
            expect(chain[2].standardKey.equals(exampleKey!)).toBe(true)
        })

        it('should use explicit parent over implicit parent', () => {
            const testWML = deIndentWML(`
                <Asset uuid=(test)>
                    <Room uuid=(room1) key=(room1)>
                        <Feature uuid=(feature1) key=(feature1) />
                    </Room>
                    <Room uuid=(room2) key=(room2)>
                        <Feature uuid=(feature2) key=(feature2)>
                            <Parent>ROOM#room1</Parent>
                        </Feature>
                    </Room>
                </Asset>
            `)
            const form = new StandardForm(testWML)

            const keyLookup = new KeyLookup(form._components)
            const organization = new SchemaOrganization({
                components: form._components,
                assetUUID: form._universalKey,
                topLevel: form._topLevel,
                keyLookup
            })

            const feature2 = form._lookup('FEATURE#feature2')
            const feature2Key = feature2?._key.plain
            expect(feature2Key).toBeDefined()

            const chain = organization.buildAncestryChain(feature2Key!)

            // Should use explicit parent (room1) not implicit parent (room2)
            expect(chain.length).toBe(2)
            expect(chain[0].tag).toBe('Room')
            const room1 = form._lookup('ROOM#room1')
            expect(chain[0].standardKey.equals(room1!._key.plain)).toBe(true)
            expect(chain[1].tag).toBe('Feature')
        })

        it('should handle deeply nested components', () => {
            const testWML = deIndentWML(`
                <Asset uuid=(test)>
                    <Room uuid=(room1) key=(room1)>
                        <Feature uuid=(feature1) key=(feature1)>
                            <Example uuid=(example1) />
                        </Feature>
                    </Room>
                </Asset>
            `)
            const form = new StandardForm(testWML)

            const keyLookup = new KeyLookup(form._components)
            const organization = new SchemaOrganization({
                components: form._components,
                assetUUID: form._universalKey,
                topLevel: form._topLevel,
                keyLookup
            })

            const example = form._lookup('EXAMPLE#example1')
            const exampleKey = example?._key.plain
            expect(exampleKey).toBeDefined()

            const chain = organization.buildAncestryChain(exampleKey!)

            // Should have: Room, Feature, Example
            expect(chain.length).toBe(3)
            expect(chain[0].tag).toBe('Room')
            expect(chain[1].tag).toBe('Feature')
            expect(chain[2].tag).toBe('Example')
        })
    })

    describe('sortOrder', () => {
        it('should sort parent before child (same tag)', () => {
            const testWML = deIndentWML(`
                <Asset uuid=(test)>
                    <Room uuid=(room1) key=(room1)>
                        <Feature uuid=(feature1) key=(feature1) />
                    </Room>
                </Asset>
            `)
            const form = new StandardForm(testWML)

            const keyLookup = new KeyLookup(form._components)
            const organization = new SchemaOrganization({
                components: form._components,
                assetUUID: form._universalKey,
                topLevel: form._topLevel,
                keyLookup
            })

            const room = form._lookup('ROOM#room1')
            const feature = form._lookup('FEATURE#feature1')
            const roomKey = room!._key.plain
            const featureKey = feature!._key.plain

            expect(organization.sortOrder(roomKey, featureKey)).toBeLessThan(0)
            expect(organization.sortOrder(featureKey, roomKey)).toBeGreaterThan(0)
        })

        it('should sort siblings by tag order', () => {
            const testWML = deIndentWML(`
                <Asset uuid=(test)>
                    <Room uuid=(room1) key=(room1) />
                    <Character uuid=(char1) key=(char1) />
                </Asset>
            `)
            const form = new StandardForm(testWML)

            const keyLookup = new KeyLookup(form._components)
            const organization = new SchemaOrganization({
                components: form._components,
                assetUUID: form._universalKey,
                topLevel: form._topLevel,
                keyLookup
            })

            const room = form._lookup('ROOM#room1')
            const character = form._lookup('CHARACTER#char1')
            const roomKey = room!._key.plain
            const characterKey = character!._key.plain

            // Character comes before Room in tag order
            expect(organization.sortOrder(characterKey, roomKey)).toBeLessThan(0)
            expect(organization.sortOrder(roomKey, characterKey)).toBeGreaterThan(0)
        })

        it('should sort siblings with same tag by key', () => {
            const testWML = deIndentWML(`
                <Asset uuid=(test)>
                    <Room uuid=(room1) key=(room1)>
                        <Feature uuid=(feature1) key=(feature1) />
                        <Feature uuid=(feature2) key=(feature2) />
                    </Room>
                </Asset>
            `)
            const form = new StandardForm(testWML)

            const keyLookup = new KeyLookup(form._components)
            const organization = new SchemaOrganization({
                components: form._components,
                assetUUID: form._universalKey,
                topLevel: form._topLevel,
                keyLookup
            })

            const feature1 = form._lookup('FEATURE#feature1')
            const feature2 = form._lookup('FEATURE#feature2')
            const feature1Key = feature1!._key.plain
            const feature2Key = feature2!._key.plain

            expect(organization.sortOrder(feature1Key, feature2Key)).toBeLessThan(0)
            expect(organization.sortOrder(feature2Key, feature1Key)).toBeGreaterThan(0)
        })

        it('should compare at differing ancestor when components have different ancestry', () => {
            const testWML = deIndentWML(`
                <Asset uuid=(test)>
                    <Room uuid=(room1) key=(room1)>
                        <Feature uuid=(feature1) key=(feature1) />
                    </Room>
                    <Room uuid=(room2) key=(room2)>
                        <Feature uuid=(feature2) key=(feature2) />
                    </Room>
                </Asset>
            `)
            const form = new StandardForm(testWML)

            const keyLookup = new KeyLookup(form._components)
            const organization = new SchemaOrganization({
                components: form._components,
                assetUUID: form._universalKey,
                topLevel: form._topLevel,
                keyLookup
            })

            const feature1 = form._lookup('FEATURE#feature1')
            const feature2 = form._lookup('FEATURE#feature2')
            const feature1Key = feature1!._key.plain
            const feature2Key = feature2!._key.plain

            // Both are Features, but their ancestors are Room1 and Room2
            // Should compare at the Room level (differing ancestor)
            // Room1 comes before Room2 alphabetically
            expect(organization.sortOrder(feature1Key, feature2Key)).toBeLessThan(0)
            expect(organization.sortOrder(feature2Key, feature1Key)).toBeGreaterThan(0)
        })

        it('should handle explicit parent vs implicit parent precedence in sorting', () => {
            const testWML = deIndentWML(`
                <Asset uuid=(test)>
                    <Room uuid=(room1) key=(room1)>
                        <Feature uuid=(feature1) key=(feature1) />
                    </Room>
                    <Room uuid=(room2) key=(room2)>
                        <Feature uuid=(feature2) key=(feature2)>
                            <Parent>ROOM#room1</Parent>
                        </Feature>
                    </Room>
                </Asset>
            `)
            const form = new StandardForm(testWML)

            const keyLookup = new KeyLookup(form._components)
            const organization = new SchemaOrganization({
                components: form._components,
                assetUUID: form._universalKey,
                topLevel: form._topLevel,
                keyLookup
            })

            const feature1 = form._lookup('FEATURE#feature1')
            const feature2 = form._lookup('FEATURE#feature2')
            const feature1Key = feature1!._key.plain
            const feature2Key = feature2!._key.plain

            // Both features should be sorted as children of room1 (feature2 has explicit parent room1)
            // So they should be siblings and sorted by key
            expect(organization.sortOrder(feature1Key, feature2Key)).toBeLessThan(0)
            expect(organization.sortOrder(feature2Key, feature1Key)).toBeGreaterThan(0)
        })

        it('should return 0 for identical keys', () => {
            const room1 = new StandardRoom(deIndentWML(`<Room uuid=(room1) key=(room1) />`))
            const components = [room1]
            const keyLookup = new KeyLookup(components)
            const organization = new SchemaOrganization({
                components,
                assetUUID: 'ASSET#test' as const,
                keyLookup
            })

            const key = new StandardKey({ key: 'room1', universalKey: 'ROOM#room1' })
            expect(organization.sortOrder(key, key)).toBe(0)
        })
    })

    describe('isReferenced', () => {
        it('should return true for component referenced in topLevel', () => {
            const testWML = deIndentWML(`
                <Asset uuid=(test)>
                    <Room uuid=(room1) key=(room1) />
                </Asset>
            `)
            const form = new StandardForm(testWML)

            const keyLookup = new KeyLookup(form._components)
            const organization = new SchemaOrganization({
                components: form._components,
                assetUUID: form._universalKey,
                topLevel: form._topLevel,
                keyLookup
            })

            const room1 = form._lookup('ROOM#room1')
            expect(room1).toBeDefined()

            const room1Key = room1!._key.plain
            expect(organization.isReferenced(room1Key)).toBe(true)
        })

        it('should return true for component referenced as child in another component', () => {
            const testWML = deIndentWML(`
                <Asset uuid=(test)>
                    <Room uuid=(room1) key=(room1)>
                        <Feature uuid=(feature1) key=(feature1) />
                    </Room>
                </Asset>
            `)
            const form = new StandardForm(testWML)

            const keyLookup = new KeyLookup(form._components)
            const organization = new SchemaOrganization({
                components: form._components,
                assetUUID: form._universalKey,
                topLevel: form._topLevel,
                keyLookup
            })

            const feature1 = form._lookup('FEATURE#feature1')
            expect(feature1).toBeDefined()

            const feature1Key = feature1!._key.plain
            expect(organization.isReferenced(feature1Key)).toBe(true)
        })

        it('should return false for component with no references', () => {
            const room1 = new StandardRoom(deIndentWML(`<Room uuid=(room1) key=(room1) />`))
            const room2 = new StandardRoom(deIndentWML(`<Room uuid=(room2) key=(room2) />`))
            const components = [room1, room2]
            const keyLookup = new KeyLookup(components)
            const organization = new SchemaOrganization({
                components,
                assetUUID: 'ASSET#test' as const,
                keyLookup
            })

            const room2Key = room2._key.plain
            // room2 is not referenced anywhere (not in topLevel, not as a child)
            expect(organization.isReferenced(room2Key)).toBe(false)
        })

        it('should return true for component referenced in topLevel even if not in graph', () => {
            const testWML = deIndentWML(`
                <Asset uuid=(test)>
                    <Room uuid=(room1) key=(room1) />
                </Asset>
            `)
            const form = new StandardForm(testWML)

            const keyLookup = new KeyLookup(form._components)
            const organization = new SchemaOrganization({
                components: form._components,
                assetUUID: form._universalKey,
                topLevel: form._topLevel,
                keyLookup
            })

            const room1 = form._lookup('ROOM#room1')
            expect(room1).toBeDefined()

            const room1Key = room1!._key.plain
            // Should return true because it's in topLevel
            expect(organization.isReferenced(room1Key)).toBe(true)
        })

        it('should return false for component not in topLevel and not referenced as child', () => {
            const testWML = deIndentWML(`
                <Asset uuid=(test)>
                    <Room uuid=(room1) key=(room1) />
                </Asset>
            `)
            const form = new StandardForm(testWML)

            // Create a component that's not in the form
            const orphanRoom = new StandardRoom(deIndentWML(`<Room uuid=(orphan) key=(orphan) />`))
            const allComponents = [...form._components, orphanRoom]
            const keyLookup = new KeyLookup(allComponents)
            const organization = new SchemaOrganization({
                components: allComponents,
                assetUUID: form._universalKey,
                topLevel: form._topLevel,
                keyLookup
            })

            const orphanKey = orphanRoom._key.plain
            // orphan is not in topLevel and not referenced as a child
            expect(organization.isReferenced(orphanKey)).toBe(false)
        })

        it('should return true for deeply nested component referenced as child', () => {
            const testWML = deIndentWML(`
                <Asset uuid=(test)>
                    <Room uuid=(room1) key=(room1)>
                        <Feature uuid=(feature1) key=(feature1)>
                            <Example uuid=(example1) />
                        </Feature>
                    </Room>
                </Asset>
            `)
            const form = new StandardForm(testWML)

            const keyLookup = new KeyLookup(form._components)
            const organization = new SchemaOrganization({
                components: form._components,
                assetUUID: form._universalKey,
                topLevel: form._topLevel,
                keyLookup
            })

            const example1 = form._lookup('EXAMPLE#example1')
            expect(example1).toBeDefined()

            const example1Key = example1!._key.plain
            // Example is referenced as a child of Feature
            expect(organization.isReferenced(example1Key)).toBe(true)
        })

        it('should return true for component with multiple parents (multiple references)', () => {
            const testWML = deIndentWML(`
                <Asset uuid=(test)>
                    <Room uuid=(room1) key=(room1)>
                        <Feature uuid=(feature1) key=(feature1) />
                    </Room>
                    <Room uuid=(room2) key=(room2)>
                        <Feature uuid=(feature1) key=(feature1) />
                    </Room>
                </Asset>
            `)
            const form = new StandardForm(testWML)

            const keyLookup = new KeyLookup(form._components)
            const organization = new SchemaOrganization({
                components: form._components,
                assetUUID: form._universalKey,
                topLevel: form._topLevel,
                keyLookup
            })

            const feature1 = form._lookup('FEATURE#feature1')
            expect(feature1).toBeDefined()

            const feature1Key = feature1!._key.plain
            // Feature1 is referenced as a child in both room1 and room2
            expect(organization.isReferenced(feature1Key)).toBe(true)
        })

        it('should return false when topLevel is not provided and component is only in topLevel', () => {
            const testWML = deIndentWML(`
                <Asset uuid=(test)>
                    <Room uuid=(room1) key=(room1) />
                </Asset>
            `)
            const form = new StandardForm(testWML)

            const keyLookup = new KeyLookup(form._components)
            const organization = new SchemaOrganization({
                components: form._components,
                assetUUID: form._universalKey,
                topLevel: new ReferenceList([]),
                keyLookup
            })

            const room1 = form._lookup('ROOM#room1')
            expect(room1).toBeDefined()

            const room1Key = room1!._key.plain
            expect(organization.isReferenced(room1Key)).toBe(false)
        })

        it('should handle empty topLevel correctly', () => {
            const room1 = new StandardRoom(deIndentWML(`<Room uuid=(room1) key=(room1) />`))
            const components = [room1]
            const keyLookup = new KeyLookup(components)
            const organization = new SchemaOrganization({
                components,
                assetUUID: 'ASSET#test' as const,
                keyLookup
            })

            const room1Key = room1._key.plain
            // Empty topLevel should not cause issues
            expect(organization.isReferenced(room1Key)).toBe(false)
        })

        it('should return false for nonexistent component key', () => {
            const testWML = deIndentWML(`
                <Asset uuid=(test)>
                    <Room uuid=(room1) key=(room1) />
                </Asset>
            `)
            const form = new StandardForm(testWML)

            const keyLookup = new KeyLookup(form._components)
            const organization = new SchemaOrganization({
                components: form._components,
                assetUUID: form._universalKey,
                topLevel: form._topLevel,
                keyLookup
            })

            const nonexistentKey = new StandardKey({ key: 'nonexistent' })
            expect(organization.isReferenced(nonexistentKey)).toBe(false)
        })
    })
})

