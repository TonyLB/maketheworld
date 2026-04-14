import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import { deIndentWML } from '@tonylb/mtw-wml/ts/schema/utils'
import { mergePerceivedRoomForms, formatRoomContentsLine } from './roomHeaderPhaseC'

describe('roomHeaderPhaseC', () => {
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
            const affordanceWml = deIndentWML(`
                <Asset uuid=(Test)>
                    <Room key=(main) uuid=(ROOM#main)>
                        <Object uuid=(crate)>
                            <ShortName>wooden crate</ShortName>
                        </Object>
                    </Room>
                </Asset>
            `)
            const render = new StandardForm(renderWml, { standardizeMode: 'ephemeraWire' })
            const affordance = new StandardForm(affordanceWml, { standardizeMode: 'ephemeraWire' })
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
            const wml = deIndentWML(`
                <Asset uuid=(Test)>
                    <Room key=(main) uuid=(ROOM#main)>
                        <Object uuid=(o1)><ShortName>crate</ShortName></Object>
                    </Room>
                </Asset>
            `)
            const form = new StandardForm(wml, { standardizeMode: 'ephemeraWire' })
            expect(formatRoomContentsLine(form, 'ROOM#main')).toEqual('Contents: crate')
        })

        it('formats two objects with and', () => {
            const wml = deIndentWML(`
                <Asset uuid=(Test)>
                    <Room key=(main) uuid=(ROOM#main)>
                        <Object uuid=(o1)><ShortName>apple</ShortName></Object>
                        <Object uuid=(o2)><ShortName>banana</ShortName></Object>
                    </Room>
                </Asset>
            `)
            const form = new StandardForm(wml, { standardizeMode: 'ephemeraWire' })
            expect(formatRoomContentsLine(form, 'ROOM#main')).toEqual('Contents: apple and banana')
        })

        it('formats three or more as Oxford list', () => {
            const wml = deIndentWML(`
                <Asset uuid=(Test)>
                    <Room key=(main) uuid=(ROOM#main)>
                        <Object uuid=(o1)><ShortName>a</ShortName></Object>
                        <Object uuid=(o2)><ShortName>b</ShortName></Object>
                        <Object uuid=(o3)><ShortName>c</ShortName></Object>
                    </Room>
                </Asset>
            `)
            const form = new StandardForm(wml, { standardizeMode: 'ephemeraWire' })
            expect(formatRoomContentsLine(form, 'ROOM#main')).toEqual('Contents: a, b, and c')
        })
    })
})
