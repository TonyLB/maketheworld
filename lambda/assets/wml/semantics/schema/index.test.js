import wmlGrammar from '../../wmlGrammar/wml.ohm-bundle.js'
import { wmlSemantics } from '../../index.js'

describe('WML semantic schema', () => {
    it('should parse elements properly', () => {
        const match = wmlGrammar.match(`
            <Asset key=(Test) fileName="test">
                <Import from=(BASE)>
                    <Use key=(basePower) type="Variable" as=(power) />
                    <Use key=(overview) type="Room" />
                </Import>
                <Room key=(ABC)>
                    <Name>Vortex</Name>
                    <Description>
                        Vortex
                        <Link key=(switchToggle) to=(toggleOpen)>(toggle)</Link>
                    </Description>
                    <Exit from=(DEF)>vortex</Exit>
                </Room>
                <Condition if={open}>
                    <Depend on=(open) />
                    <Room key=(ABC)>
                        <Exit to=(DEF)>welcome</Exit>
                    </Room>
                </Condition>
                <Room key=(DEF)>
                    <Name>Welcome</Name>
                </Room>
                <Variable key=(open) default={false} />
                <Action key=(toggleOpen) src={open = !open} />
                <Computed key=(closed) src={!open}>
                    <Depend on=(open) />
                </Computed>
            </Asset>
        `)
        const schema = wmlSemantics(match).schema()
        expect(schema).toMatchSnapshot()
    })

    it('should parse a character element', () => {
        const match = wmlGrammar.match(`
            <Character key=(Tess) fileName="Tess" player="testy" zone="Library">
                <Image key=(icon) fileURL="testIcon.png" />
                <Name>Tess</Name>
                <Pronouns
                    subject="she"
                    object="her"
                    possessive="her"
                    adjective="hers"
                    reflexive="herself"
                />
            </Character>
        `)
        const schema = wmlSemantics(match).schema()
        expect(schema).toMatchSnapshot()
    })

    it('should parse a story element', () => {
        const match = wmlGrammar.match(`
            <Story key=(Test) instance fileName="test">
                <Room key=(ABC)>
                    <Name>Vortex</Name>
                    <Description>Vortex</Description>
                </Room>
            </Story>
        `)
        const schema = wmlSemantics(match).schema()
        expect(schema).toMatchSnapshot()
    })

    it('should parse feature elements', () => {
        const match = wmlGrammar.match(`
            <Story key=(Test) instance fileName="test">
                <Feature key=(clockTower)>
                    <Description>
                        A clock-tower of weathered grey stone looms over the area.
                    </Description>
                </Feature>
                <Room key=(ABC)>
                    <Name>Vortex</Name>
                    <Feature key=(clockTower) />
                    <Description>Vortex</Description>
                </Room>
            </Story>
        `)
        const schema = wmlSemantics(match).schema()
        expect(schema).toMatchSnapshot()
    })

    it('should parse map elements', () => {
        const match = wmlGrammar.match(`
            <Story key=(Test) instance fileName="test">
                <Map key=(TestMap)>
                    <Name>Test Map</Name>
                    <Image key=(ImageTest) fileURL="https://test.com/imageTest.png" />
                    <Room key=(ABC) x="200" y="150" />
                </Map>
            </Story>
        `)
        const schema = wmlSemantics(match).schema()
        expect(schema).toMatchSnapshot()
    })

    it('should derive spaceBefore and spaceAfter properties from whitespace in description', () => {
        const match = wmlGrammar.match(`
            <Story key=(Test) instance fileName="test">
                <Feature key=(stone) />
                <Feature key=(clockTower)>
                    <Description>
                        A clock-tower of weathered grey-<Link key=(towerStone) to=(stone)>stone</Link> looms over the area.
                    </Description>
                </Feature>
                <Room key=(ABC)>
                    <Feature key=(clockTower) />
                    <Description>
                        A spinning tumble of wreckage, surrounding a
                        <Link key=(vortexClockTower) to=(clockTower)>clock tower</Link>.
                    </Description>
                </Room>
            </Story>
        `)
        const schema = wmlSemantics(match).schema()
        expect(schema).toMatchSnapshot()
    })

    it('should percolate description spaceBefore and spaceAfter up hierarchy', () => {
        const match = wmlGrammar.match(`
            <Story key=(Test) instance fileName="test">
                <Feature key=(clockTower)>
                    <Description spaceBefore spaceAfter>
                        A clock-tower of weathered grey stone looms over the area.
                    </Description>
                </Feature>
                <Room key=(ABC)>
                    <Name>Vortex</Name>
                    <Feature key=(clockTower) />
                    <Description spaceBefore spaceAfter>Vortex</Description>
                </Room>
            </Story>
        `)
        const schema = wmlSemantics(match).schema()
        expect(schema).toMatchSnapshot()
    })

})