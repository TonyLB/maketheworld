import { StandardAuthorizationResource } from "./resource"
import StandardReference from "../components/reference"
import { StandardAuthorizationItem } from "./components/baseClasses"
import StandardGrant from "./components/grant"
import { schemaToWML } from "../../schema"
import { deIndentWML } from "../../schema/utils"
import { StandardAuthRemove, StandardAuthReplace } from "./components/edits"

describe('StandardAuthorizationResource class', () => {

    it('should construct StandardAuthorizationResource from JSON', () => {
        const reference = new StandardReference({ key: 'Room1', tag: 'Room' })
        const grants: StandardAuthorizationItem[] = [
            new StandardGrant({ tag: 'Grant', player: 'player1', actions: ['action1'] }),
            new StandardGrant({ tag: 'Grant', player: 'player2', actions: ['action2'] })
        ]
        const resource = new StandardAuthorizationResource({ reference, grants })
        expect(resource.reference).toEqual(reference)
        expect(resource.grants).toEqual(grants)
        expect(resource.toJSON()).toEqual({
            reference: reference.toJSON(),
            grants: grants.map(grant => grant.toJSON())
        })
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

    it('should construct global grants from WML', () => {
        const wml = deIndentWML(`
            <Grant player=(player1) actions="action1" />
            <Grant player=(player2) actions="action2" />
        `)
        const resource = new StandardAuthorizationResource(wml)
        expect(schemaToWML(resource.schema)).toEqual(wml)
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
        const reference = new StandardReference({ key: 'Room1', tag: 'Room' })
        const grants: StandardAuthorizationItem[] = [
            new StandardGrant({ tag: 'Grant', player: 'player1', actions: ['action1'] }),
            new StandardGrant({ tag: 'Grant', player: 'player2', actions: ['action2'] })
        ]
        const resource = new StandardAuthorizationResource({ reference, grants })
        expect(schemaToWML(resource.schema)).toEqual(deIndentWML(`
            <Room key=(Room1)>
                <Grant player=(player1) actions="action1" />
                <Grant player=(player2) actions="action2" />
            </Room>
        `))
    })

    it('should render schema for resource without reference', () => {
        const grants: StandardAuthorizationItem[] = [
            new StandardGrant({ tag: 'Grant', player: 'player1', actions: ['action1'] }),
            new StandardGrant({ tag: 'Grant', player: 'player2', actions: ['action2'] })
        ]
        const resource = new StandardAuthorizationResource({ grants })
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