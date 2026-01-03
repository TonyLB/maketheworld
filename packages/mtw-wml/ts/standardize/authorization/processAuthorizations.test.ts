import { processAuthorizations } from './processAuthorizations'
import { StandardAuthorizationResource } from './resource'
import { StandardGrant } from './components/grant'
import { Schema } from '../../schema'
import { StandardAuthRemove, StandardAuthReplace } from './components/edits'
import StandardReference from '../keys/reference'

describe("processAuthorizations", () => {
    it('should return an empty array when given an empty schema', () => {
        const schema = new Schema()
        schema.loadWML(`<Asset uuid=(test) />`)
        const result = processAuthorizations({
            schema: schema.schema,
        })
        expect(result).toEqual([])
    })

    it('should parse a provided schema with grants', () => {
        const testSource = `
            <Asset uuid=(Test)>
                <Room uuid=(test)>
                    <Grant player=(test1) actions="action1" />
                </Room>
            </Asset>
        `
        const schema = new Schema()
        schema.loadWML(testSource)
        const result = processAuthorizations({
            schema: schema.schema
        })

        expect(result.length).toEqual(1)
        expect(result[0].toJSON()).toEqual({
            component: 'ROOM#test',
            grants: [{ tag: 'Grant', player: 'test1', actions: ['action1'] }]
        })
    })

    it('should handle nested components with grants (flat output)', () => {
        const testSource = `
            <Asset uuid=(Test)>
                <Room uuid=(test)>
                    <Feature uuid=(testFeature)>
                        <Grant player=(test1) actions="action1" />
                    </Feature>
                </Room>
            </Asset>
        `
        const schema = new Schema()
        schema.loadWML(testSource)
        const result = processAuthorizations({
            schema: schema.schema,
        })
        // Should return a flat list: just the Feature with grants (Room has no grants)
        expect(result.length).toEqual(1)
        expect(result[0].toJSON()).toEqual({
            component: 'FEATURE#testFeature',
            grants: [{ tag: 'Grant', player: 'test1', actions: ['action1'] }]
        })
    })

    it('should handle remove tags', () => {
        const testSource = `
            <Asset uuid=(Test)>
                <Room uuid=(test)>
                    <Remove>
                        <Grant player=(test1) actions="action1" />
                    </Remove>
                </Room>
            </Asset>
        `
        const schema = new Schema()
        schema.loadWML(testSource)
        const result = processAuthorizations({
            schema: schema.schema,
        })
        expect(result.length).toEqual(1)
        expect(result[0].toJSON()).toEqual({
            component: 'ROOM#test',
            grants: [{ tag: 'Remove', component: { tag: 'Grant', player: 'test1', actions: ['action1'] } }]
        })
    })

    it('should handle replace tags', () => {
        const testSource = `
            <Asset uuid=(Test)>
                <Room uuid=(test)>
                    <Replace>
                        <Grant player=(test1) actions="action1" />
                    </Replace>
                    <With>
                        <Grant player=(test1) actions="action2" />
                    </With>
                </Room>
            </Asset>
        `
        const schema = new Schema()
        schema.loadWML(testSource)
        const result = processAuthorizations({
            schema: schema.schema,
        })
        expect(result.length).toEqual(1)
        expect(result[0].toJSON()).toEqual({
            component: 'ROOM#test',
            grants: [{
                tag: 'Replace',
                match: { tag: 'Grant', player: 'test1', actions: ['action1'] },
                payload: { tag: 'Grant', player: 'test1', actions: ['action2'] }
            }]
        })
    })
})