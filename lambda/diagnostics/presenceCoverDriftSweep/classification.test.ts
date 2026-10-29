import { presenceGraphViewOf } from './classification'

describe('presenceGraphViewOf', () => {
    const binding = (universalKey: string) => ({ tag: 'Presence', universalKey, fromHostPresences: [{ host: 'ROOM#A', presence: 'PRESENCE#Base' }], cover: { members: [] } })

    it('reads ConnectedTo edges between the row\'s own bindings as binding-key pairs, ignoring every other edge', () => {
        const view = presenceGraphViewOf('OBJECT#Rope', {
            nodes: [{ tag: 'Object', universalKey: 'OBJECT#Rope' }, binding('PRESENCE#Base'), binding('PRESENCE#r2')],
            edges: [
                { tag: 'Relational', kind: 'ConnectedTo', from: { owner: 'OBJECT#Rope', port: 'PRESENCE#Base' }, to: { owner: 'OBJECT#Rope', port: 'PRESENCE#r2' } },
                { tag: 'Relational', kind: 'ConnectedTo', from: 'OBJECT#Rope', to: 'OBJECT#Part' },
                { tag: 'Relational', kind: 'ConnectedTo', from: { owner: 'OBJECT#Other', port: 'PRESENCE#Base' }, to: { owner: 'OBJECT#Rope', port: 'PRESENCE#r2' } },
                { tag: 'Relational', kind: 'ConnectedTo', from: { owner: 'OBJECT#Rope', port: 'PORT-ab6129d' }, to: { owner: 'OBJECT#Rope', port: 'PRESENCE#r2' } },
                { tag: 'Relational', kind: 'Custom', relationLabel: 'tied to', from: { owner: 'OBJECT#Rope', port: 'PRESENCE#Base' }, to: { owner: 'OBJECT#Rope', port: 'PRESENCE#r2' } },
            ],
        })
        expect(view?.connectedTo).toEqual([['PRESENCE#Base', 'PRESENCE#r2']])
    })

    it('reads a row with no edges as having none', () => {
        expect(presenceGraphViewOf('OBJECT#Rope', { nodes: [binding('PRESENCE#Base')] })?.connectedTo).toEqual([])
    })
})
