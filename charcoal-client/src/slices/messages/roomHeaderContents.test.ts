import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import { deIndentWML } from '@tonylb/mtw-wml/ts/schema/utils'
import { mergePerceivedRoomForms, formatRoomContentsLine } from './roomHeaderContents'

/**
 * Builds a room wire form from real WML text, the way `affordanceRoomDeliverable.ts` does
 * post-alignment: a room-nested `<Object>` is a `ludicGraph` membership reference whose full
 * inline definition (uuid + `<ShortName>`) is also promoted to a real top-level `Object`
 * component, which is what `formatRoomContentsLine` resolves via `byUniversalId`.
 */
function roomFormWithObjects(objects: { uuid: string; shortName: string }[]): StandardForm {
    const objectTags = objects
        .map(({ uuid, shortName }) => `<Object uuid=(${uuid})><ShortName>${shortName}</ShortName></Object>`)
        .join('\n                        ')
    const wml = deIndentWML(`
        <Asset uuid=(Test)>
            <Room key=(main) uuid=(ROOM#main)>
                ${objectTags}
            </Room>
        </Asset>
    `)
    return new StandardForm(wml, { standardizeMode: 'ephemeraWire' })
}

type RoomObject = { uuid: string; shortName: string; contents?: { uuid: string; shortName?: string }[] }

/**
 * Room wire form in the shape the affordance deliverable prints: each room-level object nests its
 * contents as inline `<Object>` definitions. A content with no `shortName` is a bare reference (no name stub).
 */
function roomFormWithNestedObjects(objects: RoomObject[]): StandardForm {
    const objectTags = objects
        .map(({ uuid, shortName, contents = [] }) => {
            const inner = contents
                .map((c) => (c.shortName
                    ? `<Object uuid=(${c.uuid})><ShortName>${c.shortName}</ShortName></Object>`
                    : `<Object uuid=(${c.uuid}) />`))
                .join('')
            return `<Object uuid=(${uuid})><ShortName>${shortName}</ShortName>${inner}</Object>`
        })
        .join('\n                ')
    const wml = deIndentWML(`
        <Asset uuid=(Test)>
            <Room key=(main) uuid=(ROOM#main)>
                ${objectTags}
            </Room>
        </Asset>
    `)
    return new StandardForm(wml, { standardizeMode: 'ephemeraWire' })
}

const cups = (n: number) => ['Red cup', 'Blue cup', 'Green cup', 'Gold cup'].slice(0, n).map((shortName, i) => ({ uuid: `OBJECT#c${i}`, shortName }))

