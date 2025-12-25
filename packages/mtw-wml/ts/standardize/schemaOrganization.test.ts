import { SchemaOrganization } from './schemaOrganization'
import { StandardKey } from './components/reference'
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
            const formWithParents = form.generateImplicitParents()

            const keyLookup = new KeyLookup(formWithParents._components)
            const organization = new SchemaOrganization({
                components: formWithParents._components,
                assetUUID: formWithParents._universalKey,
                topLevel: formWithParents._topLevel,
                keyLookup
            })

            const example = formWithParents._lookup('EXAMPLE#testExample')
            const feature = formWithParents._lookup('FEATURE#testFeature')
            const room = formWithParents._lookup('ROOM#testRoom')

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

        it('should match generateImplicitParents behavior for nested hierarchy', () => {
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
            const formWithParents = form.generateImplicitParents()

            const keyLookup = new KeyLookup(formWithParents._components)
            const organization = new SchemaOrganization({
                components: formWithParents._components,
                assetUUID: formWithParents._universalKey,
                topLevel: formWithParents._topLevel,
                keyLookup
            })

            // Verify all components have matching implicitParent values
            formWithParents._components.forEach(component => {
                const componentKey = component._key.plain
                const organizationImplicitParent = organization.getImplicitParent(componentKey)
                
                if (component.implicitParent) {
                    expect(organizationImplicitParent).toBeDefined()
                    expect(organizationImplicitParent?.equals(component.implicitParent)).toBe(true)
                } else {
                    expect(organizationImplicitParent).toBeUndefined()
                }
            })
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
            const formWithParents = form.generateImplicitParents()

            const keyLookup = new KeyLookup(formWithParents._components)
            const organization = new SchemaOrganization({
                components: formWithParents._components,
                assetUUID: formWithParents._universalKey,
                topLevel: formWithParents._topLevel,
                keyLookup
            })

            const room = formWithParents._lookup('ROOM#room1')
            const feature = formWithParents._lookup('FEATURE#feature1')

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
            const formWithParents = form.generateImplicitParents()

            const keyLookup = new KeyLookup(formWithParents._components)
            const organization = new SchemaOrganization({
                components: formWithParents._components,
                assetUUID: formWithParents._universalKey,
                topLevel: formWithParents._topLevel,
                keyLookup
            })

            const room = formWithParents._lookup('ROOM#room1')
            const feature = formWithParents._lookup('FEATURE#feature1')
            const character = formWithParents._lookup('CHARACTER#char1')

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
            const formWithParents = form.generateImplicitParents()

            const keyLookup = new KeyLookup(formWithParents._components)
            const organization = new SchemaOrganization({
                components: formWithParents._components,
                assetUUID: formWithParents._universalKey,
                topLevel: formWithParents._topLevel,
                keyLookup
            })

            const room1 = formWithParents._lookup('ROOM#room1')
            const room2 = formWithParents._lookup('ROOM#room2')
            const feature1 = formWithParents._lookup('FEATURE#feature1')
            const feature2 = formWithParents._lookup('FEATURE#feature2')
            const example1 = formWithParents._lookup('EXAMPLE#example1')

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
            const formWithParents = form.generateImplicitParents()

            const keyLookup = new KeyLookup(formWithParents._components)
            const organization = new SchemaOrganization({
                components: formWithParents._components,
                assetUUID: formWithParents._universalKey,
                topLevel: formWithParents._topLevel,
                keyLookup
            })

            const room = formWithParents._lookup('ROOM#room1')
            const feature = formWithParents._lookup('FEATURE#feature1')

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
            const formWithParents = form.generateImplicitParents()

            const keyLookup = new KeyLookup(formWithParents._components)
            const organization = new SchemaOrganization({
                components: formWithParents._components,
                assetUUID: formWithParents._universalKey,
                topLevel: formWithParents._topLevel,
                keyLookup
            })

            const feature = formWithParents._lookup('FEATURE#feature1')
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
            const formWithParents = form.generateImplicitParents()

            const keyLookup = new KeyLookup(formWithParents._components)
            const organization = new SchemaOrganization({
                components: formWithParents._components,
                assetUUID: formWithParents._universalKey,
                topLevel: formWithParents._topLevel,
                keyLookup
            })

            const feature = formWithParents._lookup('FEATURE#feature1')
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
            const formWithParents = form.generateImplicitParents()

            const keyLookup = new KeyLookup(formWithParents._components)
            const organization = new SchemaOrganization({
                components: formWithParents._components,
                assetUUID: formWithParents._universalKey,
                topLevel: formWithParents._topLevel,
                keyLookup
            })

            const room2 = formWithParents._lookup('ROOM#room2')
            const feature = formWithParents._lookup('FEATURE#feature1')
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
            const formWithParents = form.generateImplicitParents()

            const keyLookup = new KeyLookup(formWithParents._components)
            const organization = new SchemaOrganization({
                components: formWithParents._components,
                assetUUID: formWithParents._universalKey,
                topLevel: formWithParents._topLevel,
                keyLookup
            })

            const room1 = formWithParents._lookup('ROOM#room1')
            const room2 = formWithParents._lookup('ROOM#room2')
            const feature1 = formWithParents._lookup('FEATURE#feature1')
            const feature2 = formWithParents._lookup('FEATURE#feature2')
            const feature3 = formWithParents._lookup('FEATURE#feature3')

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
            const formWithParents = form.generateImplicitParents()

            const keyLookup = new KeyLookup(formWithParents._components)
            const organization = new SchemaOrganization({
                components: formWithParents._components,
                assetUUID: formWithParents._universalKey,
                topLevel: formWithParents._topLevel,
                keyLookup
            })

            const room1 = formWithParents._lookup('ROOM#room1')
            const room2 = formWithParents._lookup('ROOM#room2')
            const feature1 = formWithParents._lookup('FEATURE#feature1')
            const feature2 = formWithParents._lookup('FEATURE#feature2')

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
            const formWithParents = form.generateImplicitParents()

            const keyLookup = new KeyLookup(formWithParents._components)
            const organization = new SchemaOrganization({
                components: formWithParents._components,
                assetUUID: formWithParents._universalKey,
                topLevel: formWithParents._topLevel,
                keyLookup
            })

            const children = organization.getChildrenOfParent(undefined)
            expect(children.length).toBeGreaterThan(0)
            
            const room1 = formWithParents._lookup('ROOM#room1')
            const feature1 = formWithParents._lookup('FEATURE#feature1')
            expect(room1).toBeDefined()
            expect(feature1).toBeDefined()

            const childKeys = children.map(child => child._payload.plain.standardKey.toJSON())
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
            const formWithParents = form.generateImplicitParents()

            const keyLookup = new KeyLookup(formWithParents._components)
            const organization = new SchemaOrganization({
                components: formWithParents._components,
                assetUUID: formWithParents._universalKey,
                topLevel: formWithParents._topLevel,
                keyLookup
            })

            const feature1 = formWithParents._lookup('FEATURE#feature1')
            expect(feature1).toBeDefined()

            const children = organization.getChildrenOfParent(undefined)
            const childKeys = children.map(child => child._payload.plain.standardKey.toJSON())
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
            const formWithParents = form.generateImplicitParents()

            const keyLookup = new KeyLookup(formWithParents._components)
            const organization = new SchemaOrganization({
                components: formWithParents._components,
                assetUUID: formWithParents._universalKey,
                topLevel: formWithParents._topLevel,
                keyLookup
            })

            const room1 = formWithParents._lookup('ROOM#room1')
            const feature1 = formWithParents._lookup('FEATURE#feature1')
            expect(room1).toBeDefined()
            expect(feature1).toBeDefined()

            const room1Key = room1!._key.plain
            const children = organization.getChildrenOfParent(room1Key)
            expect(children.length).toBe(1)
            expect(children[0]._payload.plain.standardKey.toJSON()).toEqual(feature1!._key.plain.toJSON())
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
            const formWithParents = form.generateImplicitParents()

            const keyLookup = new KeyLookup(formWithParents._components)
            const organization = new SchemaOrganization({
                components: formWithParents._components,
                assetUUID: formWithParents._universalKey,
                topLevel: formWithParents._topLevel,
                keyLookup
            })

            const room1 = formWithParents._lookup('ROOM#room1')
            const feature1 = formWithParents._lookup('FEATURE#feature1')
            expect(room1).toBeDefined()
            expect(feature1).toBeDefined()

            const room1Key = room1!._key.plain
            const children = organization.getChildrenOfParent(room1Key)
            const childKeys = children.map(child => child._payload.plain.standardKey.toJSON())
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
            const formWithParents = form.generateImplicitParents()

            const keyLookup = new KeyLookup(formWithParents._components)
            const organization = new SchemaOrganization({
                components: formWithParents._components,
                assetUUID: formWithParents._universalKey,
                topLevel: formWithParents._topLevel,
                keyLookup
            })

            const room1 = formWithParents._lookup('ROOM#room1')
            const room2 = formWithParents._lookup('ROOM#room2')
            const feature2 = formWithParents._lookup('FEATURE#feature2')
            expect(room1).toBeDefined()
            expect(room2).toBeDefined()
            expect(feature2).toBeDefined()

            const room1Key = room1!._key.plain
            const room2Key = room2!._key.plain

            const room1Children = organization.getChildrenOfParent(room1Key)
            const room1ChildKeys = room1Children.map(child => child._payload.plain.standardKey.toJSON())
            expect(room1ChildKeys).not.toContainEqual(feature2!._key.plain.toJSON())

            const room2Children = organization.getChildrenOfParent(room2Key)
            const room2ChildKeys = room2Children.map(child => child._payload.plain.standardKey.toJSON())
            expect(room2ChildKeys).toContainEqual(feature2!._key.plain.toJSON())
        })

        it('should return empty array for parent with no children', () => {
            const testWML = deIndentWML(`
                <Asset uuid=(test)>
                    <Room uuid=(room1) key=(room1) />
                </Asset>
            `)
            const form = new StandardForm(testWML)
            const formWithParents = form.generateImplicitParents()

            const keyLookup = new KeyLookup(formWithParents._components)
            const organization = new SchemaOrganization({
                components: formWithParents._components,
                assetUUID: formWithParents._universalKey,
                topLevel: formWithParents._topLevel,
                keyLookup
            })

            const room1 = formWithParents._lookup('ROOM#room1')
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
            const formWithParents = form.generateImplicitParents()

            const keyLookup = new KeyLookup(formWithParents._components)
            const organization = new SchemaOrganization({
                components: formWithParents._components,
                assetUUID: formWithParents._universalKey,
                topLevel: formWithParents._topLevel,
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
            const formWithParents = form.generateImplicitParents()

            const keyLookup = new KeyLookup(formWithParents._components)
            const organization = new SchemaOrganization({
                components: formWithParents._components,
                assetUUID: formWithParents._universalKey,
                topLevel: formWithParents._topLevel,
                keyLookup
            })

            const room1 = formWithParents._lookup('ROOM#room1')
            const feature1 = formWithParents._lookup('FEATURE#feature1')
            const feature2 = formWithParents._lookup('FEATURE#feature2')
            const knowledge1 = formWithParents._lookup('KNOWLEDGE#knowledge1')
            expect(room1).toBeDefined()
            expect(feature1).toBeDefined()
            expect(feature2).toBeDefined()
            expect(knowledge1).toBeDefined()

            const room1Key = room1!._key.plain
            const children = organization.getChildrenOfParent(room1Key)
            expect(children.length).toBe(3)

            const childKeys = children.map(child => child._payload.plain.standardKey.toJSON())
            expect(childKeys).toContainEqual(feature1!._key.plain.toJSON())
            expect(childKeys).toContainEqual(feature2!._key.plain.toJSON())
            expect(childKeys).toContainEqual(knowledge1!._key.plain.toJSON())

            // Verify references have correct properties
            children.forEach(child => {
                expect(child.tag).toBeDefined()
                expect(child._payload.plain.standardKey).toBeDefined()
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
            const formWithParents = form.generateImplicitParents()

            const keyLookup = new KeyLookup(formWithParents._components)
            const organization = new SchemaOrganization({
                components: formWithParents._components,
                assetUUID: formWithParents._universalKey,
                topLevel: formWithParents._topLevel,
                keyLookup
            })

            const feature1 = formWithParents._lookup('FEATURE#feature1')
            const feature2 = formWithParents._lookup('FEATURE#feature2')
            expect(feature1).toBeDefined()
            expect(feature2).toBeDefined()

            const children = organization.getChildrenOfParent(undefined)
            const childKeys = children.map(child => child._payload.plain.standardKey.toJSON())
            expect(childKeys).toContainEqual(feature1!._key.plain.toJSON())
            expect(childKeys).toContainEqual(feature2!._key.plain.toJSON())
        })
    })
})

