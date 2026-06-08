import { deIndentWML } from '../../../schema/utils'
import { treeFromWML, schemaToWML } from '../../../schema'
import { StandardExitEdge, ExitEdgeList } from './exitEdge'

describe('StandardExitEdge', () => {
    const normativeEdgeWML = deIndentWML(`
        <Exit uuid=(highwayToTown)>
            <From>ROOM#highway</From>
            <To>ROOM#townCenter</To>
            <Forward>east</Forward>
            <Back>west</Back>
        </Exit>
    `)

    it('should construct from JSON', () => {
        const edge = new StandardExitEdge({
            tag: 'Exit',
            uuid: 'highwayToTown',
            from: 'ROOM#highway',
            to: 'ROOM#townCenter',
            payload: { forward: 'east', back: 'west' },
        })
        expect(edge.uuid).toEqual('highwayToTown')
        expect(edge.toJSON()).toEqual({
            tag: 'Exit',
            uuid: 'highwayToTown',
            from: 'ROOM#highway',
            to: 'ROOM#townCenter',
            payload: { forward: 'east', back: 'west' },
        })
    })

    it('should construct from schema and round-trip WML', () => {
        const edge = new StandardExitEdge(treeFromWML(normativeEdgeWML))
        expect(schemaToWML([edge.schema()])).toEqual(normativeEdgeWML)
    })

    it('should parse layered Replace on To', () => {
        const replaceWML = deIndentWML(`
            <Exit uuid=(highwayToTown)>
                <From>ROOM#highway</From>
                <Replace><To>ROOM#townCenter</To></Replace>
                <With><To>ROOM#ghi</To></With>
                <Forward>east</Forward>
                <Back>west</Back>
            </Exit>
        `)
        const edge = new StandardExitEdge(treeFromWML(replaceWML))
        const json = edge.toJSON()
        expect(json.uuid).toEqual('highwayToTown')
        expect(json.to).toEqual({
            tag: 'Replace',
            match: 'ROOM#townCenter',
            payload: 'ROOM#ghi',
        })
    })

    it('should reject legacy to= attribute', () => {
        expect(() => new StandardExitEdge(treeFromWML(`
            <Exit uuid=(e1) to=(room2)>
                <From>ROOM#a</From>
                <To>ROOM#b</To>
            </Exit>
        `))).toThrow(/rejects to= attribute/)
    })

    it('should reject missing uuid', () => {
        expect(() => new StandardExitEdge(treeFromWML(`
            <Exit>
                <From>ROOM#a</From>
                <To>ROOM#b</To>
            </Exit>
        `))).toThrow(/requires uuid/)
    })

    it('should construct uuid-only stub from JSON without from or to', () => {
        const edge = new StandardExitEdge({
            tag: 'Exit',
            uuid: 'edge-a1b2c3d4',
            payload: {},
        })
        expect(edge.toJSON()).toEqual({
            tag: 'Exit',
            uuid: 'edge-a1b2c3d4',
            payload: {},
        })
    })

    it('should parse and round-trip uuid-only stub WML', () => {
        const stubWML = deIndentWML(`<Exit uuid=(edge-a1b2c3d4) />`)
        const edge = new StandardExitEdge(treeFromWML(stubWML))
        expect(edge.toJSON()).toEqual({
            tag: 'Exit',
            uuid: 'edge-a1b2c3d4',
            payload: {},
        })
        expect(schemaToWML([edge.schema()])).toEqual(stubWML)
    })

    it('should parse and round-trip From-only edge with legalKey', () => {
        const fromOnlyWML = deIndentWML(`
            <Exit uuid=(highwayToTown)>
                <From>highway</From>
                <Forward>east</Forward>
            </Exit>
        `)
        const edge = new StandardExitEdge(treeFromWML(fromOnlyWML))
        expect(edge.toJSON()).toEqual({
            tag: 'Exit',
            uuid: 'highwayToTown',
            from: { key: 'highway', tag: 'Room' },
            payload: { forward: 'east' },
        })
        expect(schemaToWML([edge.schema()])).toEqual(schemaToWML(treeFromWML(fromOnlyWML)))
    })

    it('should parse and round-trip From-only edge with universal key', () => {
        const fromOnlyWML = deIndentWML(`
            <Exit uuid=(highwayToTown)>
                <From>ROOM#highway</From>
            </Exit>
        `)
        const edge = new StandardExitEdge(treeFromWML(fromOnlyWML))
        expect(edge.toJSON()).toEqual({
            tag: 'Exit',
            uuid: 'highwayToTown',
            from: 'ROOM#highway',
            payload: {},
        })
        expect(schemaToWML([edge.schema()])).toEqual(schemaToWML(treeFromWML(fromOnlyWML)))
    })

    it('should parse and round-trip To-only edge', () => {
        const toOnlyWML = deIndentWML(`
            <Exit uuid=(edge1)>
                <To>ROOM#townCenter</To>
            </Exit>
        `)
        const edge = new StandardExitEdge(treeFromWML(toOnlyWML))
        expect(edge.toJSON()).toEqual({
            tag: 'Exit',
            uuid: 'edge1',
            to: 'ROOM#townCenter',
            payload: {},
        })
        expect(schemaToWML([edge.schema()])).toEqual(schemaToWML(treeFromWML(toOnlyWML)))
    })

    it('should normalize empty From tag to absent endpoint', () => {
        const emptyFromWML = deIndentWML(`<Exit uuid=(e1)><From /></Exit>`)
        const stubWML = deIndentWML(`<Exit uuid=(e1) />`)
        const edge = new StandardExitEdge(treeFromWML(emptyFromWML))
        expect(edge.toJSON()).toEqual({
            tag: 'Exit',
            uuid: 'e1',
            payload: {},
        })
        expect(schemaToWML([edge.schema()])).toEqual(schemaToWML(treeFromWML(stubWML)))
    })
})

