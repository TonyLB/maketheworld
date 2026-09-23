import { Schema, schemaToWML } from "../../schema"
import { deIndentWML } from "../../schema/utils"
import { defaultComponentFromTag } from "../baseClasses"
import { StandardForm } from ".."
import { StandardObjectData } from "./dataTypes/object"
import StandardObject from "./object"
import { standardComponentFactory } from "../componentFactory"
import StandardReference from "../keys/reference"
import { StandardKey } from "../keys/key"

jest.mock('@tonylb/mtw-utilities/ts/uuid/index', () => {
    return {
        ...jest.requireActual('@tonylb/mtw-utilities/ts/uuid/___mocks___/index')
    }
})

describe('StandardObject class', () => {
    it('constructs from JSON data', () => {
        const data: StandardObjectData = {
            tag: 'Object',
            universalKey: 'OBJECT#skates',
        }
        const object = new StandardObject(data)
        expect(object.universalKey).toBe('OBJECT#skates')
        expect(object.shortName).toBeUndefined()
    })

    it('constructs from JSON data with shortName', () => {
        const data: StandardObjectData = {
            tag: 'Object',
            universalKey: 'OBJECT#skates',
            shortName: 'roller skates',
        }
        const object = new StandardObject(data)
        expect(object.shortName?._payload?.plain?.toJSON()).toBe('roller skates')
    })

    it('constructs from schema node', () => {
        const schema = new Schema()
        const testSource = deIndentWML(`
            <Asset uuid=(Test)>
                <Object uuid=(skates)>
                    <ShortName>roller skates</ShortName>
                </Object>
            </Asset>
        `)
        schema.loadWML(testSource)
        const objectNode = schema.schema[0].children[0]
        const object = new StandardObject(objectNode)
        expect(object.shortName?._payload?.plain?.toJSON()).toBe('roller skates')
        const printed = schemaToWML([object.schema])
        expect(printed).toContain('Object uuid=(skates)')
        expect(printed).toContain('<ShortName>roller skates</ShortName>')
    })

    it('serializes to JSON with omission-over-empty', () => {
        const empty = new StandardObject({ tag: 'Object', universalKey: 'OBJECT#skates' })
        const emptyJSON = empty.toJSON()
        expect(emptyJSON.tag).toBe('Object')
        expect('shortName' in emptyJSON).toBe(false)
    })

    it('round-trips JSON to Component to JSON', () => {
        const original: StandardObjectData = {
            tag: 'Object',
            universalKey: 'OBJECT#skates',
            shortName: 'roller skates',
        }
        const object = new StandardObject(original)
        const json = object.toJSON()
        const object2 = new StandardObject({ ...json, universalKey: 'OBJECT#skates' } as StandardObjectData)
        expect(object2.toJSON()).toEqual(json)
    })

    it('merges shortName from incoming overlay', () => {
        const base = new StandardObject({
            tag: 'Object',
            universalKey: 'OBJECT#skates',
        })
        const incoming = new StandardObject({
            tag: 'Object',
            universalKey: 'OBJECT#skates',
            shortName: 'roller skates',
        })
        const merged = base.merge(incoming) as StandardObject
        expect(merged.shortName?._payload?.plain?.toJSON()).toBe('roller skates')
    })

    it('merges default stub with improvisation shortName', () => {
        const stubData = defaultComponentFromTag('Object', undefined, 'OBJECT#skates')
        const { component: stub } = standardComponentFactory(stubData)
        const improvisation = new StandardObject({
            tag: 'Object',
            universalKey: 'OBJECT#skates',
            shortName: 'roller skates',
        })
        const merged = (stub as StandardObject).merge(improvisation) as StandardObject
        expect(merged.shortName?._payload?.plain?.toJSON()).toBe('roller skates')
    })

    it('merges shortName via Replace/With WML', () => {
        const base = objectFromWML(`
            <Asset uuid=(Test)>
                <Object uuid=(skates)>
                    <ShortName>Original</ShortName>
                </Object>
            </Asset>
        `)
        const incoming = objectFromWML(`
            <Asset uuid=(Test)>
                <Object uuid=(skates) ref={0}>
                    <Replace><ShortName>Original</ShortName></Replace>
                    <With><ShortName>Updated</ShortName></With>
                </Object>
            </Asset>
        `)
        const merged = base.merge(incoming) as StandardObject
        expect(schemaToWML([merged.schema])).toEqual(deIndentWML(`
            <Object uuid=(skates)><ShortName>Updated</ShortName></Object>
        `))
    })

    const objectFromWML = (wml: string): StandardObject => {
        const schema = new Schema()
        schema.loadWML(deIndentWML(wml))
        return new StandardObject(schema.schema[0].children[0])
    }

    it('constructs from WML with a Situation facet', () => {
        const object = objectFromWML(`
            <Asset uuid=(Test)>
                <Object uuid=(skates)>
                    <ShortName>roller skates</ShortName>
                    <Situation uuid=(DEFAULT)><DisplayName>Skates</DisplayName></Situation>
                </Object>
            </Asset>
        `)
        expect(object.situations.items[0].reference.universalKey).toEqual('SITUATION#DEFAULT')
        expect(schemaToWML([object.schema])).toEqual(deIndentWML(`
            <Object uuid=(skates)>
                <ShortName>roller skates</ShortName>
                <Situation uuid=(DEFAULT)><DisplayName>Skates</DisplayName></Situation>
            </Object>
        `))
    })

    it('constructs from StandardObjectData with situations', () => {
        const data: StandardObjectData = {
            tag: 'Object',
            universalKey: 'OBJECT#skates',
            situations: [{
                reference: 'SITUATION#DEFAULT',
                payload: { displayName: 'Skates' },
            }],
        }
        const object = new StandardObject(data)
        expect(object.toJSON()).toEqual(data)
    })

    it('merges situation facets', () => {
        const base = new StandardObject({
            tag: 'Object',
            universalKey: 'OBJECT#skates',
            situations: [{
                reference: 'SITUATION#sit1',
                payload: { displayName: 'One' },
            }],
        })
        const incoming = new StandardObject({
            tag: 'Object',
            universalKey: 'OBJECT#skates',
            situations: [{
                reference: 'SITUATION#sit2',
                payload: { displayName: 'Two' },
            }],
        })
        const merged = base.merge(incoming) as StandardObject
        expect(merged.situations.items.map((facet) => facet.reference.universalKey)).toEqual([
            'SITUATION#sit1',
            'SITUATION#sit2',
        ])
    })

    it('adds a Situation reference via withChild', () => {
        const object = objectFromWML(`
            <Asset uuid=(Test)>
                <Object uuid=(skates)>
                    <ShortName>roller skates</ShortName>
                    <Situation uuid=(DEFAULT) />
                </Object>
            </Asset>
        `)
        const situation = new StandardKey("SITUATION#other")
        const added = object.withChild(new StandardReference(situation))
        expect(schemaToWML([added.schema])).toEqual(deIndentWML(`
            <Object uuid=(skates)>
                <ShortName>roller skates</ShortName>
                <Situation uuid=(DEFAULT) />
                <Situation uuid=(other) />
            </Object>
        `))
    })

    it('round-trips render from StandardObjectData to schema', () => {
        const data: StandardObjectData = {
            tag: 'Object',
            universalKey: 'OBJECT#skates',
            shortName: 'roller skates',
            render: {
                displayName: 'Cached Name',
                summary: ['Summary text'],
                description: ['Description text'],
            },
        }
        const object = new StandardObject(data)
        expect(object.render).toEqual(data.render)
        const printed = schemaToWML([object.schema])
        expect(printed).toEqual(deIndentWML(`
            <Object uuid=(skates)>
                <ShortName>roller skates</ShortName>
                <Render>
                    <DisplayName>Cached Name</DisplayName>
                    <Summary>Summary text</Summary>
                    <Description>Description text</Description>
                </Render>
            </Object>
        `))
        const wrapped = `<Asset uuid=(Test)>\n${printed}\n</Asset>`
        expect(() => new StandardForm(wrapped, { standardizeMode: 'ephemeraWire' })).not.toThrow()
        const reparsed = new StandardForm(wrapped, { standardizeMode: 'ephemeraWire' })
        expect((reparsed._lookup('OBJECT#skates') as StandardObject).render).toEqual(data.render)
    })

    it('is empty only when shortName, situations, and render are all absent', () => {
        const empty = new StandardObject({ tag: 'Object', universalKey: 'OBJECT#skates' })
        expect(empty._payload.isEmpty()).toBe(true)
        const withSituation = new StandardObject({
            tag: 'Object',
            universalKey: 'OBJECT#skates',
            situations: [{ reference: 'SITUATION#DEFAULT', payload: { displayName: 'Skates' } }],
        })
        expect(withSituation._payload.isEmpty()).toBe(false)
    })

    it('rejects illegal child tags at parse time', () => {
        const testSource = deIndentWML(`
            <Asset uuid=(Test)>
                <Object uuid=(skates)>
                    <ShortName>roller skates</ShortName>
                    <Map key=(illegalMap) />
                </Object>
            </Asset>
        `)
        expect(() => new Schema().loadWML(testSource)).toThrow()
    })

    describe('ludicGraph (Slice 3)', () => {
        it('round-trips a graph node through JSON', () => {
            const data: StandardObjectData = {
                tag: 'Object',
                universalKey: 'OBJECT#toolbox',
                shortName: 'toolbox',
                ludicGraph: {
                    nodes: [{ tag: 'Object', key: 'wrench' }],
                },
            }
            const object = new StandardObject(data)
            expect(object.ludicGraph.nodes.toJSON()).toEqual(data.ludicGraph!.nodes)
            expect(object.toJSON()).toEqual(data)
        })

        it('allows an Object to nest another Object (was previously a hard parse error)', () => {
            const object = objectFromWML(`
                <Asset uuid=(Test)>
                    <Object uuid=(toolbox)>
                        <ShortName>toolbox</ShortName>
                        <Object uuid=(wrench)>
                            <ShortName>wrench</ShortName>
                        </Object>
                    </Object>
                </Asset>
            `)
            expect(object.ludicGraph.nodes.componentRefs.payload.map((ref) => ref.universalKey)).toEqual(['OBJECT#wrench'])
            // schema() renders the graph's membership as a bare reference (matching StandardArea's
            // own schema() behavior) -- the nested Object's own definition is a sibling component,
            // not inlined here.
            expect(schemaToWML([object.schema])).toEqual(deIndentWML(`
                <Object uuid=(toolbox)>
                    <ShortName>toolbox</ShortName>
                    <Object uuid=(wrench) />
                </Object>
            `))
        })

        it('merges a graph-node addition and reflects it via equals/diff', () => {
            const base = new StandardObject({ tag: 'Object', universalKey: 'OBJECT#toolbox' })
            const incoming = new StandardObject({
                tag: 'Object',
                universalKey: 'OBJECT#toolbox',
                ludicGraph: { nodes: [{ tag: 'Object', key: 'wrench' }] },
            })
            const merged = base.merge(incoming) as StandardObject
            expect(merged.ludicGraph.nodes.componentRefs.payload.map((ref) => ref.key)).toEqual(['wrench'])
            expect(base.equals(merged)).toBe(false)
            expect(merged.equals(base)).toBe(false)
            expect(merged.equals(merged)).toBe(true)
            expect(base.diff(merged)).not.toBeUndefined()
        })

        it('is non-empty when only a graph node is present', () => {
            const withGraphNode = new StandardObject({
                tag: 'Object',
                universalKey: 'OBJECT#toolbox',
                ludicGraph: { nodes: [{ tag: 'Object', key: 'wrench' }] },
            })
            expect(withGraphNode._payload.isEmpty()).toBe(false)
        })

        it('buckets a graph-node child via assureReferences and drops it via removeReferences', () => {
            const object = new StandardObject({
                tag: 'Object',
                universalKey: 'OBJECT#toolbox',
                ludicGraph: { nodes: [{ tag: 'Object', key: 'wrench' }] },
            })
            const wrenchRef = object._payload.ludicGraph.nodes.componentRefs.payload[0]
            const { payload: assured, inlineRemainder } = object._payload.assureReferences([wrenchRef])
            expect(inlineRemainder).toEqual([])
            expect(assured.ludicGraph.nodes.componentRefs.payload.map((ref) => ref.key)).toEqual(['wrench'])

            const removed = object._payload.removeReferences([wrenchRef])
            expect(removed.ludicGraph.nodes.componentRefs.payload).toEqual([])
        })
    })
})
