import { StandardAuthorizationResource } from "./resource"
import StandardReference from "../components/reference"
import { StandardAuthorizationItem } from "./components/baseClasses"
import StandardGrant from "./components/grant"
import { schemaToWML } from "../../schema"
import { deIndentWML } from "../../schema/utils"

describe('StandardAuthorizationResource class', () => {

    it('should construct StandardAuthorizationResource from JSON', () => {
        const reference = new StandardReference({ key: 'Room1' }, 'Room')
        const grants: StandardAuthorizationItem[] = [
            new StandardGrant({ tag: 'Grant', player: 'player1', actions: ['action1'] }),
            new StandardGrant({ tag: 'Grant', player: 'player2', actions: ['action2'] })
        ]
        const resource = new StandardAuthorizationResource({ component: reference, grants })
        expect(resource.component?.toJSON()).toEqual(reference.toJSON())
        expect(resource.grants).toEqual(grants)
        expect(resource.toJSON()).toEqual({
            component: reference.toJSON(),
            grants: grants.map(grant => grant.toJSON())
        })
    })

    it('should construct StandardAuthorizationResource from NDJSON', () => {
        const resource = new StandardAuthorizationResource([{
            component: { key: 'Room1' },
            grant: { tag: 'Grant', player: 'player1', actions: ['action1'] }
        }, {
            component: { key: 'Room1' },
            grant: { tag: 'Grant', player: 'player2', actions: ['action2'] }
        }])
        expect(resource.component?.toJSON()).toEqual({ key: 'Room1' })
        expect(resource.grants).toEqual([
            new StandardGrant({ tag: 'Grant', player: 'player1', actions: ['action1'] }),
            new StandardGrant({ tag: 'Grant', player: 'player2', actions: ['action2'] })
        ])
    })

    it('should throw error on NDJSON with differing components', () => {
        expect(() => {
            new StandardAuthorizationResource([{
                component: { key: 'Room1' },
                grant: { tag: 'Grant', player: 'player1', actions: ['action1'] }
            }, {
                component: { key: 'Room2' },
                grant: { tag: 'Grant', player: 'player2', actions: ['action2'] }
            }])
        }).toThrow()
    })

    it('should construct resource grant from WML', () => {
        const wml = deIndentWML(`
            <Room key=(Room1)>
                <Grant player=(player1) actions="action1" />
                <Grant player=(player2) actions="action2" />
            </Room>
        `)
        const resource = new StandardAuthorizationResource(wml)
        expect(schemaToWML(resource.schema)).toEqual(wml)
    })

    it('should correct render NDJSON', () => {
        const wml = deIndentWML(`
            <Room key=(Room1)>
                <Grant player=(player1) actions="action1" />
                <Grant player=(player2) actions="action2" />
            </Room>
        `)
        const resource = new StandardAuthorizationResource(wml)
        expect(resource.toNDJSON()).toEqual([
            {
                component: { key: 'Room1' },
                grant: { tag: 'Grant', player: 'player1', actions: ['action1'] }
            },
            {
                component: { key: 'Room1' },
                grant: { tag: 'Grant', player: 'player2', actions: ['action2'] }
            }
        ])
    })

    it('should correctly handle remove edits', () => {
        const testWML = `
            <Room key=(Room1)>
                <Remove><Grant player=(player2) actions="action2" /></Remove>
            </Room>
        `
        const resource = new StandardAuthorizationResource(testWML)
        expect(schemaToWML(resource.schema)).toEqual(deIndentWML(testWML))
    })

    it('should correctly handle replace edits', () => {
        const testWML = `
            <Room key=(Room1)>
                <Replace><Grant player=(player2) actions="action2" /></Replace>
                <With><Grant player=(player2) actions="action3" /></With>
            </Room>
        `
        const resource = new StandardAuthorizationResource(testWML)
        expect(schemaToWML(resource.schema)).toEqual(deIndentWML(testWML))
    })

    it('should merge StandardAuthorizationResource correctly', () => {
        const resourceOne = new StandardAuthorizationResource(`
            <Room key=(Room1)>
                <Grant player=(player1) actions="action1" />
            </Room>
        `)
        const resourceTwo = new StandardAuthorizationResource(`
            <Room key=(Room1)>
                <Grant player=(player1) actions="action2" />
                <Grant player=(player2) actions="action3" />
            </Room>
        `)

        const mergedResource = resourceOne.merge(resourceTwo)
        expect(schemaToWML(mergedResource.schema)).toEqual(deIndentWML(`
            <Room key=(Room1)>
                <Grant player=(player1) actions="action1, action2" />
                <Grant player=(player2) actions="action3" />
            </Room>
        `))
    })

    it('should handle merging with no overlapping grants', () => {
        const resourceOne = new StandardAuthorizationResource(`
            <Room key=(Room1)>
                <Grant player=(player1) actions="action1" />
            </Room>
        `)
        const resourceTwo = new StandardAuthorizationResource(`
            <Room key=(Room1)>
                <Grant player=(player2) actions="action2" />
            </Room>
        `)
        const mergedResource = resourceOne.merge(resourceTwo)
        expect(schemaToWML(mergedResource.schema)).toEqual(deIndentWML(`
            <Room key=(Room1)>
                <Grant player=(player1) actions="action1" />
                <Grant player=(player2) actions="action2" />
            </Room>
        `))
    })

    it('should handle merging with identical grants', () => {
        const testWML = `<Room key=(Room1)><Grant player=(player1) actions="action1" /></Room>`
        const resourceOne = new StandardAuthorizationResource(testWML)
        const mergedResource = resourceOne.merge(resourceOne)
        expect(schemaToWML(mergedResource.schema)).toEqual(testWML)
    })

    it('should handle merging remove elements', () => {
        const base = new StandardAuthorizationResource(`
            <Room key=(Room1)>
                <Grant player=(player1) actions="action1, action2" />
            </Room>
        `)
        const incoming = new StandardAuthorizationResource(`
            <Room key=(Room1)>
                <Remove><Grant player=(player1) actions="action2" /></Remove>
            </Room>
        `)
        const mergedResource = base.merge(incoming)
        expect(schemaToWML(mergedResource.schema)).toEqual(deIndentWML(`
            <Room key=(Room1)><Grant player=(player1) actions="action1" /></Room>
        `))
    })

    it('should handle merging replace elements', () => {
        const base = new StandardAuthorizationResource(`
            <Room key=(Room1)>
                <Grant player=(player1) actions="action1, action2" />
            </Room>
        `)
        const incoming = new StandardAuthorizationResource(`
            <Room key=(Room1)>
                <Replace>
                    <Grant player=(player1) actions="action2" />
                </Replace>
                <With>
                    <Grant player=(player1) actions="action3" />
                </With>
            </Room>
        `)
        const mergedResource = base.merge(incoming)
        expect(schemaToWML(mergedResource.schema)).toEqual(deIndentWML(`
            <Room key=(Room1)><Grant player=(player1) actions="action1, action3" /></Room>
        `))
    })

    it('should render schema for resource with reference', () => {
        const reference = new StandardReference({ key: 'Room1' }, 'Room')
        const grants: StandardAuthorizationItem[] = [
            new StandardGrant({ tag: 'Grant', player: 'player1', actions: ['action1'] }),
            new StandardGrant({ tag: 'Grant', player: 'player2', actions: ['action2'] })
        ]
        const resource = new StandardAuthorizationResource({ component: reference, grants })
        expect(schemaToWML(resource.schema)).toEqual(deIndentWML(`
            <Room key=(Room1)>
                <Grant player=(player1) actions="action1" />
                <Grant player=(player2) actions="action2" />
            </Room>
        `))
    })

    it('should render schema for global grants (no component)', () => {
        const grants: StandardAuthorizationItem[] = [
            new StandardGrant({ tag: 'Grant', player: 'player1', actions: ['action1'] }),
            new StandardGrant({ tag: 'Grant', player: 'player2', actions: ['action2'] })
        ]
        const resource = new StandardAuthorizationResource({ component: undefined, grants })
        // Global grants have no component
        expect(resource.component).toBeUndefined()
        expect(resource.grants).toEqual(grants)
        // Schema renders grants directly without component wrapper
        expect(schemaToWML(resource.schema)).toEqual(deIndentWML(`
            <Grant player=(player1) actions="action1" />
            <Grant player=(player2) actions="action2" />
        `))
    })

    it('should diff added grants', () => {
        const resourceOne = new StandardAuthorizationResource(`
            <Room key=(Room1)>
                <Grant player=(player1) actions="action1" />
            </Room>
        `)
        const resourceTwo = new StandardAuthorizationResource(`
            <Room key=(Room1)>
                <Grant player=(player1) actions="action1" />
                <Grant player=(player2) actions="action2" />
            </Room>
        `)
        const diffResource = resourceOne.diff(resourceTwo)
        expect(diffResource).toBeTruthy()
        if (diffResource) {
            expect(schemaToWML(diffResource.schema)).toEqual(deIndentWML(`
                <Room key=(Room1)><Grant player=(player2) actions="action2" /></Room>
            `))
        }
    })

    it('should diff removed grants', () => {
        const resourceOne = new StandardAuthorizationResource(`
            <Room key=(Room1)>
                <Grant player=(player1) actions="action1" />
                <Grant player=(player2) actions="action2" />
            </Room>
        `)
        const resourceTwo = new StandardAuthorizationResource(`
            <Room key=(Room1)>
                <Grant player=(player1) actions="action1" />
            </Room>
        `)

        const diffResource = resourceOne.diff(resourceTwo)
        expect(diffResource).toBeTruthy()
        if (diffResource) {
            expect(schemaToWML(diffResource.schema)).toEqual(deIndentWML(`
                <Room key=(Room1)>
                    <Remove><Grant player=(player2) actions="action2" /></Remove>
                </Room>
            `))
        }
    })

    it('should diff changed grants', () => {
        const resourceOne = new StandardAuthorizationResource(`
            <Room key=(Room1)>
                <Grant player=(player1) actions="action1" />
                <Grant player=(player2) actions="action2" />
            </Room>
        `)
        const resourceTwo = new StandardAuthorizationResource(`
            <Room key=(Room1)>
                <Grant player=(player1) actions="action1" />
                <Grant player=(player2) actions="action3" />
            </Room>
        `)

        const diffResource = resourceOne.diff(resourceTwo)
        expect(diffResource).toBeTruthy()
        if (diffResource) {
            expect(schemaToWML(diffResource.schema)).toEqual(deIndentWML(`
                <Room key=(Room1)>
                    <Replace><Grant player=(player2) actions="action2" /></Replace>
                    <With><Grant player=(player2) actions="action3" /></With>
                </Room>
            `))
        }
    })
})