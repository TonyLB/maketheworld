import { isFixedContainmentDrifted } from './classification'

const AREA = 'AREA#Overworld'
const ROOM = 'ROOM#Kitchen'
const FEATURE = 'FEATURE#Stove'
const OBJECT = 'OBJECT#Pot'

const root = { tag: 'Presence', universalKey: 'PRESENCE#Base', cover: { members: [] } }
const partOf = (from: string, to: string) => ({ tag: 'Relational', kind: 'PartOf', from, to })
const pointingAt = (host: string, presence = 'PRESENCE#Base', members: unknown[] = []) => ({
    nodes: [{ tag: 'Presence', universalKey: 'PRESENCE#Base', fromHostPresences: [{ host, presence }], cover: { members } }],
})
const carveOut = (members: unknown[] = []) => ({
    nodes: [root, { tag: 'Presence', universalKey: 'PRESENCE#c', fromHostPresences: [{ host: AREA, presence: 'PRESENCE#Base' }], cover: { members } }],
})
const areaGraph = { nodes: [root, ROOM], edges: [partOf(ROOM, AREA)] }
const roomGraph = { nodes: [root, FEATURE], edges: [partOf(FEATURE, ROOM)] }

describe('isFixedContainmentDrifted', () => {
    it('passes a fully populated nesting', () => {
        expect(isFixedContainmentDrifted(AREA, areaGraph, [ROOM], () => carveOut())).toBe(false)
        expect(isFixedContainmentDrifted(ROOM, roomGraph, [FEATURE], () => pointingAt(ROOM))).toBe(false)
    })

    it('flags a parent whose node list lacks the child', () => {
        expect(isFixedContainmentDrifted(AREA, { ...areaGraph, nodes: [root] }, [ROOM], () => carveOut())).toBe(true)
    })

    it('flags a parent with no PartOf edge from the child', () => {
        expect(isFixedContainmentDrifted(AREA, { nodes: [root, ROOM] }, [ROOM], () => carveOut())).toBe(true)
        expect(isFixedContainmentDrifted(AREA, { ...areaGraph, edges: [partOf(ROOM, 'AREA#Other')] }, [ROOM], () => carveOut())).toBe(true)
    })

    it('flags an authored child that was never populated (no row, or no binding at the parent)', () => {
        expect(isFixedContainmentDrifted(AREA, areaGraph, [ROOM], () => undefined)).toBe(true)
        expect(isFixedContainmentDrifted(AREA, areaGraph, [ROOM], () => ({ nodes: [root] }))).toBe(true)
    })

    it('flags a child pointer naming the wrong parent binding', () => {
        expect(isFixedContainmentDrifted(ROOM, roomGraph, [FEATURE], () => pointingAt(ROOM, 'PRESENCE#Other'))).toBe(true)
    })

    it('flags a Room binding into an Area that lists members instead of a carve-out', () => {
        expect(isFixedContainmentDrifted(AREA, areaGraph, [ROOM], () => carveOut([{ host: FEATURE, presence: 'PRESENCE#f' }]))).toBe(true)
    })

    it('flags a Room or Area with no hostless root, including one with no stored graph', () => {
        expect(isFixedContainmentDrifted(ROOM, { nodes: [] }, [], () => undefined)).toBe(true)
        expect(isFixedContainmentDrifted(ROOM, undefined, [], () => undefined)).toBe(true)
        expect(isFixedContainmentDrifted(AREA, pointingAt(ROOM), [], () => undefined)).toBe(true)
    })

    it('passes a Room or Area with only its root, and a Feature or Object with no children', () => {
        expect(isFixedContainmentDrifted(ROOM, { nodes: [root] }, [], () => undefined)).toBe(false)
        expect(isFixedContainmentDrifted(FEATURE, pointingAt(ROOM), [], () => undefined)).toBe(false)
        expect(isFixedContainmentDrifted(FEATURE, undefined, [], () => undefined)).toBe(false)
    })

    it('flags a Feature with an authored child and no binding to name', () => {
        expect(isFixedContainmentDrifted(FEATURE, undefined, ['FEATURE#Knob'], () => undefined)).toBe(true)
    })

    it('ignores an Object child, and a child of the wrong kind for the parent', () => {
        expect(isFixedContainmentDrifted(ROOM, { nodes: [root] }, [OBJECT, 'ROOM#Other'], () => undefined)).toBe(false)
    })

    it('does not sense a stored nesting the asset no longer declares (de-authoring is out of scope)', () => {
        expect(isFixedContainmentDrifted(AREA, areaGraph, [], () => carveOut())).toBe(false)
    })

    it('refuses to judge children of a parent with several bindings and no root to name', () => {
        const two = { nodes: [
            { tag: 'Presence', universalKey: 'PRESENCE#a', fromHostPresences: [{ host: ROOM, presence: 'PRESENCE#Base' }], cover: { members: [] } },
            { tag: 'Presence', universalKey: 'PRESENCE#b', fromHostPresences: [{ host: 'ROOM#Other', presence: 'PRESENCE#Base' }], cover: { members: [] } },
        ] }
        expect(isFixedContainmentDrifted(FEATURE, two, ['FEATURE#Knob'], () => undefined)).toBe(false)
    })
})
