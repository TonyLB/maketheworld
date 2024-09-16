import { listDiff } from './listDiff'

describe('listDiff', () => {
    it('should add items as necessary', () => {
        expect(listDiff(
            [
                { data: { tag: 'Exit', from: 'room1', to: 'room2', key: 'room1:room2' }, children: [{ data: { tag: 'String', value: 'out' }, children: [] }] },
                { data: { tag: 'Exit', from: 'room1', to: 'room4', key: 'room1:room4' }, children: [{ data: { tag: 'String', value: 'closet' }, children: [] }] }
            ],
            [
                { data: { tag: 'Exit', from: 'room1', to: 'room2', key: 'room1:room2' }, children: [{ data: { tag: 'String', value: 'out' }, children: [] }] },
                { data: { tag: 'Exit', from: 'room1', to: 'room3', key: 'room1:room3' }, children: [{ data: { tag: 'String', value: 'stairs' }, children: [] }] },
                { data: { tag: 'Exit', from: 'room1', to: 'room4', key: 'room1:room4' }, children: [{ data: { tag: 'String', value: 'closet' }, children: [] }] }
            ]
        )).toEqual([
            { data: { tag: 'Exit', from: 'room1', to: 'room3', key: 'room1:room3' }, children: [{ data: { tag: 'String', value: 'stairs' }, children: [] }] }
        ])
    })
})