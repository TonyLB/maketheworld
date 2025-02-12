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

    it('should merge StandardAuthorizationResource correctly', () => {
        const reference = new StandardReference({ key: 'Room1', tag: 'Room' })
        const grants1: StandardAuthorizationItem[] = [
            new StandardGrant({ tag: 'Grant', player: 'player1', actions: ['action1'] })
        ]
        const grants2: StandardAuthorizationItem[] = [
            new StandardGrant({ tag: 'Grant', player: 'player1', actions: ['action2'] }),
            new StandardGrant({ tag: 'Grant', player: 'player2', actions: ['action3'] })
        ]
        const resource1 = new StandardAuthorizationResource({ reference, grants: grants1 })
        const resource2 = new StandardAuthorizationResource({ reference, grants: grants2 })
        const mergedResource = resource1.merge(resource2)
        expect(mergedResource.grants).toEqual([
            new StandardGrant({ tag: 'Grant', player: 'player1', actions: ['action1', 'action2'] }),
            new StandardGrant({ tag: 'Grant', player: 'player2', actions: ['action3'] })
        ])
    })

    it('should handle merging with no overlapping grants', () => {
        const reference = new StandardReference({ key: 'Room1', tag: 'Room' })
        const grants1: StandardAuthorizationItem[] = [
            new StandardGrant({ tag: 'Grant', player: 'player1', actions: ['action1'] })
        ]
        const grants2: StandardAuthorizationItem[] = [
            new StandardGrant({ tag: 'Grant', player: 'player2', actions: ['action2'] })
        ]
        const resource1 = new StandardAuthorizationResource({ reference, grants: grants1 })
        const resource2 = new StandardAuthorizationResource({ reference, grants: grants2 })
        const mergedResource = resource1.merge(resource2)
        expect(mergedResource.grants).toEqual([
            new StandardGrant({ tag: 'Grant', player: 'player1', actions: ['action1'] }),
            new StandardGrant({ tag: 'Grant', player: 'player2', actions: ['action2'] })
        ])
    })

    it('should handle merging with identical grants', () => {
        const reference = new StandardReference({ key: 'Room1', tag: 'Room' })
        const grants: StandardAuthorizationItem[] = [
            new StandardGrant({ tag: 'Grant', player: 'player1', actions: ['action1'] })
        ]
        const resource1 = new StandardAuthorizationResource({ reference, grants })
        const resource2 = new StandardAuthorizationResource({ reference, grants })
        const mergedResource = resource1.merge(resource2)
        expect(mergedResource.grants).toEqual(grants)
    })

    it('should handle merging remove elements', () => {
        const reference = new StandardReference({ key: 'Room1', tag: 'Room' })
        const grants: StandardAuthorizationItem[] = [
            new StandardGrant({ tag: 'Grant', player: 'player1', actions: ['action1', 'action2'] })
        ]
        const resource1 = new StandardAuthorizationResource({ reference, grants })
        const resource2 = new StandardAuthorizationResource({ reference, grants: [
            new StandardAuthRemove(new StandardGrant({ tag: 'Grant', player: 'player1', actions: ['action2'] }))
        ] })
        const mergedResource = resource1.merge(resource2)
        expect(mergedResource.grants).toEqual([new StandardGrant({ tag: 'Grant', player: 'player1', actions: ['action1'] })])
    })

    it('should handle merging replace elements', () => {
        const reference = new StandardReference({ key: 'Room1', tag: 'Room' })
        const grants: StandardAuthorizationItem[] = [
            new StandardGrant({ tag: 'Grant', player: 'player1', actions: ['action1', 'action2'] })
        ]
        const resource1 = new StandardAuthorizationResource({ reference, grants })
        const resource2 = new StandardAuthorizationResource({ reference, grants: [
            new StandardAuthReplace(
                new StandardGrant({ tag: 'Grant', player: 'player1', actions: ['action2'] }),
                new StandardGrant({ tag: 'Grant', player: 'player1', actions: ['action3'] })
            )
        ] })
        const mergedResource = resource1.merge(resource2)
        expect(mergedResource.grants).toEqual([new StandardGrant({ tag: 'Grant', player: 'player1', actions: ['action1', 'action3'] })])
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
})