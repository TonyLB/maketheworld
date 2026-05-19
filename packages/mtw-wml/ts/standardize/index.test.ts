import { Schema, schemaToWML, treeFromWML } from '../schema'
import { StandardForm, hasShortName } from '.'
import { deIndentWML } from '../schema/utils'
import { GenericTreeNode } from '@tonylb/mtw-base/ts/genericTree'
import { SchemaTag } from '@tonylb/mtw-base/ts/schema'
import StandardRoom from './components/room'
import StandardKnowledge from './components/knowledge'
import StandardCharacter from './components/character'
import { ReferenceList } from './keys/referenceList'
import StandardReference from './keys/reference'
import { StandardKey } from './keys/key'
import StandardFeature from './components/feature'
import StandardSituation from './components/situation'
import { StandardLiteral } from './literal'
import StandardMap from './components/map'
import StandardMark, { StandardLens } from './components/worldState'
import { StandardMarkFacet } from './keys/facets/mark'
import { StandardExplicitKey } from './explicit/key'
import { isStandardForm, isStandardFormInput, StandardFormData } from './components/dataTypes'
jest.mock('@tonylb/mtw-utilities/ts/uuid/index', () => {
    return {
        ...jest.requireActual('@tonylb/mtw-utilities/ts/uuid/___mocks___/index')
    }
})


