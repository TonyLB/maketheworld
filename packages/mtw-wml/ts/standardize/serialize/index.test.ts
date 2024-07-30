import { Schema } from '../../schema'
import { Standardizer } from '..'
import { deIndentWML } from '../../schema/utils'
import { serialize } from '.'

describe('standard form serialize' ,() => {
    it('should return single line on empty asset', () => {
        expect(serialize({
            tag: 'Asset',
            key: 'Test',
            byId: {},
            metaData: []
        })).toEqual([{ tag: 'Asset', key: 'Test' }])
    })

    it('should serialize all component types', () => {
        const schema = new Schema()
        schema.loadWML(deIndentWML(`
            <Asset key=(test)>
                <Image key=(testIcon) />
                <Variable key=(open) default={false} />
                <Action key=(toggleOpen) src={open = !open} />
                <Computed key=(closed) src={!open} />
                <Room key=(testRoom)>
                    <ShortName>Vortex</ShortName>
                    <Name>Vortex</Name>
                    <Description>Vortex Desc</Description>
                </Room>
                <Feature key=(testFeature)>
                    <Name>Clocktower</Name>
                    <Description>A tower built of white sandstone blocks, with an ornate clock set on the northern face.</Description>
                </Feature>
                <Knowledge key=(testKnowledge)>
                    <Name>Learn</Name>
                    <Description>
                        There is so much to know!
                    </Description>
                </Knowledge>
                <Moment key=(openDoorMoment)>
                    <Message key=(openDoor)>
                        The door opens!
                        <Room key=(testRoom) />
                    </Message>
                </Moment>
            </Asset>
        `))
        const standard = new Standardizer(schema.schema)
        expect(serialize(standard.stripped)).toMatchSnapshot()
    })

    it('should serialize imports', () => {
        const schema = new Schema()
        schema.loadWML(deIndentWML(`
            <Asset key=(test)>
                <Import from=(testImport)><Room key=(testIn) as=(testRoom) /></Import>
                <Room key=(testRoom)>
                    <ShortName>Test</ShortName>
                </Room>
            </Asset>
        `))
        const standard = new Standardizer(schema.schema)
        expect(serialize(standard.stripped)).toEqual([
            { tag: 'Asset', key: 'test' },
            {
                tag: 'Room',
                from: { assetId: 'testImport', key: 'testIn' },
                key: 'testRoom',
                shortName: { data: { tag: 'ShortName' }, children: [{ data: { tag: 'String', value: 'Test' }, children: [] }] },
                name: { data: { tag: 'Name' }, children: [] },
                summary: { data: { tag: 'Summary' }, children: [] },
                description: { data: { tag: 'Description' }, children: [] },
                exits: [],
                themes: []
            }
        ])
    })

    it('should serialize exports', () => {
        const schema = new Schema()
        schema.loadWML(deIndentWML(`
            <Asset key=(test)>
                <Room key=(testRoom)>
                    <ShortName>Test</ShortName>
                </Room>
                <Export><Room key=(testRoom) as=(Room3) /></Export>
            </Asset>
        `))
        const standard = new Standardizer(schema.schema)
        expect(serialize(standard.stripped)).toEqual([
            { tag: 'Asset', key: 'test' },
            {
                tag: 'Room',
                key: 'testRoom',
                exportAs: 'Room3',
                shortName: { data: { tag: 'ShortName' }, children: [{ data: { tag: 'String', value: 'Test' }, children: [] }] },
                name: { data: { tag: 'Name' }, children: [] },
                summary: { data: { tag: 'Summary' }, children: [] },
                description: { data: { tag: 'Description' }, children: [] },
                exits: [],
                themes: []
            }
        ])
    })

})