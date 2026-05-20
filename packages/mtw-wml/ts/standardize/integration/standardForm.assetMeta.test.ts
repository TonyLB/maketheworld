import { Schema, schemaToWML, treeFromWML } from '../../schema'
import { StandardForm } from '..'
import { deIndentWML } from '../../schema/utils'
import { GenericTreeNode } from '@tonylb/mtw-base/ts/genericTree'
import { SchemaTag } from '@tonylb/mtw-base/ts/schema'
import StandardRoom from '../components/room'
import StandardKnowledge from '../components/knowledge'
import StandardCharacter from '../components/character'
import { ReferenceList } from '../keys/referenceList'
import StandardReference from '../keys/reference'
import { StandardKey } from '../keys/key'
import StandardFeature from '../components/feature'
import StandardSituation from '../components/situation'
import { StandardLiteral } from '../literal'
import StandardMap from '../components/map'
import StandardMark, { StandardLens } from '../components/worldState'
import { StandardMarkFacet } from '../keys/facets/mark'
import { StandardExplicitKey } from '../explicit/key'
import { isStandardForm, isStandardFormInput, StandardFormData } from '../components/dataTypes'

jest.mock('@tonylb/mtw-utilities/ts/uuid/index', () => {
    return {
        ...jest.requireActual('@tonylb/mtw-utilities/ts/uuid/___mocks___/index')
    }
})


describe('StandardForm', () => {
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

    describe('imports through NDJSON', () => {
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
    })
})
