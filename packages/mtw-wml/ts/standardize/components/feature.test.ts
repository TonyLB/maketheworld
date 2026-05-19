import { Schema, schemaToWML } from "../../schema"
import { deIndentWML } from "../../schema/utils"
import { StandardFeatureData } from "./dataTypes/feature"
import StandardFeature from './feature'
import { mergeTest } from "./utils/testing"
import StandardReference from "../keys/reference"
import { StandardKey } from "../keys/key"

describe('StandardFeature class', () => {

    it('should construct StandardFeature from WML', () => {
        const testSource = deIndentWML(`
            <Feature key=(test)>
                <Situation uuid=(DEFAULT)><DisplayName>Base</DisplayName></Situation>
            </Feature>
        `)
        const testFeature = new StandardFeature(testSource)
        expect(testFeature.key).toEqual('test')
        expect(testFeature.situations.items[0].reference.universalKey).toEqual('SITUATION#DEFAULT')
        expect(schemaToWML([testFeature.schema])).toEqual(testSource)
    })

    it('should construct StandardFeature from WML with ShortName', () => {
        const testSource = deIndentWML(`
            <Feature key=(test)>
                <ShortName>Test Feature</ShortName>
                <Situation uuid=(DEFAULT)><DisplayName>Base</DisplayName></Situation>
            </Feature>
        `)
        const testFeature = new StandardFeature(testSource)
        expect(testFeature.key).toEqual('test')
        expect(testFeature.shortName?.toJSON()).toEqual('Test Feature')
        expect(schemaToWML([testFeature.schema])).toEqual(testSource)
    })

    it('should construct StandardFeature from schema', () => {
        const schema = new Schema()
        const testSource = deIndentWML(`
            <Feature key=(test)>
                <Situation uuid=(DEFAULT)><DisplayName>Base</DisplayName></Situation>
            </Feature>
        `)
        schema.loadWML(testSource)
        const testFeature = new StandardFeature(schema.schema[0])
        expect(testFeature.key).toEqual('test')
        expect(schemaToWML([testFeature.schema])).toEqual(testSource)
    })

    it('should construct StandardFeature from StandardFeatureData', () => {
        const testFeatureData: StandardFeatureData = {
            key: 'test',
            tag: 'Feature',
            situations: [{
                reference: 'SITUATION#DEFAULT',
                payload: { displayName: 'Example1' }
            }]
        }
        const testFeature = new StandardFeature(testFeatureData)
        expect(testFeature.key).toEqual('test')
        expect(testFeature.toJSON()).toEqual(testFeatureData)
    })

    it('should construct StandardFeature from StandardFeatureData with shortName', () => {
        const testFeatureData: StandardFeatureData = {
            key: 'test',
            tag: 'Feature',
            shortName: 'Test Feature',
            situations: [{
                reference: 'SITUATION#DEFAULT',
                payload: { displayName: 'Example1' }
            }]
        }
        const testFeature = new StandardFeature(testFeatureData)
        expect(testFeature.key).toEqual('test')
        expect(testFeature.shortName?.toJSON()).toEqual('Test Feature')
        expect(testFeature.toJSON()).toEqual(testFeatureData)
    })

    it('should merge correctly', () => {
        expect(mergeTest(
            `<Feature key=(testFeature)>
                <Situation key=(sit1)><DisplayName>One</DisplayName></Situation>
            </Feature>`,
            StandardFeature,
            `<Feature key=(testFeature)>
                <Situation key=(sit2)><DisplayName>Two</DisplayName></Situation>
            </Feature>`
        )).toEqual(deIndentWML(`
            <Feature key=(testFeature)>
                <Situation key=(sit1)><DisplayName>One</DisplayName></Situation>
                <Situation key=(sit2)><DisplayName>Two</DisplayName></Situation>
            </Feature>
        `))
    })

    it('should merge DEFAULT situation facets with Replace/With on prose', () => {
        expect(mergeTest(
            `<Feature key=(testFeature)>
                <Situation uuid=(DEFAULT)>
                    <DisplayName>Lobby</DisplayName>
                    <Description>A plain lobby.</Description>
                </Situation>
            </Feature>`,
            StandardFeature,
            `<Feature key=(testFeature) ref={0}>
                <Situation uuid=(DEFAULT) ref={0}>
                    <Replace><DisplayName>Lobby</DisplayName></Replace><With><DisplayName>Spooky Lobby</DisplayName></With>
                    <Description><Space />Shadows cling to the corners.</Description>
                </Situation>
            </Feature>`
        )).toEqual(deIndentWML(`
            <Feature key=(testFeature)>
                <Situation uuid=(DEFAULT)>
                    <DisplayName>Spooky Lobby</DisplayName>
                    <Description>A plain lobby. Shadows cling to the corners.</Description>
                </Situation>
            </Feature>
        `))
    })

    it('should merge shortName correctly', () => {
        expect(mergeTest(
            `<Feature key=(testFeature)>
                <ShortName>Original</ShortName>
            </Feature>`,
            StandardFeature,
            `<Feature key=(testFeature)>
                <Replace><ShortName>Original</ShortName></Replace>
                <With><ShortName>Updated</ShortName></With>
            </Feature>`
        )).toEqual(deIndentWML(`
            <Feature key=(testFeature)><ShortName>Updated</ShortName></Feature>
        `))
    })

    it('should treat undefined and empty shortName as equal', () => {
        const withoutShortName = new StandardFeature({
            tag: 'Feature',
            key: 'test',
            situations: [{
                reference: 'SITUATION#DEFAULT',
                payload: { displayName: 'Name' }
            }]
        })
        const withEmptyShortName = new StandardFeature({
            tag: 'Feature',
            key: 'test',
            shortName: '',
            situations: [{
                reference: 'SITUATION#DEFAULT',
                payload: { displayName: 'Name' }
            }]
        })

        expect(withoutShortName.equals(withEmptyShortName)).toBe(true)
        expect(withEmptyShortName.equals(withoutShortName)).toBe(true)
    })

    it('should throw on unconsumed child tags', () => {
        const testSource = deIndentWML(`
            <Feature key=(testFeature)>
                <Situation uuid=(DEFAULT) />
                <Map />
            </Feature>
        `)
        expect(() => new StandardFeature(testSource)).toThrow(/Unconsumed child tags:/)
        expect(() => new StandardFeature(testSource)).toThrow(/Map/)
    })

    it('should reject legacy Example child WML at parse time (Phase 4)', () => {
        const testSource = deIndentWML(`
            <Feature key=(testFeature)>
                <Example key=(Example1) />
            </Feature>
        `)
        expect(() => new StandardFeature(testSource)).toThrow()
    })

    it('should correctly add a Situation reference to a feature', () => {
        const test = new StandardFeature(`
            <Feature key=(testFeature)>
                <Situation uuid=(DEFAULT) />
            </Feature>
        `)
        const situation = new StandardKey("SITUATION#other")
        const added = test.withChild(new StandardReference(situation))
        expect(schemaToWML([added.schema])).toEqual(deIndentWML(`
            <Feature key=(testFeature)>
                <Situation uuid=(DEFAULT) />
                <Situation uuid=(other) />
            </Feature>
        `))
    })

    it('should diff shortName correctly', () => {
        const testFeature = new StandardFeature(`
            <Feature key=(test)>
                <ShortName>Original</ShortName>
            </Feature>
        `)
        const testFeature2 = new StandardFeature(`
            <Feature key=(test)>
                <ShortName>Updated</ShortName>
            </Feature>
        `)
        const diff = testFeature.diff(testFeature2)
        expect(diff).toBeDefined()
        expect(schemaToWML([diff!.schema])).toEqual(deIndentWML(`
            <Feature key=(test)>
                <Replace><ShortName>Original</ShortName></Replace>
                <With><ShortName>Updated</ShortName></With>
            </Feature>
        `))
    })

    it('referencedKeys should include Direct Situation ref and Link keys from description', () => {
        const test = new StandardFeature(deIndentWML(`
            <Feature key=(test)>
                <Situation uuid=(DEFAULT)>
                    <Description>See <Link to=(featOne)>Feature</Link>.</Description>
                </Situation>
            </Feature>
        `))
        const mapping = [
            new StandardReference({ key: 'featOne', tag: 'Feature', universalKey: 'FEATURE#featOne' }),
        ]
        const keys = test._payload.referencedKeys(mapping)
        expect(keys.some((k) => k.referenceType === 'Direct' && k.reference.universalKey === 'SITUATION#DEFAULT')).toBe(true)
        expect(keys.some((k) => k.referenceType === 'Link' && k.reference.sameKey(mapping[0]))).toBe(true)
    })

    describe('assureReferences method', () => {
        it('should return unchanged feature when children array is empty', () => {
            const feature = new StandardFeature({ tag: 'Feature', key: 'test' })
            const { payload: result, inlineRemainder } = feature._payload.assureReferences([])
            
            expect(result.situations.length).toBe(0)
            expect(inlineRemainder).toEqual([])
            expect(feature._payload.situations.length).toBe(0)
        })
        
        it('should put all children in inlineRemainder with ref={0}', () => {
            const feature = new StandardFeature({ tag: 'Feature', key: 'test' })
            const situationRef = new StandardReference({ tag: 'Situation', key: 'ex1', universalKey: 'SITUATION#ex1' })
            
            const { payload: result, inlineRemainder } = feature._payload.assureReferences([situationRef])
            
            expect(result.situations.length).toBe(0)
            expect(inlineRemainder.length).toBe(1)
            expect(inlineRemainder[0].ref).toBe(0)
            expect(inlineRemainder[0].sameKey(situationRef)).toBe(true)
        })
        
        it('should return a clone without mutating the original', () => {
            const feature = new StandardFeature({ tag: 'Feature', key: 'test' })
            const situationRef = new StandardReference({ tag: 'Situation', key: 'ex1', universalKey: 'SITUATION#ex1' })
            
            const { payload: result } = feature._payload.assureReferences([situationRef])
            
            expect(feature._payload.situations.length).toBe(0)
            expect(result.situations.length).toBe(0)
            expect(result).not.toBe(feature._payload)
        })
        
        it('should put non-Situation children in inlineRemainder', () => {
            const feature = new StandardFeature({ tag: 'Feature', key: 'test' })
            const lensRef = new StandardReference({ tag: 'Lens', key: 'lens1' })
            const situationRef = new StandardReference({ tag: 'Situation', key: 'ex1', universalKey: 'SITUATION#ex1' })
            
            const { payload: result, inlineRemainder } = feature._payload.assureReferences([lensRef, situationRef])
            
            expect(result.situations.length).toBe(0)
            expect(inlineRemainder.length).toBe(2)
            expect(inlineRemainder.every((r) => r.ref === 0)).toBe(true)
        })
    })

    describe('removeReferences method', () => {
        it('should remove matching situation facets', () => {
            const feature = new StandardFeature(deIndentWML(`
                <Feature key=(test)>
                    <Situation key=(ex1) />
                    <Situation key=(ex2) />
                </Feature>
            `))
            const situationRef = new StandardReference({ tag: 'Situation', key: 'ex1', universalKey: 'SITUATION#ex1' })
            
            const result = feature._payload.removeReferences([situationRef])
            
            expect(result.situations.length).toBe(1)
            expect(result.situations.items[0].reference.sameKey(new StandardReference({ tag: 'Situation', key: 'ex2', universalKey: 'SITUATION#ex2' }))).toBe(true)
        })
        
        it('should return a clone without mutating the original', () => {
            const feature = new StandardFeature(deIndentWML(`
                <Feature key=(test)>
                    <Situation key=(ex1) />
                </Feature>
            `))
            const originalLength = feature._payload.situations.length
            const situationRef = new StandardReference({ tag: 'Situation', key: 'ex1', universalKey: 'SITUATION#ex1' })
            
            const result = feature._payload.removeReferences([situationRef])
            
            expect(feature._payload.situations.length).toBe(originalLength)
            expect(result.situations.length).toBe(0)
            expect(result).not.toBe(feature._payload)
        })
    })

    it('round-trips render from StandardFeatureData to schema', () => {
        const testFeatureData: StandardFeatureData = {
            key: 'test',
            tag: 'Feature',
            render: {
                displayName: 'Cached Name',
                summary: ['Summary text'],
                description: ['Description text'],
            },
        }
        const testFeature = new StandardFeature(testFeatureData)
        expect(testFeature.render).toEqual(testFeatureData.render)
        expect(schemaToWML([testFeature.schema])).toEqual(deIndentWML(`
            <Feature key=(test)>
                <Render>
                    <DisplayName>Cached Name</DisplayName>
                    <Summary>Summary text</Summary>
                    <Description>Description text</Description>
                </Render>
            </Feature>
        `))
    })

    it('rejects Render under Feature in asset mode', () => {
        const wml = deIndentWML(`
            <Feature key=(fountain)>
                <Render>
                    <DisplayName>Fountain</DisplayName>
                    <Summary>Sparkling water</Summary>
                    <Description>A marble fountain.</Description>
                </Render>
            </Feature>
        `)
        expect(() => new StandardFeature(wml)).toThrow()
    })
    
})