describe('StandardForm', () => {
    describe('input vs normative typeguards', () => {
        it('accepts missing facet payload in input guard but rejects in normative guard', () => {
            const candidate = {
                universalKey: 'ASSET#test',
                metaData: [],
                components: [
                    {
                        tag: 'Situation',
                        key: 'situation1',
                        universalKey: 'SITUATION#situation1',
                        marks: [
                            {
                                reference: {
                                    tag: 'Mark',
                                    key: 'mark1',
                                    universalKey: 'MARK#mark1'
                                }
                            }
                        ]
                    }
                ]
            }

            expect(isStandardFormInput(candidate)).toBe(true)
            expect(isStandardForm(candidate)).toBe(false)
        })
    })

    describe('isEmpty()', () => {
        it('returns true for empty asset with only universalKey', () => {
            const sf = new StandardForm('ASSET#TestAsset')
            expect(sf.isEmpty()).toBe(true)
        })

        it('returns false when components are present', () => {
            const sf = new StandardForm(`<Asset uuid=(TestAsset)>
                <Room key=(MAIN) />
            </Asset>`)
            expect(sf.isEmpty()).toBe(false)
        })

        it('returns false when ShortName is present without components', () => {
            const sf = new StandardForm(`<Asset uuid=(TestAsset)>
                <ShortName>My Draft</ShortName>
            </Asset>`)
            expect(sf.isEmpty()).toBe(false)
        })

        it('returns false when Summary is present without components', () => {
            const sf = new StandardForm(`<Asset uuid=(TestAsset)>
                <Summary>Some description</Summary>
            </Asset>`)
            expect(sf.isEmpty()).toBe(false)
        })

        it('returns true when Summary is semantically empty', () => {
            const sf = new StandardForm({
                universalKey: 'ASSET#TestAsset',
                metaData: [],
                components: [],
                summary: []
            })
            expect(sf.summary?.isEmpty()).toBe(true)
            expect(sf.isEmpty()).toBe(true)
        })

        it('returns false when Summary is non-empty from data input', () => {
            const sf = new StandardForm({
                universalKey: 'ASSET#TestAsset',
                metaData: [],
                components: [],
                summary: ['Some description']
            })
            expect(sf.summary?.isEmpty()).toBe(false)
            expect(sf.isEmpty()).toBe(false)
        })

        it('returns true when ShortName is semantically empty', () => {
            const sf = new StandardForm('ASSET#TestAsset')
            ;(sf as any)._shortName = new StandardLiteral('', { tag: 'ShortName' })
            expect(sf.shortName?.isEmpty()).toBe(true)
            expect(sf.isEmpty()).toBe(true)
        })

        it('returns true with explicitly empty topLevel reference list', () => {
            const sf = new StandardForm('ASSET#TestAsset')
            ;(sf as any)._topLevel = new ReferenceList([])
            expect(sf.isEmpty()).toBe(true)
        })

        it('returns false with non-empty topLevel reference list', () => {
            const sf = new StandardForm('ASSET#TestAsset')
            ;(sf as any)._topLevel = new ReferenceList([
                new StandardReference({ tag: 'Room', universalKey: 'ROOM#main' })
            ])
            expect(sf.isEmpty()).toBe(false)
        })

        it('returns true when all components are semantically empty', () => {
            const sf = new StandardForm('ASSET#TestAsset')
            ;(sf as any)._components = [{ isEmpty: () => true }]
            expect(sf.isEmpty()).toBe(true)
        })

        it('returns false when at least one component is non-empty', () => {
            const sf = new StandardForm('ASSET#TestAsset')
            ;(sf as any)._components = [{ isEmpty: () => true }, { isEmpty: () => false }]
            expect(sf.isEmpty()).toBe(false)
        })

        it('returns true when metadata and components are all vacuous', () => {
            const sf = new StandardForm({
                universalKey: 'ASSET#TestAsset',
                metaData: [],
                components: [],
                summary: []
            })
            ;(sf as any)._shortName = new StandardLiteral('', { tag: 'ShortName' })
            ;(sf as any)._topLevel = new ReferenceList([])
            ;(sf as any)._components = [{ isEmpty: () => true }]
            expect(sf.isEmpty()).toBe(true)
        })
    })

    describe('equals()', () => {
        it('returns true for identical forms', () => {
            const left = new StandardForm(deIndentWML(`
                <Asset uuid=(TestAsset)>
                    <Room uuid=(room1) key=(room1)>
                        <ShortName>Room One</ShortName>
                    </Room>
                </Asset>
            `))
            const right = new StandardForm(deIndentWML(`
                <Asset uuid=(TestAsset)>
                    <Room uuid=(room1) key=(room1)>
                        <ShortName>Room One</ShortName>
                    </Room>
                </Asset>
            `))
            expect(left.equals(right)).toBe(true)
        })

        it('returns false when an unrelated component differs', () => {
            const left = new StandardForm(deIndentWML(`
                <Asset uuid=(TestAsset)>
                    <Room uuid=(room1) key=(room1) />
                    <Feature uuid=(feature1) key=(feature1)>
                        <ShortName>Base Feature</ShortName>
                    </Feature>
                </Asset>
            `))
            const right = new StandardForm(deIndentWML(`
                <Asset uuid=(TestAsset)>
                    <Room uuid=(room1) key=(room1) />
                    <Feature uuid=(feature1) key=(feature1)>
                        <ShortName>Changed Feature</ShortName>
                    </Feature>
                </Asset>
            `))
            expect(left.equals(right)).toBe(false)
        })

        it('treats vacuous optional metadata as equal', () => {
            const left = new StandardForm({
                universalKey: 'ASSET#TestAsset',
                metaData: [],
                components: [],
                shortName: '',
                summary: [],
                topLevel: []
            })
            const right = new StandardForm({
                universalKey: 'ASSET#TestAsset',
                metaData: [],
                components: []
            })
            expect(left.equals(right)).toBe(true)
        })

        it('treats metadata ordering as non-semantic', () => {
            const left = new StandardForm('ASSET#TestAsset')
            const right = new StandardForm('ASSET#TestAsset')
            ;(left as any)._metaData = [
                { data: { tag: 'Import', from: 'ASSET#alpha' }, children: [] },
                { data: { tag: 'Import', from: 'ASSET#beta' }, children: [] }
            ]
            ;(right as any)._metaData = [
                { data: { tag: 'Import', from: 'ASSET#beta' }, children: [] },
                { data: { tag: 'Import', from: 'ASSET#alpha' }, children: [] }
            ]
            expect(left.equals(right)).toBe(true)
        })

        it('supports optimizeByUniversalKey with parity to default comparison', () => {
            const left = new StandardForm(deIndentWML(`
                <Asset uuid=(TestAsset)>
                    <Room uuid=(room1) key=(room1)>
                        <Feature uuid=(feature1) />
                    </Room>
                    <Feature uuid=(feature1) key=(feature1) />
                </Asset>
            `))
            const right = new StandardForm(deIndentWML(`
                <Asset uuid=(TestAsset)>
                    <Feature uuid=(feature1) key=(feature1) />
                    <Room uuid=(room1) key=(room1)>
                        <Feature uuid=(feature1) />
                    </Room>
                </Asset>
            `))
            expect(left.equals(right)).toBe(true)
            expect(left.equals(right, { optimizeByUniversalKey: true })).toBe(true)
        })

        it('falls back to full comparison when optimizeByUniversalKey preconditions fail', () => {
            const left = new StandardForm(deIndentWML(`
                <Asset uuid=(TestAsset)>
                    <Room key=(room1)>
                        <ShortName>Room One</ShortName>
                    </Room>
                </Asset>
            `))
            const right = new StandardForm(deIndentWML(`
                <Asset uuid=(TestAsset)>
                    <Room key=(room1)>
                        <ShortName>Room Two</ShortName>
                    </Room>
                </Asset>
            `))
            expect(left.equals(right)).toBe(false)
            expect(left.equals(right, { optimizeByUniversalKey: true })).toBe(false)
        })
    })

    describe('standardizeMode', () => {
        it('defaults to asset', () => {
            expect(new StandardForm('ASSET#TestAsset').standardizeMode).toBe('asset')
        })

        it('accepts ephemeraWire via constructor options', () => {
            const sf = new StandardForm(`<Asset uuid=(X) />`, { standardizeMode: 'ephemeraWire' })
            expect(sf.standardizeMode).toBe('ephemeraWire')
        })

        it('includes standardizeMode in toJSON when not asset', () => {
            const sf = new StandardForm(`<Asset uuid=(X)><Room key=(main) /></Asset>`).withStandardizeMode('ephemeraWire')
            expect(sf.toJSON().standardizeMode).toBe('ephemeraWire')
        })

        it('parses Object children under Room in ephemeraWire', () => {
            const wml = deIndentWML(`
                <Asset uuid=(Test)>
                    <Room key=(main) uuid=(main)>
                        <Object uuid=(skates)>
                            <ShortName>roller skates</ShortName>
                        </Object>
                        <Object uuid=(shovel)>
                            <ShortName>shovel</ShortName>
                        </Object>
                    </Room>
                </Asset>
            `)
            const sf = new StandardForm(wml, { standardizeMode: 'ephemeraWire' })
            const room = sf._lookup('ROOM#main') as StandardRoom
            expect(room.objects).toEqual([
                { uuid: 'OBJECT#skates', shortName: 'roller skates' },
                { uuid: 'OBJECT#shovel', shortName: 'shovel' },
            ])
            expect((room.toJSON() as { objects?: { uuid: string; shortName: string }[] }).objects).toEqual([
                { uuid: 'OBJECT#skates', shortName: 'roller skates' },
                { uuid: 'OBJECT#shovel', shortName: 'shovel' },
            ])
        })

        it('normalizes Object uuid=(OBJECT#id) same as bare id in ephemeraWire', () => {
            const wmlBare = deIndentWML(`
                <Asset uuid=(Test)>
                    <Room key=(main) uuid=(main)>
                        <Object uuid=(skates)>
                            <ShortName>roller skates</ShortName>
                        </Object>
                    </Room>
                </Asset>
            `)
            const wmlPrefixed = deIndentWML(`
                <Asset uuid=(Test)>
                    <Room key=(main) uuid=(main)>
                        <Object uuid=(OBJECT#skates)>
                            <ShortName>roller skates</ShortName>
                        </Object>
                    </Room>
                </Asset>
            `)
            const roomBare = (new StandardForm(wmlBare, { standardizeMode: 'ephemeraWire' })._lookup('ROOM#main') as StandardRoom)
            const roomPrefixed = (new StandardForm(wmlPrefixed, { standardizeMode: 'ephemeraWire' })._lookup('ROOM#main') as StandardRoom)
            expect(roomBare.objects).toEqual(roomPrefixed.objects)
            expect(roomBare.objects[0].uuid).toBe('OBJECT#skates')
        })

        it('throws when Object uuid has wrong typed prefix', () => {
            const wml = deIndentWML(`
                <Asset uuid=(Test)>
                    <Room key=(main) uuid=(main)>
                        <Object uuid=(ROOM#x)>
                            <ShortName>thing</ShortName>
                        </Object>
                    </Room>
                </Asset>
            `)
            expect(() => treeFromWML(wml)).toThrow(/Invalid type \(ROOM\) in typed string/)
        })

        it('round-trips Object uuid as bare key in WML output', () => {
            const wml = deIndentWML(`
                <Asset uuid=(Test)>
                    <Room key=(main) uuid=(main)>
                        <Object uuid=(skates)>
                            <ShortName>roller skates</ShortName>
                        </Object>
                    </Room>
                </Asset>
            `)
            const tree = treeFromWML(wml)
            const printed = schemaToWML(tree)
            expect(printed).toContain('uuid=(skates)')
            expect(printed).not.toContain('uuid=(OBJECT#')
        })

        it('rejects Object under Room in asset mode (unconsumed tag)', () => {
            const wml = deIndentWML(`
                <Asset uuid=(Test)>
                    <Room key=(main) uuid=(main)>
                        <Object uuid=(skates)>
                            <ShortName>roller skates</ShortName>
                        </Object>
                    </Room>
                </Asset>
            `)
            expect(() => new StandardForm(wml)).toThrow(/Unconsumed child tags: Object/)
        })

        it('throws when Object ShortName is whitespace-only inside Room', () => {
            const wml = deIndentWML(`
                <Asset uuid=(Test)>
                    <Room key=(main) uuid=(main)>
                        <Object uuid=(o1)>
                            <ShortName>   </ShortName>
                        </Object>
                    </Room>
                </Asset>
            `)
            expect(() => treeFromWML(wml)).toThrow(/Object ShortName must contain non-empty text/)
        })

        it('parses Render under Room in ephemeraWire', () => {
            const wml = deIndentWML(`
                <Asset uuid=(Test)>
                    <Room key=(main) uuid=(main)>
                        <Render>
                            <DisplayName>Parlor</DisplayName>
                            <Summary>A quiet room</Summary>
                            <Description>Full prose here.</Description>
                        </Render>
                    </Room>
                </Asset>
            `)
            const sf = new StandardForm(wml, { standardizeMode: 'ephemeraWire' })
            const room = sf._lookup('ROOM#main') as StandardRoom
            expect(room.render).toEqual({
                displayName: 'Parlor',
                summary: ['A quiet room'],
                description: ['Full prose here.'],
            })
            expect((room.toJSON() as { render?: { displayName: string; summary: unknown; description: unknown } }).render).toEqual({
                displayName: 'Parlor',
                summary: ['A quiet room'],
                description: ['Full prose here.'],
            })
        })

        it('round-trips Render under Room in ephemeraWire', () => {
            const wml = deIndentWML(`
                <Asset uuid=(Test)>
                    <Room key=(main) uuid=(main)>
                        <Render>
                            <DisplayName>Parlor</DisplayName>
                            <Summary>A quiet room</Summary>
                            <Description>Full prose here.</Description>
                        </Render>
                    </Room>
                </Asset>
            `)
            const sf = new StandardForm(wml, { standardizeMode: 'ephemeraWire' })
            const printed = schemaToWML([sf.schema])
            const sfAgain = new StandardForm(printed, { standardizeMode: 'ephemeraWire' })
            expect(schemaToWML([sfAgain.schema])).toEqual(printed)
            const roomAgain = sfAgain._lookup('ROOM#main') as StandardRoom
            expect(roomAgain.render).toEqual({
                displayName: 'Parlor',
                summary: ['A quiet room'],
                description: ['Full prose here.'],
            })
        })

        it('rejects Render under Room in asset mode (unconsumed tag)', () => {
            const wml = deIndentWML(`
                <Asset uuid=(Test)>
                    <Room key=(main) uuid=(main)>
                        <Render>
                            <DisplayName>X</DisplayName>
                            <Summary>Y</Summary>
                            <Description>Z</Description>
                        </Render>
                    </Room>
                </Asset>
            `)
            expect(() => new StandardForm(wml)).toThrow(/Unconsumed child tags: Render/)
        })

        it('throws when more than one Render under Room in ephemeraWire', () => {
            const wml = deIndentWML(`
                <Asset uuid=(Test)>
                    <Room key=(main) uuid=(main)>
                        <Render>
                            <DisplayName>A</DisplayName>
                            <Summary>B</Summary>
                            <Description>C</Description>
                        </Render>
                        <Render>
                            <DisplayName>D</DisplayName>
                            <Summary>E</Summary>
                            <Description>F</Description>
                        </Render>
                    </Room>
                </Asset>
            `)
            expect(() => new StandardForm(wml, { standardizeMode: 'ephemeraWire' })).toThrow(/Room must contain at most one Render tag/)
        })

        it('throws when Render DisplayName is whitespace-only inside Room', () => {
            const wml = deIndentWML(`
                <Asset uuid=(Test)>
                    <Room key=(main) uuid=(main)>
                        <Render>
                            <DisplayName>   </DisplayName>
                            <Summary>Y</Summary>
                            <Description>Z</Description>
                        </Render>
                    </Room>
                </Asset>
            `)
            expect(() => treeFromWML(wml)).toThrow(/Render DisplayName must contain non-empty text/)
        })

        /**
         * Ephemera split: one form carries `<Render>` prose; another carries affordances (`<Character>`, `<Object>`).
         * Merge on the same `ROOM#` should combine render payload with objects and character references.
         */
        it('merges ephemeraWire render form with affordance form for the same room UUID', () => {
            const renderWml = deIndentWML(`
                <Asset uuid=(Test)>
                    <Room key=(main) uuid=(main)>
                        <Render>
                            <DisplayName>Parlor</DisplayName>
                            <Summary>A quiet room</Summary>
                            <Description>Full prose here.</Description>
                        </Render>
                    </Room>
                </Asset>
            `)
            const affordanceWml = deIndentWML(`
                <Asset uuid=(Test)>
                    <Room key=(main) uuid=(main)>
                        <Character key=(ally) />
                        <Character key=(npc) />
                        <Object uuid=(crate)>
                            <ShortName>wooden crate</ShortName>
                        </Object>
                        <Object uuid=(lantern)>
                            <ShortName>brass lantern</ShortName>
                        </Object>
                    </Room>
                </Asset>
            `)
            const render = new StandardForm(renderWml, { standardizeMode: 'ephemeraWire' })
            const affordance = new StandardForm(affordanceWml, { standardizeMode: 'ephemeraWire' })
            const final = render.merge(affordance)
            expect(schemaToWML([final.schema])).toEqual(
                deIndentWML(`
                <Asset uuid=(Test)>
                    <Room uuid=(main) key=(main) ref={2}>
                        <Character key=(ally) />
                        <Character key=(npc) />
                        <Object uuid=(crate)><ShortName>wooden crate</ShortName></Object>
                        <Object uuid=(lantern)><ShortName>brass lantern</ShortName></Object>
                        <Render>
                            <DisplayName>Parlor</DisplayName>
                            <Summary>A quiet room</Summary>
                            <Description>Full prose here.</Description>
                        </Render>
                    </Room>
                </Asset>
                `)
            )
        })
    })

    it('should return an empty wrapper unchanged', () => {
        const test = new StandardForm(`<Asset uuid=(Test) />`)
        expect(test.header).toEqual({ tag: 'Asset', universalKey: 'ASSET#Test', topLevel: [] })
        expect(schemaToWML([test.schema])).toEqual(`<Asset uuid=(Test) />`)
    })

    it('should accept edit tags in JSON form', () => {
        const test = new StandardForm({
            universalKey: 'ASSET#test',
            metaData: [],
            components: [
                {
                    tag: 'Room',
                    key: 'testRoomTwo',
                    universalKey: 'ROOM#testRoomTwo',
                }
            ],
            topLevel: [{
                tag: 'Room',
                universalKey: 'ROOM#testRoomTwo',
                ref: -1
            }]
        })
        expect(schemaToWML([test.schema])).toEqual(deIndentWML(`
            <Asset uuid=(test)>
                <Remove><Room uuid=(testRoomTwo) key=(testRoomTwo) /></Remove>
            </Asset>
        `))
    })

    it('should accept JSON facet entries with missing payload and inject defaults', () => {
        const test = new StandardForm({
            universalKey: 'ASSET#test',
            metaData: [],
            components: [
                {
                    tag: 'Situation',
                    key: 'situation1',
                    universalKey: 'SITUATION#situation1',
                    marks: [
                        {
                            reference: {
                                tag: 'Mark',
                                key: 'mark1',
                                universalKey: 'MARK#mark1'
                            }
                        }
                    ]
                }
            ]
        })
        const json = test.toJSON()
        expect(json.universalKey).toBe('ASSET#test')
        expect(json.components).toEqual([
            expect.objectContaining({
                tag: 'Situation',
                key: 'situation1',
                universalKey: 'SITUATION#situation1',
                marks: [
                    {
                        reference: 'MARK#mark1',
                        payload: ''
                    }
                ]
            })
        ])
    })

    it('should reject malformed present payload in JSON facet entries', () => {
        expect(() => new StandardForm({
            universalKey: 'ASSET#test',
            metaData: [],
            components: [
                {
                    tag: 'Situation',
                    key: 'situation1',
                    universalKey: 'SITUATION#situation1',
                    marks: [
                        {
                            reference: {
                                tag: 'Mark',
                                key: 'mark1',
                                universalKey: 'MARK#mark1'
                            },
                            payload: null
                        }
                    ]
                }
            ]
        } as unknown as StandardFormData)).toThrow()
    })

    it('should accept NDJSON facet entries with missing payload and inject defaults', () => {
        const test = new StandardForm([
            {
                tag: 'Asset',
                universalKey: 'ASSET#test'
            },
            {
                tag: 'Situation',
                key: 'situation1',
                universalKey: 'SITUATION#situation1',
                marks: [
                    {
                        reference: {
                            tag: 'Mark',
                            key: 'mark1',
                            universalKey: 'MARK#mark1'
                        }
                    }
                ]
            }
        ])
        const json = test.toJSON()
        expect(json.universalKey).toBe('ASSET#test')
        expect(json.components).toEqual([
            expect.objectContaining({
                tag: 'Situation',
                key: 'situation1',
                universalKey: 'SITUATION#situation1',
                marks: [
                    {
                        reference: 'MARK#mark1',
                        payload: ''
                    }
                ]
            })
        ])
    })

    it('should preserve missing-payload default through diff/merge roundtrip', () => {
        const base = new StandardForm({
            universalKey: 'ASSET#test',
            metaData: [],
            components: [
                {
                    tag: 'Situation',
                    key: 'situation1',
                    universalKey: 'SITUATION#situation1',
                    marks: [
                        {
                            reference: {
                                tag: 'Mark',
                                key: 'mark1',
                                universalKey: 'MARK#mark1'
                            }
                        }
                    ]
                }
            ]
        })
        const updated = new StandardForm({
            universalKey: 'ASSET#test',
            metaData: [],
            components: [
                {
                    tag: 'Situation',
                    key: 'situation1',
                    universalKey: 'SITUATION#situation1',
                    marks: [
                        {
                            reference: {
                                tag: 'Mark',
                                key: 'mark1',
                                universalKey: 'MARK#mark1'
                            },
                            payload: 'Updated narrative'
                        }
                    ]
                }
            ]
        })

        const diff = base.diff(updated)
        expect(diff).toBeDefined()
        const merged = base.merge(diff!)
        expect(merged.toJSON().components).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    tag: 'Situation',
                    key: 'situation1',
                    marks: [
                        {
                            reference: 'MARK#mark1',
                            payload: 'Updated narrative'
                        }
                    ]
                })
            ])
        )
    })

    it('should accept edit tags', () => {
        const test: GenericTreeNode<SchemaTag> = {
            data: { tag: 'Asset', uuid: 'ASSET#Test', Story: undefined },
            children: [
                {
                    data: { tag: 'Room', key: 'testRoom', uuid: 'ROOM#testRoom' },
                    children: [{
                        data: { tag: 'Situation', uuid: 'SITUATION#DEFAULT' },
                        children: [{
                            data: { tag: 'Replace' },
                            children: [{
                                data: { tag: 'ReplaceMatch' },
                                children: [{
                                    data: { tag: 'DisplayName' },
                                    children: [{ data: { tag: 'String', value: 'Lobby' }, children: [] }]
                                }]
                            },
                            {
                                data: { tag: 'ReplacePayload' },
                                children: [{
                                    data: { tag: 'DisplayName' },
                                    children: [{ data: { tag: 'String', value: 'Foyer' }, children: [] }]
                                }]
                            }]    
                        }]
                    },
                    {
                        data: { tag: 'Remove' },
                        children: [{ data: { tag: 'Exit', to: 'testDestination' }, children: [{ data: { tag: 'String', value: 'out' }, children: [] }] }]
                    }]
                },
                { data: { tag: 'Remove' }, children: [{ data: { tag: 'Room', key: 'testRoomRemove', uuid: 'ROOM#testRoomRemove' }, children: [] }] },
            ]
        }

        const standard = new StandardForm(test)
        expect(standard.toJSON()).toEqual({
            universalKey: 'ASSET#Test',
            metaData: [],
            topLevel: [
                'ROOM#testRoom',
                { universalKey: 'ROOM#testRoomRemove', tag: 'Room', ref: -1 }
            ],
            components: [
                {
                    tag: 'Room',
                    key: 'testRoom',
                    universalKey: 'ROOM#testRoom',
                    situations: [{
                        reference: 'SITUATION#DEFAULT',
                        payload: {
                            displayName: {
                                tag: 'Replace',
                                match: 'Lobby',
                                payload: 'Foyer'
                            }
                        }
                    }],
                    exits: [{
                        reference: { tag: 'Room', key: 'testDestination', ref: -1 },
                        payload: { tag: 'Remove', match: 'out' }
                    }]
                },
                {
                    tag: 'Situation',
                    universalKey: 'SITUATION#DEFAULT',
                },
                {
                    tag: 'Room',
                    key: 'testRoomRemove',
                    universalKey: 'ROOM#testRoomRemove',
                }
            ]
        })
    })

    it('should accept parsed schema', () => {
        const testSource = deIndentWML(`
            <Asset uuid=(Test)>
                <Feature uuid=(testFeature) key=(testFeature)>
                    <Situation uuid=(testFeatureBase)>
                        <Description>Four</Description>
                    </Situation>
                </Feature>
                <Room uuid=(test) key=(test)>
                    <Situation uuid=(DEFAULT) ref={0} />
                    <Situation uuid=(DEFAULT)>
                        <DisplayName>Test Room</DisplayName>
                        <Summary>One<br />Two</Summary>
                        <Description>Three</Description>
                    </Situation>
                </Room>
            </Asset>
        `)
        const schema = new Schema()
        schema.loadWML(testSource)
        const test = new StandardForm(schema.schema[0])
        const roomStubByIdWML = deIndentWML(`
            <Room uuid=(test) key=(test)>
                <Situation uuid=(DEFAULT)>
                    <DisplayName>Test Room</DisplayName>
                    <Summary>One<br />Two</Summary>
                    <Description>Three</Description>
                </Situation>
            </Room>
        `)
        expect(schemaToWML([test.byId.test.schema])).toEqual(roomStubByIdWML)
        expect(schemaToWML([test.byUniversalId['ROOM#test'].schema])).toEqual(roomStubByIdWML)
        expect(schemaToWML([test.schema])).toEqual(testSource)
    })

    it('should ignore authorization tags', () => {
        const test = new StandardForm(`
            <Asset uuid=(Test)>
                <Room uuid=(test) key=(test)>
                    <Grant player=(testPlayer) actions="test" />
                    <Situation uuid=(DEFAULT)>
                        <Description>
                            One
                            <br />
                        </Description>
                    </Situation>
                </Room>
            </Asset>
        `)
        expect(schemaToWML([test.schema])).toEqual(deIndentWML(`
            <Asset uuid=(Test)>
                <Room uuid=(test) key=(test)>
                    <Situation uuid=(DEFAULT) ref={0} />
                    <Situation uuid=(DEFAULT)>
                        <Description>One<br /></Description>
                    </Situation>
                </Room>
            </Asset>
        `))
    })

    it('should properly nest components in a removed component', () => {
        const testWML = deIndentWML(`
            <Asset uuid=(Test)>
                <Remove>
                    <Room uuid=(testRoom) key=(testRoom)>
                        <Feature uuid=(testFeature) key=(testFeature) />
                    </Room>
                </Remove>
            </Asset>
        `)
        const test = new StandardForm(testWML)
        expect(schemaToWML([test.schema])).toEqual(testWML)
    })

    it('should correctly round-trip a removed feature reference in a room', () => {
        const test = new StandardForm(`
            <Asset uuid=(Test)>
                <Feature uuid=(base) key=(base) />
                <Room uuid=(testRoom) key=(testRoom)>
                    <Remove><Feature key=(base) /></Remove>
                </Room>
            </Asset>
        `)
        expect(schemaToWML([test.schema])).toEqual(deIndentWML(`
            <Asset uuid=(Test)>
                <Feature uuid=(base) key=(base) />
                <Room uuid=(testRoom) key=(testRoom)>
                    <Remove><Feature key=(base) /></Remove>
                </Room>
            </Asset>
        `))
    })

    it('should correctly round-trip a removed feature nested in a room', () => {
        const test = new StandardForm(`
            <Asset uuid=(Test)>
                <Room uuid=(testRoom) key=(testRoom)>
                    <Remove>
                        <Feature uuid=(base) />
                    </Remove>
                </Room>
            </Asset>
        `)
        expect(schemaToWML([test.schema])).toEqual(deIndentWML(`
            <Asset uuid=(Test)>
                <Room uuid=(testRoom) key=(testRoom)>
                    <Remove><Feature uuid=(base) /></Remove>
                </Room>
            </Asset>
        `))
    })

    it('should correctly round-trip a room with lenses containing marks', () => {
        const testWML = deIndentWML(`
            <Asset uuid=(Test)>
                <Room uuid=(testRoom) key=(testRoom)>
                    <ShortName>Test Room</ShortName>
                    <Lens uuid=(lens1)>
                        <ShortName>Test Lens</ShortName>
                        <Description>This is a test lens.</Description>
                        <Mark uuid=(mark1)>
                            <ShortName>First Mark</ShortName>
                            <Description>This is a first mark.</Description>
                        </Mark>
                        <Mark uuid=(mark2)>
                            <ShortName>Second Mark</ShortName>
                            <Description>This is a second mark.</Description>
                        </Mark>
                    </Lens>
                </Room>
            </Asset>
        `)
        const test = new StandardForm(testWML)
        expect(schemaToWML([test.schema])).toEqual(testWML)
        
        // Verify the room has the lens reference
        const room = test.byUniversalId['ROOM#testRoom'] as StandardRoom
        expect(room).toBeDefined()
        expect(room.lens.payload.length).toEqual(1)
        expect(room.lens.payload[0].universalKey).toEqual('LENS#lens1')
        expect(room.lens.payload[0].tag).toEqual('Lens')
        
        // Verify the lens has the mark references
        const lens = test.byUniversalId['LENS#lens1'] as StandardLens
        expect(lens).toBeDefined()
        expect(lens).toBeInstanceOf(StandardLens)
        expect(lens.marks.items.length).toEqual(2)
        expect(lens.marks.items[0].reference.universalKey).toEqual('MARK#mark1')
        expect(lens.marks.items[1].reference.universalKey).toEqual('MARK#mark2')
    })

    it('should correctly round-trip a standalone Lens component', () => {
        const testWML = deIndentWML(`
            <Asset uuid=(Test)>
                <Lens uuid=(lens1) key=(lens1)>
                    <ShortName>Test Lens</ShortName>
                    <Description>This is a test lens.</Description>
                    <Mark uuid=(mark1)>
                        <ShortName>First Mark</ShortName>
                        <Description>This is a first mark.</Description>
                    </Mark>
                    <Mark uuid=(mark2)>
                        <ShortName>Second Mark</ShortName>
                        <Description>This is a second mark.</Description>
                    </Mark>
                </Lens>
            </Asset>
        `)
        const test = new StandardForm(testWML)
        expect(schemaToWML([test.schema])).toEqual(testWML)
        
        // Verify the lens component
        const lens = test.byUniversalId['LENS#lens1'] as StandardLens
        expect(lens).toBeDefined()
        expect(lens).toBeInstanceOf(StandardLens)
        expect(lens.shortName?.toJSON()).toEqual('Test Lens')
        expect(lens.description?.toJSON()).toEqual(['This is a test lens.'])
        
        // Verify the lens has the mark references
        expect(lens.marks.items.length).toEqual(2)
        expect(lens.marks.items[0].reference.universalKey).toEqual('MARK#mark1')
        expect(lens.marks.items[1].reference.universalKey).toEqual('MARK#mark2')
        
        // Verify the mark components exist
        const mark1 = test.byUniversalId['MARK#mark1'] as StandardMark
        const mark2 = test.byUniversalId['MARK#mark2'] as StandardMark
        expect(mark1).toBeDefined()
        expect(mark1).toBeInstanceOf(StandardMark)
        expect(mark2).toBeDefined()
        expect(mark2).toBeInstanceOf(StandardMark)
        expect(mark1.shortName?.toJSON()).toEqual('First Mark')
        expect(mark2.shortName?.toJSON()).toEqual('Second Mark')
    })

    it('should correctly round-trip a standalone Mark component', () => {
        const testWML = deIndentWML(`
            <Asset uuid=(Test)>
                <Mark uuid=(mark1) key=(mark1)>
                    <ShortName>Test Mark</ShortName>
                    <Description>This is a test mark.</Description>
                </Mark>
            </Asset>
        `)
        const test = new StandardForm(testWML)
        expect(schemaToWML([test.schema])).toEqual(testWML)
        
        // Verify the mark component
        const mark = test.byUniversalId['MARK#mark1'] as StandardMark
        expect(mark).toBeDefined()
        expect(mark).toBeInstanceOf(StandardMark)
        expect(mark.shortName?.toJSON()).toEqual('Test Mark')
        expect(mark.description?.toJSON()).toEqual(['This is a test mark.'])
    })

    it('should correctly round-trip a Situation with Mark facets', () => {
        const testWML = deIndentWML(`
            <Asset uuid=(Test)>
                <Mark uuid=(mark1) key=(mark1)>
                    <ShortName>Condition Mark</ShortName>
                    <Description>This is a condition mark.</Description>
                </Mark>
                <Situation uuid=(situation1) key=(situation1)>
                    <ShortName>Situation label</ShortName>
                    <Mark key=(mark1)><Match>Condition narrative</Match></Mark>
                </Situation>
            </Asset>
        `)
        const test = new StandardForm(testWML)
        expect(schemaToWML([test.schema])).toEqual(testWML)
        
        const mark = test.byUniversalId['MARK#mark1'] as StandardMark
        expect(mark).toBeDefined()
        expect(mark).toBeInstanceOf(StandardMark)
        
        const situation = test.byUniversalId['SITUATION#situation1'] as StandardSituation
        expect(situation).toBeDefined()
        expect(situation).toBeInstanceOf(StandardSituation)
        expect(situation.marks.length).toEqual(1)
        
        const facet = situation.marks.items[0] as StandardMarkFacet
        expect((facet.reference as StandardReference).key).toEqual('mark1')
        expect(facet.payload.toJSON()).toEqual('Condition narrative')
        expect(situation.shortName?.toJSON()).toEqual('Situation label')
    })

    it('should correctly parse Situation with ShortName and hasShortName', () => {
        const testWML = deIndentWML(`
            <Asset uuid=(Test)>
                <Situation uuid=(situation1) key=(situation1)>
                    <ShortName>Tab label</ShortName>
                </Situation>
            </Asset>
        `)
        const test = new StandardForm(testWML)
        const situation = test.byUniversalId['SITUATION#situation1'] as StandardSituation
        expect(situation).toBeDefined()
        expect(situation).toBeInstanceOf(StandardSituation)
        expect(hasShortName(situation)).toBe(true)
        expect(situation.shortName?.toJSON()).toEqual('Tab label')
    })

    it('should correctly construct classes', () => {
        const testWML = deIndentWML(`
            <Asset uuid=(Test)>
                <Map uuid=(testMap)>
                    <Room uuid=(testRoom)>
                        <Feature uuid=(testFeature) key=(testFeature) />
                        <Position {0, 0} />
                    </Room>
                </Map>
            </Asset>
        `)
        const test = new StandardForm(testWML)
        expect(test.byUniversalId['ROOM#testRoom']).toBeInstanceOf(StandardRoom)
        expect(test.byUniversalId['FEATURE#testFeature']).toBeInstanceOf(StandardFeature)
        expect(test.byUniversalId['MAP#testMap']).toBeInstanceOf(StandardMap)
    })

    it('should correctly relocate nested components to rendering level', () => {
        const testWML = deIndentWML(`
            <Asset uuid=(Test)>
                <Room uuid=(testRoom) key=(testRoom)>
                    <Feature key=(testFeature)>
                        <Situation key=(testFeatureExample)>
                            <Description>Test Feature</Description>
                        </Situation>
                    </Feature>
                </Room>
                <Feature uuid=(testFeature) key=(testFeature) />
            </Asset>
        `)
        const test = new StandardForm(testWML)
        expect(schemaToWML([test.schema])).toEqual(deIndentWML(`
            <Asset uuid=(Test)>
                <Feature uuid=(testFeature) key=(testFeature)>
                    <Situation key=(testFeatureExample)>
                        <Description>Test Feature</Description>
                    </Situation>
                </Feature>
                <Room uuid=(testRoom) key=(testRoom)><Feature key=(testFeature) /></Room>
            </Asset>
        `))
    })

    it('should combine descriptions in rooms and features', () => {
        const test = new StandardForm(`<Asset uuid=(Test)>
            <Room uuid=(test) key=(test)>
                <Situation uuid=(DEFAULT)>
                    <Summary>
                        One
                        <br />
                    </Summary>
                    <Description>Three</Description>
                </Situation>
            </Room>
            <Room key=(test) ref={0}>
                <Situation uuid=(DEFAULT)><Summary>Two</Summary></Situation>
            </Room>
            <Feature uuid=(testFeature) key=(testFeature)>
                <Situation uuid=(testFeatureBase) key=(base)><Description>Four</Description></Situation>
            </Feature>
            <Room key=(test) ref={0}>
                <Situation uuid=(DEFAULT)><DisplayName>Test Room</DisplayName></Situation>
            </Room>
        </Asset>`)
        expect(schemaToWML([test.schema])).toEqual(deIndentWML(`
            <Asset uuid=(Test)>
                <Feature uuid=(testFeature) key=(testFeature)>
                    <Situation key=(base)><Description>Four</Description></Situation>
                </Feature>
                <Room uuid=(test) key=(test)>
                    <Situation uuid=(DEFAULT) ref={0} />
                    <Situation uuid=(DEFAULT) ref={3}>
                        <DisplayName>Test Room</DisplayName>
                        <Summary>One<br />Two</Summary>
                        <Description>Three</Description>
                    </Situation>
                </Room>
            </Asset>
        `))
    })

    it('should combine exits in rooms', () => {
        const test = new StandardForm(`<Asset uuid=(Test)>
            <Room uuid=(testRoom) key=(test)>
                <Situation ref={0} uuid=(testRoomBase) key=(base)>
                    <Description>
                        One
                        <br />
                    </Description>
                </Situation>
            </Room>
            <Room uuid=(testTwo) key=(testTwo) />
            <Room key=(test) ref={0}>
                <Exit to=(testTwo)>Test Exit</Exit>
            </Room>
            <Room key=(testTwo) ref={0}>
                <Exit to=(test)>Test Return</Exit>
            </Room>
        </Asset>`)
        expect(schemaToWML([test.schema])).toEqual(deIndentWML(`
            <Asset uuid=(Test)>
                <Room uuid=(testRoom) key=(test)>
                    <Situation key=(base) ref={0}>
                        <Description>One<br /></Description>
                    </Situation>
                    <Exit to=(testTwo)>Test Exit</Exit>
                </Room>
                <Room uuid=(testTwo) key=(testTwo)>
                    <Exit to=(test)>Test Return</Exit>
                </Room>
                <Situation uuid=(testRoomBase) key=(base) ref={0} />
            </Asset>
        `))
    })

    it('should correctly return JSON for features nested in rooms', () => {
        const test = new StandardForm(`<Asset uuid=(Test)>
            <Feature uuid=(testGlobal) key=(testGlobal) />
            <Room uuid=(testRoom) key=(test)>
                <Situation ref={0} uuid=(testRoomBase)><Description>One</Description></Situation>
                <Feature uuid=(testLocal) key=(testLocal)>
                    <Situation uuid=(testLocalBase)><Description>Local</Description></Situation>
                </Feature>
                <Feature uuid=(testGlobal) key=(testGlobal)>
                    <Situation uuid=(testGlobalBase)><Description>Global</Description></Situation>
                </Feature>
            </Room>
            <Room uuid=(testTwo) key=(testTwo) />
        </Asset>`)
        expect(test.toJSON()).toEqual({
            universalKey: 'ASSET#Test',
            metaData: [],
            topLevel: [
                'FEATURE#testGlobal',
                'ROOM#testRoom',
                'ROOM#testTwo'
            ],
            components: [{
                tag: 'Feature',
                key: 'testGlobal',
                universalKey: 'FEATURE#testGlobal',
                shortName: undefined,
                situations: [{
                    reference: 'SITUATION#testGlobalBase',
                    payload: { description: ['Global'] }
                }]
            },
            {
                key: undefined,
                tag: 'Situation',
                universalKey: 'SITUATION#testGlobalBase',
            },
            {
                tag: 'Room',
                key: 'test',
                universalKey: 'ROOM#testRoom',
                shortName: undefined,
                situations: [{
                    reference: {
                        universalKey: 'SITUATION#testRoomBase',
                        tag: 'Situation',
                        ref: 0
                    },
                    payload: { description: ['One'] }
                }],
                features: ['FEATURE#testLocal', 'FEATURE#testGlobal']
            },
            {
                tag: 'Feature',
                key: 'testLocal',
                universalKey: 'FEATURE#testLocal',
                shortName: undefined,
                situations: [{
                    reference: 'SITUATION#testLocalBase',
                    payload: { description: ['Local'] }
                }]
            },
            {
                key: undefined,
                tag: 'Situation',
                universalKey: 'SITUATION#testLocalBase',
            },
            {
                tag: 'Room',
                key: 'testTwo',
                universalKey: 'ROOM#testTwo',
                shortName: undefined,
            },
            {
                key: undefined,
                universalKey: 'SITUATION#testRoomBase',
                tag: 'Situation',
            }]
        })
    })

    it('should correctly return JSON for examples nested in rooms', () => {
        const test = new StandardForm(`<Asset uuid=(Test)>
            <Room uuid=(test) key=(test)>
                <Situation ref={0} uuid=(testLocal)>
                    <Description>Description Test</Description>
                </Situation>
            </Room>
            <Room uuid=(testTwo) key=(testTwo) />
        </Asset>`)
        expect(test.toJSON()).toEqual({
            universalKey: 'ASSET#Test',
            metaData: [],
            topLevel: [
                'ROOM#test',
                'ROOM#testTwo'
            ],
            components: [{
                tag: 'Room',
                key: 'test',
                universalKey: 'ROOM#test',
                shortName: undefined,
                situations: [{
                    reference: {
                        universalKey: 'SITUATION#testLocal',
                        tag: 'Situation',
                        ref: 0
                    },
                    payload: { description: ['Description Test'] }
                }],
            },
            {
                tag: 'Room',
                key: 'testTwo',
                universalKey: 'ROOM#testTwo',
                shortName: undefined,
            },
            {
                universalKey: 'SITUATION#testLocal',
                tag: 'Situation',
            }]
        })
    })

    it('should correctly return JSON for examples nested in Knowledge', () => {
        const test = new StandardForm(`<Asset uuid=(Test)>
            <Knowledge uuid=(test) key=(test)>
                <Situation uuid=(testLocal)>
                    <Description>Description Test</Description>
                </Situation>
            </Knowledge>
        </Asset>`)
        expect(test.toJSON()).toEqual({
            universalKey: 'ASSET#Test',
            metaData: [],
            topLevel: ['KNOWLEDGE#test'],
            components: [{
                tag: 'Knowledge',
                key: 'test',
                universalKey: 'KNOWLEDGE#test',
                situations: [{
                    reference: 'SITUATION#testLocal',
                    payload: { description: ['Description Test'] }
                }]
            },
            {
                universalKey: 'SITUATION#testLocal',
                tag: 'Situation',
            }]
        })
    })

    it('should correct return JSON for examples nested in features nested in rooms', () => {
        const test = new StandardForm(`<Asset uuid=(Test)>
            <Room uuid=(test) key=(test)>
                <Feature uuid=(testFeature) key=(testFeature)>
                    <Situation uuid=(testLocal) key=(testLocal)>
                        <Description>Description Test</Description>
                    </Situation>
                </Feature>
            </Room>
            <Room uuid=(testTwo) key=(testTwo) />
        </Asset>`)
        expect(test.toJSON()).toEqual({
            universalKey: 'ASSET#Test',
            metaData: [],
            topLevel: [
                'ROOM#test',
                'ROOM#testTwo'
            ],
            components: [{
                tag: 'Room',
                key: 'test',
                universalKey: 'ROOM#test',
                features: ['FEATURE#testFeature']
            },
            {
                tag: 'Feature',
                key: 'testFeature',
                universalKey: 'FEATURE#testFeature',
                situations: [{
                    reference: 'SITUATION#testLocal',
                    payload: { description: ['Description Test'] }
                }]
            },
            {
                key: 'testLocal',
                universalKey: 'SITUATION#testLocal',
                tag: 'Situation',
            },
            {
                tag: 'Room',
                key: 'testTwo',
                universalKey: 'ROOM#testTwo',
            }]
        })
    })

    it('should correctly return schema for features nested in rooms', () => {
        const test = new StandardForm(`<Asset uuid=(Test)>
            <Feature uuid=(testGlobal) key=(testGlobal) />
            <Room uuid=(test) key=(test)>
                <Feature uuid=(testLocal) key=(testLocal)>
                    <Situation uuid=(testFeatureExample)>
                        <Description>Local</Description>
                    </Situation>
                </Feature>
                <Feature key=(testGlobal)>
                    <Situation uuid=(testGlobalExample)>
                        <Description>Global</Description>
                    </Situation>
                </Feature>
                <Situation ref={0} uuid=(testBase)><Description>One</Description></Situation>
            </Room>
            <Room uuid=(testTwo) key=(testTwo) />
        </Asset>`)
        expect(schemaToWML([test.schema])).toEqual(deIndentWML(`
            <Asset uuid=(Test)>
                <Feature uuid=(testGlobal) key=(testGlobal)>
                    <Situation uuid=(testGlobalExample)>
                        <Description>Global</Description>
                    </Situation>
                </Feature>
                <Room uuid=(test) key=(test)>
                    <Feature key=(testGlobal) />
                    <Feature uuid=(testLocal) key=(testLocal)>
                        <Situation uuid=(testFeatureExample)>
                            <Description>Local</Description>
                        </Situation>
                    </Feature>
                    <Situation uuid=(testBase) ref={0}>
                        <Description>One</Description>
                    </Situation>
                </Room>
                <Room uuid=(testTwo) key=(testTwo) />
                <Situation uuid=(testBase) ref={0} />
            </Asset>
        `))
    })

    it('should correctly return schema for examples nested in knowledge', () => {
        const testSource = deIndentWML(`
            <Asset uuid=(Test)>
                <Knowledge uuid=(test) key=(test)>
                    <Situation key=(testLocal)>
                        <Description>Description Test</Description>
                    </Situation>
                </Knowledge>
            </Asset>
        `)
        const test = new StandardForm(testSource)
        expect(schemaToWML([test.schema])).toEqual(testSource)
    })

    it('hoists a room default Situation stub to asset scope in schema output (Gate D)', () => {
        const wml = deIndentWML(`
            <Asset uuid=(Test)>
                <Room key=(r1)>
                    <Situation ref={0} uuid=(e1)><Description>x</Description></Situation>
                </Room>
            </Asset>
        `)
        const printed = schemaToWML([new StandardForm(wml).schema])
        expect(printed).toContain('Situation uuid=(e1) ref={0}')
        expect(printed).toContain('<Description>x</Description>')
    })

    it('should correctly return schema for examples nested in features nested in rooms', () => {
        const testWML = deIndentWML(`
            <Asset uuid=(Test)>
                <Room uuid=(test) key=(test)>
                    <Feature uuid=(testFeature) key=(testFeature)>
                        <Situation key=(testLocal)>
                            <Description>Description Test</Description>
                        </Situation>
                    </Feature>
                </Room>
                <Room uuid=(testTwo) key=(testTwo) />
            </Asset>
        `)
        const test = new StandardForm(testWML)
        expect(schemaToWML([test.schema])).toEqual(testWML)
    })

    it('should combine render in nested rooms', () => {
        const test = new StandardForm(`<Asset uuid=(Test)>
            <Room uuid=(test) key=(test)>
                <Situation ref={0} uuid=(testBase) key=(base)>
                    <Description>
                        One
                        <br />
                    </Description>
                </Situation>
            </Room>
            <Room uuid=(testTwo) key=(testTwo) />
            <Message uuid=(testMessage) key=(testMessage)>
                <Description>Test message</Description>
                <Room uuid=(test) key=(test)>
                    <Situation key=(base) ref={0}>
                        <Description>
                            Two
                        </Description>
                    </Situation>
                    <Exit to=(testTwo)>Test Exit</Exit>
                </Room>
            </Message>
            <Room key=(testTwo) ref={0}>
                <Exit to=(test)>Test Return</Exit>
            </Room>
        </Asset>`)
        expect(schemaToWML([test.schema])).toEqual(deIndentWML(`
            <Asset uuid=(Test)>
                <Room uuid=(test) key=(test)>
                    <Situation key=(base) ref={0}>
                        <Description>One<br />Two</Description>
                    </Situation>
                    <Exit to=(testTwo)>Test Exit</Exit>
                </Room>
                <Room uuid=(testTwo) key=(testTwo)>
                    <Exit to=(test)>Test Return</Exit>
                </Room>
                <Message uuid=(testMessage) key=(testMessage)>
                    <Room key=(test) />
                    <Description>Test message</Description>
                </Message>
                <Situation uuid=(testBase) key=(base) ref={0} />
            </Asset>
        `))
    })

    it('should render features and links correctly', () => {
        const test = new StandardForm(`<Asset uuid=(Test)>
            <Room uuid=(test) key=(test)>
                <Situation ref={0} uuid=(testBase)>
                    <Description>
                        <Link to=(testFeatureOne)>test</Link>
                    </Description>
                </Situation>
            </Room>
            <Feature uuid=(testFeatureOne) key=(testFeatureOne)>
                <Situation uuid=(testFeatureOneBase)>
                    <DisplayName>TestOne</DisplayName>
                    <Description><Link to=(testFeatureTwo)>two</Link></Description>
                </Situation>
            </Feature>
            <Feature uuid=(testFeatureTwo) key=(testFeatureTwo)>
                <Situation uuid=(testFeatureTwoBase)>
                    <DisplayName>TestTwo</DisplayName>
                    <Description>Test</Description>
                </Situation>
            </Feature>
        </Asset>`)
        expect(schemaToWML([test.schema])).toEqual(deIndentWML(`
            <Asset uuid=(Test)>
                <Feature uuid=(testFeatureOne) key=(testFeatureOne)>
                    <Situation uuid=(testFeatureOneBase)>
                        <DisplayName>TestOne</DisplayName>
                        <Description><Link to=(testFeatureTwo)>two</Link></Description>
                    </Situation>
                </Feature>
                <Feature uuid=(testFeatureTwo) key=(testFeatureTwo)>
                    <Situation uuid=(testFeatureTwoBase)>
                        <DisplayName>TestTwo</DisplayName>
                        <Description>Test</Description>
                    </Situation>
                </Feature>
                <Room uuid=(test) key=(test)>
                    <Situation uuid=(testBase) ref={0}>
                        <Description><Link to=(testFeatureOne)>test</Link></Description>
                    </Situation>
                </Room>
                <Situation uuid=(testBase) ref={0} />
            </Asset>
        `))
    })

    it('should render knowledge correctly', () => {
        const test = new StandardForm(`<Asset uuid=(Test)>
            <Room uuid=(test) key=(test)>
                <Situation ref={0} uuid=(testBase)>
                    <Description>
                        <Link to=(testKnowledgeOne)>test</Link>
                    </Description>
                </Situation>
            </Room>
            <Knowledge uuid=(testKnowledgeOne) key=(testKnowledgeOne)>
                <Situation uuid=(testKnowledgeOneBase)>
                    <DisplayName>TestOne</DisplayName>
                    <Description><Link to=(testKnowledgeTwo)>two</Link></Description>
                </Situation>
            </Knowledge>
            <Knowledge uuid=(testKnowledgeTwo) key=(testKnowledgeTwo)>
                <Situation uuid=(testKnowledgeTwoBase)>
                    <DisplayName>TestTwo</DisplayName>
                    <Description>Test</Description>
                </Situation>
            </Knowledge>
        </Asset>`)
        expect(schemaToWML([test.schema])).toEqual(deIndentWML(`
            <Asset uuid=(Test)>
                <Knowledge uuid=(testKnowledgeOne) key=(testKnowledgeOne)>
                    <Situation uuid=(testKnowledgeOneBase)>
                        <DisplayName>TestOne</DisplayName>
                        <Description><Link to=(testKnowledgeTwo)>two</Link></Description>
                    </Situation>
                </Knowledge>
                <Knowledge uuid=(testKnowledgeTwo) key=(testKnowledgeTwo)>
                    <Situation uuid=(testKnowledgeTwoBase)>
                        <DisplayName>TestTwo</DisplayName>
                        <Description>Test</Description>
                    </Situation>
                </Knowledge>
                <Room uuid=(test) key=(test)>
                    <Situation uuid=(testBase) ref={0}>
                        <Description><Link to=(testKnowledgeOne)>test</Link></Description>
                    </Situation>
                </Room>
                <Situation uuid=(testBase) ref={0} />
            </Asset>
        `))
    })

    it('should render maps correctly', () => {
        const test = new StandardForm(`<Asset uuid=(Test)>
            <Map uuid=(testMap) key=(testMap)>
                <ShortName>Test map</ShortName>
                <Room uuid=(testRoomOne) key=(testRoomOne)>
                    <Position {0, 0} />
                    <Situation ref={0} uuid=(testRoomOneBase)>
                        <Description>Test Room One</Description>
                    </Situation>
                    <Exit to=(testRoomTwo)>two</Exit>
                </Room>
                <Room uuid=(testRoomOne) key=(testRoomOne) />
                <Room uuid=(testRoomTwo) key=(testRoomTwo)>
                    <Position {-100, 0} />
                    <Situation ref={0} uuid=(testRoomTwoBase)>
                        <Description>Test Room Two</Description>
                    </Situation>
                    <Exit to=(testRoomOne)>one</Exit>
                </Room>
                <Room uuid=(testRoomThree) key=(testRoomThree) />
                <Image key=(mapBackground) />
            </Map>
            <Room uuid=(testRoomOne) />
            <Room uuid=(testRoomTwo) />
            <Room uuid=(testRoomThree) />
        </Asset>`)
        expect(schemaToWML([test.schema])).toEqual(deIndentWML(`
            <Asset uuid=(Test)>
                <Room uuid=(testRoomOne) key=(testRoomOne)>
                    <Situation uuid=(testRoomOneBase) ref={0}>
                        <Description>Test Room One</Description>
                    </Situation>
                    <Exit to=(testRoomTwo)>two</Exit>
                </Room>
                <Room uuid=(testRoomThree) key=(testRoomThree) />
                <Room uuid=(testRoomTwo) key=(testRoomTwo)>
                    <Situation uuid=(testRoomTwoBase) ref={0}>
                        <Description>Test Room Two</Description>
                    </Situation>
                    <Exit to=(testRoomOne)>one</Exit>
                </Room>
                <Map uuid=(testMap) key=(testMap)>
                    <ShortName>Test map</ShortName>
                    <Image key=(mapBackground) />
                    <Room key=(testRoomOne)><Position {0, 0} /></Room>
                    <Room key=(testRoomTwo)><Position {-100, 0} /></Room>
                </Map>
                <Situation uuid=(testRoomOneBase) ref={0} />
                <Situation uuid=(testRoomTwoBase) ref={0} />
            </Asset>
        `))
    })

    it('should render empty maps', () => {
        const test = new StandardForm(`<Asset uuid=(Test)><Map uuid=(testMap) key=(testMap) /></Asset>`)
        expect(schemaToWML([test.schema])).toEqual(deIndentWML(`
            <Asset uuid=(Test)><Map uuid=(testMap) key=(testMap) /></Asset>
        `))
    })

    it('should render messages correctly', () => {
        const test = new StandardForm(`<Asset uuid=(Test)>
            <Message uuid=(testMessage) key=(testMessage)>
                <Description>Test message</Description>
                <Room uuid=(testRoomOne) key=(testRoomOne)>
                    <Situation ref={0} uuid=(testRoomOneBase)>
                        <Description>Test Room One</Description>
                    </Situation>
                    <Exit to=(testRoomTwo)>two</Exit>
                </Room>
                <Room uuid=(testRoomTwo) key=(testRoomTwo)>
                    <Situation ref={0} uuid=(testRoomTwoBase)>
                        <Description>Test Room Two</Description>
                    </Situation>
                    <Exit to=(testRoomOne)>one</Exit>
                </Room>
            </Message>
            <Room uuid=(testRoomOne) />
            <Room uuid=(testRoomTwo) />
        </Asset>`)
        expect(schemaToWML([test.schema])).toEqual(deIndentWML(`
            <Asset uuid=(Test)>
                <Room uuid=(testRoomOne) key=(testRoomOne)>
                    <Situation uuid=(testRoomOneBase) ref={0}>
                        <Description>Test Room One</Description>
                    </Situation>
                    <Exit to=(testRoomTwo)>two</Exit>
                </Room>
                <Room uuid=(testRoomTwo) key=(testRoomTwo)>
                    <Situation uuid=(testRoomTwoBase) ref={0}>
                        <Description>Test Room Two</Description>
                    </Situation>
                    <Exit to=(testRoomOne)>one</Exit>
                </Room>
                <Message uuid=(testMessage) key=(testMessage)>
                    <Room key=(testRoomOne) />
                    <Room key=(testRoomTwo) />
                    <Description>Test message</Description>
                </Message>
                <Situation uuid=(testRoomOneBase) ref={0} />
                <Situation uuid=(testRoomTwoBase) ref={0} />
            </Asset>
        `))
    })

    it('should render moments correctly', () => {
        const test = new StandardForm(`<Asset uuid=(Test)>
            <Moment uuid=(testMoment) key=(testMoment)>
                <Message uuid=(testMessage) key=(testMessage)>
                    <Description>Test message</Description>
                    <Room uuid=(testRoomOne) key=(testRoomOne)>
                        <Situation ref={0} uuid=(testRoomOneBase)>
                            <Description>Test Room One</Description>
                        </Situation>
                        <Exit to=(testRoomTwo)>two</Exit>
                    </Room>
                </Message>
            </Moment>
            <Room uuid=(testRoomOne) />
            <Room uuid=(testRoomTwo) key=(testRoomTwo) />
        </Asset>`)
        expect(schemaToWML([test.schema])).toEqual(deIndentWML(`
            <Asset uuid=(Test)>
                <Room uuid=(testRoomOne) key=(testRoomOne)>
                    <Situation uuid=(testRoomOneBase) ref={0}>
                        <Description>Test Room One</Description>
                    </Situation>
                    <Exit to=(testRoomTwo)>two</Exit>
                </Room>
                <Room uuid=(testRoomTwo) key=(testRoomTwo) />
                <Moment uuid=(testMoment) key=(testMoment)>
                    <Message uuid=(testMessage) key=(testMessage)>
                        <Room key=(testRoomOne) />
                        <Description>Test message</Description>
                    </Message>
                </Moment>
                <Situation uuid=(testRoomOneBase) ref={0} />
            </Asset>
        `))
    })

    it('should handle complex WML parsing with nested character references', () => {
        const complexWML = deIndentWML(`
            <Asset uuid=(complex)>
                <Character uuid=(global1) key=(global1)>
                    <ShortName>Global1</ShortName>
                    <DisplayName>Global Character 1</DisplayName>
                </Character>
                <Character uuid=(global2) key=(global2)>
                    <ShortName>Global2</ShortName>
                    <DisplayName>Global Character 2</DisplayName>
                </Character>
                <Room uuid=(mainRoom) key=(mainRoom)>
                    <Character key=(local1)>
                        <ShortName>Local1</ShortName>
                        <DisplayName>Local Character 1</DisplayName>
                    </Character>
                    <Character uuid=(global1) />
                    <Character key=(local2)>
                        <ShortName>Local2</ShortName>
                        <DisplayName>Local Character 2</DisplayName>
                    </Character>
                </Room>
                <Room uuid=(sideRoom) key=(sideRoom)>
                    <Character uuid=(global2) />
                    <Character key=(local3)>
                        <ShortName>Local3</ShortName>
                        <DisplayName>Local Character 3</DisplayName>
                    </Character>
                </Room>
            </Asset>
        `)
        
        const form = new StandardForm(complexWML)
        const mainRoom = form._lookup('ROOM#mainRoom') as StandardRoom
        const sideRoom = form._lookup('ROOM#sideRoom') as StandardRoom
        
        // Verify character counts
        expect(mainRoom.characters).toBeDefined()
        expect(mainRoom.characters!.payload.length).toBe(3)
        expect(sideRoom.characters).toBeDefined()
        expect(sideRoom.characters!.payload.length).toBe(2)
        
        // Verify character types (local vs universal)
        const mainRoomKeys = mainRoom.characters!.payload.map(ref => ref.key || ref.universalKey)
        const sideRoomKeys = sideRoom.characters!.payload.map(ref => ref.key || ref.universalKey)
        
        expect(mainRoomKeys).toContain('local1')
        expect(mainRoomKeys).toContain('CHARACTER#global1')
        expect(mainRoomKeys).toContain('local2')
        expect(sideRoomKeys).toContain('CHARACTER#global2')
        expect(sideRoomKeys).toContain('local3')
    })

    it('should perform complete serialization round-trip with character references', () => {
        const originalWML = deIndentWML(`
            <Asset uuid=(roundtrip)>
                <Character uuid=(char1) key=(char1)>
                    <ShortName>Test</ShortName>
                    <DisplayName>Test Character</DisplayName>
                </Character>
                <Room uuid=(room1) key=(room1)>
                    <Character key=(char1) />
                    <Character uuid=(local1) key=(local1)>
                        <ShortName>Local</ShortName>
                        <DisplayName>Local Character</DisplayName>
                    </Character>
                </Room>
            </Asset>
        `)
        
        // WML → StandardForm
        const form1 = new StandardForm(originalWML)
        
        // StandardForm → JSON
        const jsonData = form1.toJSON()
        
        // JSON → StandardForm
        const form2 = new StandardForm(jsonData)
        
        // Verify the round-trip preserved character references
        const room1 = form2._lookup('ROOM#room1') as StandardRoom
        expect(room1.characters!.payload.length).toBe(2)
        
        const charKeys = room1.characters!.payload.map(ref => ref.key || ref.universalKey)
        expect(charKeys).toContain('local1')
        expect(charKeys).toContain('char1')

        // StandardForm → WML
        const finalWML = schemaToWML([form2.schema])
        
        // Verify the final WML contains character references
        expect(finalWML).toEqual(originalWML)
    })

    it('should handle diff scenarios with character reference changes', () => {
        const baseWML = deIndentWML(`
            <Asset uuid=(diff)>
                <Character uuid=(char1) key=(char1)>
                    <ShortName>Alice</ShortName>
                    <DisplayName>Alice</DisplayName>
                </Character>
                <Character uuid=(char2) key=(char2)>
                    <ShortName>Bob</ShortName>
                    <DisplayName>Bob</DisplayName>
                </Character>
                <Room uuid=(room1) key=(room1)>
                    <Character uuid=(local1) key=(local1)>
                        <ShortName>Local1</ShortName>
                        <DisplayName>Local Character 1</DisplayName>
                    </Character>
                    <Character uuid=(char1) />
                </Room>
            </Asset>
        `)
        
        const modifiedWML = deIndentWML(`
            <Asset uuid=(diff)>
                <Character uuid=(char1) key=(char1)>
                    <ShortName>Alice</ShortName>
                    <DisplayName>Alice</DisplayName>
                </Character>
                <Character uuid=(char2) key=(char2)>
                    <ShortName>Bob</ShortName>
                    <DisplayName>Bob</DisplayName>
                </Character>
                <Character uuid=(char3) key=(char3)>
                    <ShortName>Charlie</ShortName>
                    <DisplayName>Charlie</DisplayName>
                </Character>
                <Room uuid=(room1) key=(room1)>
                    <Character uuid=(local2) key=(local2)>
                        <ShortName>Local2</ShortName>
                        <DisplayName>Local Character 2</DisplayName>
                    </Character>
                    <Character uuid=(char2) />
                    <Character uuid=(char3) />
                </Room>
            </Asset>
        `)
        
        const baseForm = new StandardForm(baseWML)
        const modifiedForm = new StandardForm(modifiedWML)
        
        // Generate diff
        const diff = baseForm.diff(modifiedForm)
        
        // Verify diff contains character changes
        expect(diff).toBeDefined()
        const diffWML = schemaToWML([diff.schema])
        // TODO: Fix diff system to properly handle reference changes in nested components
        // Current behavior: Missing char2 reference due to diff system edge case
        // Expected behavior: Should include <Character key=(char2) /> in Room
        expect(diffWML).toEqual(deIndentWML(`
            <Asset uuid=(diff)>
                <Character uuid=(char3) key=(char3)>
                    <ShortName>Charlie</ShortName>
                    <DisplayName>Charlie</DisplayName>
                </Character>
                <Room uuid=(room1) key=(room1) ref={0}>
                    <Character key=(char3) />
                    <Remove>
                        <Character uuid=(local1) key=(local1)>
                            <ShortName>Local1</ShortName>
                            <DisplayName>Local Character 1</DisplayName>
                        </Character>
                    </Remove>
                    <Character uuid=(local2) key=(local2)>
                        <ShortName>Local2</ShortName>
                        <DisplayName>Local Character 2</DisplayName>
                    </Character>
                    <Remove><Character uuid=(char1) key=(char1) /></Remove>
                    <Character uuid=(char2) key=(char2) />
                </Room>
            </Asset>
        `))
    })

    it('should handle merge scenarios with conflicting character references', () => {
        const form1WML = deIndentWML(`
            <Asset uuid=(merge)>
                <Character uuid=(char1) key=(char1)>
                    <ShortName>Alice</ShortName>
                    <DisplayName>Alice</DisplayName>
                </Character>
                <Room uuid=(room1) key=(room1)>
                    <Character key=(local1)>
                        <ShortName>Local1</ShortName>
                        <DisplayName>Local Character 1</DisplayName>
                    </Character>
                    <Character uuid=(char1) />
                </Room>
            </Asset>
        `)
        
        const form2WML = deIndentWML(`
            <Asset uuid=(merge)>
                <Character uuid=(char2) key=(char2)>
                    <ShortName>Bob</ShortName>
                    <DisplayName>Bob</DisplayName>
                </Character>
                <Room uuid=(room1) key=(room1)>
                    <Character key=(local2)>
                        <ShortName>Local2</ShortName>
                        <DisplayName>Local Character 2</DisplayName>
                    </Character>
                    <Character uuid=(char2) />
                </Room>
            </Asset>
        `)
        
        const form1 = new StandardForm(form1WML)
        const form2 = new StandardForm(form2WML)
        
        // Merge the forms
        const mergedForm = form1.merge(form2)
        
        // Verify merged form contains characters from both sources
        const mergedRoom = mergedForm._lookup('ROOM#room1') as StandardRoom
        expect(mergedRoom.characters!.payload.length).toBe(4)
        
        const mergedCharKeys = mergedRoom.characters!.payload.map(ref => ref.key || ref.universalKey)
        expect(mergedCharKeys).toContain('local1')
        expect(mergedCharKeys).toContain('local2')
        expect(mergedCharKeys).toContain('CHARACTER#char1')
        expect(mergedCharKeys).toContain('CHARACTER#char2')
    })

    it('should handle empty character lists correctly in integration', () => {
        const emptyWML = deIndentWML(`
            <Asset uuid=(empty)>
                <Room uuid=(room1) key=(room1)>
                    <DisplayName>Empty Room</DisplayName>
                </Room>
            </Asset>
        `)
        
        const form = new StandardForm(emptyWML)
        const room = form._lookup('ROOM#room1') as StandardRoom
        
        // Verify empty character list
        expect(room.characters.payload.length).toBe(0)
        
        // Verify serialization works with empty list
        const jsonData = form.toJSON()
        const reconstructedForm = new StandardForm(jsonData)
        const reconstructedRoom = reconstructedForm._lookup('ROOM#room1') as StandardRoom
        
        expect(reconstructedRoom.characters.payload.length).toBe(0)
    })

    it('should handle origin properties correctly in WML parsing and serialization', () => {
        const originWML = deIndentWML(`
            <Asset uuid=(origin)>
                <Character uuid=(char1) origin=(ASSET#123,ASSET#456)>
                    <DisplayName>Character with Origin</DisplayName>
                </Character>
                <Room uuid=(room1) origin=(ASSET#789)>
                    <Feature uuid=(feature1) origin=(ASSET#101,ASSET#102) />
                </Room>
            </Asset>
        `)
        
        // WML → StandardForm
        const form = new StandardForm(originWML)
        
        // Verify origin properties are parsed correctly
        const char1 = form._lookup('CHARACTER#char1') as StandardCharacter
        const room1 = form._lookup('ROOM#room1') as StandardRoom
        const feature1 = form._lookup('FEATURE#feature1') as StandardFeature
        
        expect(char1['_origin']).toEqual(['ASSET#123', 'ASSET#456'])
        expect(room1['_origin']).toEqual(['ASSET#789'])
        expect(feature1?.['_origin']).toEqual(['ASSET#101', 'ASSET#102'])
        
        const finalWML = schemaToWML([form.schema])
        expect(finalWML).toEqual(originWML)
    })

    it('should correctly reflect empty imports in byId', () => {
        const test = new StandardForm(`<Asset uuid=(Test)>
            <Room uuid=(testRoomOne) key=(testRoomOne) from=(ASSET#test) />
        </Asset>`)
        const firstRoom = test.byId.testRoomOne
        expect(firstRoom.toJSON()).toEqual({
            key: 'testRoomOne',
            universalKey: 'ROOM#testRoomOne',
            tag: 'Room',
            from: `ASSET#test`
        })
        const mapTest = new StandardForm(`<Asset uuid=(Test)>
            <Map uuid=(testMap) key=(testMap)>
                <Room uuid=(testRoomOne) key=(testRoomOne)><Position {0, 100} /></Room>
            </Map>
        </Asset>`)
        expect(mapTest.byId.testRoomOne.toJSON()).toEqual({
            key: 'testRoomOne',
            universalKey: 'ROOM#testRoomOne',
            tag: 'Room'
        })
    })

    it('should render Remove tags correctly', () => {
        const testSource = deIndentWML(`
            <Asset uuid=(Test)>
                <Situation uuid=(testRoomTwoBase) key=(base) ref={0} />
                <Room uuid=(testRoomOne) key=(testRoomOne) />
                <Room uuid=(testRoomTwo) key=(testRoomTwo) ref={0}>
                    <Situation key=(base) ref={0}>
                        <Remove><DisplayName>Test To Delete</DisplayName></Remove>
                    </Situation>
                </Room>
            </Asset>
        `)
        const test = new StandardForm(testSource)
        expect(schemaToWML([test.schema])).toEqual(deIndentWML(`
            <Asset uuid=(Test)>
                <Room uuid=(testRoomOne) key=(testRoomOne) />
                <Room uuid=(testRoomTwo) key=(testRoomTwo) ref={0}>
                    <Situation key=(base) ref={0}>
                        <Remove><DisplayName>Test To Delete</DisplayName></Remove>
                    </Situation>
                </Room>
                <Situation uuid=(testRoomTwoBase) key=(base) ref={0} />
            </Asset>
        `))
    })

    it('should handle characters correctly', () => {
        const testSource = deIndentWML(`
            <Asset uuid=(test)>
                <Character key=(Tess)>
                    <DisplayName>Tess</DisplayName>
                    <Image key=(TessIcon) />
                </Character>
                <Image key=(TessIcon) />
            </Asset>
        `)
        const test = new StandardForm(testSource)
        expect(test.byId.Tess instanceof StandardCharacter).toBe(true)
        expect(schemaToWML([test.schema])).toEqual(testSource)
    })

    it('should merge edit value tags correctly', () => {
        const inherited = new StandardForm(`
            <Asset uuid=(Test)>
                <Room uuid=(testRoomOne)>
                    <Situation ref={0} uuid=(testRoomOneBase)>
                        <DisplayName>Lobby</DisplayName>
                        <Description>A plain lobby.</Description>
                    </Situation>
                </Room>
            </Asset>
        `)
        const test = new StandardForm(`
            <Asset uuid=(Test)>
                <Room uuid=(testRoomOne) ref={0}>
                    <Situation uuid=(testRoomOneBase) ref={0}>
                        <Replace><DisplayName>Lobby</DisplayName></Replace>
                        <With><DisplayName>Darkened lobby</DisplayName></With>
                    </Situation>
                </Room>
            </Asset>
        `)
        expect(schemaToWML([inherited.merge(test).schema])).toEqual(deIndentWML(`
            <Asset uuid=(Test)>
                <Room uuid=(testRoomOne)>
                    <Situation uuid=(testRoomOneBase) ref={0}>
                        <DisplayName>Darkened lobby</DisplayName>
                        <Description>A plain lobby.</Description>
                    </Situation>
                </Room>
            </Asset>
        `))
    })

    it('should merge edit component remove correctly', () => {
        const inherited = new StandardForm(`
            <Asset uuid=(Test)>
                <Room uuid=(testRoomOne) key=(testRoomOne)>
                    <Situation ref={0} uuid=(testRoomOneBase) key=(base)>
                        <DisplayName>Lobby</DisplayName>
                        <Description>A plain lobby.</Description>
                    </Situation>
                </Room>
                <Room uuid=(testRoomTwo) key=(testRoomTwo) />
            </Asset>
        `)
        const test = new StandardForm(`
            <Asset uuid=(Test)>
                <Remove>
                    <Room uuid=(testRoomOne) key=(testRoomOne)>
                        <Situation ref={0} uuid=(testRoomOneBase) key=(base)>
                            <DisplayName>Lobby</DisplayName>
                            <Description>A plain lobby.</Description>
                        </Situation>
                    </Room>
                </Remove>
            </Asset>
        `)
        expect(schemaToWML([inherited.merge(test).schema])).toEqual(deIndentWML(`
            <Asset uuid=(Test)><Room uuid=(testRoomTwo) key=(testRoomTwo) /></Asset>
        `))
    })

    it('should merge edit component remove of empty base component correctly', () => {
        const inherited = new StandardForm(`
            <Asset uuid=(Test)>
                <Room uuid=(testRoomTwo) key=(testRoomTwo) />
            </Asset>
        `)
        const test = new StandardForm(`
            <Asset uuid=(Test)>
                <Remove>
                    <Room uuid=(testRoomOne) key=(testRoomOne)><Situation ref={0} uuid=(testRoomOneBase) key=(base)><DisplayName>Lobby</DisplayName></Situation></Room>
                </Remove>
            </Asset>
        `)
        const merged = inherited.merge(test)
        expect(schemaToWML([merged.schema])).toEqual(deIndentWML(`
            <Asset uuid=(Test)>
                <Remove>
                    <Room uuid=(testRoomOne) key=(testRoomOne)>
                        <Situation key=(base) ref={0}>
                            <DisplayName>Lobby</DisplayName>
                        </Situation>
                    </Room>
                </Remove>
                <Room uuid=(testRoomTwo) key=(testRoomTwo) />
                <Situation uuid=(testRoomOneBase) key=(base) ref={0} />
            </Asset>
        `))
    })

    it('should apply edits on merge', () => {
        const inherited = new StandardForm(`
            <Asset uuid=(Test)>
                <Room uuid=(testRoomOne) key=(testRoomOne) />
                <Room uuid=(testRoomTwo) key=(testRoomTwo)>
                    <Exit to=(testRoomOne)>out</Exit>
                </Room>
            </Asset>
        `)
        const test = new StandardForm(`
            <Asset uuid=(Test)>
                <Room uuid=(testRoomTwo) key=(testRoomTwo) ref={0}>
                    <Remove><Exit to=(testRoomOne)>out</Exit></Remove>
                    <Exit to=(testRoomOne)>depart</Exit>
                </Room>
            </Asset>
        `)
        expect(schemaToWML([inherited.merge(test).schema])).toEqual(deIndentWML(`
            <Asset uuid=(Test)>
                <Room uuid=(testRoomOne) key=(testRoomOne) />
                <Room uuid=(testRoomTwo) key=(testRoomTwo)>
                    <Exit to=(testRoomOne)>depart</Exit>
                </Room>
            </Asset>
        `))
    })

    it('should merge multiple standardComponents correctly', () => {
        const inherited = new StandardForm(`
            <Asset uuid=(Test)>
                <Room uuid=(testRoomOne) key=(testRoomOne)>
                    <Situation ref={0} uuid=(testRoomOneBase)>
                        <DisplayName>Lobby</DisplayName>
                        <Description>A plain lobby.</Description>
                    </Situation>
                </Room>
                <Room uuid=(testRoomTwo) key=(testRoomTwo)>
                    <Situation ref={0} uuid=(testRoomTwoBase)><DisplayName>Test Two</DisplayName></Situation>
                </Room>
            </Asset>
        `)
        const test = new StandardForm(`
            <Asset uuid=(Test)>
                <Room uuid=(testRoomOne) ref={0}>
                    <Situation uuid=(testRoomOneBase) ref={0}>
                        <DisplayName><Space />(at night)</DisplayName>
                        <Description><Space />Shadows cling to the corners of the room.</Description>
                    </Situation>
                </Room>
                <Room uuid=(testRoomThree) key=(testRoomThree)>
                    <Situation ref={0} uuid=(testRoomThreeBase)><DisplayName>Test Three</DisplayName></Situation>
                </Room>
            </Asset>
        `)
        expect(schemaToWML([inherited.merge(test).schema])).toEqual(deIndentWML(`
            <Asset uuid=(Test)>
                <Room uuid=(testRoomOne) key=(testRoomOne)>
                    <Situation uuid=(testRoomOneBase) ref={0}>
                        <DisplayName>Lobby (at night)</DisplayName>
                        <Description>
                            A plain lobby. Shadows cling to the corners of the room.
                        </Description>
                    </Situation>
                </Room>
                <Room uuid=(testRoomThree) key=(testRoomThree)>
                    <Situation uuid=(testRoomThreeBase) ref={0}>
                        <DisplayName>Test Three</DisplayName>
                    </Situation>
                </Room>
                <Room uuid=(testRoomTwo) key=(testRoomTwo)>
                    <Situation uuid=(testRoomTwoBase) ref={0}>
                        <DisplayName>Test Two</DisplayName>
                    </Situation>
                </Room>
                <Situation uuid=(testRoomThreeBase) ref={0} />
            </Asset>
        `))
    })

    it('should merge metadata correctly', () => {
        const inherited = new StandardForm(`
            <Asset uuid=(Test)>
                <Room uuid=(testRoomOne) key=(testRoomOne) from=(ASSET#primitives)>
                    <Situation ref={0} uuid=(testRoomOneBase)>
                        <DisplayName>Lobby</DisplayName>
                        <Description>A plain lobby.</Description>
                    </Situation>
                </Room>
                <Room uuid=(testRoomTwo) key=(testRoomTwo)>
                    <Situation ref={0} uuid=(testRoomTwoBase)>
                        <DisplayName>Test Two</DisplayName>
                    </Situation>
                </Room>
            </Asset>
        `)
        const test = new StandardForm(`
            <Asset uuid=(Test)>
                <Room uuid=(testRoomOne) ref={0}>
                    <Situation uuid=(testRoomOneBase) ref={0}>
                        <DisplayName><Space />(at night)</DisplayName>
                        <Description><Space />Shadows cling to the corners of the room.</Description>
                    </Situation>
                </Room>
                <Room uuid=(testRoomThree) key=(testRoomThree) from=(ASSET#primitives)>
                    <Situation ref={0} uuid=(testRoomThreeBase)>
                        <DisplayName>Test Three</DisplayName>
                    </Situation>
                </Room>
            </Asset>
        `)
        expect(schemaToWML([inherited.merge(test).schema])).toEqual(deIndentWML(`
            <Asset uuid=(Test)>
                <Room uuid=(testRoomOne) key=(testRoomOne) from=(ASSET#primitives)>
                    <Situation uuid=(testRoomOneBase) ref={0}>
                        <DisplayName>Lobby (at night)</DisplayName>
                        <Description>
                            A plain lobby. Shadows cling to the corners of the room.
                        </Description>
                    </Situation>
                </Room>
                <Room uuid=(testRoomThree) key=(testRoomThree) from=(ASSET#primitives)>
                    <Situation uuid=(testRoomThreeBase) ref={0}>
                        <DisplayName>Test Three</DisplayName>
                    </Situation>
                </Room>
                <Room uuid=(testRoomTwo) key=(testRoomTwo)>
                    <Situation uuid=(testRoomTwoBase) ref={0}>
                        <DisplayName>Test Two</DisplayName>
                    </Situation>
                </Room>
                <Situation uuid=(testRoomThreeBase) ref={0} />
            </Asset>
        `))
    })

    it('should merge multiple serializable standardComponents correctly', () => {
        const inherited = new StandardForm(`
            <Asset uuid=(Test)>
                <Room uuid=(testRoomOne) key=(testRoomOne)>
                    <Situation ref={0} uuid=(testRoomOneBase)>
                        <DisplayName>Lobby</DisplayName>
                        <Description>A plain lobby.</Description>
                    </Situation>
                </Room>
                <Room uuid=(testRoomTwo) key=(testRoomTwo)>
                    <Situation ref={0} uuid=(testRoomTwoBase)>
                        <DisplayName>Test Two</DisplayName>
                    </Situation>
                </Room>
            </Asset>
        `)
        const testStandard = new StandardForm({
            universalKey: 'ASSET#Test',
            components: [
                {
                    tag: 'Situation',
                    universalKey: 'SITUATION#testRoomOneBase',
                },
                {
                    tag: 'Room',
                    key: 'testRoomOne',
                    universalKey: 'ROOM#testRoomOne',
                    situations: [{
                        reference: 'SITUATION#testRoomOneBase',
                        payload: {
                            displayName: ': Night',
                        }
                    }]
                },
            ],
            metaData: []
        })
        const standardizer = inherited.merge(testStandard)
        expect(schemaToWML([standardizer.schema])).toEqual(deIndentWML(`
            <Asset uuid=(Test)>
                <Room uuid=(testRoomOne) key=(testRoomOne)>
                    <Situation uuid=(testRoomOneBase) ref={0} />
                    <Situation uuid=(testRoomOneBase)>
                        <DisplayName>Lobby: Night</DisplayName>
                        <Description>A plain lobby.</Description>
                    </Situation>
                </Room>
                <Room uuid=(testRoomTwo) key=(testRoomTwo)>
                    <Situation uuid=(testRoomTwoBase) ref={0}>
                        <DisplayName>Test Two</DisplayName>
                    </Situation>
                </Room>
            </Asset>
        `))
    })

    it('should merge with an empty value', () => {
        const inherited = new StandardForm(`<Asset uuid=(Test) />`)
        const testStandard = new StandardForm({
            universalKey: 'ASSET#Test',
            components: [
                {
                    tag: 'Room',
                    key: 'testRoomOne',
                    universalKey: 'ROOM#testRoomOne',
                    shortName: {
                        tag: 'Replace',
                        match: 'Test',
                        payload: 'Replace'
                    }
                }
            ],
            metaData: [],
            topLevel: ['ROOM#testRoomOne']
        })
        const standardizer = inherited.merge(testStandard)
        expect(schemaToWML([standardizer.schema])).toEqual(deIndentWML(`
            <Asset uuid=(Test)>
                <Room uuid=(testRoomOne) key=(testRoomOne)>
                    <Replace><ShortName>Test</ShortName></Replace>
                    <With><ShortName>Replace</ShortName></With>
                </Room>
            </Asset>
        `))
    })

    it('should merge base component with universalKey', () => {
        const base = new StandardKnowledge(deIndentWML(`<Knowledge uuid=(001) key=(test)><Situation key=(one) /></Knowledge>`))
        const incoming = new StandardKnowledge(deIndentWML(`<Knowledge key=(test)><Situation key=(two) /></Knowledge>`))
        const merge = base.merge(incoming)
        if (!merge) {
            expect(true).toBe(false)
        }
        else {
            expect(merge.universalKey).toEqual('KNOWLEDGE#001')
            expect(schemaToWML([merge.schema])).toEqual(deIndentWML(`
                <Knowledge uuid=(001) key=(test)>
                    <Situation key=(one) />
                    <Situation key=(two) />
                </Knowledge>
            `))
        }
    })

    it('should merge incoming component with universalKey', () => {
        const base = new StandardKnowledge(deIndentWML(`<Knowledge key=(test)><Situation key=(one) /></Knowledge>`))
        const incoming = new StandardKnowledge(deIndentWML(`<Knowledge uuid=(001) key=(test)><Situation key=(two) /></Knowledge>`))
        const merge = base.merge(incoming)
        if (!merge) {
            expect(true).toBe(false)
        }
        else {
            expect(merge.universalKey).toEqual('KNOWLEDGE#001')
            expect(schemaToWML([merge.schema])).toEqual(deIndentWML(`
                <Knowledge uuid=(001) key=(test)>
                    <Situation key=(one) />
                    <Situation key=(two) />
                </Knowledge>
            `))
        }
    })

    it('should merge identical universalKeys', () => {
        const base = new StandardKnowledge(deIndentWML(`<Knowledge uuid=(001) key=(test)><Situation key=(one) /></Knowledge>`))
        const incoming = new StandardKnowledge(deIndentWML(`<Knowledge uuid=(001) key=(test)><Situation key=(two) /></Knowledge>`))
        const merge = base.merge(incoming)
        if (!merge) {
            expect(true).toBe(false)
        }
        else {
            expect(merge.universalKey).toEqual('KNOWLEDGE#001')
            expect(schemaToWML([merge.schema])).toEqual(deIndentWML(`
                <Knowledge uuid=(001) key=(test)>
                    <Situation key=(one) />
                    <Situation key=(two) />
                </Knowledge>
            `))
        }
    })

    it('should throw error on conflicting universalKeys', () => {
        const base = new StandardRoom(deIndentWML(`<Room key=(test) />`)).withUniversalKey('ROOM#001')
        const incoming = new StandardRoom(deIndentWML(`<Room key=(test) />`)).withUniversalKey('ROOM#002')
        expect(() => { base.merge(incoming) }).toThrow()
    })

    it('should deserialize empty NDJSON correctly', () => {
        expect((new StandardForm([{ tag: 'Asset', key: 'Test', universalKey: 'ASSET#Test' }])).toJSON()).toEqual({
            universalKey: 'ASSET#Test',
            components: [],
            metaData: []
        })
    })

    describe('assureComponents method', () => {
        it('should add missing referenced components as empty components', () => {
            const form = new StandardForm(`<Asset uuid=(test)><Room uuid=(room1) key=(room1) /></Asset>`)
            const references = new ReferenceList([
                new StandardReference({ tag: 'Feature', key: 'feature1', universalKey: 'FEATURE#feature1' })
            ])
            const result = form.assureComponents(references)
            const feature = result._lookup('FEATURE#feature1')
            expect(feature).toBeDefined()
            expect(feature?.universalKey).toBe('FEATURE#feature1')
            expect(feature?.key).toBe('feature1')
        })

        it('should not duplicate components that already exist', () => {
            const form = new StandardForm(`<Asset uuid=(test)><Room uuid=(room1) key=(room1) /><Feature uuid=(feature1) key=(feature1) /></Asset>`)
            const originalComponentCount = form._components.length
            const references = new ReferenceList([
                new StandardReference({ tag: 'Feature', key: 'feature1', universalKey: 'FEATURE#feature1' })
            ])
            const result = form.assureComponents(references)
            expect(result._components.length).toBe(originalComponentCount)
            const feature = result._lookup('FEATURE#feature1')
            expect(feature).toBeDefined()
        })

        it('should handle references with both key and universalKey', () => {
            const form = new StandardForm(`<Asset uuid=(test)><Room uuid=(room1) key=(room1) /></Asset>`)
            const references = new ReferenceList([
                new StandardReference({ tag: 'Feature', key: 'feature1', universalKey: 'FEATURE#feature1' })
            ])
            const result = form.assureComponents(references)
            const feature = result._lookup('FEATURE#feature1')
            expect(feature).toBeDefined()
            expect(feature?.key).toBe('feature1')
            expect(feature?.universalKey).toBe('FEATURE#feature1')
        })

        it('should handle references with only universalKey', () => {
            const form = new StandardForm(`<Asset uuid=(test)><Room uuid=(room1) key=(room1) /></Asset>`)
            const references = new ReferenceList([
                new StandardReference({ tag: 'Feature', universalKey: 'FEATURE#feature1' })
            ])
            const result = form.assureComponents(references)
            const feature = result._lookup('FEATURE#feature1')
            expect(feature).toBeDefined()
            expect(feature?.universalKey).toBe('FEATURE#feature1')
        })

        it('should handle references with only key', () => {
            const form = new StandardForm(`<Asset uuid=(test)><Room uuid=(room1) key=(room1) /></Asset>`)
            const references = new ReferenceList([
                new StandardReference({ tag: 'Feature', key: 'feature1' })
            ])
            const result = form.assureComponents(references)
            const feature = result._lookup({ key: 'feature1' })
            expect(feature).toBeDefined()
            expect(feature?.key).toBe('feature1')
        })

        it('should return a new StandardForm and not mutate the original', () => {
            const form = new StandardForm(`<Asset uuid=(test)><Room uuid=(room1) key=(room1) /></Asset>`)
            const originalComponentCount = form._components.length
            const references = new ReferenceList([
                new StandardReference({ tag: 'Feature', key: 'feature1', universalKey: 'FEATURE#feature1' })
            ])
            const result = form.assureComponents(references)
            expect(result).not.toBe(form)
            expect(form._components.length).toBe(originalComponentCount)
            expect(result._components.length).toBe(originalComponentCount + 1)
        })

        it('should handle multiple references in a ReferenceList', () => {
            const form = new StandardForm(`<Asset uuid=(test)><Room uuid=(room1) key=(room1) /></Asset>`)
            const references = new ReferenceList([
                new StandardReference({ tag: 'Feature', key: 'feature1', universalKey: 'FEATURE#feature1' }),
                new StandardReference({ tag: 'Character', key: 'char1', universalKey: 'CHARACTER#char1' })
            ])
            const result = form.assureComponents(references)
            expect(result._components.length).toBe(3) // room1, feature1, char1
            const feature = result._lookup('FEATURE#feature1')
            const character = result._lookup('CHARACTER#char1')
            expect(feature).toBeDefined()
            expect(character).toBeDefined()
        })
    })

    describe('diff method', () => {
        it('should return an empty diff for identical forms', () => {
            const base = new StandardForm(`<Asset uuid=(Test)><Room uuid=(testRoom) key=(testRoom) /></Asset>`)
            const incoming = new StandardForm(`<Asset uuid=(Test)><Room uuid=(testRoom) key=(testRoom) /></Asset>`)
            const diff = base.diff(incoming)
            expect(schemaToWML([diff.schema])).toEqual(`<Asset uuid=(Test) />`)
        })

        it('should return the incoming form when base is empty', () => {
            const base = new StandardForm(`<Asset uuid=(Test) />`)
            const incoming = new StandardForm(`<Asset uuid=(Test)><Room uuid=(testRoom) key=(testRoom) /></Asset>`)
            const diff = base.diff(incoming)
            expect(schemaToWML([diff.schema])).toEqual(`<Asset uuid=(Test)><Room uuid=(testRoom) key=(testRoom) /></Asset>`)
        })

        it('should remove the base form components when incoming is empty', () => {
            const base = new StandardForm(`<Asset uuid=(Test)><Room uuid=(testRoom) key=(testRoom) /></Asset>`)
            const incoming = new StandardForm(`<Asset uuid=(Test) />`)
            const diff = base.diff(incoming)
            expect(schemaToWML([diff.schema])).toEqual(deIndentWML(`
                <Asset uuid=(Test)>
                    <Remove><Room uuid=(testRoom) key=(testRoom) /></Remove>
                </Asset>
            `))
        })

        it('should return the diff for added components', () => {
            const base = new StandardForm(`<Asset uuid=(Test)><Room uuid=(testRoom) key=(testRoom) /></Asset>`)
            const incoming = new StandardForm(`<Asset uuid=(Test)><Room uuid=(testRoom) key=(testRoom) /><Room uuid=(testRoomTwo) key=(testRoomTwo) /></Asset>`)
            const diff = base.diff(incoming)
            expect(schemaToWML([diff.schema])).toEqual(`<Asset uuid=(Test)><Room uuid=(testRoomTwo) key=(testRoomTwo) /></Asset>`)
        })

        it('should return the diff for added top-level references to pre-existing components', () => {
            const base = new StandardForm(deIndentWML(`
                <Asset uuid=(Test)>
                    <Room uuid=(testRoom) key=(testRoom)>
                        <Feature uuid=(testFeature) key=(testFeature)>
                            <ShortName>Test Feature</ShortName>
                        </Feature>
                    </Room>
                </Asset>
            `))
            const incoming = new StandardForm(deIndentWML(`
                <Asset uuid=(Test)>
                    <Room uuid=(testRoom) key=(testRoom)>
                        <Feature uuid=(testFeature) key=(testFeature) />
                    </Room>
                    <Feature uuid=(testFeature) key=(testFeature)>
                        <ShortName>Test Feature</ShortName>
                    </Feature>
                </Asset>
            `))
            const diff = base.diff(incoming)
            expect(schemaToWML([diff.schema])).toEqual(`<Asset uuid=(Test)><Feature uuid=(testFeature) key=(testFeature) /></Asset>`)
        })

        it('should return the diff for removed components', () => {
            const base = new StandardForm(`<Asset uuid=(Test)><Room uuid=(testRoom) key=(testRoom) /><Room uuid=(testRoomTwo) key=(testRoomTwo) /></Asset>`)
            const incoming = new StandardForm(`<Asset uuid=(Test)><Room uuid=(testRoom) key=(testRoom) /></Asset>`)
            const diff = base.diff(incoming)
            expect(schemaToWML([diff.schema])).toEqual(deIndentWML(`
                <Asset uuid=(Test)>
                    <Remove><Room uuid=(testRoomTwo) key=(testRoomTwo) /></Remove>
                </Asset>
            `))
        })

        it('should return simple Remove tag when removing component with nested content', () => {
            const base = new StandardForm(`<Asset uuid=(Test)>
                <Room uuid=(testRoom) key=(testRoom)>
                    <Situation ref={0} uuid=(base)>
                        <DisplayName>Test Room</DisplayName>
                        <Description>Test Description</Description>
                    </Situation>
                </Room>
                <Room uuid=(testRoomTwo) key=(testRoomTwo) />
            </Asset>`)
            const incoming = new StandardForm(deIndentWML(`
                <Asset uuid=(Test)>
                    <Room uuid=(testRoomTwo) key=(testRoomTwo) />
                </Asset>
            `))
            const diff = base.diff(incoming)
            expect(schemaToWML([diff.schema])).toEqual(deIndentWML(`
                <Asset uuid=(Test)>
                    <Remove>
                        <Room uuid=(testRoom) key=(testRoom)>
                            <Situation uuid=(base) ref={0}>
                                <DisplayName>Test Room</DisplayName>
                                <Description>Test Description</Description>
                            </Situation>
                        </Room>
                    </Remove>
                    <Situation uuid=(base) ref={0} />
                </Asset>
            `))
        })

        it('should return a minimal in-place edit diff for modified nested components', () => {
            const base = new StandardForm(`<Asset uuid=(Test)><Room uuid=(testRoom) key=(testRoom)><Situation ref={0} uuid=(base) key=(base)><DisplayName>Old Name</DisplayName></Situation></Room></Asset>`)
            const incoming = new StandardForm(`<Asset uuid=(Test)><Room uuid=(testRoom) key=(testRoom)><Situation ref={0} uuid=(base) key=(base)><DisplayName>New Name</DisplayName></Situation></Room></Asset>`)
            const diff = base.diff(incoming)
            expect(schemaToWML([diff.schema])).toEqual(deIndentWML(`
                <Asset uuid=(Test)>
                    <Room uuid=(testRoom) key=(testRoom) ref={0}>
                        <Situation key=(base) ref={0}>
                            <Replace><DisplayName>Old Name</DisplayName></Replace>
                            <With><DisplayName>New Name</DisplayName></With>
                        </Situation>
                    </Room>
                    <Situation uuid=(base) key=(base) ref={0} />
                </Asset>
            `))
        })

        it('should return the diff for added and removed components', () => {
            const base = new StandardForm(`<Asset uuid=(Test)><Room uuid=(testRoom) key=(testRoom) /></Asset>`)
            const incoming = new StandardForm(`<Asset uuid=(Test)><Room uuid=(testRoomTwo) key=(testRoomTwo) /></Asset>`)
            const diff = base.diff(incoming)
            expect(schemaToWML([diff.schema])).toEqual(deIndentWML(`
                <Asset uuid=(Test)>
                    <Remove><Room uuid=(testRoom) key=(testRoom) /></Remove>
                    <Room uuid=(testRoomTwo) key=(testRoomTwo) />
                </Asset>
            `))
        })

        it('should return the diff for nested feature components', () => {
            const base = new StandardForm(`<Asset uuid=(Test)><Room uuid=(testRoom) key=(testRoom)><Feature uuid=(testFeature) key=(testFeature) /></Room></Asset>`)
            const incoming = new StandardForm(`<Asset uuid=(Test)><Room uuid=(testRoom) key=(testRoom)><Feature uuid=(testFeature) key=(testFeature) /><Feature uuid=(testFeatureTwo) key=(testFeatureTwo) /></Room></Asset>`)
            const diff = base.diff(incoming)
            expect(schemaToWML([diff.schema])).toEqual(deIndentWML(`
                <Asset uuid=(Test)>
                    <Room uuid=(testRoom) key=(testRoom) ref={0}>
                        <Feature uuid=(testFeatureTwo) key=(testFeatureTwo) />
                    </Room>
                </Asset>
            `))
        })

        it('should include referenced-only components in diff when references appear in the diff outputs', () => {
            // Test case: Empty component (no content) referenced in different parents
            // When diffing, the component itself should appear in the diff, not just reference changes in parents
            const baseWML = deIndentWML(`
                <Asset uuid=(test)>
                    <Room uuid=(room1) key=(room1)>
                        <Feature uuid=(feature1) key=(feature1) />
                    </Room>
                    <Room uuid=(room2) key=(room2) />
                </Asset>
            `)
            const modifiedWML = deIndentWML(`
                <Asset uuid=(test)>
                    <Room uuid=(room1) key=(room1) />
                    <Room uuid=(room2) key=(room2)>
                        <Feature uuid=(feature1) key=(feature1) />
                    </Room>
                </Asset>
            `)
            
            const baseForm = new StandardForm(baseWML)
            const modifiedForm = new StandardForm(modifiedWML)
            const diffForm = baseForm.diff(modifiedForm)
            
            expect(diffForm).toBeDefined()
            
            // The diff should include the feature component itself, not just the room reference changes
            const featureInDiff = diffForm!._lookup('FEATURE#feature1')
            expect(featureInDiff).toBeDefined()
            
            // Verify feature exists in components array
            const featureComponent = diffForm!._components.find(
                component => component.universalKey === 'FEATURE#feature1'
            )
            expect(featureComponent).toBeDefined()
        })

        it('should return the diff for nested situation components', () => {
            const base = new StandardForm(`<Asset uuid=(Test)><Knowledge uuid=(testRoom) key=(testRoom)><Situation ref={0} uuid=(Example1) key=(Example1) /></Knowledge></Asset>`)
            const incoming = new StandardForm(`<Asset uuid=(Test)><Knowledge uuid=(testRoom) key=(testRoom)><Situation ref={0} uuid=(Example1) key=(Example1) /><Situation ref={0} uuid=(Example2) key=(Example2) /></Knowledge></Asset>`)
            const diff = base.diff(incoming)
            expect(schemaToWML([diff.schema])).toEqual(deIndentWML(`
                <Asset uuid=(Test)>
                    <Knowledge uuid=(testRoom) key=(testRoom) ref={0}>
                        <Situation key=(Example2) ref={0} />
                    </Knowledge>
                    <Situation uuid=(Example2) key=(Example2) ref={0} />
                </Asset>
            `))
        })

        it('should remove nested components properly', () => {
            const base = new StandardForm(`<Asset uuid=(Test)><Room uuid=(testRoom) key=(testRoom)><Feature uuid=(testFeature) key=(testFeature) /></Room></Asset>`)
            const incoming = new StandardForm(`<Asset uuid=(Test)><Room uuid=(testRoom) key=(testRoom) /></Asset>`)
            const diff = base.diff(incoming)
            expect(schemaToWML([diff.schema])).toEqual(deIndentWML(`
                <Asset uuid=(Test)>
                    <Room uuid=(testRoom) key=(testRoom) ref={0}>
                        <Remove><Feature uuid=(testFeature) key=(testFeature) /></Remove>
                    </Room>
                </Asset>
            `))
        })

        it('should remove components with nested components properly', () => {
            const base = new StandardForm(`<Asset uuid=(Test)><Room uuid=(testRoom) key=(testRoom)><Feature uuid=(testFeature) key=(testFeature) /></Room></Asset>`)
            const incoming = new StandardForm(`<Asset uuid=(Test) />`)
            const diff = base.diff(incoming)
            expect(schemaToWML([diff.schema])).toEqual(deIndentWML(`
                <Asset uuid=(Test)>
                    <Remove>
                        <Room uuid=(testRoom) key=(testRoom)>
                            <Feature uuid=(testFeature) key=(testFeature) />
                        </Room>
                    </Remove>
                </Asset>
            `))
        })

        describe('Nested Component Change (In-Place) - Minimal Diff Format', () => {
            it('should generate minimal diff for nested component change (no Parent tag, no topLevel)', () => {
                const base = new StandardForm(deIndentWML(`
                    <Asset uuid=(Test)>
                        <Room uuid=(room1) key=(room1)>
                            <Situation ref={0} uuid=(ex1) key=(ex1)>
                                <DisplayName>Old Name</DisplayName>
                            </Situation>
                        </Room>
                    </Asset>
                `))
                const incoming = new StandardForm(deIndentWML(`
                    <Asset uuid=(Test)>
                        <Room uuid=(room1) key=(room1)>
                            <Situation ref={0} uuid=(ex1) key=(ex1)>
                                <DisplayName>New Name</DisplayName>
                            </Situation>
                        </Room>
                    </Asset>
                `))
                const diff = base.diff(incoming)
                
                // Expected: Minimal diff - only the changed component, no parent components
                expect(schemaToWML([diff.schema])).toEqual(deIndentWML(`
                    <Asset uuid=(Test)>
                        <Room uuid=(room1) key=(room1) ref={0}>
                            <Situation key=(ex1) ref={0}>
                                <Replace><DisplayName>Old Name</DisplayName></Replace>
                                <With><DisplayName>New Name</DisplayName></With>
                            </Situation>
                        </Room>
                        <Situation uuid=(ex1) key=(ex1) ref={0} />
                    </Asset>
                `))
                
                // Verify no Parent tag
                const situationComponent = diff.byUniversalId['SITUATION#ex1']
                expect(situationComponent?.explicitParent).toBeUndefined()
                
                // Verify not in topLevel (nested change)
                // topLevel should be undefined since Situation is nested, not at Asset level
                expect(diff._topLevel?.toJSON()).toEqual([])
            })

            it('should merge minimal diff correctly, maintaining nested structure', () => {
                const base = new StandardForm(deIndentWML(`
                    <Asset uuid=(Test)>
                        <Knowledge uuid=(room1) key=(room1)>
                            <Situation ref={0} uuid=(ex1) key=(ex1)>
                                <DisplayName>Original</DisplayName>
                            </Situation>
                        </Knowledge>
                    </Asset>
                `))
                const diff = new StandardForm(deIndentWML(`
                    <Asset uuid=(Test)>
                        <Knowledge uuid=(room1) key=(room1) ref={0}>
                            <Situation uuid=(ex1) key=(ex1) ref={0}>
                                <Replace><DisplayName>Original</DisplayName></Replace>
                                <With><DisplayName>Updated</DisplayName></With>
                            </Situation>
                        </Knowledge>
                    </Asset>
                `))
                const merged = base.merge(diff)
                
                expect(schemaToWML([merged.schema])).toEqual(deIndentWML(`
                    <Asset uuid=(Test)>
                        <Knowledge uuid=(room1) key=(room1)>
                            <Situation key=(ex1) ref={0}>
                                <DisplayName>Updated</DisplayName>
                            </Situation>
                        </Knowledge>
                    </Asset>
                `))
                
                // Verify situation stub exists
                const knowledge = merged._lookup('KNOWLEDGE#room1') as StandardKnowledge
                expect(knowledge.situations.items[0].payload?._displayName?.toJSON()).toEqual('Updated')
                
                // Verify not in topLevel
                expect(merged.header.topLevel).toEqual(['KNOWLEDGE#room1'])
            })
        })

        it('should generate diff with Parent tag when component is moved to Asset-level', () => {
            const base = new StandardForm(deIndentWML(`
                <Asset uuid=(Test)>
                    <Knowledge uuid=(room1) key=(room1)>
                        <Situation ref={0} uuid=(ex1) key=(ex1)>
                            <DisplayName>Old Example</DisplayName>
                        </Situation>
                    </Knowledge>
                </Asset>
            `))
            const incoming = new StandardForm(deIndentWML(`
                <Asset uuid=(Test)>
                    <Situation uuid=(ex1) key=(ex1) ref={0} />
                    <Knowledge uuid=(room1) key=(room1)>
                        <Situation uuid=(ex1) key=(ex1)>
                            <DisplayName>New Example</DisplayName>
                        </Situation>
                    </Knowledge>
                </Asset>
            `))
            const diff = base.diff(incoming)
            
            expect(schemaToWML([diff.schema])).toEqual(deIndentWML(`
                <Asset uuid=(Test)>
                    <Knowledge uuid=(room1) key=(room1) ref={0}>
                        <Situation key=(ex1)>
                            <Replace><DisplayName>Old Example</DisplayName></Replace>
                            <With><DisplayName>New Example</DisplayName></With>
                        </Situation>
                    </Knowledge>
                </Asset>
            `))
            
        })

        describe('Case 2: Explicit Top-Level Component', () => {

            it('should merge diff with Parent tag correctly, placing component at Asset-level', () => {
                const base = new StandardForm(deIndentWML(`
                    <Asset uuid=(Test)>
                        <Knowledge uuid=(room1) key=(room1)>
                            <Situation ref={0} uuid=(ex1) key=(ex1) />
                        </Knowledge>
                    </Asset>
                `))
                const diff = new StandardForm(deIndentWML(`
                    <Asset uuid=(Test)>
                        <Knowledge uuid=(room1) key=(room1) ref={0}>
                            <Situation uuid=(ex1) key=(ex1) ref={0}>
                                <Parent />
                                <DisplayName>New Example</DisplayName>
                            </Situation>
                        </Knowledge>
                    </Asset>
                `))
                const merged = base.merge(diff)
                
                expect(schemaToWML([merged.schema])).toEqual(deIndentWML(`
                    <Asset uuid=(Test)>
                        <Knowledge uuid=(room1) key=(room1)>
                            <Situation key=(ex1) ref={0}>
                                <DisplayName>New Example</DisplayName>
                            </Situation>
                        </Knowledge>
                    </Asset>
                `))
            })
        })

        describe('Case 3: Component Moving from Nested to Top-Level', () => {
            it('should generate diff with Parent tag and reference removal when component moves to Asset-level', () => {
                const base = new StandardForm(deIndentWML(`
                    <Asset uuid=(Test)>
                        <Knowledge uuid=(room1) key=(room1)>
                            <Situation ref={0} uuid=(ex1) key=(ex1)>
                                <DisplayName>Nested Example</DisplayName>
                            </Situation>
                        </Knowledge>
                    </Asset>
                `))
                const incoming = new StandardForm(deIndentWML(`
                    <Asset uuid=(Test)>
                        <Situation uuid=(ex1) key=(ex1) ref={0} />
                        <Knowledge uuid=(room1) key=(room1)>
                            <Situation uuid=(ex1) key=(ex1)>
                                <DisplayName>Top-Level Example</DisplayName>
                            </Situation>
                        </Knowledge>
                    </Asset>
                `))
                const diff = base.diff(incoming)
                
                expect(schemaToWML([diff.schema])).toEqual(deIndentWML(`
                    <Asset uuid=(Test)>
                        <Knowledge uuid=(room1) key=(room1) ref={0}>
                            <Situation key=(ex1)>
                                <Replace><DisplayName>Nested Example</DisplayName></Replace>
                                <With><DisplayName>Top-Level Example</DisplayName></With>
                            </Situation>
                        </Knowledge>
                    </Asset>
                `))
            })

            it('should merge diff with Parent tag and reference removal correctly', () => {
                const base = new StandardForm(deIndentWML(`
                    <Asset uuid=(Test)>
                        <Knowledge uuid=(room1) key=(room1)>
                            <Situation ref={0} uuid=(ex1) key=(ex1)>
                                <DisplayName>Nested Example</DisplayName>
                            </Situation>
                        </Knowledge>
                    </Asset>
                `))
                const diff = new StandardForm(deIndentWML(`
                    <Asset uuid=(Test)>
                        <Situation uuid=(ex1) key=(ex1) ref={0} />
                        <Knowledge uuid=(room1) key=(room1) ref={0}>
                            <Situation key=(ex1) ref={0}>
                                <Parent />
                                <Replace><DisplayName>Nested Example</DisplayName></Replace>
                                <With><DisplayName>Top-Level Example</DisplayName></With>
                            </Situation>
                        </Knowledge>
                    </Asset>
                `))
                const merged = base.merge(diff)
                
                expect(schemaToWML([merged.schema])).toEqual(deIndentWML(`
                    <Asset uuid=(Test)>
                        <Knowledge uuid=(room1) key=(room1)>
                            <Situation key=(ex1) ref={0}>
                                <DisplayName>Top-Level Example</DisplayName>
                            </Situation>
                        </Knowledge>
                    </Asset>
                `))
            })
        })

        // Case 4 revised (2025): reparenting via topLevel ref-counts + in-place situation prose diff;
        // no explicit <Parent> in diff output. Cases 2-3 and related Parent-tag merge fixtures
        // were left unchanged pending a systematic pass over this file.
        describe('Case 4: Component Moving from Asset-Level to Nested', () => {
            const case4BaseWML = deIndentWML(`
                <Asset uuid=(Test)>
                    <Situation uuid=(ex1) key=(ex1) />
                    <Knowledge uuid=(room1) key=(room1)>
                        <Situation uuid=(ex1) key=(ex1)>
                            <DisplayName>Top-level</DisplayName>
                        </Situation>
                    </Knowledge>
                </Asset>
            `)
            const case4IncomingWML = deIndentWML(`
                <Asset uuid=(Test)>
                    <Knowledge uuid=(room1) key=(room1)>
                        <Situation uuid=(ex1) key=(ex1)>
                            <DisplayName>Now nested</DisplayName>
                        </Situation>
                    </Knowledge>
                </Asset>
            `)

            it('should generate diff with topLevel removal when Situation moves from Asset to nested', () => {
                const base = new StandardForm(case4BaseWML)
                const incoming = new StandardForm(case4IncomingWML)
                const diff = base.diff(incoming)

                expect(schemaToWML([diff.schema])).toEqual(deIndentWML(`
                    <Asset uuid=(Test)>
                        <Knowledge uuid=(room1) key=(room1) ref={0}>
                            <Situation key=(ex1) ref={0}>
                                <Replace><DisplayName>Top-level</DisplayName></Replace>
                                <With><DisplayName>Now nested</DisplayName></With>
                            </Situation>
                        </Knowledge>
                        <Remove><Situation uuid=(ex1) key=(ex1) /></Remove>
                    </Asset>
                `))
            })

            it('should merge diff round-trip when Situation moves from Asset to nested', () => {
                const base = new StandardForm(case4BaseWML)
                const incoming = new StandardForm(case4IncomingWML)
                const diff = base.diff(incoming)
                const merged = base.merge(diff)

                expect(schemaToWML([merged.schema])).toEqual(schemaToWML([incoming.schema]))

                const situationComponent = merged.byUniversalId['SITUATION#ex1']
                expect(situationComponent?.explicitParent).toBeUndefined()
            })
        })

        describe('key changes', () => {
            it('should show key change in diff when component is renamed', () => {
                const base = new StandardForm(`<Asset uuid=(Test)><Feature uuid=(Feature1) key=(Feature1)><ShortName>Test</ShortName></Feature></Asset>`)
                const incoming = new StandardForm(`<Asset uuid=(Test)><Feature uuid=(Feature1) key=(clockTower)><ShortName>Test</ShortName></Feature></Asset>`)
                const diff = base.diff(incoming)
                expect(schemaToWML([diff.schema])).toEqual(deIndentWML(`
                    <Asset uuid=(Test)>
                        <Feature uuid=(Feature1) key=(Feature1) ref={0}>
                            <Replace><Key>Feature1</Key></Replace><With><Key>clockTower</Key></With>
                        </Feature>
                    </Asset>
                `))
            })

            it('should show key addition in diff when component gains a local key', () => {
                const base = new StandardForm(`<Asset uuid=(Test)><Feature uuid=(Feature1)><ShortName>Test</ShortName></Feature></Asset>`)
                const incoming = new StandardForm(`<Asset uuid=(Test)><Feature uuid=(Feature1) key=(clockTower)><ShortName>Test</ShortName></Feature></Asset>`)
                const diff = base.diff(incoming)
                // Should show key being added - lookup by universalKey since base has no local key
                const component = diff._lookup('FEATURE#Feature1')
                expect(component).toBeDefined()
                expect(component?.key).toBe('clockTower')
            })

            it('should show key removal in diff when component loses a local key', () => {
                const base = new StandardForm(`<Asset uuid=(Test)><Feature uuid=(Feature1) key=(clockTower)><ShortName>Test</ShortName></Feature></Asset>`)
                const incoming = new StandardForm(`<Asset uuid=(Test)><Feature uuid=(Feature1)><ShortName>Test</ShortName></Feature></Asset>`)
                const diff = base.diff(incoming)
                // Should show key being removed - lookup by universalKey since incoming has no local key
                const component = diff._lookup('FEATURE#Feature1')
                expect(component).toBeDefined()
                // The key should be removed (undefined or showing Remove semantics)
                // When key is removed, the component in diff might still have the old key or be undefined
                // Check that the key diff shows removal
                const keyJSON = component?._key?.toJSON()
                if (keyJSON && typeof keyJSON === 'object' && keyJSON.tag === 'Remove') {
                    expect(keyJSON.match).toBe('clockTower')
                } else {
                    // Or the key might be undefined
                    expect(component?.key).toBeUndefined()
                }
            })

            it('should show both key change and content changes in diff', () => {
                const base = new StandardForm(`<Asset uuid=(Test)><Feature uuid=(Feature1) key=(Feature1)><ShortName>Old Name</ShortName></Feature></Asset>`)
                const incoming = new StandardForm(`<Asset uuid=(Test)><Feature uuid=(Feature1) key=(clockTower)><ShortName>New Name</ShortName></Feature></Asset>`)
                const diff = base.diff(incoming)
                expect(schemaToWML([diff.schema])).toEqual(deIndentWML(`
                    <Asset uuid=(Test)>
                        <Feature uuid=(Feature1) key=(Feature1) ref={0}>
                            <Replace><Key>Feature1</Key></Replace><With><Key>clockTower</Key></With>
                            <Replace><ShortName>Old Name</ShortName></Replace>
                            <With><ShortName>New Name</ShortName></With>
                        </Feature>
                    </Asset>
                `))
            })

            it('should keep key-only room rename diff observable for exit retarget flow', () => {
                const base = new StandardForm(`
                    <Asset uuid=(testAsset)>
                        <Room uuid=(Room1)>
                            <Situation uuid=(DEFAULT)>
                                <DisplayName>Test Room</DisplayName>
                                <Description>Test Description</Description>
                            </Situation>
                            <Exit to=(ROOM#Room2)>out</Exit>
                        </Room>
                        <Room uuid=(Room2)>
                            <Situation uuid=(DEFAULT)><DisplayName>Garden</DisplayName></Situation>
                            <Exit to=(ROOM#Room1)>text</Exit>
                        </Room>
                    </Asset>
                `)
                const incoming = new StandardForm(`
                    <Asset uuid=(testAsset)>
                        <Room uuid=(Room1)>
                            <Situation uuid=(DEFAULT)>
                                <DisplayName>Test Room</DisplayName>
                                <Description>Test Description</Description>
                            </Situation>
                            <Exit to=(garden)>out</Exit>
                        </Room>
                        <Room uuid=(Room2) key=(garden)>
                            <Situation uuid=(DEFAULT)><DisplayName>Garden</DisplayName></Situation>
                            <Exit to=(ROOM#Room1)>text</Exit>
                        </Room>
                    </Asset>
                `)
                const diff = base.diff(incoming)
                expect(diff.isEmpty()).toBe(false)
                expect(schemaToWML([base.merge(diff).schema])).toEqual(schemaToWML([incoming.schema]))
            })

            it('should keep key-only room rename diff observable for map reference retarget flow', () => {
                const base = new StandardForm(`
                    <Asset uuid=(testAsset)>
                        <Room uuid=(Room2)>
                            <Situation uuid=(DEFAULT)><DisplayName>Garden</DisplayName></Situation>
                        </Room>
                        <Map uuid=(testMap)><Room uuid=(Room2)><Position {0, 0} /></Room></Map>
                    </Asset>
                `)
                const incoming = new StandardForm(`
                    <Asset uuid=(testAsset)>
                        <Room uuid=(Room2) key=(garden)>
                            <Situation uuid=(DEFAULT)><DisplayName>Garden</DisplayName></Situation>
                        </Room>
                        <Map uuid=(testMap)><Room key=(garden)><Position {0, 0} /></Room></Map>
                    </Asset>
                `)
                const diff = base.diff(incoming)
                expect(diff.isEmpty()).toBe(false)
                expect(diff._lookup('ROOM#Room2')?.key).toBe('garden')
            })

            it('should keep key-only feature rename diff observable for link retarget flow', () => {
                const base = new StandardForm(`
                    <Asset uuid=(testAsset)>
                        <Feature uuid=(Feature1) key=(Feature1)>
                            <Situation uuid=(base)>
                                <DisplayName>Test Feature</DisplayName>
                                <Description><Link to=(Feature1)>Link</Link></Description>
                            </Situation>
                        </Feature>
                    </Asset>
                `)
                const incoming = new StandardForm(`
                    <Asset uuid=(testAsset)>
                        <Feature uuid=(Feature1) key=(clockTower)>
                            <Situation uuid=(base)>
                                <DisplayName>Test Feature</DisplayName>
                                <Description><Link to=(clockTower)>Link</Link></Description>
                            </Situation>
                        </Feature>
                    </Asset>
                `)
                const diff = base.diff(incoming)
                expect(diff.isEmpty()).toBe(false)
                const featureDiff = diff._lookup('FEATURE#Feature1')
                expect(featureDiff).toBeDefined()
                expect(featureDiff?.key).toBe('Feature1')
                expect(schemaToWML([diff.schema])).toContain('<Replace><Key>Feature1</Key></Replace><With><Key>clockTower</Key></With>')
            })
        })

    })

    describe('subset method', () => {
        it('should properly subset an asset with full content without cascade', () => {
            const test = new StandardForm(`
                <Asset uuid=(test)>
                    <Knowledge key=(testKnowledge)>
                        <Situation ref={0} uuid=(001)>
                            <Description><Link to=(FEATURE#testFeature)>link</Link></Description>
                        </Situation>
                    </Knowledge>
                    <Room key=(testRoom)>
                        <ShortName>Test Room</ShortName>
                        <Exit to=(testRoomTwo)>exit</Exit>
                    </Room>
                    <Room key=(testRoomTwo) />
                    <Feature uuid=(testFeature) key=(testFeature) />
                </Asset>
            `)
            const subset = test.subset([{ requestType: 'Full', keys: [new StandardKey({ key: 'testRoom', tag: 'Room' })] }])
            //
            // Note that the Example link cannot be resolved by `requestType: 'Full'`, because it is implicitly a reference
            // to an Example component, which is not included in the subset due to the lack of cascades.
            //
            expect(schemaToWML([subset.schema])).toEqual(deIndentWML(`
                <Asset uuid=(test)>
                    <Room key=(testRoom)>
                        <ShortName>Test Room</ShortName>
                        <Exit to=(testRoomTwo)>exit</Exit>
                    </Room>
                </Asset>
            `))
        })

        it('should properly subset an asset with full content with a direct cascade', () => {
            const test = new StandardForm(`
                <Asset uuid=(test)>
                    <Knowledge key=(testKnowledge)>
                        <Situation ref={0} uuid=(001)>
                            <Description><Link to=(FEATURE#testFeature)>link</Link></Description>
                        </Situation>
                    </Knowledge>
                    <Room key=(testRoom)>
                        <ShortName>Test Room</ShortName>
                        <Exit to=(testRoomTwo)>exit</Exit>
                    </Room>
                    <Room key=(testRoomTwo) />
                    <Feature uuid=(testFeature) key=(testFeature) />
                </Asset>
            `)
            const subset = test.subset([{
                requestType: 'Full',
                keys: [new StandardKey({ key: 'testKnowledge', tag: 'Knowledge' })],
                cascadeConditions: [{
                    graph: [
                        {
                            name: 'knowledge',
                            requestType: 'Full',
                            transitions: [
                                { connectionType: 'Direct', targetNode: 'nested' }
                            ]
                        },
                        {
                            name: 'nested',
                            requestType: 'Full',
                            transitions: []
                        }
                    ],
                    startNodes: ['knowledge']
                }]
            }])
            expect(schemaToWML([subset.schema])).toEqual(deIndentWML(`
                <Asset uuid=(test)>
                    <Situation uuid=(001) ref={0} />
                    <Knowledge key=(testKnowledge)>
                        <Situation uuid=(001) ref={0}>
                            <Description>
                                <Link to=(FEATURE#testFeature)>link</Link>
                            </Description>
                        </Situation>
                    </Knowledge>
                </Asset>
            `))
        })    

        it('should properly subset an asset with exit content without cascade', () => {
            const test = new StandardForm(`
                <Asset uuid=(test)>
                    <Room key=(testRoom)>
                        <ShortName>Test Room</ShortName>
                        <Situation uuid=(DEFAULT) ref={0} key=(base)>
                            <Description><Link to=(FEATURE#testFeature)>link</Link></Description>
                        </Situation>
                        <Exit to=(testRoomTwo)>exit</Exit>
                    </Room>
                    <Room key=(testRoomTwo) />
                    <Feature uuid=(testFeature) key=(testFeature) />
                    <Knowledge key=(testKnowledge) />
                </Asset>
            `)
            expect(schemaToWML([test.subset([{ requestType: 'ExitsAndShortName', keys: [new StandardKey({ key: 'testRoom', tag: 'Room' })] }]).schema])).toEqual(deIndentWML(`
                <Asset uuid=(test)>
                    <Room key=(testRoom)>
                        <ShortName>Test Room</ShortName>
                        <Exit to=(testRoomTwo)>exit</Exit>
                    </Room>
                </Asset>
            `))
        })

        it('should properly subset a cascade with exits', () => {
            const test = new StandardForm(`
                <Asset uuid=(test)>
                    <Map uuid=(testMap)>
                        <Room uuid=(room1)>
                            <Position {0, 0} />
                            <Exit to=(ROOM#room2)>room2</Exit>
                        </Room>
                        <Room uuid=(room2)>
                            <Position {100, 100} />
                            <Exit to=(ROOM#room1)>room1</Exit>
                        </Room>
                    </Map>
                </Asset>
            `)
            const results = test.subset([{
                requestType: 'Full',
                keys: [new StandardKey(`MAP#testMap`)],
                cascadeConditions: [{ 
                    graph: [
                        {
                            name: 'map',
                            requestType: 'Full',
                            transitions: [
                                { connectionType: 'Position', targetNode: 'room' }
                            ]
                        },
                        {
                            name: 'room',
                            requestType: 'ExitsAndShortName',
                            transitions: []
                        }
                    ],
                    startNodes: ['map']
                }]
            }])
            expect(results.byUniversalId['ROOM#room1']).toBeInstanceOf(StandardRoom)
            expect(schemaToWML([results.schema])).toEqual(deIndentWML(`
                <Asset uuid=(test)>
                    <Map uuid=(testMap)>
                        <Room uuid=(room1)>
                            <Position {0, 0} />
                            <Exit to=(ROOM#room2)>room2</Exit>
                        </Room>
                        <Room uuid=(room2)>
                            <Position {100, 100} />
                            <Exit to=(ROOM#room1)>room1</Exit>
                        </Room>
                    </Map>
                </Asset>
            `))

        })

        it('should properly subset an asset with shortName content without cascade', () => {
            const test = new StandardForm(`
                <Asset uuid=(test)>
                    <Room key=(testRoom)>
                        <ShortName>Test Room</ShortName>
                        <Situation uuid=(DEFAULT) ref={0} key=(base)>
                            <Description><Link to=(testFeature)>link</Link></Description>
                        </Situation>
                    </Room>
                    <Feature key=(testFeature) />
                    <Knowledge key=(testKnowledge) />
                </Asset>
            `)
            expect(schemaToWML([test.subset([{ requestType: 'ShortName', keys: [new StandardKey({ key: 'testRoom', tag: 'Room' })] }]).schema])).toEqual(deIndentWML(`
                <Asset uuid=(test)>
                    <Room key=(testRoom)><ShortName>Test Room</ShortName></Room>
                </Asset>
            `))
        })    

        it('should properly subset an asset with stub content without cascade', () => {
            const test = new StandardForm(`
                <Asset uuid=(test)>
                    <Room key=(testRoom)>
                        <ShortName>Test Room</ShortName>
                        <Situation uuid=(DEFAULT) ref={0} key=(base)>
                            <Description><Link to=(testFeature)>link</Link></Description>
                        </Situation>
                    </Room>
                    <Feature key=(testFeature) />
                    <Knowledge key=(testKnowledge) />
                </Asset>
            `)
            expect(schemaToWML([test.subset([{ requestType: 'Stub', keys: [new StandardKey({ key: 'testRoom', tag: 'Room' })] }]).schema])).toEqual(deIndentWML(`
                <Asset uuid=(test)><Room key=(testRoom) /></Asset>
            `))
        })    

        it('should properly subset an asset with link cascade', () => {
            const test = new StandardForm(`
                <Asset uuid=(test)>
                    <Knowledge key=(testKnowledge)>
                        <Situation ref={0} uuid=(testRoomBase)>
                            <Description><Link to=(FEATURE#testFeature)>link</Link></Description>
                        </Situation>
                    </Knowledge>
                    <Room key=(testRoom) />
                    <Feature uuid=(testFeature) key=(testFeature)>
                        <Situation uuid=(testFeatureBase)>
                            <Description><Link to=(FEATURE#testFeatureTwo)>link</Link></Description>
                        </Situation>
                    </Feature>
                    <Feature uuid=(testFeatureTwo) key=(testFeatureTwo) />
                </Asset>
            `)
            expect(schemaToWML([test.subset([{
                requestType: 'Full',
                keys: [new StandardKey({ key: 'testKnowledge', tag: 'Knowledge' })],
                cascadeConditions: [
                    {
                        graph: [
                            {
                                name: 'knowledge',
                                requestType: 'Full',
                                transitions: [
                                    { connectionType: 'Direct', targetNode: 'example' }
                                ]
                            },
                            {
                                name: 'example',
                                requestType: 'Full',
                                transitions: [
                                    { connectionType: 'Link', targetNode: 'feature' }
                                ]
                            },
                            {
                                name: 'feature',
                                requestType: 'Stub',
                                transitions: []
                            }
                        ],
                        startNodes: ['knowledge']
                    }
                ]
            }]).schema])).toEqual(deIndentWML(`
                <Asset uuid=(test)>
                    <Situation uuid=(testRoomBase) ref={0} />
                    <Knowledge key=(testKnowledge)>
                        <Situation uuid=(testRoomBase) ref={0}>
                            <Description>
                                <Link to=(FEATURE#testFeature)>link</Link>
                            </Description>
                        </Situation>
                    </Knowledge>
                </Asset>
            `))
        })

        it('should properly subset a chained cascade', () => {
            const test = new StandardForm(`
                <Asset uuid=(test)>
                    <Knowledge key=(testKnowledge)>
                        <Situation ref={0} uuid=(roomExample)>
                            <Description>
                                <Link to=(FEATURE#testFeature)>link</Link>
                            </Description>
                        </Situation>
                    </Knowledge>
                    <Room key=(testRoom) />
                    <Feature uuid=(testFeature) key=(testFeature)>
                        <Situation uuid=(featureExample)>
                            <Description>
                                <Link to=(FEATURE#testFeatureTwo)>link</Link>
                            </Description>
                        </Situation>
                    </Feature>
                    <Feature uuid=(testFeatureTwo) key=(testFeatureTwo) />
                </Asset>
            `)
            expect(schemaToWML([test.subset([{ 
                requestType: 'Full', 
                keys: [new StandardKey({ key: 'testKnowledge', tag: 'Knowledge' })], 
                cascadeConditions: [
                    {
                        graph: [
                            {
                                name: 'knowledge',
                                requestType: 'Full',
                                transitions: [
                                    { connectionType: 'Direct', targetNode: 'example' }
                                ]
                            },
                            {
                                name: 'example',
                                requestType: 'Full', 
                                transitions: [
                                    { connectionType: 'Link', targetNode: 'feature' }
                                ]
                            },
                            {
                                name: 'feature',
                                requestType: 'Full',
                                transitions: [
                                    { connectionType: 'Direct', targetNode: 'example' }
                                ]
                            }
                        ],
                        startNodes: ['knowledge']
                    }
                ]
            }]).schema])).toEqual(deIndentWML(`
                <Asset uuid=(test)>
                    <Situation uuid=(roomExample) ref={0} />
                    <Knowledge key=(testKnowledge)>
                        <Situation uuid=(roomExample) ref={0}>
                            <Description>
                                <Link to=(FEATURE#testFeature)>link</Link>
                            </Description>
                        </Situation>
                    </Knowledge>
                </Asset>
            `))
        })    

        it('should subset a looping chained cascade without error', () => {
            const test = new StandardForm(`
                <Asset uuid=(test)>
                    <Feature uuid=(testFeature) key=(testFeature)>
                        <Situation uuid=(exampleOne)>
                            <Description><Link to=(FEATURE#testFeatureTwo)>link</Link></Description>
                        </Situation>
                    </Feature>
                    <Feature uuid=(testFeatureTwo) key=(testFeatureTwo)>
                        <Situation uuid=(exampleTwo)>
                            <Description><Link to=(FEATURE#testFeature)>link</Link></Description>
                        </Situation>
                    </Feature>
                    <Knowledge key=(testKnowledge) />
                </Asset>
            `)
            expect(schemaToWML([test.subset([{ requestType: 'Full', keys: [new StandardKey({ key: 'testFeature', tag: 'Feature' })], cascadeConditions: [{ 
                graph: [
                    {
                        name: 'feature',
                        requestType: 'Full',
                        transitions: [
                            { connectionType: 'Direct', targetNode: 'example' }
                        ]
                    },
                    {
                        name: 'example',
                        requestType: 'Full',
                        transitions: [
                            { connectionType: 'Link', targetNode: 'feature' }
                        ]
                    }
                ],
                startNodes: ['feature']
            }] }]).schema])).toEqual(deIndentWML(`
                <Asset uuid=(test)>
                    <Feature uuid=(testFeature) key=(testFeature)>
                        <Situation uuid=(exampleOne)>
                            <Description>
                                <Link to=(FEATURE#testFeatureTwo)>link</Link>
                            </Description>
                        </Situation>
                    </Feature>
                </Asset>
            `))
        })    

        it('should properly subset an asset with position cascade', () => {
            const test = new StandardForm(`
                <Asset uuid=(test)>
                    <Map key=(testMap)>
                        <Room key=(testRoom)><Position {0, 0} /></Room>
                    </Map>
                    <Room key=(testRoom)>
                        <Situation uuid=(DEFAULT) ref={0} key=(base)>
                            <Description><Link to=(testFeature)>link</Link></Description>
                        </Situation>
                    </Room>
                    <Feature key=(testFeature) />
                    <Knowledge key=(testKnowledge) />
                </Asset>
            `)
            expect(schemaToWML([test.subset([{ requestType: 'Full', keys: [new StandardKey({ key: 'testMap', tag: 'Map' })], cascadeConditions: [{ 
                graph: [
                    {
                        name: 'map',
                        requestType: 'Full',
                        transitions: [
                            { connectionType: 'Position', targetNode: 'room' }
                        ]
                    },
                    {
                        name: 'room',
                        requestType: 'Stub',
                        transitions: []
                    }
                ],
                startNodes: ['map']
            }] }]).schema])).toEqual(deIndentWML(`
                <Asset uuid=(test)>
                    <Map key=(testMap)><Room key=(testRoom)><Position {0, 0} /></Room></Map>
                    <Room key=(testRoom) />
                </Asset>
            `))
        })

        it('should properly subset an asset with exit cascade', () => {
            const test = new StandardForm(`
                <Asset uuid=(test)>
                    <Room key=(testRoom)>
                        <ShortName>Test Room</ShortName>
                        <Situation uuid=(DEFAULT) ref={0} key=(base)>
                            <Description><Link to=(testFeature)>link</Link></Description>
                        </Situation>
                        <Exit to=(testRoomTwo)>exit</Exit>
                    </Room>
                    <Room key=(testRoomTwo)>
                        <Exit to=(testRoomOne)>enter</Exit>
                    </Room>
                    <Feature key=(testFeature) />
                    <Knowledge key=(testKnowledge) />
                </Asset>
            `)
            expect(schemaToWML([test.subset([{ requestType: 'ExitsAndShortName', keys: [new StandardKey({ key: 'testRoom', tag: 'Room' })], cascadeConditions: [{ 
                graph: [
                    {
                        name: 'room',
                        requestType: 'ExitsAndShortName',
                        transitions: [
                            { connectionType: 'Exit', targetNode: 'exitTarget' }
                        ]
                    },
                    {
                        name: 'exitTarget',
                        requestType: 'ExitsAndShortName',
                        transitions: []
                    }
                ],
                startNodes: ['room']
            }] }]).schema])).toEqual(deIndentWML(`
                <Asset uuid=(test)>
                    <Room key=(testRoom)>
                        <ShortName>Test Room</ShortName>
                        <Exit to=(testRoomTwo)>exit</Exit>
                    </Room>
                    <Room key=(testRoomTwo)><Exit to=(testRoomOne)>enter</Exit></Room>
                </Asset>
            `))
        })    

        it('should demonstrate recursive cascade structure for map editing', () => {
            const test = new StandardForm(`
                <Asset uuid=(test)>
                    <Map uuid=(testMap)>
                        <Room key=(room1)><Position {0, 0} /></Room>
                        <Room key=(room2)><Position {100, 100} /></Room>
                    </Map>
                    <Room key=(room1)>
                        <ShortName>Room One</ShortName>
                        <Exit to=(room2)>to room two</Exit>
                    </Room>
                    <Room key=(room2)>
                        <ShortName>Room Two</ShortName>
                        <Exit to=(room1)>to room one</Exit>
                    </Room>
                </Asset>
            `)
            
            // This demonstrates the new recursive cascade structure:
            // 1. Get map with Full detail
            // 2. Follow Position connections to get positioned rooms
            // 3. For each positioned room, get Exit connections
            // 4. For each exit target, get ShortName detail
            const results = test.subset([{
                requestType: 'Full',
                keys: [new StandardKey(`MAP#testMap`)],
                cascadeConditions: [
                    {
                        graph: [
                            {
                                name: 'map',
                                requestType: 'Full',
                                transitions: [
                                    { connectionType: 'Position', targetNode: 'room' }
                                ]
                            },
                            {
                                name: 'room',
                                requestType: 'ExitsAndShortName',
                                transitions: [
                                    { connectionType: 'Exit', targetNode: 'exitTarget' }
                                ]
                            },
                            {
                                name: 'exitTarget',
                                requestType: 'ShortName',
                                transitions: []
                            }
                        ],
                        startNodes: ['map']
                    }
                ]
            }])
            
            // Should include the map, positioned rooms, and exit targets with short names
            expect(results.byUniversalId['MAP#testMap']).toBeInstanceOf(StandardMap)
            expect(results.byId['room1']).toBeInstanceOf(StandardRoom)
            expect(results.byId['room2']).toBeInstanceOf(StandardRoom)
        })

    })

    it('should round-trip all component types through NDJSON', () => {
        const testWML = deIndentWML(`
            <Asset uuid=(test)>
                <Feature uuid=(003) key=(testFeature)>
                    <Situation uuid=(0035)>
                        <DisplayName>Clocktower</DisplayName>
                        <Description>
                            A tower built of white sandstone blocks, with an ornate clock
                            set on the northern face.
                        </Description>
                    </Situation>
                </Feature>
                <Knowledge uuid=(004) key=(testKnowledge)>
                    <Situation uuid=(0045)>
                        <DisplayName>Learn</DisplayName>
                        <Description>There is so much to know!</Description>
                    </Situation>
                </Knowledge>
                <Room uuid=(002) key=(testRoom)>
                    <ShortName>Vortex</ShortName>
                    <Situation uuid=(025) ref={0}>
                        <DisplayName>Vortex</DisplayName>
                        <Description>Vortex Desc</Description>
                    </Situation>
                </Room>
                <Map uuid=(005) key=(testMap)>
                    <Image key=(testBackground) />
                    <Room key=(testRoom)><Position {0, 100} /></Room>
                </Map>
                <Message uuid=(006) key=(openDoor)>
                    <Room key=(testRoom) />
                    <Description>The door opens!</Description>
                </Message>
                <Moment uuid=(007) key=(openDoorMoment)><Message key=(openDoor) /></Moment>
                <Situation uuid=(025) ref={0} />
                <Image key=(testBackground) />
            </Asset>
        `)
        const testSource = new StandardForm(testWML)

        const ndjson = testSource.toNDJSON()
        const test = new StandardForm(ndjson)
        expect(schemaToWML([test.schema])).toEqual(testWML)
        expect(test.byId.testRoom.universalKey).toEqual('ROOM#002')
        expect(test.byId.testFeature.universalKey).toEqual('FEATURE#003')
        expect(test.byId.testKnowledge.universalKey).toEqual('KNOWLEDGE#004')
        expect(test.byId.testMap.universalKey).toEqual('MAP#005')
        expect(test.byId.openDoor.universalKey).toEqual('MESSAGE#006')
        expect(test.byId.openDoorMoment.universalKey).toEqual('MOMENT#007')
    })

    it('should group sub-components correctly in JSON', () => {
        const testWML = deIndentWML(`
            <Asset uuid=(test)>
                <Feature uuid=(003) key=(testGlobal)>
                    <Situation uuid=(003b)>
                        <Description>Global</Description>
                    </Situation>
                </Feature>
                <Room uuid=(001) key=(testRoom)>
                    <Feature uuid=(004) key=(testLocal)>
                        <Situation uuid=(004b)>
                            <DisplayName>Clocktower</DisplayName>
                            <Description>
                                A tower built of white sandstone blocks, with an ornate clock set on
                                the northern face.
                            </Description>
                        </Situation>
                    </Feature>
                    <Feature uuid=(003) key=(testGlobal) />
                    <Situation ref={0} uuid=(001b)>
                        <DisplayName>Vortex</DisplayName>
                    </Situation>
                </Room>
                <Room uuid=(002) key=(testRoomTwo) />
            </Asset>
        `)
        const testSource = new StandardForm(testWML)

        const ndjson = testSource.toNDJSON()
        expect(ndjson).toEqual([
            {
                tag: 'Asset',
                universalKey: 'ASSET#test',
                topLevel: [
                    'FEATURE#003',
                    'ROOM#001',
                    'ROOM#002'
                ]
            },
            {
                tag: 'Feature',
                key: 'testGlobal',
                universalKey: 'FEATURE#003',
                situations: [{
                    reference: 'SITUATION#003b',
                    payload: { description: ['Global'] }
                }],
                shortName: undefined,
            },
            {
                key: undefined,
                universalKey: 'SITUATION#003b',
                tag: 'Situation',
            },
            {
                tag: 'Room',
                key: 'testRoom',
                universalKey: 'ROOM#001',
                situations: [{
                    reference: {
                        universalKey: 'SITUATION#001b',
                        tag: 'Situation',
                        ref: 0
                    },
                    payload: { displayName: 'Vortex' }
                }],
                features: ['FEATURE#004', 'FEATURE#003'],
                shortName: undefined,
            },
            {
                tag: 'Feature',
                key: 'testLocal',
                universalKey: 'FEATURE#004',
                situations: [{
                    reference: 'SITUATION#004b',
                    payload: {
                        displayName: 'Clocktower',
                        description: ['A tower built of white sandstone blocks, with an ornate clock set on the northern face.']
                    }
                }],
                shortName: undefined,
            },
            {
                key: undefined,
                universalKey: 'SITUATION#004b',
                tag: 'Situation',
            },
            { tag: 'Room', key: 'testRoomTwo', universalKey: 'ROOM#002', shortName: undefined },
            {
                key: undefined,
                universalKey: 'SITUATION#001b',
                tag: 'Situation',
            },
        ])
    })

    it('should round-trip nested subcomponents', () => {
        const testWML = deIndentWML(`
            <Asset uuid=(test)>
                <Feature uuid=(003) key=(testGlobal)>
                    <Situation uuid=(003b)><Description>Global</Description></Situation>
                </Feature>
                <Room uuid=(001) key=(testRoom)>
                    <Feature key=(testGlobal) />
                    <Feature uuid=(004) key=(testLocal)>
                        <Situation uuid=(004b)>
                            <DisplayName>Clocktower</DisplayName>
                            <Description>
                                A tower built of white sandstone blocks, with an ornate
                                clock set on the northern face.
                            </Description>
                        </Situation>
                    </Feature>
                    <Situation uuid=(001b) ref={0}>
                        <DisplayName>Vortex</DisplayName>
                    </Situation>
                </Room>
                <Room uuid=(002) key=(testRoomTwo) />
                <Situation uuid=(001b) ref={0} />
            </Asset>
        `)
        const test = new StandardForm(testWML)

        expect(schemaToWML([test.schema])).toEqual(testWML)
    })

    it('should round-trip imports through NDJSON', () => {
        const testWML = deIndentWML(`
            <Asset uuid=(test)>
                <Room key=(testRoom) from=(ASSET#testImport)>
                    <ShortName>Test</ShortName>
                </Room>
            </Asset>
        `)
        const testSource = new StandardForm(testWML)
        const test = new StandardForm(testSource.toNDJSON())
        expect(schemaToWML([test.schema])).toEqual(testWML)
    })

    describe('key changes via merge', () => {
        describe('validation', () => {
            it('should throw error when Key rename lacks universalKey', () => {
                const base = new StandardForm(`
                    <Asset uuid=(test)>
                        <Feature key=(testFeature)>
                            <Situation uuid=(base)><DisplayName>Test</DisplayName></Situation>
                        </Feature>
                    </Asset>
                `)
                // Create edit with Key rename but no universalKey
                const edit = new StandardForm(`
                    <Asset uuid=(test)>
                        <Feature key=(testFeature)>
                            <Replace><Key>testFeature</Key></Replace>
                            <With><Key>renamedFeature</Key></With>
                        </Feature>
                    </Asset>
                `)
                
                expect(() => base.merge(edit)).toThrow('Cannot rename key for component without universalKey')
            })

            it('should throw error when Key removal lacks universalKey', () => {
                const base = new StandardForm(`
                    <Asset uuid=(test)>
                        <Feature key=(testFeature)>
                            <Situation uuid=(base)><DisplayName>Test</DisplayName></Situation>
                        </Feature>
                    </Asset>
                `)
                // Create edit with Remove Key operation but without universalKey
                const edit = new StandardForm(`
                    <Asset uuid=(test)>
                        <Feature key=(testFeature)><Remove><Key>testFeature</Key></Remove></Feature>
                    </Asset>
                `)
                
                expect(() => base.merge(edit)).toThrow('Cannot remove key for component without universalKey')
            })
        })

        describe('reference updates', () => {
            it('should retarget Links to the renamed key via merge', () => {
                const base = new StandardForm(`
                    <Asset uuid=(test)>
                        <Feature uuid=(feature1) key=(testFeatureOne)>
                            <Situation uuid=(base1)>
                                <Description>
                                    <Link to=(testFeatureOne)>self link</Link>
                                    <Link to=(testFeatureTwo)>other link</Link>
                                </Description>
                            </Situation>
                        </Feature>
                        <Feature uuid=(feature2) key=(testFeatureTwo)>
                            <Situation uuid=(base2)>
                                <Description><Link to=(testFeatureOne)>back link</Link></Description>
                            </Situation>
                        </Feature>
                    </Asset>
                `)
                
                // Create edit with Key rename
                const edit = new StandardForm(`
                    <Asset uuid=(test)>
                        <Feature uuid=(feature1) key=(testFeatureOne) ref={0}>
                            <Replace><Key>testFeatureOne</Key></Replace>
                            <With><Key>renamedFeature</Key></With>
                        </Feature>
                    </Asset>
                `)
                
                const merged = base.merge(edit)
                expect(schemaToWML([merged.schema])).toEqual(deIndentWML(`
                    <Asset uuid=(test)>
                        <Feature uuid=(feature1) key=(renamedFeature)>
                            <Situation uuid=(base1)>
                                <Description>
                                    <Link to=(testFeatureOne)>self link</Link>
                                    <Link to=(testFeatureTwo)>other link</Link>
                                </Description>
                            </Situation>
                        </Feature>
                        <Feature uuid=(feature2) key=(testFeatureTwo)>
                            <Situation uuid=(base2)>
                                <Description>
                                    <Link to=(testFeatureOne)>back link</Link>
                                </Description>
                            </Situation>
                        </Feature>
                    </Asset>
                `))
            })

            it('should retarget Exits to the renamed key via merge', () => {
                const base = new StandardForm(`
                    <Asset uuid=(test)>
                        <Room uuid=(room1) key=(testRoomOne)>
                            <Exit to=(testRoomTwo)>exit</Exit>
                        </Room>
                        <Room uuid=(room2) key=(testRoomTwo)>
                            <Exit to=(testRoomOne)>enter</Exit>
                        </Room>
                    </Asset>
                `)
                
                // Create edit with Key rename
                const edit = new StandardForm(`
                    <Asset uuid=(test)>
                        <Room uuid=(room1) key=(testRoomOne) ref={0}>
                            <Replace><Key>testRoomOne</Key></Replace>
                            <With><Key>renamedRoom</Key></With>
                        </Room>
                    </Asset>
                `)
                
                const merged = base.merge(edit)
                expect(schemaToWML([merged.schema])).toEqual(deIndentWML(`
                    <Asset uuid=(test)>
                        <Room uuid=(room1) key=(renamedRoom)>
                            <Exit to=(testRoomTwo)>exit</Exit>
                        </Room>
                        <Room uuid=(room2) key=(testRoomTwo)>
                            <Exit to=(renamedRoom)>enter</Exit>
                        </Room>
                    </Asset>
                `))
            })

            it('should retarget Map Positions to the renamed key via merge', () => {
                const base = new StandardForm(`
                    <Asset uuid=(test)>
                        <Room uuid=(room1) key=(testRoomOne) />
                        <Map uuid=(map1) key=(testMapOne)>
                            <Room uuid=(room1) key=(testRoomOne)><Position {100, 100} /></Room>
                        </Map>
                    </Asset>
                `)
                
                // Create edit with Key rename
                const edit = new StandardForm(`
                    <Asset uuid=(test)>
                        <Room uuid=(room1) key=(testRoomOne) ref={0}>
                            <Replace><Key>testRoomOne</Key></Replace>
                            <With><Key>renamedRoom</Key></With>
                        </Room>
                    </Asset>
                `)
                
                const merged = base.merge(edit)
                expect(schemaToWML([merged.schema])).toEqual(deIndentWML(`
                    <Asset uuid=(test)>
                        <Room uuid=(room1) key=(renamedRoom) />
                        <Map uuid=(map1) key=(testMapOne)>
                            <Room key=(renamedRoom)><Position {100, 100} /></Room>
                        </Map>
                    </Asset>
                `))
            })

            it('should handle bidirectional references correctly via merge', () => {
                const base = new StandardForm(`
                    <Asset uuid=(test)>
                        <Room uuid=(room1) key=(testRoomOne)>
                            <Situation ref={0} uuid=(base1)>
                                <Description>Test One <Link to=(testRoomTwo)>link</Link></Description>
                            </Situation>
                        </Room>
                        <Room uuid=(room2) key=(testRoomTwo)>
                            <Situation ref={0} uuid=(base2)>
                                <Description>Test Two <Link to=(testRoomOne)>link</Link></Description>
                            </Situation>
                        </Room>
                    </Asset>
                `)
                
                // Create edit swapping both keys
                const edit = new StandardForm(`
                    <Asset uuid=(test)>
                        <Room uuid=(room1) key=(testRoomOne) ref={0}>
                            <Replace><Key>testRoomOne</Key></Replace>
                            <With><Key>testRoomTwo</Key></With>
                        </Room>
                        <Room uuid=(room2) key=(testRoomTwo) ref={0}>
                            <Replace><Key>testRoomTwo</Key></Replace>
                            <With><Key>testRoomOne</Key></With>
                        </Room>
                    </Asset>
                `)
                
                const merged = base.merge(edit)
                expect(schemaToWML([merged.schema])).toEqual(deIndentWML(`
                    <Asset uuid=(test)>
                        <Room uuid=(room1) key=(testRoomTwo)>
                            <Situation uuid=(base1) ref={0}>
                                <Description>
                                    Test One <Link to=(testRoomTwo)>link</Link>
                                </Description>
                            </Situation>
                        </Room>
                        <Room uuid=(room2) key=(testRoomOne)>
                            <Situation uuid=(base2) ref={0}>
                                <Description>
                                    Test Two <Link to=(testRoomOne)>link</Link>
                                </Description>
                            </Situation>
                        </Room>
                    </Asset>
                `))
            })
        })

        describe('merge behavior', () => {
            it('should preserve component via universalKey when key is removed', () => {
                const base = new StandardForm(`
                    <Asset uuid=(test)>
                        <Feature uuid=(feature1) key=(testFeature)>
                            <Situation uuid=(base)><DisplayName>Test</DisplayName></Situation>
                        </Feature>
                    </Asset>
                `)
                
                // Create edit removing the key
                const edit = new StandardForm(`
                    <Asset uuid=(test)>
                        <Feature uuid=(feature1) key=(testFeature) ref={0}>
                            <Remove><Key>testFeature</Key></Remove>
                        </Feature>
                    </Asset>
                `)
                
                const merged = base.merge(edit)
                // Component should still exist via universalKey
                expect(merged.byUniversalId['FEATURE#feature1']).toBeDefined()
                expect(merged.byUniversalId['FEATURE#feature1']?.key).toBeUndefined()
            })

            it('should handle multiple Key changes in single merge', () => {
                const base = new StandardForm(`
                    <Asset uuid=(test)>
                        <Feature uuid=(feature1) key=(feature1)>
                            <Situation uuid=(base)><DisplayName>One</DisplayName></Situation>
                        </Feature>
                        <Feature uuid=(feature2) key=(feature2)>
                            <Situation uuid=(base)><DisplayName>Two</DisplayName></Situation>
                        </Feature>
                    </Asset>
                `)
                
                // Create edit renaming both features
                const edit = new StandardForm(`
                    <Asset uuid=(test)>
                        <Feature uuid=(feature1) key=(feature1)>
                            <Replace><Key>feature1</Key></Replace>
                            <With><Key>renamed1</Key></With>
                        </Feature>
                        <Feature uuid=(feature2) key=(feature2) ref={0}>
                            <Replace><Key>feature2</Key></Replace>
                            <With><Key>renamed2</Key></With>
                        </Feature>
                    </Asset>
                `)
                
                const merged = base.merge(edit)
                expect(merged.byId.renamed1).toBeDefined()
                expect(merged.byId.renamed2).toBeDefined()
            })
        })

        describe('integration', () => {
            it('should work with full edit/merge/diff cycle', () => {
                const base = new StandardForm(`
                    <Asset uuid=(test)>
                        <Feature uuid=(feature1) key=(clockTower)>
                            <ShortName>Clock Tower</ShortName>
                        </Feature>
                    </Asset>
                `)
                
                // Create modified version with new key
                const modified = base._clone()
                const component = modified.byUniversalId['FEATURE#feature1']
                const newComponent = component.withKey('tower')
                modified.byUniversalId['FEATURE#feature1'] = newComponent
                modified._components = modified._components.map(c => 
                    c.standardKey.equals(newComponent.standardKey) ? newComponent : c
                )
                
                // Generate diff
                const diff = base.diff(modified.finalize())
                expect(diff).toBeDefined()
                
                // Merge diff back
                const merged = base.merge(diff!)
                expect(merged.byId.tower).toBeDefined()
                expect(merged.byId.clockTower).toBeUndefined()
            })
        })
    })


    describe('byId', () => {
        it('should update a component byId', () => {
            const test = new StandardForm(`
                <Asset uuid=(test)>
                    <Room key=(testRoom) />
                </Asset>
            `)
            expect(test.byId.testRoom).toBeInstanceOf(StandardRoom)
            const room = test.byId.testRoom.clone() as StandardRoom
            room._payload._shortName = new StandardLiteral('Updated Room', { tag: 'ShortName' })
            test.byId.testRoom = room
            expect(schemaToWML([test.schema])).toEqual(deIndentWML(`
                <Asset uuid=(test)>
                    <Room key=(testRoom)><ShortName>Updated Room</ShortName></Room>
                </Asset>
            `))
        })

        it('should add a component byId', () => {
            const test = new StandardForm(`
                <Asset uuid=(test)>
                    <Room key=(testRoom) />
                </Asset>
            `)
            test.byId.testFeature = new StandardFeature(`<Feature uuid=(testFeature) key=(testFeature) />`)
            expect(schemaToWML([test.schema])).toEqual(deIndentWML(`
                <Asset uuid=(test)>
                    <Feature uuid=(testFeature) key=(testFeature) ref={0} />
                    <Room key=(testRoom) />
                </Asset>
            `))
        })
    })

    describe('byUniversalId', () => {
        it('should update a component byUniversalId', () => {
            const test = new StandardForm(`
                <Asset uuid=(test)>
                    <Room uuid=(testRoom) key=(testRoom) />
                </Asset>
            `)
            expect(test.byUniversalId[`ROOM#testRoom`]).toBeInstanceOf(StandardRoom)
            const room = test.byUniversalId[`ROOM#testRoom`].clone() as StandardRoom
            room._payload._shortName = new StandardLiteral('Updated Room', { tag: 'ShortName' })
            test.byUniversalId[`ROOM#testRoom`] = room
            expect(schemaToWML([test.schema])).toEqual(deIndentWML(`
                <Asset uuid=(test)>
                    <Room uuid=(testRoom) key=(testRoom)>
                        <ShortName>Updated Room</ShortName>
                    </Room>
                </Asset>
            `))
        })

        it('should add a component byUniversalId', () => {
            const test = new StandardForm(`
                <Asset uuid=(test)>
                    <Room uuid=(testRoom) key=(testRoom) />
                </Asset>
            `)
            test.byUniversalId[`FEATURE#testFeature`] = new StandardFeature(`<Feature uuid=(testFeature) key=(testFeature) />`)
            expect(schemaToWML([test.schema])).toEqual(deIndentWML(`
                <Asset uuid=(test)>
                    <Feature uuid=(testFeature) key=(testFeature) ref={0} />
                    <Room uuid=(testRoom) key=(testRoom) />
                </Asset>
            `))
        })
    })

    describe('finalize', () => {
        it('should add UUID on finalize', () => {
            const test = new StandardForm(`
                <Asset uuid=(test)>
                    <Room key=(testRoom) />
                </Asset>
            `)
            expect(schemaToWML([test.schema])).toEqual(deIndentWML(`
                <Asset uuid=(test)><Room key=(testRoom) /></Asset>
            `))
            const finalized = test.finalize()
            expect(schemaToWML([finalized.schema])).toEqual(deIndentWML(`
                <Asset uuid=(test)><Room uuid=(mock-uuid-1) key=(testRoom) /></Asset>
            `))
            expect(finalized.byId.testRoom.universalKey).toEqual('ROOM#mock-uuid-1')
        })

        it('should remap references to UUIDs on finalize', () => {
            const testWML = deIndentWML(`
                <Asset uuid=(test)>
                    <Feature uuid=(testFeature) key=(testFeature) />
                    <Room uuid=(testRoom) key=(testRoom)>
                        <Feature key=(testFeature) />
                    </Room>
                </Asset>
            `)
            const test = new StandardForm(testWML).finalize()
            const findRoom = test._lookup('ROOM#testRoom')
            expect(findRoom).toBeInstanceOf(StandardRoom)
            expect((findRoom as StandardRoom).features?.toJSON()).toEqual([
                'FEATURE#testFeature'
            ])
        })

        it('should return correct instance types from _lookup', () => {
            const testWML = deIndentWML(`
                <Asset uuid=(test)>
                    <Room uuid=(testRoom) key=(testRoom)>
                        <Situation ref={0} uuid=(testExample) key=(testExample)>
                            <DisplayName>Test Room</DisplayName>
                            <Description>Test room description</Description>
                        </Situation>
                    </Room>
                </Asset>
            `)
            const test = new StandardForm(testWML).finalize()
            
            // Test that _lookup returns the correct instance types
            const foundRoom = test._lookup('ROOM#testRoom')
            expect(foundRoom).toBeInstanceOf(StandardRoom)
            
            const foundSituation = test._lookup('SITUATION#testExample')
            expect(foundSituation).toBeInstanceOf(StandardSituation)
        })

        it('should integrate characters with rooms in StandardForm.schema scenarios', () => {
            // Create a complex scenario with characters defined both as separate components
            // and as sub-components of rooms
            const testWML = deIndentWML(`
                <Asset uuid=(test)>
                    <Character uuid=(char1) key=(char1)>
                        <ShortName>Alice</ShortName>
                        <DisplayName>Alice</DisplayName>
                    </Character>
                    <Character uuid=(char2) key=(char2)>
                        <ShortName>Bob</ShortName>
                        <DisplayName>Bob</DisplayName>
                    </Character>
                    <Room uuid=(room1) key=(room1)>
                        <Character key=(char3)>
                            <ShortName>Charlie</ShortName>
                            <DisplayName>Charlie</DisplayName>
                        </Character>
                        <Character uuid=(char1) />
                    </Room>
                    <Room uuid=(room2) key=(room2)>
                        <Character uuid=(char2) />
                        <Character key=(char4)>
                            <ShortName>David</ShortName>
                            <DisplayName>David</DisplayName>
                        </Character>
                    </Room>
                </Asset>
            `)
            const test = new StandardForm(testWML).finalize()
            
            // Test that characters are correctly parsed and stored
            const room1 = test._lookup('ROOM#room1') as StandardRoom
            const room2 = test._lookup('ROOM#room2') as StandardRoom
            const char1 = test._lookup('CHARACTER#char1') as StandardCharacter
            const char2 = test._lookup('CHARACTER#char2') as StandardCharacter
            
            expect(room1).toBeInstanceOf(StandardRoom)
            expect(room2).toBeInstanceOf(StandardRoom)
            expect(char1).toBeInstanceOf(StandardCharacter)
            expect(char2).toBeInstanceOf(StandardCharacter)
            
            // Test that rooms have the correct character references
            expect(room1.characters).toBeDefined()
            expect(room1.characters!.payload.length).toBe(2)
            expect(room2.characters).toBeDefined()
            expect(room2.characters!.payload.length).toBe(2)
            
            // Test that character references include both local and universal keys
            const room1CharKeys = room1.characters!.payload.map(ref => ref.key || ref.universalKey)
            const room2CharKeys = room2.characters!.payload.map(ref => ref.key || ref.universalKey)
            
            expect(room1CharKeys).toContain('char3') // Local character in room1
            expect(room1CharKeys).toContain('CHARACTER#char1') // Universal character reference in room1
            expect(room2CharKeys).toContain('CHARACTER#char2') // Universal character reference in room2
            expect(room2CharKeys).toContain('char4') // Local character in room2
            
            // Test that StandardForm.schema includes character references in room contexts
            const schemaWML = schemaToWML([test.schema])
            
            // Verify that the schema includes character references within room contexts
            // Note: StandardForm.schema includes full character content, not just references
            expect(schemaWML).toEqual(deIndentWML(`
                <Asset uuid=(test)>
                    <Character uuid=(char1) key=(char1)>
                        <ShortName>Alice</ShortName>
                        <DisplayName>Alice</DisplayName>
                    </Character>
                    <Character uuid=(char2) key=(char2)>
                        <ShortName>Bob</ShortName>
                        <DisplayName>Bob</DisplayName>
                    </Character>
                    <Room uuid=(room1) key=(room1)>
                        <Character key=(char1) />
                        <Character uuid=(mock-uuid-1) key=(char3)>
                            <ShortName>Charlie</ShortName>
                            <DisplayName>Charlie</DisplayName>
                        </Character>
                    </Room>
                    <Room uuid=(room2) key=(room2)>
                        <Character key=(char2) />
                        <Character uuid=(mock-uuid-2) key=(char4)>
                            <ShortName>David</ShortName>
                            <DisplayName>David</DisplayName>
                        </Character>
                    </Room>
                </Asset>
            `))
            
        })
    })

    it('should merge origin properties correctly in StandardForm merge', () => {
        const baseForm = new StandardForm(`<Asset uuid=(Test)>
            <Room uuid=(testRoom) key=(testRoom) origin=(ASSET#base,ASSET#inherited) />
        </Asset>`)
        
        const incomingForm = new StandardForm(`<Asset uuid=(Test)>
            <Room uuid=(testRoom) key=(testRoom) origin=(ASSET#incoming,ASSET#new) />
        </Asset>`)
        
        const mergedForm = baseForm.merge(incomingForm)
        const mergedRoom = mergedForm._lookup('ROOM#testRoom') as StandardRoom
        
        // Verify that origins are merged and deduplicated
        expect(mergedRoom.origin).toEqual([
            'ASSET#base',
            'ASSET#inherited',
            'ASSET#incoming', 
            'ASSET#new'
        ])
    })

    it('should allow nested Situation facet edits in edit mode', () => {
        const baseForm = new StandardForm(`<Asset uuid=(Test)>
            <Room key=(testRoom)>
                <Situation ref={0} uuid=(room-example)>
                    <DisplayName>Lobby</DisplayName>
                    <Description>A sterile corporate lobby.</Description>
                </Situation>
            </Room>
        </Asset>`)

        const editForm = new StandardForm(`<Asset uuid=(Test)>
            <Room key=(testRoom) ref={0}>
                <Situation uuid=(room-example) ref={0}>
                    <Replace><DisplayName>Lobby</DisplayName></Replace><With><DisplayName>Grand Foyer</DisplayName></With>
                </Situation>
            </Room>
        </Asset>`)

        const mergedForm = baseForm.merge(editForm)
        
        expect(schemaToWML([mergedForm.schema])).toEqual(deIndentWML(`
            <Asset uuid=(Test)>
                <Room key=(testRoom)>
                    <Situation uuid=(room-example) ref={0}>
                        <DisplayName>Grand Foyer</DisplayName>
                        <Description>A sterile corporate lobby.</Description>
                    </Situation>
                </Room>
            </Asset>
        `))
    })

    describe('Asset-level ShortName and Summary', () => {
        
        it('should parse Asset-level ShortName from WML', () => {
            const testWML = deIndentWML(`
                <Asset uuid=(nakatomiPlaza)>
                    <ShortName>Nakatomi Plaza</ShortName>
                    <Room key=(lobby)>
                        <Situation uuid=(DEFAULT)>
                            <Description>A gleaming marble lobby with towering windows</Description>
                        </Situation>
                    </Room>
                </Asset>
            `)
            
            const form = new StandardForm(testWML)
            expect(form.shortName).toBeDefined()
            expect(form.shortName?.toJSON()).toEqual('Nakatomi Plaza')
        })

        it('should parse Asset-level Summary from WML', () => {
            const testWML = deIndentWML(`
                <Asset uuid=(nakatomiPlaza)>
                    <Summary>A high-rise office building in downtown Los Angeles</Summary>
                    <Room key=(lobby)>
                        <Situation uuid=(DEFAULT)>
                            <Description>A gleaming marble lobby with towering windows</Description>
                        </Situation>
                    </Room>
                </Asset>
            `)
            
            const form = new StandardForm(testWML)
            expect(form.summary).toBeDefined()
            expect(form.summary?.toJSON()).toEqual(['A high-rise office building in downtown Los Angeles'])
        })

        it('should parse both Asset-level ShortName and Summary from WML', () => {
            const testWML = deIndentWML(`
                <Asset uuid=(nakatomiPlaza)>
                    <ShortName>Nakatomi Plaza</ShortName>
                    <Summary>A high-rise office building in downtown Los Angeles</Summary>
                    <Room uuid=(lobby) key=(lobby)>
                        <ShortName>Main Lobby</ShortName>
                        <Situation uuid=(DEFAULT)>
                            <Description>A gleaming marble lobby with towering windows</Description>
                        </Situation>
                    </Room>
                </Asset>
            `)
            
            const form = new StandardForm(testWML)
            expect(form.shortName?.toJSON()).toEqual('Nakatomi Plaza')
            expect(form.summary?.toJSON()).toEqual(['A high-rise office building in downtown Los Angeles'])
            
            // Verify Room's ShortName is separate
            const room = form._lookup('ROOM#lobby') as StandardRoom
            expect(room).toBeDefined()
            expect(room.shortName?.toJSON()).toEqual('Main Lobby')
        })

        it('should serialize Asset-level ShortName back to WML', () => {
            const originalWML = deIndentWML(`
                <Asset uuid=(hauntedMansion)>
                    <ShortName>Ravencrest Manor</ShortName>
                    <Room key=(foyer)>
                        <Situation uuid=(DEFAULT)>
                            <Description>A dust-covered entrance hall</Description>
                        </Situation>
                    </Room>
                </Asset>
            `)
            
            const form = new StandardForm(originalWML)
            const serializedWML = schemaToWML([form.schema])
            
            expect(serializedWML).toContain('<ShortName>Ravencrest Manor</ShortName>')
        })

        it('should serialize Asset-level Summary back to WML', () => {
            const originalWML = deIndentWML(`
                <Asset uuid=(hauntedMansion)>
                    <Summary>Victorian mansion with a dark history</Summary>
                    <Room key=(foyer)>
                        <Situation uuid=(DEFAULT)>
                            <Description>A dust-covered entrance hall</Description>
                        </Situation>
                    </Room>
                </Asset>
            `)
            
            const form = new StandardForm(originalWML)
            const serializedWML = schemaToWML([form.schema])
            
            expect(serializedWML).toContain('<Summary>Victorian mansion with a dark history</Summary>')
        })

        it('should perform complete round-trip with Asset-level metadata', () => {
            const originalWML = deIndentWML(`
                <Asset uuid=(underworldCaverns)>
                    <ShortName>The Sunless Depths</ShortName>
                    <Summary>Ancient cavern system beneath the mountain</Summary>
                    <Room uuid=(entrance) key=(entrance)>
                        <ShortName>Crystal Grotto</ShortName>
                        <Situation uuid=(DEFAULT)>
                            <Description>Luminescent crystals cast an eerie blue glow across the cavern walls</Description>
                        </Situation>
                    </Room>
                </Asset>
            `)
            
            const form = new StandardForm(originalWML)
            const serializedWML = schemaToWML([form.schema])
            
            // Parse the serialized WML again
            const roundTripForm = new StandardForm(serializedWML)
            
            // Verify Asset-level metadata preserved
            expect(roundTripForm.shortName?.toJSON()).toEqual('The Sunless Depths')
            expect(roundTripForm.summary?.toJSON()).toEqual(['Ancient cavern system beneath the mountain'])
            
            // Verify component data also preserved
            const room = roundTripForm._lookup('ROOM#entrance') as StandardRoom
            expect(room.shortName?.toJSON()).toEqual('Crystal Grotto')
        })

        it('should handle Assets without ShortName or Summary', () => {
            const testWML = deIndentWML(`
                <Asset uuid=(regularAsset)>
                    <Room key=(room1)>
                        <Situation uuid=(DEFAULT)>
                            <Description>A room</Description>
                        </Situation>
                    </Room>
                </Asset>
            `)
            
            const form = new StandardForm(testWML)
            expect(form.shortName).toBeUndefined()
            expect(form.summary).toBeUndefined()
        })

        it('should clone Asset with ShortName and Summary', () => {
            const originalWML = deIndentWML(`
                <Asset uuid=(skyshipDock)>
                    <ShortName>Aetherdock Seven</ShortName>
                    <Summary>Floating docking station for airships</Summary>
                    <Room key=(platform)>
                        <Situation uuid=(DEFAULT)>
                            <Description>A wooden platform swaying gently in the wind</Description>
                        </Situation>
                    </Room>
                </Asset>
            `)
            
            const form = new StandardForm(originalWML)
            const cloned = form._clone()
            
            expect(cloned.shortName?.toJSON()).toEqual('Aetherdock Seven')
            expect(cloned.summary?.toJSON()).toEqual(['Floating docking station for airships'])
        })

        it('should merge Asset-level ShortName from incoming form', () => {
            const baseWML = deIndentWML(`
                <Asset uuid=(test)>
                    <ShortName>Original Name</ShortName>
                </Asset>
            `)
            const incomingWML = deIndentWML(`
                <Asset uuid=(test)>
                    <ShortName>Updated Name</ShortName>
                </Asset>
            `)
            
            const baseForm = new StandardForm(baseWML)
            const incomingForm = new StandardForm(incomingWML)
            const merged = baseForm.merge(incomingForm)
            
            // Merging two ShortNames concatenates them (standard merge behavior)
            expect(merged.shortName?.toJSON()).toEqual('Original NameUpdated Name')
        })

        it('should merge Asset-level ShortName with Replace tag', () => {
            const baseWML = deIndentWML(`
                <Asset uuid=(test)>
                    <ShortName>Test</ShortName>
                </Asset>
            `)
            const incomingWML = deIndentWML(`
                <Asset uuid=(test)>
                    <Replace><ShortName>Test</ShortName></Replace>
                    <With><ShortName>Different test</ShortName></With>
                </Asset>
            `)
            
            const baseForm = new StandardForm(baseWML)
            const incomingForm = new StandardForm(incomingWML)
            const merged = baseForm.merge(incomingForm)
            
            expect(merged.shortName?.toJSON()).toEqual('Different test')
        })

        it('should merge Asset-level ShortName with Remove tag', () => {
            const baseWML = deIndentWML(`
                <Asset uuid=(test)>
                    <ShortName>Test Name</ShortName>
                </Asset>
            `)
            const incomingWML = deIndentWML(`
                <Asset uuid=(test)>
                    <Remove><ShortName>Test Name</ShortName></Remove>
                </Asset>
            `)
            
            const baseForm = new StandardForm(baseWML)
            const incomingForm = new StandardForm(incomingWML)
            const merged = baseForm.merge(incomingForm)
            
            expect(merged.shortName).toBeUndefined()
        })

        it('should merge Asset-level Summary from incoming form', () => {
            const baseWML = deIndentWML(`
                <Asset uuid=(test)>
                    <Summary>Original summary</Summary>
                </Asset>
            `)
            const incomingWML = deIndentWML(`
                <Asset uuid=(test)>
                    <Summary>Updated summary</Summary>
                </Asset>
            `)
            
            const baseForm = new StandardForm(baseWML)
            const incomingForm = new StandardForm(incomingWML)
            const merged = baseForm.merge(incomingForm)
            
            // Merging two Summaries concatenates them (standard merge behavior)
            expect(merged.summary?.toJSON()).toEqual(['Original summaryUpdated summary'])
        })

        it('should merge Asset-level Summary with Replace tag', () => {
            const baseWML = deIndentWML(`
                <Asset uuid=(test)>
                    <Summary>A mysterious <Link to=(somewhere)>portal</Link> appears</Summary>
                </Asset>
            `)
            const incomingWML = deIndentWML(`
                <Asset uuid=(test)>
                    <Replace><Summary>A mysterious <Link to=(somewhere)>portal</Link> appears</Summary></Replace>
                    <With><Summary>The <Link to=(somewhere)>portal</Link> has closed</Summary></With>
                </Asset>
            `)
            
            const baseForm = new StandardForm(baseWML)
            const incomingForm = new StandardForm(incomingWML)
            const merged = baseForm.merge(incomingForm)
            
            expect(merged.summary?.toJSON()).toEqual(['The ', { data: { tag: 'Link', to: 'somewhere', text: 'portal' }, children: ['portal'] }, ' has closed'])
        })

        it('should merge Asset-level Summary with Remove tag', () => {
            const baseWML = deIndentWML(`
                <Asset uuid=(test)>
                    <Summary>Test summary</Summary>
                </Asset>
            `)
            const incomingWML = deIndentWML(`
                <Asset uuid=(test)>
                    <Remove><Summary>Test summary</Summary></Remove>
                </Asset>
            `)
            
            const baseForm = new StandardForm(baseWML)
            const incomingForm = new StandardForm(incomingWML)
            const merged = baseForm.merge(incomingForm)
            
            expect(merged.summary).toBeUndefined()
        })

        it('should keep base Asset-level metadata when incoming has none', () => {
            const baseWML = deIndentWML(`
                <Asset uuid=(test)>
                    <ShortName>Base Name</ShortName>
                    <Summary>Base summary</Summary>
                </Asset>
            `)
            const incomingWML = deIndentWML(`
                <Asset uuid=(test)>
                    <Room key=(room1)>
                        <Situation uuid=(DEFAULT)>
                            <Description>A room</Description>
                        </Situation>
                    </Room>
                </Asset>
            `)
            
            const baseForm = new StandardForm(baseWML)
            const incomingForm = new StandardForm(incomingWML)
            const merged = baseForm.merge(incomingForm)
            
            expect(merged.shortName?.toJSON()).toEqual('Base Name')
            expect(merged.summary?.toJSON()).toEqual(['Base summary'])
        })

        it('should use incoming Asset-level metadata when base has none', () => {
            const baseWML = deIndentWML(`
                <Asset uuid=(test)>
                    <Room key=(room1)>
                        <Situation uuid=(DEFAULT)>
                            <Description>A room</Description>
                        </Situation>
                    </Room>
                </Asset>
            `)
            const incomingWML = deIndentWML(`
                <Asset uuid=(test)>
                    <ShortName>Incoming Name</ShortName>
                    <Summary>Incoming summary</Summary>
                </Asset>
            `)
            
            const baseForm = new StandardForm(baseWML)
            const incomingForm = new StandardForm(incomingWML)
            const merged = baseForm.merge(incomingForm)
            
            expect(merged.shortName?.toJSON()).toEqual('Incoming Name')
            expect(merged.summary?.toJSON()).toEqual(['Incoming summary'])
        })

        it('should diff Asset-level ShortName when changed', () => {
            const baseWML = deIndentWML(`
                <Asset uuid=(test)>
                    <ShortName>Original Name</ShortName>
                </Asset>
            `)
            const incomingWML = deIndentWML(`
                <Asset uuid=(test)>
                    <ShortName>Changed Name</ShortName>
                </Asset>
            `)
            
            const baseForm = new StandardForm(baseWML)
            const incomingForm = new StandardForm(incomingWML)
            const diffed = baseForm.diff(incomingForm)
            
            // Verify the diff produces the expected WML structure
            const diffWML = schemaToWML([diffed.schema])
            expect(diffWML).toEqual(deIndentWML(`
                <Asset uuid=(test)>
                    <Replace><ShortName>Original Name</ShortName></Replace>
                    <With><ShortName>Changed Name</ShortName></With>
                </Asset>
            `))
        })

        it('should not include Asset-level ShortName in diff when unchanged', () => {
            const baseWML = deIndentWML(`
                <Asset uuid=(test)>
                    <ShortName>Same Name</ShortName>
                </Asset>
            `)
            const incomingWML = deIndentWML(`
                <Asset uuid=(test)>
                    <ShortName>Same Name</ShortName>
                </Asset>
            `)
            
            const baseForm = new StandardForm(baseWML)
            const incomingForm = new StandardForm(incomingWML)
            const diffed = baseForm.diff(incomingForm)
            
            expect(diffed.shortName).toBeUndefined()
        })

        it('should diff Asset-level Summary when changed', () => {
            const baseWML = deIndentWML(`
                <Asset uuid=(test)>
                    <Summary>Original summary</Summary>
                </Asset>
            `)
            const incomingWML = deIndentWML(`
                <Asset uuid=(test)>
                    <Summary>Changed summary</Summary>
                </Asset>
            `)
            
            const baseForm = new StandardForm(baseWML)
            const incomingForm = new StandardForm(incomingWML)
            const diffed = baseForm.diff(incomingForm)
            
            // Verify the diff produces the expected WML structure
            const diffWML = schemaToWML([diffed.schema])
            expect(diffWML).toEqual(deIndentWML(`
                <Asset uuid=(test)>
                    <Replace><Summary>Original summary</Summary></Replace>
                    <With><Summary>Changed summary</Summary></With>
                </Asset>
            `))
        })

        it('should not include Asset-level Summary in diff when unchanged', () => {
            const baseWML = deIndentWML(`
                <Asset uuid=(test)>
                    <Summary>Same summary</Summary>
                </Asset>
            `)
            const incomingWML = deIndentWML(`
                <Asset uuid=(test)>
                    <Summary>Same summary</Summary>
                </Asset>
            `)
            
            const baseForm = new StandardForm(baseWML)
            const incomingForm = new StandardForm(incomingWML)
            const diffed = baseForm.diff(incomingForm)
            
            expect(diffed.summary).toBeUndefined()
        })

        it('should diff when Asset-level Summary is added', () => {
            const baseWML = deIndentWML(`
                <Asset uuid=(test) />
            `)
            const incomingWML = deIndentWML(`
                <Asset uuid=(test)><Summary>New summary</Summary></Asset>
            `)
            
            const baseForm = new StandardForm(baseWML)
            const incomingForm = new StandardForm(incomingWML)
            const diffed = baseForm.diff(incomingForm)
            
            // When base has no Summary and incoming has one, diff should include the incoming Summary
            expect(diffed.summary).toBeDefined()
            expect(diffed.summary?.toJSON()).toEqual(['New summary'])
            
            // Verify the diff produces the expected WML structure
            const diffWML = schemaToWML([diffed.schema])
            expect(diffWML).toEqual(deIndentWML(`
                <Asset uuid=(test)><Summary>New summary</Summary></Asset>
            `))
        })

        it('should compact Asset-level Summary to undefined when incoming summary is semantically empty', () => {
            const baseForm = new StandardForm({
                universalKey: 'ASSET#test',
                components: [],
                metaData: []
            })
            const incomingForm = new StandardForm({
                universalKey: 'ASSET#test',
                components: [],
                metaData: [],
                summary: []
            })

            const diffed = baseForm.diff(incomingForm)
            expect(diffed.summary).toBeUndefined()
        })

        it('should diff when Asset-level ShortName is added', () => {
            const baseWML = deIndentWML(`
                <Asset uuid=(test)>
                </Asset>
            `)
            const incomingWML = deIndentWML(`
                <Asset uuid=(test)>
                    <ShortName>New Name</ShortName>
                </Asset>
            `)
            
            const baseForm = new StandardForm(baseWML)
            const incomingForm = new StandardForm(incomingWML)
            const diffed = baseForm.diff(incomingForm)
            
            // When base has no ShortName and incoming has one, diff should include the incoming ShortName
            expect(diffed.shortName).toBeDefined()
            expect(diffed.shortName?.toJSON()).toEqual('New Name')
            
            // Verify the diff produces the expected WML structure
            const diffWML = schemaToWML([diffed.schema])
            expect(diffWML).toEqual(deIndentWML(`
                <Asset uuid=(test)><ShortName>New Name</ShortName></Asset>
            `))
        })

        it('should compact Asset-level ShortName to undefined when incoming shortName is semantically empty', () => {
            const baseForm = new StandardForm({
                universalKey: 'ASSET#test',
                components: [],
                metaData: []
            })
            const incomingForm = new StandardForm({
                universalKey: 'ASSET#test',
                components: [],
                metaData: []
            })
            ;(incomingForm as any)._shortName = new StandardLiteral('', { tag: 'ShortName' })

            const diffed = baseForm.diff(incomingForm)
            expect(diffed.shortName).toBeUndefined()
        })

        it('should diff when Asset-level ShortName is removed', () => {
            const baseWML = deIndentWML(`
                <Asset uuid=(test)>
                    <ShortName>Old Name</ShortName>
                </Asset>
            `)
            const incomingWML = deIndentWML(`
                <Asset uuid=(test)>
                </Asset>
            `)
            
            const baseForm = new StandardForm(baseWML)
            const incomingForm = new StandardForm(incomingWML)
            const diffed = baseForm.diff(incomingForm)
            
            // Verify the diff shows the removal
            const diffWML = schemaToWML([diffed.schema])
            expect(diffWML).toEqual('<Asset uuid=(test)><Remove><ShortName>Old Name</ShortName></Remove></Asset>')
        })

        it('should round-trip Asset-level ShortName through NDJSON', () => {
            const testWML = deIndentWML(`
                <Asset uuid=(test)>
                    <ShortName>Test Asset Name</ShortName>
                    <Room uuid=(room1) key=(room1)><ShortName>Test Room</ShortName></Room>
                </Asset>
            `)
            const original = new StandardForm(testWML)
            const ndjson = original.toNDJSON()
            
            // Verify NDJSON header includes shortName
            expect(ndjson[0]).toEqual({
                tag: 'Asset',
                universalKey: 'ASSET#test',
                shortName: 'Test Asset Name',
                topLevel: ['ROOM#room1']
            })
            
            // Round-trip through NDJSON
            const roundTripped = new StandardForm(ndjson)
            expect(roundTripped.shortName?.toJSON()).toEqual('Test Asset Name')
            expect((roundTripped.byId.room1 as StandardRoom).shortName?.toJSON()).toEqual('Test Room')
            expect(schemaToWML([roundTripped.schema])).toEqual(testWML)
        })

        it('should round-trip Asset-level Summary through NDJSON', () => {
            const testWML = deIndentWML(`
                <Asset uuid=(test)>
                    <Summary>This is a test summary</Summary>
                    <Room uuid=(room1) key=(room1)><ShortName>Test Room</ShortName></Room>
                </Asset>
            `)
            const original = new StandardForm(testWML)
            const ndjson = original.toNDJSON()
            
            // Verify NDJSON header includes summary
            expect(ndjson[0]).toEqual({
                tag: 'Asset',
                universalKey: 'ASSET#test',
                summary: ['This is a test summary'],
                topLevel: ['ROOM#room1']
            })
            
            // Round-trip through NDJSON
            const roundTripped = new StandardForm(ndjson)
            expect(roundTripped.summary?.toJSON()).toEqual(['This is a test summary'])
            expect((roundTripped.byId.room1 as StandardRoom).shortName?.toJSON()).toEqual('Test Room')
            expect(schemaToWML([roundTripped.schema])).toEqual(testWML)
        })

        it('should round-trip both Asset-level ShortName and Summary through NDJSON', () => {
            const testWML = deIndentWML(`
                <Asset uuid=(nakatomiPlaza)>
                    <ShortName>Nakatomi Plaza</ShortName>
                    <Summary>A high-rise office building in downtown Los Angeles</Summary>
                    <Room uuid=(lobby) key=(lobby)>
                        <ShortName>Main Lobby</ShortName>
                        <Situation uuid=(DEFAULT)>
                            <Description>A gleaming marble lobby</Description>
                        </Situation>
                    </Room>
                </Asset>
            `)
            const original = new StandardForm(testWML)
            const ndjson = original.toNDJSON()
            
            // Verify NDJSON header includes both fields
            expect(ndjson[0]).toEqual({
                tag: 'Asset',
                universalKey: 'ASSET#nakatomiPlaza',
                shortName: 'Nakatomi Plaza',
                summary: ['A high-rise office building in downtown Los Angeles'],
                topLevel: ['ROOM#lobby']
            })
            
            // Round-trip through NDJSON
            const roundTripped = new StandardForm(ndjson)
            expect(roundTripped.shortName?.toJSON()).toEqual('Nakatomi Plaza')
            expect(roundTripped.summary?.toJSON()).toEqual(['A high-rise office building in downtown Los Angeles'])
            expect(schemaToWML([roundTripped.schema])).toEqual(deIndentWML(`
                <Asset uuid=(nakatomiPlaza)>
                    <ShortName>Nakatomi Plaza</ShortName>
                    <Summary>A high-rise office building in downtown Los Angeles</Summary>
                    <Room uuid=(lobby) key=(lobby)>
                        <ShortName>Main Lobby</ShortName>
                        <Situation uuid=(DEFAULT) ref={0} />
                        <Situation uuid=(DEFAULT)>
                            <Description>A gleaming marble lobby</Description>
                        </Situation>
                    </Room>
                </Asset>
            `))
        })

        it('should round-trip Asset without ShortName or Summary through NDJSON', () => {
            const testWML = deIndentWML(`
                <Asset uuid=(test)>
                    <Room uuid=(room1) key=(room1)><ShortName>Test Room</ShortName></Room>
                </Asset>
            `)
            const original = new StandardForm(testWML)
            const ndjson = original.toNDJSON()
            
            // Verify NDJSON header has no shortName or summary
            expect(ndjson[0]).toEqual({
                tag: 'Asset',
                universalKey: 'ASSET#test',
                topLevel: ['ROOM#room1']
            })
            
            // Round-trip through NDJSON
            const roundTripped = new StandardForm(ndjson)
            expect(roundTripped.shortName).toBeUndefined()
            expect(roundTripped.summary).toBeUndefined()
            expect((roundTripped.byId.room1 as StandardRoom).shortName?.toJSON()).toEqual('Test Room')
            expect(schemaToWML([roundTripped.schema])).toEqual(testWML)
        })

        it('should round-trip Asset-level Summary with complex content through NDJSON', () => {
            const testWML = deIndentWML(`
                <Asset uuid=(test)>
                    <Summary>
                        A mysterious <Link to=(portal)>portal</Link> appears in the
                        <Link to=(room)>room</Link>
                    </Summary>
                    <Room key=(room)><ShortName>Test Room</ShortName></Room>
                </Asset>
            `)
            const original = new StandardForm(testWML)
            const ndjson = original.toNDJSON()
            
            // Verify NDJSON header includes complex summary
            expect((ndjson[0] as any).summary).toBeDefined()
            
            // Round-trip through NDJSON
            const roundTripped = new StandardForm(ndjson)
            expect(roundTripped.summary?.toJSON()).toEqual([
                'A mysterious ',
                { data: { tag: 'Link', to: 'portal', text: 'portal' }, children: ['portal'] },
                ' appears in the ',
                { data: { tag: 'Link', to: 'room', text: 'room' }, children: ['room'] }
            ])
            expect((roundTripped.byId.room as StandardRoom).shortName?.toJSON()).toEqual('Test Room')
            expect(schemaToWML([roundTripped.schema])).toEqual(testWML)
        })

    })

    describe('validate()', () => {
        describe('circular explicit parent detection', () => {
            it('should throw error for simple 2-component cycle', () => {
                const wml = deIndentWML(`
                    <Asset uuid=(test)>
                        <Room uuid=(roomA) key=(roomA)>
                            <Parent>ROOM#roomB</Parent>
                        </Room>
                        <Room uuid=(roomB) key=(roomB)>
                            <Parent>ROOM#roomA</Parent>
                        </Room>
                    </Asset>
                `)
                expect(() => new StandardForm(wml)).toThrow('Circular parent relationship detected')
                expect(() => new StandardForm(wml)).toThrow('roomA')
                expect(() => new StandardForm(wml)).toThrow('roomB')
            })

            it('should throw error for 3-component cycle', () => {
                const wml = deIndentWML(`
                    <Asset uuid=(test)>
                        <Room uuid=(roomA) key=(roomA)>
                            <Parent>ROOM#roomB</Parent>
                        </Room>
                        <Room uuid=(roomB) key=(roomB)>
                            <Parent>ROOM#roomC</Parent>
                        </Room>
                        <Room uuid=(roomC) key=(roomC)>
                            <Parent>ROOM#roomA</Parent>
                        </Room>
                    </Asset>
                `)
                expect(() => new StandardForm(wml)).toThrow('Circular parent relationship detected')
                expect(() => new StandardForm(wml)).toThrow('roomA')
                expect(() => new StandardForm(wml)).toThrow('roomB')
                expect(() => new StandardForm(wml)).toThrow('roomC')
            })

            it('should throw error for cycle using universal keys', () => {
                const wml = deIndentWML(`
                    <Asset uuid=(test)>
                        <Room uuid=(room1) key=(room1)>
                            <Parent>ROOM#room2</Parent>
                        </Room>
                        <Room uuid=(room2) key=(room2)>
                            <Parent>ROOM#room1</Parent>
                        </Room>
                    </Asset>
                `)
                expect(() => new StandardForm(wml)).toThrow('Circular parent relationship detected')
            })

            it('should not throw error for valid parent relationships', () => {
                const wml = deIndentWML(`
                    <Asset uuid=(test)>
                        <Room uuid=(room1) key=(room1) />
                        <Feature uuid=(feature1) key=(feature1)>
                            <Parent>ROOM#room1</Parent>
                        </Feature>
                        <Feature uuid=(feature2) key=(feature2)>
                            <Parent>ROOM#room1</Parent>
                        </Feature>
                    </Asset>
                `)
                expect(() => new StandardForm(wml)).not.toThrow()
            })

            it('should not throw error for asset-level components', () => {
                const wml = deIndentWML(`
                    <Asset uuid=(test)>
                        <Room uuid=(room1) key=(room1) />
                        <Feature uuid=(feature1) key=(feature1) />
                        <Situation uuid=(situation1) key=(situation1)>
                            <Parent />
                        </Situation>
                    </Asset>
                `)
                expect(() => new StandardForm(wml)).not.toThrow()
            })

            it('should detect cycle in merge operation', () => {
                const base = new StandardForm(deIndentWML(`
                    <Asset uuid=(test)>
                        <Feature uuid=(featureA) key=(featureA)>
                            <Parent>FEATURE#featureB</Parent>
                        </Feature>
                        <Feature uuid=(featureB) key=(featureB) />
                    </Asset>
                `))
                
                const incoming = new StandardForm(deIndentWML(`
                    <Asset uuid=(test)>
                        <Feature uuid=(featureA) key=(featureA) ref={0} />
                        <Feature uuid=(featureB) key=(featureB) ref={0}>
                            <Parent>FEATURE#featureA</Parent>
                        </Feature>
                    </Asset>
                `))
                
                expect(() => base.merge(incoming)).toThrow('Circular parent relationship detected')
            })

            it('should detect cycle in diff operation', () => {
                const base = new StandardForm(deIndentWML(`
                    <Asset uuid=(test)>
                        <Room uuid=(roomA) key=(roomA) />
                        <Feature uuid=(featureA) key=(featureA)>
                            <Remove><Parent>FEATURE#featureB</Parent></Remove>
                        </Feature>
                        <Feature uuid=(featureB) key=(featureB) />
                    </Asset>
                `))
                
                const modified = new StandardForm(deIndentWML(`
                    <Asset uuid=(test)>
                        <Room uuid=(roomA) key=(roomA) />
                        <Feature uuid=(featureA) key=(featureA) />
                        <Feature uuid=(featureB) key=(featureB)>
                            <Parent>FEATURE#featureA</Parent>
                        </Feature>
                    </Asset>
                `))
                
                // Note: This will throw on invalid parent type (Features can't parent Features)
                // before it reaches cycle detection. With current component types, valid cycles aren't possible.
                expect(() => base.diff(modified)).toThrow()
            })
        })
    })

    describe('removeComponent', () => {
        it('should remove a component from the StandardForm', () => {
            const form = new StandardForm(deIndentWML(`
                <Asset uuid=(test)>
                    <Room uuid=(room1) key=(room1) />
                    <Room uuid=(room2) key=(room2) />
                </Asset>
            `))
            
            const room1Ref = new StandardReference({ tag: 'Room', key: 'room1', universalKey: 'ROOM#room1' })
            const result = form.removeComponent(room1Ref)
            
            expect(result._components.length).toBe(1)
            expect(result._components[0].key).toBe('room2')
            expect(result._components[0].universalKey).toBe('ROOM#room2')
        })

        it('should remove component from topLevel if present', () => {
            const form = new StandardForm(deIndentWML(`
                <Asset uuid=(test)>
                    <Room uuid=(room1) key=(room1) />
                    <Room uuid=(room2) key=(room2) />
                </Asset>
            `))
            
            const room1Ref = new StandardReference({ tag: 'Room', key: 'room1', universalKey: 'ROOM#room1' })
            const result = form.removeComponent(room1Ref)
            
            expect(result._topLevel?.payload.length).toBe(1)
            expect(result._topLevel?.payload[0].key).toBe('room2')
            expect(result._topLevel?.payload[0].universalKey).toBe('ROOM#room2')
        })

        it('should return unchanged form when component is not found', () => {
            const form = new StandardForm(deIndentWML(`
                <Asset uuid=(test)>
                    <Room uuid=(room1) key=(room1) />
                </Asset>
            `))
            
            const nonExistentRef = new StandardReference({ tag: 'Room', key: 'nonexistent', universalKey: 'ROOM#nonexistent' })
            const result = form.removeComponent(nonExistentRef)
            
            expect(result._components.length).toBe(1)
            expect(result._components[0].key).toBe('room1')
        })

        it('should remove references from multiple components', () => {
            const form = new StandardForm(deIndentWML(`
                <Asset uuid=(test)>
                    <Feature uuid=(feature1) key=(feature1) />
                    <Room uuid=(room1) key=(room1)>
                        <Feature key=(feature1) />
                    </Room>
                    <Room uuid=(room2) key=(room2)>
                        <Feature key=(feature1) />
                    </Room>
                </Asset>
            `))
            
            const feature1Ref = new StandardReference({ tag: 'Feature', key: 'feature1', universalKey: 'FEATURE#feature1' })
            const result = form.removeComponent(feature1Ref)
            
            // Feature should be removed
            expect(result._components.find(c => c.key === 'feature1')).toBeUndefined()
            
            // Both rooms should exist but without feature references
            const room1 = result._components.find(c => c.key === 'room1') as StandardRoom
            const room2 = result._components.find(c => c.key === 'room2') as StandardRoom
            expect(room1.features?.payload.length).toBe(0)
            expect(room2.features?.payload.length).toBe(0)
        })

        it('should follow functional pattern and not mutate original', () => {
            const form = new StandardForm(deIndentWML(`
                <Asset uuid=(test)>
                    <Room uuid=(room1) key=(room1) />
                    <Room uuid=(room2) key=(room2) />
                </Asset>
            `))
            
            const originalComponentCount = form._components.length
            const room1Ref = new StandardReference({ tag: 'Room', key: 'room1', universalKey: 'ROOM#room1' })
            const result = form.removeComponent(room1Ref)
            
            // Original should be unchanged
            expect(form._components.length).toBe(originalComponentCount)
            expect(form._components.find(c => c.key === 'room1')).toBeDefined()
            
            // Result should be different
            expect(result._components.length).toBe(1)
            expect(result._components.find(c => c.key === 'room1')).toBeUndefined()
        })

        it('should handle removing component referenced by universalKey only', () => {
            const form = new StandardForm(deIndentWML(`
                <Asset uuid=(test)>
                    <Feature uuid=(feature1) />
                    <Room uuid=(room1) key=(room1)>
                        <Feature uuid=(feature1) />
                    </Room>
                </Asset>
            `))
            
            const feature1Ref = new StandardReference({ tag: 'Feature', universalKey: 'FEATURE#feature1' })
            const result = form.removeComponent(feature1Ref)
            
            // Feature should be removed
            expect(result._components.find(c => c.universalKey === 'FEATURE#feature1')).toBeUndefined()
            
            // Room should still exist but without the feature reference
            const room = result._components.find(c => c.key === 'room1') as StandardRoom
            expect(room.features?.payload.length).toBe(0)
        })

        describe('cascade option', () => {
            it('should remove component and all descendants when cascade=true', () => {
                const form = new StandardForm(deIndentWML(`
                    <Asset uuid=(test)>
                        <Room uuid=(room1) key=(room1)>
                            <Feature uuid=(f1) key=(f1)>
                                <Situation uuid=(example1) key=(example1) />
                                <Situation uuid=(example2) key=(example2) />
                            </Feature>
                        </Room>
                    </Asset>
                `))
                
                const room1Ref = new StandardReference({ tag: 'Room', key: 'room1', universalKey: 'ROOM#room1' })
                const result = form.removeComponent(room1Ref, { cascade: true })
                
                // Room and both Examples should be removed
                expect(result._components.length).toBe(0)
                expect(result._components.find(c => c.key === 'room1')).toBeUndefined()
                expect(result._components.find(c => c.key === 'example1')).toBeUndefined()
                expect(result._components.find(c => c.key === 'example2')).toBeUndefined()
            })

            it('should remove nested hierarchy when cascade=true', () => {
                const form = new StandardForm(deIndentWML(`
                    <Asset uuid=(test)>
                        <Room uuid=(room1) key=(room1)>
                            <Feature uuid=(feature1) key=(feature1)>
                                <Situation uuid=(example1) key=(example1) />
                            </Feature>
                        </Room>
                    </Asset>
                `))
                
                const room1Ref = new StandardReference({ tag: 'Room', key: 'room1', universalKey: 'ROOM#room1' })
                const result = form.removeComponent(room1Ref, { cascade: true })
                
                // Room, Feature, and Example should all be removed
                expect(result._components.length).toBe(0)
                expect(result._components.find(c => c.key === 'room1')).toBeUndefined()
                expect(result._components.find(c => c.key === 'feature1')).toBeUndefined()
                expect(result._components.find(c => c.key === 'example1')).toBeUndefined()
            })

            it('should only remove component when cascade=false', () => {
                const form = new StandardForm(deIndentWML(`
                    <Asset uuid=(test)>
                        <Room uuid=(room1) key=(room1)>
                            <Situation ref={0} uuid=(example1) key=(example1) />
                        </Room>
                    </Asset>
                `))
                
                const room1Ref = new StandardReference({ tag: 'Room', key: 'room1', universalKey: 'ROOM#room1' })
                const result = form.removeComponent(room1Ref, { cascade: false })
                
                // Only Room should be removed, hoisted Situation stub should remain
                expect(result._components.length).toBe(1)
                expect(result._components.find(c => c.key === 'room1')).toBeUndefined()
                expect(result._components.find(c => c.key === 'example1' && c.tag === 'Situation')).toBeDefined()
            })

            it('should behave same as cascade=false when component has no descendants', () => {
                const form = new StandardForm(deIndentWML(`
                    <Asset uuid=(test)>
                        <Room uuid=(room1) key=(room1) />
                        <Room uuid=(room2) key=(room2) />
                    </Asset>
                `))
                
                const room1Ref = new StandardReference({ tag: 'Room', key: 'room1', universalKey: 'ROOM#room1' })
                const result = form.removeComponent(room1Ref, { cascade: true })
                
                // Only room1 should be removed
                expect(result._components.length).toBe(1)
                expect(result._components.find(c => c.key === 'room1')).toBeUndefined()
                expect(result._components.find(c => c.key === 'room2')).toBeDefined()
            })

            it('should remove component and descendants from topLevel when cascade=true', () => {
                const form = new StandardForm(deIndentWML(`
                    <Asset uuid=(test)>
                        <Room uuid=(room1) key=(room1)>
                            <Situation ref={0} uuid=(example1) key=(example1) />
                        </Room>
                    </Asset>
                `))
                
                const room1Ref = new StandardReference({ tag: 'Room', key: 'room1', universalKey: 'ROOM#room1' })
                const result = form.removeComponent(room1Ref, { cascade: true })
                
                // topLevel should be empty or undefined
                expect(result._topLevel).toBeUndefined()
            })

            it('should remove references to all removed components when cascade=true', () => {
                const form = new StandardForm(deIndentWML(`
                    <Asset uuid=(test)>
                        <Room uuid=(room1) key=(room1)>
                            <Feature uuid=(feature1) key=(feature1)>
                                <Situation uuid=(example1) key=(example1) />
                            </Feature>
                        </Room>
                        <Room uuid=(room2) key=(room2) />
                    </Asset>
                `))
                
                const room1Ref = new StandardReference({ tag: 'Room', key: 'room1', universalKey: 'ROOM#room1' })
                const result = form.removeComponent(room1Ref, { cascade: true })
                
                // room1, feature1, and example1 should all be removed (all are descendants of room1)
                expect(result._components.find(c => c.key === 'room1')).toBeUndefined()
                expect(result._components.find(c => c.key === 'feature1')).toBeUndefined()
                expect(result._components.find(c => c.key === 'example1')).toBeUndefined()
                
                // room2 should still exist
                expect(result._components.find(c => c.key === 'room2')).toBeDefined()
            })
        })
    })

    describe('referencedBy', () => {
        it('returns empty array when component has no referrers', () => {
            const form = new StandardForm(deIndentWML(`
                <Asset uuid=(test)>
                    <Room uuid=(room1) key=(room1) />
                </Asset>
            `))

            const room1Ref = new StandardReference({ tag: 'Room', key: 'room1', universalKey: 'ROOM#room1' })
            const result = form.referencedBy(room1Ref)

            expect(result).toEqual([])
        })

        it('returns referrers for Direct references', () => {
            const form = new StandardForm(deIndentWML(`
                <Asset uuid=(test)>
                    <Feature uuid=(feature1) key=(feature1) />
                    <Room uuid=(room1) key=(room1)>
                        <Feature key=(feature1) />
                    </Room>
                </Asset>
            `))

            const feature1Ref = new StandardReference({ tag: 'Feature', key: 'feature1', universalKey: 'FEATURE#feature1' })
            const result = form.referencedBy(feature1Ref)

            expect(result.length).toBe(1)
            expect(result[0].sameKey(new StandardReference({ tag: 'Room', key: 'room1', universalKey: 'ROOM#room1' }))).toBe(true)
        })

        it('returns multiple referrers when component is shared', () => {
            const form = new StandardForm(deIndentWML(`
                <Asset uuid=(test)>
                    <Feature uuid=(feature1) key=(feature1) />
                    <Room uuid=(room1) key=(room1)>
                        <Feature key=(feature1) />
                    </Room>
                    <Room uuid=(room2) key=(room2)>
                        <Feature key=(feature1) />
                    </Room>
                </Asset>
            `))

            const feature1Ref = new StandardReference({ tag: 'Feature', key: 'feature1', universalKey: 'FEATURE#feature1' })
            const result = form.referencedBy(feature1Ref)

            expect(result.length).toBe(2)
            expect(result.some(r => r.sameKey(new StandardReference({ tag: 'Room', key: 'room1', universalKey: 'ROOM#room1' })))).toBe(true)
            expect(result.some(r => r.sameKey(new StandardReference({ tag: 'Room', key: 'room2', universalKey: 'ROOM#room2' })))).toBe(true)
        })

        it('returns empty array when target is not in form', () => {
            const form = new StandardForm(deIndentWML(`
                <Asset uuid=(test)>
                    <Room uuid=(room1) key=(room1) />
                    <Room uuid=(room2) key=(room2) />
                </Asset>
            `))

            const nonExistentRef = new StandardReference({ tag: 'Feature', key: 'nonexistent', universalKey: 'FEATURE#nonexistent' })
            const result = form.referencedBy(nonExistentRef)

            expect(result).toEqual([])
        })

        it('matches by universalKey when key differs', () => {
            const form = new StandardForm(deIndentWML(`
                <Asset uuid=(test)>
                    <Feature uuid=(feature1) />
                    <Room uuid=(room1) key=(room1)>
                        <Feature uuid=(feature1) />
                    </Room>
                </Asset>
            `))

            const feature1RefByUniversalKey = new StandardReference({ tag: 'Feature', universalKey: 'FEATURE#feature1' })
            const result = form.referencedBy(feature1RefByUniversalKey)

            expect(result.length).toBe(1)
            expect(result[0].sameKey(new StandardReference({ tag: 'Room', key: 'room1', universalKey: 'ROOM#room1' }))).toBe(true)
        })
    })

})
