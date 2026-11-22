//
// Every registered piece's render pinned, cell by cell, under its default options and each arm it takes (AGENT.pieceViews.planning.md,
// step 3): the hashes were read from the code on 2026-11-22, before the scene side joined the views, not from batch reports. A refactor that
// keeps these green keeps every prompt byte for byte. The trial's batch-reported pins (`oraclePieces/trial/renderPins.test.ts`) and
// `playByPlay`'s and `consequences`' stay where they are. The verdict has no golden rebuttals, so it is pinned on the lifted pairs only.
//
import { textHash } from '../textHash'
import type { RegisteredPiece } from './oraclePiece'
import { pieces } from './pieces'

type Pin = { options: unknown; hashes: Record<string, string> }

const PINS: Record<string, Pin[]> = {
    'ruleCell': [
        { options: undefined, hashes: {
            'OC-1': 'ebbc4662', 'OC-6/tilted': '735d3891', 'OC-6/stays': '99fc6b02', 'OC-30/2/tipped': '9561e60e', 'OC-30/2/together': '999e11ef', 'OC-30/2/slides': 'add14926',
            'OC-19/voided': '5b992a65', 'OC-19/glued': 'fa7505ca', 'OC-20': 'e47be6cd',
        } },
        { options: { show: 'none' }, hashes: {
            'OC-1': 'c398e4b9', 'OC-6/tilted': 'c2be44d8', 'OC-6/stays': '4efc55ed', 'OC-30/2/tipped': '5296f783', 'OC-30/2/together': 'b1c20fc9', 'OC-30/2/slides': '191d679b',
            'OC-19/voided': '56f391fa', 'OC-19/glued': 'fd0e4afa', 'OC-20': '49a1add7',
        } },
        { options: { sceneRules: true }, hashes: {
            'OC-1': 'f79ad325', 'OC-6/tilted': 'ba292b86', 'OC-6/stays': '0cdce2bc', 'OC-30/2/tipped': '41b5656c', 'OC-30/2/together': 'ee33fa23', 'OC-30/2/slides': 'fea4586d',
            'OC-19/voided': '67667e2d', 'OC-19/glued': '60b1c836', 'OC-20': '16ef5c8a',
        } },
    ],
    'nonRuleCell': [
        { options: undefined, hashes: {
            'OC-11': '684a864c', 'OC-18': 'c52ec605', 'OC-3': 'cf41375b', 'OC-1': '4d3b8751', 'OC-2': '3cdd809c', 'OC-20': '5a6d3748',
            'OC-6': '91a5b01a', 'OC-30/h5': '39778328', 'OC-30/h7': 'af8996af', 'OC-30/h10': 'a464d243', 'OC-9': '177d4442',
        } },
        { options: { scene: 'explicit' }, hashes: {
            'OC-11': '082f340d', 'OC-18': '49f413d8', 'OC-3': 'b5dc3eca', 'OC-1': 'ebd7dd76', 'OC-2': 'cbd55f39', 'OC-20': 'dd950e89',
            'OC-6': '8b233f25', 'OC-30/h5': 'f083fcc2', 'OC-30/h7': '93d47acb', 'OC-30/h10': 'ba555576', 'OC-9': 'f973c3f5',
        } },
    ],
    'playByPlay': [
        { options: undefined, hashes: {
            'OC-1': '1395e48e', 'OC-1b': '7bfddef2', 'OC-6': '144e5e15', 'OC-6/command': '75d624f0', 'OC-19': '2f1e1d3e', 'OC-20': 'bfb8a376',
            'OC-20/concession': 'bfb8a376', 'OC-20/proposed': 'bfb8a376',
        } },
        { options: { scene: 'judge' }, hashes: {
            'OC-1': '55b88438', 'OC-1b': '308e1cb9', 'OC-6': 'd130f013', 'OC-6/command': '888e8c91', 'OC-19': '8961fc76', 'OC-20': '42c4313e',
            'OC-20/concession': '42c4313e', 'OC-20/proposed': '42c4313e',
        } },
    ],
    'consequences': [
        { options: undefined, hashes: {
            'OC-30/2': 'c639e8eb', 'OC-1': '030c1940', 'cup': '8bb8636c', 'OC-1/teapot1': 'ad08de90',
        } },
        { options: { scene: 'judge' }, hashes: {
            'OC-30/2': '30ffac46', 'OC-1': '548b1777', 'cup': '59facc11', 'OC-1/teapot1': '5766fcfe',
        } },
    ],
    'stepConsiderations': [
        { options: undefined, hashes: {
            'OC-11': '684a864c', 'OC-18': 'c52ec605', 'OC-3': 'cf41375b', 'OC-1': '4d3b8751', 'OC-2': '3cdd809c', 'OC-20': '5a6d3748',
            'OC-6': '91a5b01a', 'OC-30/h5': '39778328', 'OC-30/h7': 'af8996af', 'OC-30/h10': 'a464d243', 'OC-9': '177d4442',
        } },
    ],
    'trial/against': [
        { options: undefined, hashes: {
            'OC-11': '684a864c', 'OC-18': 'c52ec605', 'OC-3': 'cf41375b', 'OC-1': '4d3b8751', 'OC-2': '3cdd809c', 'OC-20': '5a6d3748',
            'OC-6': '91a5b01a', 'OC-30/h5': '39778328', 'OC-30/h7': 'af8996af', 'OC-30/h10': 'a464d243', 'OC-9': '177d4442',
        } },
        { options: { securing: 'omitted' }, hashes: {
            'OC-11': 'dd44f7a3', 'OC-18': 'c5cc8c32', 'OC-3': '2c87ce0b', 'OC-1': 'f87a3dbe', 'OC-2': '4e64c3a2', 'OC-20': 'ce09dbbf',
            'OC-6': 'e0b2344a', 'OC-30/h5': '0ce4c4e3', 'OC-30/h7': '75731acb', 'OC-30/h10': 'a3e913ac', 'OC-9': '177d4442',
        } },
        { options: { securing: 'shown', scene: 'explicit' }, hashes: {
            'OC-11': '082f340d', 'OC-18': '49f413d8', 'OC-3': 'b5dc3eca', 'OC-1': 'ebd7dd76', 'OC-2': 'cbd55f39', 'OC-20': 'dd950e89',
            'OC-6': '8b233f25', 'OC-30/h5': 'f083fcc2', 'OC-30/h7': '93d47acb', 'OC-30/h10': 'ba555576', 'OC-9': 'f973c3f5',
        } },
        { options: { securing: 'omitted', scene: 'explicit' }, hashes: {
            'OC-11': 'e09f70d4', 'OC-18': 'c636ab09', 'OC-3': '52b0692f', 'OC-1': 'f5976d26', 'OC-2': '1c433b1b', 'OC-20': '9b4cc6ab',
            'OC-6': 'd802e915', 'OC-30/h5': '6657312a', 'OC-30/h7': '6efc1b96', 'OC-30/h10': '89154328', 'OC-9': 'f973c3f5',
        } },
    ],
    'trial/rebuttal': [
        { options: { upstream: 'golden' }, hashes: {
            'OC-11': '396071e5', 'OC-18': 'ec4fb9aa', 'OC-3': '2927c178', 'OC-1': '15e55631', 'OC-2': 'cb734fad', 'OC-20': 'e8f2edc8',
            'OC-6': '31e993df', 'OC-30/h5': '1cad64ef', 'OC-30/h7': 'f3e97830', 'OC-30/h10': 'f3ead215', 'OC-9': 'a2b65689',
        } },
        { options: { upstream: 'lifted' }, hashes: {
            'OC-11': '1d9993f4', 'OC-18': 'dc3aca76', 'OC-3': '69ba0893', 'OC-1': 'af40964c', 'OC-2': '47be4ffa', 'OC-20': '08aa0e65',
            'OC-6': 'dbfdecde', 'OC-30/h5': '65fe58b6', 'OC-30/h7': 'fe8d4d82', 'OC-30/h10': '2c308588', 'OC-9': '9613c0b8',
        } },
    ],
    'trial/verdict': [
        { options: { upstream: 'lifted' }, hashes: {
            'OC-11': '8ebd4108', 'OC-18': '51b7dab0', 'OC-3': 'c8bf6c6a', 'OC-1': '4537a28b', 'OC-2': 'cadf70e7', 'OC-20': '059ef63b',
            'OC-6': '1deb2603', 'OC-30/h5': 'fb128d59', 'OC-30/h7': 'aff63480', 'OC-30/h10': '2056f2ca', 'OC-9': '4006128c',
        } },
        { options: { upstream: 'lifted', scene: 'explicit' }, hashes: {
            'OC-11': '32198a7c', 'OC-18': '11ec6f48', 'OC-3': 'f3ae9de9', 'OC-1': '8ea202cc', 'OC-2': '5c0c02b6', 'OC-20': '87e8d5db',
            'OC-6': 'e209951a', 'OC-30/h5': 'c66005ea', 'OC-30/h7': '1c81ae52', 'OC-30/h10': 'e6d87c32', 'OC-9': '75d0b3f2',
        } },
    ],
    'trial/ruling': [
        { options: { upstream: 'golden' }, hashes: {
            'OC-11': '085c0190', 'OC-18': 'f0f014e3', 'OC-3': '220a5dd0', 'OC-1': 'b9af03e6', 'OC-2': 'cec6135f', 'OC-20': 'e94016ef',
            'OC-6': '3060577f', 'OC-30/h5': '1a12088c', 'OC-30/h7': 'e73f1098', 'OC-30/h10': 'f7dca1ca', 'OC-9': 'ba282cac',
        } },
        { options: { upstream: 'lifted' }, hashes: {
            'OC-11': '9ccc67e7', 'OC-18': 'd7108252', 'OC-3': '28ea3818', 'OC-1': '71bc62a6', 'OC-2': '1659a5ef', 'OC-20': 'aa314e0c',
            'OC-6': '038c1ced', 'OC-30/h5': '9e37e488', 'OC-30/h7': '62d7031d', 'OC-30/h10': '09b1b46a', 'OC-9': '1076083d',
        } },
    ],
    'sceneReading': [
        { options: { render: 'sections' }, hashes: {
            'R-1': 'f1e13bc7', 'R-3': 'ad0206fa', 'R-4': '4c69997e', 'R-5': '976af083', 'R-6': '838628ab', 'R-7': '794d9e27',
            'R-8': '056ccd09', 'R-9': 'c4cb11ad',
        } },
        { options: { render: 'explicit' }, hashes: {
            'R-1': '4d38d66f', 'R-3': '55bef4a3', 'R-4': '8659db52', 'R-5': '3cb2f5c4', 'R-6': 'de89e6ce', 'R-7': '9698e364',
            'R-8': 'cf1a21f5', 'R-9': '8589c11f',
        } },
    ],
}