describe('ExitEdgeList', () => {
    const baseEdge = new StandardExitEdge({
        tag: 'Exit',
        uuid: 'highwayToTown',
        from: 'ROOM#highway',
        to: 'ROOM#townCenter',
        payload: { forward: 'east', back: 'west' },
    })

    it('should merge JSON Replace overlay on to endpoint by uuid', () => {
        const overlayEdge = new StandardExitEdge({
            tag: 'Exit',
            uuid: 'highwayToTown',
            from: 'ROOM#highway',
            to: { tag: 'Replace', match: 'ROOM#townCenter', payload: 'ROOM#ghi' },
            payload: { forward: 'east', back: 'west' },
        })
        const merged = new ExitEdgeList([baseEdge]).merge(new ExitEdgeList([overlayEdge]))
        expect(merged?.toJSON()[0].to).toEqual('ROOM#ghi')
    })

    it('should merge edges by uuid with endpoint Replace overlay from WML', () => {
        const overlayEdge = new StandardExitEdge(treeFromWML(deIndentWML(`
            <Exit uuid=(highwayToTown)>
                <From>ROOM#highway</From>
                <Replace><To>ROOM#townCenter</To></Replace>
                <With><To>ROOM#ghi</To></With>
                <Forward>east</Forward>
                <Back>west</Back>
            </Exit>
        `)))
        const merged = new ExitEdgeList([baseEdge]).merge(new ExitEdgeList([overlayEdge]))
        expect(merged?.toJSON()).toEqual([{
            tag: 'Exit',
            uuid: 'highwayToTown',
            from: 'ROOM#highway',
            to: 'ROOM#ghi',
            payload: { forward: 'east', back: 'west' },
        }])
    })

    it('should dedupe duplicate uuid on construct when edges are equal', () => {
        const list = new ExitEdgeList([baseEdge, baseEdge.clone()])
        expect(list.length).toEqual(1)
    })

    it('should throw when deduping duplicate uuid with conflicting endpoints', () => {
        expect(() => new ExitEdgeList([
            baseEdge,
            new StandardExitEdge({
                tag: 'Exit',
                uuid: 'highwayToTown',
                from: 'ROOM#highway',
                to: 'ROOM#other',
                payload: {},
            }),
        ])).toThrow(/Conflicting endpoint values/)
    })
})
