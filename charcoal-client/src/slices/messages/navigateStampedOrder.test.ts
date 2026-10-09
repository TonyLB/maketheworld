import { vi } from 'vitest'
import reducer, { receiveMessages } from './index'

vi.mock('../../cacheDB')

/**
 * Client half of the compiler-stamped presentation order payoff. The rows below are the wire-shaped copy of what
 * `lambda/ephemera/dataSource/navigateStampedOrder.integration.test.ts` captures for a navigate
 * into an uncached room, **in emitted order**: leave, header placeholder, arrive, header terminal
 * (a revision of the placeholder's MessageId, strictly later), then a trailing affordance header
 * (published after the plan's lines; the slice groups it without giving it a transcript position). No
 * cross-package harness exists, so keep this fixture in step with that test by hand.
 */
const MOVER = 'CHARACTER#mover'
const OBSERVER = 'CHARACTER#observer'
const ROOM = 'ROOM#arrival'
const BEAT = 1_700_000_000_000
const LATER = BEAT + 5_000

const generatingWml = `<Asset uuid=(render)>
    <Room uuid=(${ROOM})>
        <Render>
            <DisplayName>Generating...</DisplayName>
            <Summary></Summary>
            <Description></Description>
        </Render>
    </Room>
</Asset>`

const terminalWml = `<Asset uuid=(render)>
    <Room uuid=(${ROOM})>
        <Render>
            <DisplayName>Arrival Hall</DisplayName>
            <Summary></Summary>
            <Description>A quiet hall.</Description>
        </Render>
    </Room>
</Asset>`

const affordanceWml = `<Asset uuid=(affordances)><Room uuid=(${ROOM})><Exit to=(ROOM#elsewhere)>out</Exit></Room></Asset>`

const emittedRows: any[] = [
    { Target: MOVER, DisplayProtocol: 'WorldMessage', MessageId: 'MESSAGE#leave', CreatedTime: BEAT, Message: ['Tess left.'] },
    { Target: OBSERVER, DisplayProtocol: 'WorldMessage', MessageId: 'MESSAGE#leave', CreatedTime: BEAT, Message: ['Tess left.'] },
    { Target: MOVER, DisplayProtocol: 'PerceptionMessage', MessageId: 'MESSAGE#header', CreatedTime: BEAT + 1, wmlContent: generatingWml, metaData: { componentUUID: ROOM, displayMode: 'header', status: 'generating', roomChannel: 'render' } },
    { Target: MOVER, DisplayProtocol: 'WorldMessage', MessageId: 'MESSAGE#arrive', CreatedTime: BEAT + 2, Message: ['Tess has arrived.'] },
    { Target: MOVER, DisplayProtocol: 'PerceptionMessage', MessageId: 'MESSAGE#header', CreatedTime: LATER, wmlContent: terminalWml, metaData: { componentUUID: ROOM, displayMode: 'header', roomChannel: 'render' } },
    { Target: MOVER, DisplayProtocol: 'PerceptionMessage', MessageId: 'MESSAGE#affordances', CreatedTime: LATER + 1, wmlContent: affordanceWml, metaData: { componentUUID: ROOM, displayMode: 'header', roomChannel: 'affordances' } },
]

describe('navigate into an uncached room (client ingestion of the server\'s stamped rows)', () => {
    const state = emittedRows.reduce(
        (previous, row) => reducer(previous, receiveMessages([row])),
        reducer(undefined, { type: 'init' })
    )

    it('presents the mover\'s rows as leave, header, arrive, with the header at its placeholder\'s position', () => {
        const rows = state.presentation[MOVER].filter((row: any) => row.MessageId !== 'MESSAGE#affordances')
        expect(rows.map((row: any) => row.MessageId)).toEqual(['MESSAGE#leave', 'MESSAGE#header', 'MESSAGE#arrive'])
        expect(rows.map((row: any) => row.CreatedTime)).toEqual([BEAT, BEAT + 1, BEAT + 2])
    })

    it('shows the header\'s terminal render text, not the placeholder', () => {
        const header = state.presentation[MOVER].find((row: any) => row.MessageId === 'MESSAGE#header')
        expect(header.wmlContent).toContain('Arrival Hall')
        expect(header.wmlContent).not.toContain('Generating...')
        expect(header.parsedWML).toBeDefined()
        // The revision lives in history alongside the placeholder.
        expect(state.history[MOVER].filter((row: any) => row.MessageId === 'MESSAGE#header')).toHaveLength(2)
    })

    it('keeps the trailing affordance header after the arrive line', () => {
        const ids = state.presentation[MOVER].map((row: any) => row.MessageId)
        expect(ids.indexOf('MESSAGE#affordances')).toBeGreaterThan(ids.indexOf('MESSAGE#arrive'))
    })

    it('gives the departure-room observer the leave line', () => {
        expect(state.presentation[OBSERVER].map((row: any) => [row.MessageId, row.Message])).toEqual([
            ['MESSAGE#leave', ['Tess left.']],
        ])
    })
})
