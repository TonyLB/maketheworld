import { schemaToWML } from '../../schema'
import { deIndentWML } from '../../schema/utils'
import { StandardComponent } from './baseClasses'
import { StandardCharacter } from './character'
import StandardFeature from './feature'
import StandardGuidance from './guidance'
import StandardImage from './image'
import StandardKnowledge from './knowledge'
import StandardMap from './map'
import StandardMessage from './message'
import StandardMoment from './moment'
import { StandardRoom } from './room'
import StandardSituation from './situation'
import StandardMark, { StandardLens } from './worldState'

const LABEL = 'Label'

type RoundTripCase = {
    tag: string
    wml: string
    expected: string
    Component: new (wml: string) => StandardComponent
}

const shortNameRoundTripCases: RoundTripCase[] = [
    {
        tag: 'Character',
        wml: `
            <Character key=(test)>
                <ShortName>${LABEL}</ShortName>
                <Pronouns>they/them</Pronouns>
            </Character>
        `,
        expected: `
            <Character key=(test)>
                <ShortName>${LABEL}</ShortName>
                <Pronouns>they/them</Pronouns>
            </Character>
        `,
        Component: StandardCharacter,
    },
    {
        tag: 'Feature',
        wml: `<Feature key=(test)><ShortName>${LABEL}</ShortName></Feature>`,
        expected: `<Feature key=(test)><ShortName>${LABEL}</ShortName></Feature>`,
        Component: StandardFeature,
    },
    {
        tag: 'Guidance',
        wml: `
            <Guidance key=(test)>
                <ShortName>${LABEL}</ShortName>
                <Instructions>Test instructions</Instructions>
            </Guidance>
        `,
        expected: `
            <Guidance key=(test)>
                <ShortName>${LABEL}</ShortName>
                <Instructions>Test instructions</Instructions>
            </Guidance>
        `,
        Component: StandardGuidance,
    },
    {
        tag: 'Image',
        wml: `<Image key=(test)><ShortName>${LABEL}</ShortName></Image>`,
        expected: `<Image key=(test)><ShortName>${LABEL}</ShortName></Image>`,
        Component: StandardImage,
    },
    {
        tag: 'Knowledge',
        wml: `<Knowledge key=(test)><ShortName>${LABEL}</ShortName></Knowledge>`,
        expected: `<Knowledge key=(test)><ShortName>${LABEL}</ShortName></Knowledge>`,
        Component: StandardKnowledge,
    },
    {
        tag: 'Lens',
        wml: `<Lens key=(test)><ShortName>${LABEL}</ShortName></Lens>`,
        expected: `<Lens key=(test)><ShortName>${LABEL}</ShortName></Lens>`,
        Component: StandardLens,
    },
    {
        tag: 'Map',
        wml: `<Map key=(test)><ShortName>${LABEL}</ShortName></Map>`,
        expected: `<Map key=(test)><ShortName>${LABEL}</ShortName></Map>`,
        Component: StandardMap,
    },
    {
        tag: 'Mark',
        wml: `<Mark key=(test)><ShortName>${LABEL}</ShortName></Mark>`,
        expected: `<Mark key=(test)><ShortName>${LABEL}</ShortName></Mark>`,
        Component: StandardMark,
    },
    {
        tag: 'Message',
        wml: `<Message key=(test)><ShortName>${LABEL}</ShortName></Message>`,
        expected: `<Message key=(test)><ShortName>${LABEL}</ShortName></Message>`,
        Component: StandardMessage,
    },
    {
        tag: 'Moment',
        wml: `<Moment key=(test)><ShortName>${LABEL}</ShortName></Moment>`,
        expected: `<Moment key=(test)><ShortName>${LABEL}</ShortName></Moment>`,
        Component: StandardMoment,
    },
    {
        tag: 'Room',
        wml: `<Room key=(test)><ShortName>${LABEL}</ShortName></Room>`,
        expected: `<Room key=(test)><ShortName>${LABEL}</ShortName></Room>`,
        Component: StandardRoom,
    },
    {
        tag: 'Situation',
        wml: `<Situation key=(test)><ShortName>${LABEL}</ShortName></Situation>`,
        expected: `<Situation key=(test)><ShortName>${LABEL}</ShortName></Situation>`,
        Component: StandardSituation,
    },
]

describe.each(shortNameRoundTripCases)('$tag shortName round-trip', ({ wml, expected, Component }) => {
    it('parses ShortName and round-trips schema', () => {
        const component = new Component(deIndentWML(wml))
        expect(component.shortName?.toJSON()).toEqual(LABEL)
        expect(schemaToWML([component.schema])).toEqual(deIndentWML(expected))
    })
})
