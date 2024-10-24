import { Schema, schemaToWML } from '../../schema'
import { Standardizer } from '..'
import { deIndentWML } from '../../schema/utils'
import { serialize, deserialize } from '.'
describe('standard form serialize' ,() => {
    it('should return single line on empty asset', () => {
        expect(serialize({
            tag: 'Asset',
            key: 'Test',
            byId: {},
            metaData: []
        })).toEqual([{ tag: 'Asset', key: 'Test', universalId: 'ASSET#Test' }])
    })
    it('should serialize all component types', () => {
        const schema = new Schema()
        schema.loadWML(deIndentWML(`
            <Asset key=(test)>
                <Image key=(testBackground) />
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
                <Map key=(testMap)>
                    <Image key=(testBackground) />
                    <Room key=(testRoom)><Position x="0" y="100" /></Room>
                </Map>
                <Moment key=(openDoorMoment)>
                    <Message key=(openDoor)>
                        The door opens!
                        <Room key=(testRoom) />
                    </Message>
                </Moment>
            </Asset>
        `))
        const universalKeys = {
            testBackground: 'IMAGE#001',
            testRoom: 'ROOM#002',
            testFeature: 'FEATURE#003',
            testKnowledge: 'KNOWLEDGE#004',
            testMap: 'MAP#005',
            openDoor: 'MESSAGE#006',
            openDoorMoment: 'MOMENT#007',
            open: 'VARIABLE#008',
            closed: 'COMPUTED#009',
            toggleOpen: 'ACTION#010'
        }
        const universalKey = (key: string): string => {
            if (!(key in universalKeys)) {
                throw new Error('Key not in mock universalKeys')
            }
            return universalKeys[key]
        }
        const fileAssociations = {
            testBackground: 'IMAGE-001'
        }
        const fileAssociation = (key: string): string => {
            return fileAssociations[key]
        }
        const standard = new Standardizer(schema.schema)
        expect(serialize(standard.standardForm, universalKey, fileAssociation)).toMatchSnapshot()
    })
    it('should serialize a character', () => {
        const schema = new Schema()
        schema.loadWML(deIndentWML(`
            <Character key=(Tess)>
                <Name>Tess</Name>
                <Pronouns
                    subject="she"
                    object="her"
                    possessive="her"
                    adjective="hers"
                    reflexive="herself"
                />
                <FirstImpression>Frumpy Goth</FirstImpression>
                <OneCoolThing>Fuchsia eyes</OneCoolThing>
                <Outfit>
                    A bulky frock-coat lovingly kit-bashed from a black hoodie and patchily dyed lace.
                </Outfit>
                <Image key=(TessIcon) />
            </Character>
        `))
        const universalKeys = {
            Tess: 'CHARACTER#001',
            TessIcon: 'IMAGE#002'
        }
        const universalKey = (key: string): string => {
            if (!(key in universalKeys)) {
                throw new Error('Key not in mock universalKeys')
            }
            return universalKeys[key]
        }
        const fileAssociations = {
            TessIcon: 'IMAGE-002'
        }
        const fileAssociation = (key: string): string => {
            return fileAssociations[key]
        }
        const standard = new Standardizer(schema.schema)
        expect(serialize(standard.standardForm, universalKey, fileAssociation)).toMatchSnapshot()
    })
    it('should serialize universal keys', () => {
        const schema = new Schema()
        schema.loadWML(deIndentWML(`
            <Asset key=(test)>
                <Room key=(testRoom)>
                    <ShortName>Vortex</ShortName>
                    <Name>Vortex</Name>
                    <Description>Vortex Desc</Description>
                </Room>
                <Feature key=(testFeature)>
                    <Name>Clocktower</Name>
                    <Description>A tower built of white sandstone blocks, with an ornate clock set on the northern face.</Description>
                </Feature>
            </Asset>
        `))
        const standard = new Standardizer(schema.schema)
        expect(serialize(standard.standardForm, (key, tag) => (`${tag.toUpperCase()}#UUID`))).toMatchSnapshot()
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
        expect(serialize(standard.standardForm)).toEqual([
            { tag: 'Asset', key: 'test', universalId: 'ASSET#test' },
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
        expect(serialize(standard.standardForm)).toEqual([
            { tag: 'Asset', key: 'test', universalId: 'ASSET#test' },
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
describe('standard form deserialize' ,() => {
    it('should return empty asset from single line', () => {
        expect(deserialize([{ tag: 'Asset', key: 'Test' }]).standardForm).toEqual({
            tag: 'Asset',
            key: 'Test',
            byId: {},
            metaData: []
        })
    })
    it('should round-trip all component types', () => {
        const testWML = deIndentWML(`
            <Asset key=(test)>
                <Image key=(testBackground) />
                <Room key=(testRoom)>
                    <ShortName>Vortex</ShortName>
                    <Name>Vortex</Name>
                    <Description>Vortex Desc</Description>
                </Room>
                <Feature key=(testFeature)>
                    <Name>Clocktower</Name>
                    <Description>
                        A tower built of white sandstone blocks, with an ornate clock set on
                        the northern face.
                    </Description>
                </Feature>
                <Knowledge key=(testKnowledge)>
                    <Name>Learn</Name>
                    <Description>There is so much to know!</Description>
                </Knowledge>
                <Map key=(testMap)>
                    <Image key=(testBackground) />
                    <Room key=(testRoom)><Position x="0" y="100" /></Room>
                </Map>
                <Message key=(openDoor)><Room key=(testRoom) />The door opens!</Message>
                <Moment key=(openDoorMoment)><Message key=(openDoor) /></Moment>
                <Variable key=(open) default={false} />
                <Computed key=(closed) src={!open} />
                <Action key=(toggleOpen) src={open = !open} />
            </Asset>
        `)
        const schema = new Schema()
        schema.loadWML(testWML)
        const universalKeys = {
            testBackground: 'IMAGE#001',
            testRoom: 'ROOM#002',
            testFeature: 'FEATURE#003',
            testKnowledge: 'KNOWLEDGE#004',
            testMap: 'MAP#005',
            openDoor: 'MESSAGE#006',
            openDoorMoment: 'MOMENT#007',
            open: 'VARIABLE#008',
            closed: 'COMPUTED#009',
            toggleOpen: 'ACTION#010'
        }
        const universalKey = (key: string): string => {
            if (!(key in universalKeys)) {
                throw new Error('Key not in mock universalKeys')
            }
            return universalKeys[key]
        }
        const fileAssociations = {
            testBackground: 'IMAGE-001'
        }
        const fileAssociation = (key: string): string => {
            return fileAssociations[key]
        }
        const standard = new Standardizer(schema.schema)
        const ndjson = serialize(standard.standardForm, universalKey, fileAssociation)
        const deserialized = new Standardizer()
        const results = deserialize(ndjson)
        deserialized.loadStandardForm(results.standardForm)
        expect(schemaToWML(deserialized.schema)).toEqual(testWML)
        expect(results.universalKeys).toEqual(universalKeys)
        expect(results.fileAssociations).toEqual(fileAssociations)
    })
    it('should round-trip a character', () => {
        const testWML = deIndentWML(`
            <Character key=(Tess)>
                <Name>Tess</Name>
                <Pronouns
                    subject="she"
                    object="her"
                    possessive="her"
                    adjective="hers"
                    reflexive="herself"
                />
                <FirstImpression>Frumpy Goth</FirstImpression>
                <OneCoolThing>Fuchsia eyes</OneCoolThing>
                <Outfit>
                    A bulky frock-coat lovingly kit-bashed from a black hoodie and patchily dyed lace.
                </Outfit>
                <Image key=(TessIcon) />
            </Character>
        `)
        const schema = new Schema()
        schema.loadWML(testWML)
        const universalKeys = {
            Tess: 'CHARACTER#001',
            TessIcon: 'IMAGE#002'
        }
        const universalKey = (key: string): string => {
            if (!(key in universalKeys)) {
                throw new Error('Key not in mock universalKeys')
            }
            return universalKeys[key]
        }
        const fileAssociations = {
            TessIcon: 'IMAGE-002'
        }
        const fileAssociation = (key: string): string => {
            return fileAssociations[key]
        }
        const standard = new Standardizer(schema.schema)
        const ndjson = serialize(standard.standardForm, universalKey, fileAssociation)
        const deserialized = new Standardizer()
        const results = deserialize(ndjson)
        deserialized.loadStandardForm(results.standardForm)
        expect(schemaToWML(deserialized.schema)).toEqual(testWML)
        expect(results.universalKeys).toEqual(universalKeys)
        expect(results.fileAssociations).toEqual(fileAssociations)
    })
    it('should deserialize imports', () => {
        const testWML = deIndentWML(`
            <Asset key=(test)>
                <Import from=(testImport)><Room key=(testIn) as=(testRoom) /></Import>
                <Room key=(testRoom)><ShortName>Test</ShortName></Room>
            </Asset>
        `)
        const schema = new Schema()
        schema.loadWML(testWML)
        const standard = new Standardizer(schema.schema)
        const ndjson = serialize(standard.standardForm)
        const deserialized = new Standardizer()
        deserialized.loadStandardForm(deserialize(ndjson).standardForm)
        expect(schemaToWML(deserialized.schema)).toEqual(testWML)
    })
    it('should deserialize exports', () => {
        const testWML = deIndentWML(`
            <Asset key=(test)>
                <Room key=(testRoom)><ShortName>Test</ShortName></Room>
                <Export><Room key=(testRoom) as=(Room3) /></Export>
            </Asset>
        `)
        const schema = new Schema()
        schema.loadWML(testWML)
        const standard = new Standardizer(schema.schema)
        const ndjson = serialize(standard.standardForm)
        const deserialized = new Standardizer()
        deserialized.loadStandardForm(deserialize(ndjson).standardForm)
        expect(schemaToWML(deserialized.schema)).toEqual(testWML)
    })
})