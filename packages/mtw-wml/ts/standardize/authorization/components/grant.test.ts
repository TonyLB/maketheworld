import { Schema, schemaToWML } from "../../../schema"
import { deIndentWML } from "../../../schema/utils"
import { StandardGrantData } from "./dataTypes/grant"
import StandardGrant from './grant'
import { mergeTest } from '../../components/utils/testing'
import { StandardAuthReplace } from "./edits"

describe('StandardGrant class', () => {

    it('should construct StandardGrant from WML', () => {
        const testSource = deIndentWML(`
            <Grant player=(testPlayer) actions="action1, action2" />
        `)
        const testGrant = new StandardGrant(testSource)
        expect(testGrant.player).toEqual('testPlayer')
        expect(testGrant.actions).toEqual(['action1', 'action2'])
        expect(schemaToWML([testGrant.schema])).toEqual(testSource)
    })

    it('should construct StandardGrant from schema', () => {
        const schema = new Schema()
        const testSource = deIndentWML(`
            <Grant player=(testPlayer) actions="action1, action2" />
        `)
        schema.loadWML(testSource)
        const testGrant = new StandardGrant(schema.schema[0])
        expect(testGrant.player).toEqual('testPlayer')
        expect(testGrant.actions).toEqual(['action1', 'action2'])
        expect(schemaToWML([testGrant.schema])).toEqual(testSource)
    })

    it('should construct StandardGrant from StandardGrantData', () => {
        const testComputedData: StandardGrantData = {
            tag: 'Grant',
            player: 'testPlayer',
            actions: ['action1', 'action2']
        }
        const testComputed = new StandardGrant(testComputedData)
        expect(testComputed.player).toEqual('testPlayer')
        expect(testComputed.actions).toEqual(['action1', 'action2'])
        expect(testComputed.toJSON()).toEqual(testComputedData)
    })

    it('should merge correctly', () => {
        expect(mergeTest(
            '<Grant player=(testPlayer) actions="action1" />',
            StandardGrant,
            '<Grant player=(testPlayer) actions="action2" />'
        )).toEqual(deIndentWML('<Grant player=(testPlayer) actions="action1, action2" />'))
    })

    it('should diff identical components correctly', () => {
        const testGrant = new StandardGrant({
            tag: 'Grant',
            player: 'testPlayer',
            actions: ['action1', 'action2']
        })
        expect(testGrant.diff(testGrant)).toBeUndefined()
    })

    it('should diff different components correctly', () => {
        const testGrant = new StandardGrant({
            tag: 'Grant',
            player: 'testPlayer',
            actions: ['action1']
        })
        const testGrant2 = new StandardGrant({
            tag: 'Grant',
            player: 'testPlayer',
            actions: ['action2']
        })
        expect(testGrant.diff(testGrant2)?.toJSON()).toEqual(new StandardAuthReplace(testGrant, testGrant2).toJSON())
    })
})