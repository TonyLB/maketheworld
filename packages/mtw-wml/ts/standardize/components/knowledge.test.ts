import { Schema, schemaToWML } from "../../schema"
import { deIndentWML } from "../../schema/utils"
import { StandardKnowledgeData } from "./dataTypes/knowledge"
import { StandardForm } from '../index'
import StandardKnowledge from './knowledge'
import { mergeTest } from "./utils/testing"
import StandardReference from "../keys/reference"
import { StandardKey } from "../keys/key"

describe('StandardKnowledge class', () => {

    it('should construct StandardKnowledge from WML', () => {
        const testSource = deIndentWML(`
            <Knowledge uuid=(001) key=(test)>
                <Situation uuid=(DEFAULT)><DisplayName>Base</DisplayName></Situation>
            </Knowledge>
        `)
        const testKnowledge = new StandardKnowledge(testSource)
        expect(testKnowledge.key).toEqual('test')
        expect(testKnowledge.situations.items[0].reference.universalKey).toEqual('SITUATION#DEFAULT')
        expect(schemaToWML([testKnowledge.schema])).toEqual(testSource)
    })

    it('should construct StandardKnowledge from WML with ShortName', () => {
        const testSource = deIndentWML(`
            <Knowledge key=(test)>
                <ShortName>Test Knowledge</ShortName>
                <Situation uuid=(DEFAULT)><DisplayName>Base</DisplayName></Situation>
            </Knowledge>
        `)
        const testKnowledge = new StandardKnowledge(testSource)
        expect(testKnowledge.key).toEqual('test')
        expect(testKnowledge.shortName?.toJSON()).toEqual('Test Knowledge')
        expect(schemaToWML([testKnowledge.schema])).toEqual(testSource)
    })

    it('should construct StandardKnowledge from schema', () => {
        const schema = new Schema()
        const testSource = deIndentWML(`
            <Knowledge key=(test)>
                <Situation uuid=(DEFAULT)><DisplayName>Base</DisplayName></Situation>
            </Knowledge>
        `)
        schema.loadWML(testSource)
        const testKnowledge = new StandardKnowledge(schema.schema[0])
        expect(testKnowledge.key).toEqual('test')
        expect(schemaToWML([testKnowledge.schema])).toEqual(testSource)
    })

    it('should construct StandardKnowledge from StandardKnowledgeData', () => {
        const testKnowledgeData: StandardKnowledgeData = {
            key: 'test',
            tag: 'Knowledge',
            situations: [{
                reference: 'SITUATION#DEFAULT',
                payload: { displayName: 'base' }
            }]
        }
        const testKnowledge = new StandardKnowledge(testKnowledgeData)
        expect(testKnowledge.key).toEqual('test')
        expect(testKnowledge.toJSON()).toEqual(testKnowledgeData)
    })

    it('should construct StandardKnowledge from StandardKnowledgeData with shortName', () => {
        const testKnowledgeData: StandardKnowledgeData = {
            key: 'test',
            tag: 'Knowledge',
            shortName: 'Test Knowledge',
            situations: [{
                reference: 'SITUATION#DEFAULT',
                payload: { displayName: 'base' }
            }]
        }
        const testKnowledge = new StandardKnowledge(testKnowledgeData)
        expect(testKnowledge.key).toEqual('test')
        expect(testKnowledge.shortName?.toJSON()).toEqual('Test Knowledge')
        expect(testKnowledge.toJSON()).toEqual(testKnowledgeData)
    })

    it('should merge correctly', () => {
        expect(mergeTest(
            `<Knowledge key=(testKnowledge)>
                <Situation key=(sit1)><DisplayName>One</DisplayName></Situation>
            </Knowledge>`,
            StandardKnowledge,
            `<Knowledge key=(testKnowledge)>
                <Situation key=(sit2)><DisplayName>Two</DisplayName></Situation>
            </Knowledge>`
        )).toEqual(deIndentWML(`
            <Knowledge key=(testKnowledge)>
                <Situation key=(sit1)><DisplayName>One</DisplayName></Situation>
                <Situation key=(sit2)><DisplayName>Two</DisplayName></Situation>
            </Knowledge>
        `))
    })

    it('should merge shortName correctly', () => {
        expect(mergeTest(
            `<Knowledge key=(testKnowledge)>
                <ShortName>Original</ShortName>
            </Knowledge>`,
            StandardKnowledge,
            `<Knowledge key=(testKnowledge)>
                <Replace><ShortName>Original</ShortName></Replace>
                <With><ShortName>Updated</ShortName></With>
            </Knowledge>`
        )).toEqual(deIndentWML(`
            <Knowledge key=(testKnowledge)><ShortName>Updated</ShortName></Knowledge>
        `))
    })

    it('should throw on unconsumed child tags', () => {
        const testSource = deIndentWML(`
            <Knowledge key=(testKnowledge)>
                <Situation uuid=(DEFAULT) />
                <Map />
            </Knowledge>
        `)
        expect(() => new StandardKnowledge(testSource)).toThrow(/Unconsumed child tags:/)
        expect(() => new StandardKnowledge(testSource)).toThrow(/Map/)
    })

    it('should reject legacy Example child WML at parse time (Phase 4)', () => {
        const testSource = deIndentWML(`
            <Knowledge key=(testKnowledge)>
                <Example key=(Example1) />
            </Knowledge>
        `)
        expect(() => new StandardKnowledge(testSource)).toThrow()
    })

    it('should correctly add a Situation reference to knowledge', () => {
        const test = new StandardKnowledge(`
            <Knowledge key=(testKnowledge)>
                <Situation uuid=(DEFAULT) />
            </Knowledge>
        `)
        const situation = new StandardKey("SITUATION#other")
        const added = test.withChild(new StandardReference(situation))
        expect(schemaToWML([added.schema])).toEqual(deIndentWML(`
            <Knowledge key=(testKnowledge)>
                <Situation uuid=(DEFAULT) />
                <Situation uuid=(other) />
            </Knowledge>
        `))
    })

    it('should diff shortName correctly', () => {
        const testKnowledge = new StandardKnowledge(`
            <Knowledge key=(test)>
                <ShortName>Original</ShortName>
            </Knowledge>
        `)
        const testKnowledge2 = new StandardKnowledge(`
            <Knowledge key=(test)>
                <ShortName>Updated</ShortName>
            </Knowledge>
        `)
        const diff = testKnowledge.diff(testKnowledge2)
        expect(diff).toBeDefined()
        expect(schemaToWML([diff!.schema])).toEqual(deIndentWML(`
            <Knowledge key=(test)>
                <Replace><ShortName>Original</ShortName></Replace>
                <With><ShortName>Updated</ShortName></With>
            </Knowledge>
        `))
    })

    describe('assureReferences method', () => {
        it('should return unchanged knowledge when children array is empty', () => {
            const knowledge = new StandardKnowledge({ tag: 'Knowledge', key: 'test' })
            const { payload: result, inlineRemainder } = knowledge._payload.assureReferences([])
            
            expect(result.situations.length).toBe(0)
            expect(inlineRemainder).toEqual([])
            expect(knowledge._payload.situations.length).toBe(0)
        })
        
        it('should put all children in inlineRemainder with ref={0}', () => {
            const knowledge = new StandardKnowledge({ tag: 'Knowledge', key: 'test' })
            const situationRef = new StandardReference({ tag: 'Situation', key: 'ex1', universalKey: 'SITUATION#ex1' })
            
            const { payload: result, inlineRemainder } = knowledge._payload.assureReferences([situationRef])
            
            expect(result.situations.length).toBe(0)
            expect(inlineRemainder.length).toBe(1)
            expect(inlineRemainder[0].ref).toBe(0)
            expect(inlineRemainder[0].sameKey(situationRef)).toBe(true)
        })
        
        it('should return a clone without mutating the original', () => {
            const knowledge = new StandardKnowledge({ tag: 'Knowledge', key: 'test' })
            const situationRef = new StandardReference({ tag: 'Situation', key: 'ex1', universalKey: 'SITUATION#ex1' })
            
            const { payload: result } = knowledge._payload.assureReferences([situationRef])
            
            expect(knowledge._payload.situations.length).toBe(0)
            expect(result.situations.length).toBe(0)
            expect(result).not.toBe(knowledge._payload)
        })
        
        it('should put non-Situation children in inlineRemainder', () => {
            const knowledge = new StandardKnowledge({ tag: 'Knowledge', key: 'test' })
            const featureRef = new StandardReference({ tag: 'Feature', key: 'feat1' })
            const situationRef = new StandardReference({ tag: 'Situation', key: 'ex1', universalKey: 'SITUATION#ex1' })
            
            const { payload: result, inlineRemainder } = knowledge._payload.assureReferences([featureRef, situationRef])
            
            expect(result.situations.length).toBe(0)
            expect(inlineRemainder.length).toBe(2)
            expect(inlineRemainder.every((r) => r.ref === 0)).toBe(true)
        })
    })

    describe('removeReferences method', () => {
        it('should remove matching situation facets', () => {
            const knowledge = new StandardKnowledge(deIndentWML(`
                <Knowledge key=(test)>
                    <Situation key=(ex1) />
                    <Situation key=(ex2) />
                </Knowledge>
            `))
            const situationRef = new StandardReference({ tag: 'Situation', key: 'ex1', universalKey: 'SITUATION#ex1' })
            
            const result = knowledge._payload.removeReferences([situationRef])
            
            expect(result.situations.length).toBe(1)
            expect(result.situations.items[0].reference.sameKey(new StandardReference({ tag: 'Situation', key: 'ex2', universalKey: 'SITUATION#ex2' }))).toBe(true)
        })
        
        it('should return a clone without mutating the original', () => {
            const knowledge = new StandardKnowledge(deIndentWML(`
                <Knowledge key=(test)>
                    <Situation key=(ex1) />
                </Knowledge>
            `))
            const originalLength = knowledge._payload.situations.length
            const situationRef = new StandardReference({ tag: 'Situation', key: 'ex1', universalKey: 'SITUATION#ex1' })
            
            const result = knowledge._payload.removeReferences([situationRef])
            
            expect(knowledge._payload.situations.length).toBe(originalLength)
            expect(result.situations.length).toBe(0)
            expect(result).not.toBe(knowledge._payload)
        })
    })

    it('round-trips render from StandardKnowledgeData to schema', () => {
        const testKnowledgeData: StandardKnowledgeData = {
            key: 'test',
            tag: 'Knowledge',
            render: {
                displayName: 'Cached Name',
                summary: ['Summary text'],
                description: ['Description text'],
            },
        }
        const testKnowledge = new StandardKnowledge(testKnowledgeData)
        expect(testKnowledge.render).toEqual(testKnowledgeData.render)
        expect(schemaToWML([testKnowledge.schema])).toEqual(deIndentWML(`
            <Knowledge key=(test)>
                <Render>
                    <DisplayName>Cached Name</DisplayName>
                    <Summary>Summary text</Summary>
                    <Description>Description text</Description>
                </Render>
            </Knowledge>
        `))
    })

    it('parses Render on bare StandardKnowledge (asset policy is on StandardForm)', () => {
        const wml = deIndentWML(`
            <Knowledge key=(lore)>
                <Render>
                    <DisplayName>Ancient lore</DisplayName>
                    <Summary>Short summary</Summary>
                    <Description>Full knowledge text.</Description>
                </Render>
            </Knowledge>
        `)
        const testKnowledge = new StandardKnowledge(wml)
        expect(testKnowledge.render).toBeDefined()
    })

    it('rejects Render under Knowledge on asset StandardForm', () => {
        const wml = deIndentWML(`
            <Asset uuid=(Test)>
                <Knowledge key=(lore) uuid=(lore)>
                    <Render>
                        <DisplayName>Ancient lore</DisplayName>
                        <Summary>Short summary</Summary>
                        <Description>Full knowledge text.</Description>
                    </Render>
                </Knowledge>
            </Asset>
        `)
        expect(() => new StandardForm(wml)).toThrow(/Knowledge render is not allowed in asset mode/)
    })

})
