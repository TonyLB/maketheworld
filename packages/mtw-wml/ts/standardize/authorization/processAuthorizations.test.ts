import { processAuthorizations } from './processAuthorizations'
import { ComponentProcessingTemplate } from '../processComponents'
import { StandardAuthorizationResource } from './resource'
import { StandardGrant } from './components/grant'
import { Schema } from '../../schema'
import { StandardAuthRemove, StandardAuthReplace } from './components/edits'
import StandardReference from '../components/reference'

const componentTemplates: ComponentProcessingTemplate[] = [
    { 
        key: 'Character',
        legalParents: ['Room']
    },
    { key: 'Image' },
    { key: 'Room', legalParents: ['Map', 'Message'] },
    { key: 'Feature', legalParents: ['Room'] },
    { key: 'Knowledge' },
    { key: 'Map' },
    { key: 'Message', legalParents: ['Moment'] },
    { key: 'Moment' },
    { key: 'Example', legalParents: ['Room', 'Feature', 'Knowledge'] }
]

describe("processAuthorizations", () => {
    it('should return an empty object when given an empty schema', () => {
        const schema = new Schema()
        schema.loadWML(`<Asset key=(test) />`)
        const result = processAuthorizations({
            componentTemplates,
            schema: schema.schema,
        })
        expect(result).toEqual({})
    })

    it('should parse a provided schema with grants', () => {
        const testSource = `
            <Asset key=(Test)>
                <Room key=(test)>
                    <Grant player=(test1) actions="action1" />
                </Room>
            </Asset>
        `
        const schema = new Schema()
        schema.loadWML(testSource)
        const result = processAuthorizations({
            componentTemplates,
            schema: schema.schema
        })

        expect(Object.keys(result)).toEqual(['test'])
        expect(result.test.toJSON()).toEqual({
            referenceStack: [{ key: 'test', tag: 'Room' }],
            grants: [{ tag: 'Grant', player: 'test1', actions: ['action1'] }]
        })
    })

    it('should handle nested components with grants', () => {
        const testSource = `
            <Asset key=(Test)>
                <Room key=(test)>
                    <Feature key=(testFeature)>
                        <Grant player=(test1) actions="action1" />
                    </Feature>
                </Room>
            </Asset>
        `
        const schema = new Schema()
        schema.loadWML(testSource)
        const result = processAuthorizations({
            componentTemplates,
            schema: schema.schema,
        })
        expect(Object.keys(result)).toEqual(['test.testFeature'])
        expect(result["test.testFeature"].toJSON()).toEqual({
            referenceStack: [
                { key: 'test', tag: 'Room' },
                { key: 'testFeature', tag: 'Feature' }
            ],
            grants: [{ tag: 'Grant', player: 'test1', actions: ['action1'] }]
        })
    })

    it('should handle remove tags', () => {
        const testSource = `
            <Asset key=(Test)>
                <Room key=(test)>
                    <Remove>
                        <Grant player=(test1) actions="action1" />
                    </Remove>
                </Room>
            </Asset>
        `
        const schema = new Schema()
        schema.loadWML(testSource)
        const result = processAuthorizations({
            componentTemplates,
            schema: schema.schema,
        })
        expect(Object.keys(result)).toEqual(['test'])
        expect(result.test.toJSON()).toEqual({
            referenceStack: [{ key: 'test', tag: 'Room' }],
            grants: [{ tag: 'Remove', component: { tag: 'Grant', player: 'test1', actions: ['action1'] } }]
        })
    })

    it('should handle replace tags', () => {
        const testSource = `
            <Asset key=(Test)>
                <Room key=(test)>
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
            componentTemplates,
            schema: schema.schema,
        })
        expect(Object.keys(result)).toEqual(['test'])
        expect(result.test.toJSON()).toEqual({
            referenceStack: [{ key: 'test', tag: 'Room' }],
            grants: [{
                tag: 'Replace',
                match: { tag: 'Grant', player: 'test1', actions: ['action1'] },
                payload: { tag: 'Grant', player: 'test1', actions: ['action2'] }
            }]
        })
    })
})