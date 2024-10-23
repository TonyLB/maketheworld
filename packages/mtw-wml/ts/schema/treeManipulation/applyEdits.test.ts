import { schemaFromParse, schemaToWML } from '..'
import tokenizer from '../../parser/tokenizer'
import SourceStream from '../../parser/tokenizer/sourceStream'
import parse from '../../simpleParser'
import { deIndentWML } from '../utils'

import applyEdits from './applyEdits'

describe('applyEdits', () => {
    const schemaTest = (wml: string) => (schemaFromParse(parse(tokenizer(new SourceStream(wml)))))

    it('should leave non-edit syntax untouched', () => {
        const testOne = schemaTest(`
            <Asset key=(test)>
                <Room key=(testRoomOne)>
                    <Description>Test description</Description>
                    <Exit to=(testRoomTwo)>out</Exit>
                </Room>
                <Room key=(testRoomTwo) />
            </Asset>
        `)
        expect(applyEdits(testOne)).toEqual(testOne)
    })

    it('should apply replace that matches present content', () => {
        const test = schemaTest(`
            <Asset key=(test)>
                <Room key=(testRoomOne)>
                    <Description>Test description</Description>
                    <Replace><Description>Test description</Description></Replace>
                    <With><Description>New test</Description></With>
                </Room>
            </Asset>
        `)
        expect(schemaToWML(applyEdits(test))).toEqual(deIndentWML(`
            <Asset key=(test)>
                <Room key=(testRoomOne)><Description>New test</Description></Room>
            </Asset>
        `))
    })

    it('should correctly remove keyed items', () => {
        const test = schemaTest(`
            <Asset key=(test)>
                <Room key=(testRoomOne) />
                <Room key=(testRoomTwo)>
                    <Exit to=(testRoomOne)>out</Exit>
                    <Remove><Exit to=(testRoomOne)>out</Exit></Remove>
                    <Exit to=(testRoomOne)>depart</Exit>
                </Room>
            </Asset>
        `)
        expect(schemaToWML(applyEdits(test))).toEqual(deIndentWML(`
            <Asset key=(test)>
                <Room key=(testRoomOne) />
                <Room key=(testRoomTwo)><Exit to=(testRoomOne)>depart</Exit></Room>
            </Asset>
        `))
    })

    it('should apply replace that exceeds present content', () => {
        const test = schemaTest(`
            <Asset key=(test)>
                <Room key=(testRoomOne)>
                    <Description>description</Description>
                    <Replace><Description>Test description</Description></Replace>
                    <With><Description>New test</Description></With>
                </Room>
            </Asset>
        `)
        expect(schemaToWML(applyEdits(test))).toEqual(deIndentWML(`
            <Asset key=(test)>
                <Room key=(testRoomOne)>
                    <Replace><Description>Test<Space /></Description></Replace>
                    <With><Description>New test</Description></With>
                </Room>
            </Asset>
        `))
    })

    it('should no-op an add combined with a matching remove', () => {
        const test = schemaTest(`
            <Asset key=(test)>
                <Room key=(testRoomOne)>
                    <Description>Test description</Description>
                    <Remove><Description>Test description</Description></Remove>
                </Room>
            </Asset>
        `)
        expect(schemaToWML(applyEdits(test))).toEqual(deIndentWML(`
            <Asset key=(test)><Room key=(testRoomOne) /></Asset>
        `))
    })

    it('should leave edit syntax with no preceding referent untouched', () => {
        const testOne = schemaTest(`
            <Asset key=(test)>
                <Room key=(testRoomOne)>
                    <Replace><Description>Test description</Description></Replace>
                    <With><Description>New description</Description></With>
                    <Remove><Exit to=(testRoomTwo)>out</Exit></Remove>
                </Room>
                <Room key=(testRoomTwo) />
            </Asset>
        `)
        expect(applyEdits(testOne)).toEqual(testOne)
    })

    it('should merge with empty values', () => {
        const testOne = schemaTest(`
            <Asset key=(test)>
                <Room key=(testRoomOne)>
                    <ShortName />
                    <Replace><ShortName>Test</ShortName></Replace>
                    <With><ShortName>TestReplace</ShortName></With>
                </Room>
            </Asset>
        `)
        expect(schemaToWML(applyEdits(testOne))).toEqual(deIndentWML(`
            <Asset key=(test)>
                <Room key=(testRoomOne)>
                    <Replace><ShortName>Test</ShortName></Replace>
                    <With><ShortName>TestReplace</ShortName></With>
                </Room>
            </Asset>
        `))
    })

    it('should filter no-op replace combinations', () => {
        const testOne = schemaTest(`
            <Asset key=(test)>
                <Room key=(testRoomOne)>
                    <Replace><ShortName>One</ShortName></Replace>
                    <With><ShortName>Two</ShortName></With>
                    <Replace><ShortName>Two</ShortName></Replace>
                    <With><ShortName>One</ShortName></With>
                </Room>
            </Asset>
        `)
        expect(schemaToWML(applyEdits(testOne))).toEqual(deIndentWML(`
            <Asset key=(test)><Room key=(testRoomOne) /></Asset>
        `))
    })

})