const registered: [string, RegisteredPiece][] = Object.entries(pieces).flatMap(([name, entry]): [string, RegisteredPiece][] => (
    entry.kind === 'family' ? Object.entries(entry.stages).map(([stage, piece]): [string, RegisteredPiece] => [`${name}/${stage}`, piece]) : [[name, entry]]
))

const hashes = async (piece: RegisteredPiece, named: unknown): Promise<Record<string, string>> => {
    const options = piece.parseOptions(named)
    if (typeof options === 'string') {
        throw new Error(options)
    }
    const render = piece.render as (cell: unknown, options: unknown) => Promise<string>
    return Object.fromEntries(await Promise.all(Object.entries(piece.cells).map(async ([id, cell]) => [id, textHash(await render(cell, options))])))
}

describe("every piece's render, pinned before the scene side joined the views", () => {
    beforeEach(() => {
        jest.spyOn(console, 'log').mockImplementation(() => {})
        jest.spyOn(console, 'info').mockImplementation(() => {})
    })
    afterEach(() => jest.restoreAllMocks())

    it('pins every registered piece, and only those', () => {
        expect(Object.keys(PINS).sort()).toEqual(registered.map(([id]) => id).sort())
    })

    it.each(registered.flatMap(([id, piece]) => (PINS[id] ?? []).map(({ options, hashes: pinned }): [string, string, RegisteredPiece, unknown, Record<string, string>] => [id, JSON.stringify(options ?? null), piece, options, pinned])))(
        '%s under %s renders as pinned',
        async (_id, _label, piece, options, pinned) => {
            expect(await hashes(piece, options)).toEqual(pinned)
        },
    )
})