describe('roomHeaderContents', () => {
    describe('mergePerceivedRoomForms', () => {
        it('returns render.merge(affordance) when both exist', () => {
            const renderWml = deIndentWML(`
                <Asset uuid=(Test)>
                    <Room key=(main) uuid=(ROOM#main)>
                        <Render>
                            <DisplayName>Parlor</DisplayName>
                            <Summary>A quiet room</Summary>
                            <Description>Full prose here.</Description>
                        </Render>
                    </Room>
                </Asset>
            `)
            const render = new StandardForm(renderWml, { standardizeMode: 'ephemeraWire' })
            const affordance = roomFormWithObjects([{ uuid: 'OBJECT#crate', shortName: 'wooden crate' }])
            const merged = mergePerceivedRoomForms(render, affordance)
            expect(merged).toBeDefined()
            const room = merged!.byUniversalId['ROOM#main']
            expect(room?.tag).toEqual('Room')
        })

        it('returns render-only when affordance is absent', () => {
            const wml = deIndentWML(`
                <Asset uuid=(Test)>
                    <Room key=(main) uuid=(ROOM#main)>
                        <ShortName>R</ShortName>
                    </Room>
                </Asset>
            `)
            const render = new StandardForm(wml, { standardizeMode: 'ephemeraWire' })
            expect(mergePerceivedRoomForms(render, undefined)).toBe(render)
        })

        it('returns affordance-only when render is absent', () => {
            const wml = deIndentWML(`
                <Asset uuid=(Test)>
                    <Room key=(main) uuid=(ROOM#main)>
                        <ShortName>R</ShortName>
                    </Room>
                </Asset>
            `)
            const aff = new StandardForm(wml, { standardizeMode: 'ephemeraWire' })
            expect(mergePerceivedRoomForms(undefined, aff)).toBe(aff)
        })
    })

    describe('formatRoomContentsLine', () => {
        it('returns null for zero objects', () => {
            const wml = deIndentWML(`
                <Asset uuid=(Test)>
                    <Room key=(main) uuid=(ROOM#main)>
                        <ShortName>R</ShortName>
                    </Room>
                </Asset>
            `)
            const form = new StandardForm(wml, { standardizeMode: 'ephemeraWire' })
            expect(formatRoomContentsLine(form, 'ROOM#main')).toBeNull()
        })

        it('formats a single object as label only', () => {
            const form = roomFormWithObjects([{ uuid: 'OBJECT#o1', shortName: 'crate' }])
            expect(formatRoomContentsLine(form, 'ROOM#main')).toEqual('Contents: crate')
        })

        it('formats two objects with and', () => {
            const form = roomFormWithObjects([
                { uuid: 'OBJECT#o1', shortName: 'apple' },
                { uuid: 'OBJECT#o2', shortName: 'banana' },
            ])
            expect(formatRoomContentsLine(form, 'ROOM#main')).toEqual('Contents: apple and banana')
        })

        it('formats three or more as Oxford list', () => {
            const form = roomFormWithObjects([
                { uuid: 'OBJECT#o1', shortName: 'a' },
                { uuid: 'OBJECT#o2', shortName: 'b' },
                { uuid: 'OBJECT#o3', shortName: 'c' },
            ])
            expect(formatRoomContentsLine(form, 'ROOM#main')).toEqual('Contents: a, b, and c')
        })

        describe('nested contents', () => {
            const line = (objects: RoomObject[]) => formatRoomContentsLine(roomFormWithNestedObjects(objects), 'ROOM#main')

            it('shows an object that hosts nothing as its name alone', () => {
                expect(line([{ uuid: 'OBJECT#t', shortName: 'Table', contents: [] }])).toEqual('Contents: Table')
            })

            it('lists one content', () => {
                expect(line([{ uuid: 'OBJECT#t', shortName: 'Table', contents: cups(1) }]))
                    .toEqual('Contents: Table (with Red cup)')
            })

            it('lists two contents, comma-separated without "and"', () => {
                expect(line([{ uuid: 'OBJECT#t', shortName: 'Table', contents: cups(2) }]))
                    .toEqual('Contents: Table (with Red cup, Blue cup)')
            })

            it('aggregates at the threshold of three', () => {
                expect(line([{ uuid: 'OBJECT#t', shortName: 'Table', contents: cups(3) }]))
                    .toEqual('Contents: Table (with several objects)')
            })

            it('stays aggregated above the threshold', () => {
                expect(line([{ uuid: 'OBJECT#t', shortName: 'Table', contents: cups(4) }]))
                    .toEqual('Contents: Table (with several objects)')
            })

            it('drops a content ref with no stub before counting', () => {
                expect(line([{
                    uuid: 'OBJECT#t',
                    shortName: 'Table',
                    contents: [...cups(2), { uuid: 'OBJECT#ghost' }],
                }])).toEqual('Contents: Table (with Red cup, Blue cup)')
            })

            it('keeps the outer Oxford join across room-level objects with and without contents', () => {
                expect(line([
                    { uuid: 'OBJECT#t', shortName: 'Table', contents: cups(2) },
                    { uuid: 'OBJECT#ch', shortName: 'Chair' },
                    { uuid: 'OBJECT#l', shortName: 'Lamp' },
                ])).toEqual('Contents: Table (with Red cup, Blue cup), Chair, and Lamp')
            })
        })
    })
})
