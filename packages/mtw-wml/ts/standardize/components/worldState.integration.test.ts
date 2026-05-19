import { schemaToWML } from '../../schema'
import { StandardForm } from '..'
import { deIndentWML } from '../../schema/utils'
import StandardMark, { StandardLens } from './worldState'

jest.mock('@tonylb/mtw-utilities/ts/uuid/index', () => {
    return {
        ...jest.requireActual('@tonylb/mtw-utilities/ts/uuid/___mocks___/index')
    }
})

describe('StandardWorldState integration', () => {
    describe('Lens and Mark round-trips', () => {
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
    })
})
