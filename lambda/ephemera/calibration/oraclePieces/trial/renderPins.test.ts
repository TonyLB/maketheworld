//
// The trial's renders pinned to the inputs hashes its batches reported (AGENT.nonRuleCell.planning.md, Slices A and B): a refactor that keeps
// these green keeps every prompt byte for byte, so the batches already run stay comparable with the next.
//
import { textHash } from '../../textHash'
import { trialAgainst } from './against'
import { trialRebuttal } from './rebuttal'
import { trialVerdict } from './verdict'

/** Against, the securing shown: batch 1 (draft 1). */
const AGAINST_SHOWN: Record<string, string> = {
    'OC-11': '684a864c', 'OC-18': 'c52ec605', 'OC-3': 'cf41375b', 'OC-1': '4d3b8751', 'OC-2': '3cdd809c', 'OC-20': '5a6d3748',
    'OC-6': '91a5b01a', 'OC-9': '177d4442', 'OC-30/h5': '39778328', 'OC-30/h7': 'af8996af', 'OC-30/h10': 'a464d243',
}

/** Against, the securing omitted: batch 2. OC-9 has no securing and wasn't called, so it renders as batch 1's. */
const AGAINST_OMITTED: Record<string, string> = {
    'OC-11': 'dd44f7a3', 'OC-18': 'c5cc8c32', 'OC-3': '2c87ce0b', 'OC-1': 'f87a3dbe', 'OC-2': '4e64c3a2', 'OC-20': 'ce09dbbf',
    'OC-6': 'e0b2344a', 'OC-9': '177d4442', 'OC-30/h5': '0ce4c4e3', 'OC-30/h7': '75731acb', 'OC-30/h10': 'a3e913ac',
}

/** Against, the explicit scene with the securing omitted: batch 26 (draft 2, AGENT.trialQuestion.planning.md, step 2). */
const AGAINST_EXPLICIT: Record<string, string> = {
    'OC-11': 'e09f70d4', 'OC-18': 'c636ab09', 'OC-3': '52b0692f', 'OC-1': 'f5976d26', 'OC-2': '1c433b1b', 'OC-20': '9b4cc6ab',
    'OC-6': 'd802e915', 'OC-9': 'f973c3f5', 'OC-30/h5': '6657312a', 'OC-30/h7': '6efc1b96', 'OC-30/h10': '89154328',
}

/** The rebuttal, the golden arguments: batch 8 (draft 5, confirmed). */
const REBUTTAL_GOLDEN: Record<string, string> = {
    'OC-11': '396071e5', 'OC-18': 'ec4fb9aa', 'OC-3': '2927c178', 'OC-1': '15e55631', 'OC-2': 'cb734fad', 'OC-20': 'e8f2edc8',
    'OC-6': '31e993df', 'OC-9': 'a2b65689', 'OC-30/h5': '1cad64ef', 'OC-30/h7': 'f3e97830', 'OC-30/h10': 'f3ead215',
}

/** The verdict, on the lifted pairs, drafts 1 to 4: batches 9 to 12. Kept as the record; the render moved with draft 5. */
const VERDICT_LIFTED_UNTAGGED: Record<string, string> = {
    'OC-11': 'ce147644', 'OC-18': 'bb1b4b08', 'OC-3': 'a302860d', 'OC-1': 'c0162179', 'OC-2': '691b7312', 'OC-20': 'e9010364',
    'OC-6': 'bccf923d', 'OC-9': '6c5fa084', 'OC-30/h5': '60cf614a', 'OC-30/h7': 'bf36e159', 'OC-30/h10': '40387274',
}

/** The verdict, on the lifted pairs, the two sides tagged (draft 5): to be confirmed by batch 13's reported hashes. */
const VERDICT_LIFTED: Record<string, string> = {
    'OC-11': '8ebd4108', 'OC-18': '51b7dab0', 'OC-3': 'c8bf6c6a', 'OC-1': '4537a28b', 'OC-2': 'cadf70e7', 'OC-20': '059ef63b',
    'OC-6': '1deb2603', 'OC-9': '4006128c', 'OC-30/h5': 'fb128d59', 'OC-30/h7': 'aff63480', 'OC-30/h10': '2056f2ca',
}

const hashes = async <C, O>(cells: Record<string, C>, render: (cell: C, options: O) => Promise<string>, options: O): Promise<Record<string, string>> => (
    Object.fromEntries(await Promise.all(Object.entries(cells).map(async ([id, cell]) => [id, textHash(await render(cell, options))])))
)

describe('the trial\'s renders, pinned to its batches', () => {
    beforeEach(() => {
        jest.spyOn(console, 'log').mockImplementation(() => {})
        jest.spyOn(console, 'info').mockImplementation(() => {})
    })
    afterEach(() => jest.restoreAllMocks())

    it('against, the securing shown, renders as batch 1', async () => {
        expect(await hashes(trialAgainst.cells, trialAgainst.render, { securing: 'known' })).toEqual(AGAINST_SHOWN)
    })

    it('against, the securing omitted, renders as batch 2', async () => {
        expect(await hashes(trialAgainst.cells, trialAgainst.render, { securing: 'omitted' })).toEqual(AGAINST_OMITTED)
    })

    it('against, the explicit scene with the securing omitted, renders as batch 26', async () => {
        expect(await hashes(trialAgainst.cells, trialAgainst.render, { securing: 'omitted', scene: 'explicit' })).toEqual(AGAINST_EXPLICIT)
    })

    it('the rebuttal, on the golden arguments, renders as batch 8', async () => {
        expect(await hashes(trialRebuttal.cells, trialRebuttal.render, { upstream: 'golden' })).toEqual(REBUTTAL_GOLDEN)
    })

    it('the verdict, on the lifted pairs, renders with the two sides tagged (draft 5), every hash moved from batches 9 to 12', async () => {
        const tagged = await hashes(trialVerdict.cells, trialVerdict.render, { upstream: 'lifted' })
        expect(tagged).toEqual(VERDICT_LIFTED)
        expect(Object.keys(tagged).filter((id) => tagged[id] === VERDICT_LIFTED_UNTAGGED[id])).toEqual([])
    })
})
