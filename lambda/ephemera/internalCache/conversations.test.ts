import ConversationsData from './conversations'

describe('ConversationsData', () => {
    it('set and get round-trip', () => {
        const cache = new ConversationsData()
        const id = 'conv-001'
        cache.set({ conversationId: id })
        expect(cache.get(id)).toEqual({ conversationId: id })
    })

    it('get returns undefined for unknown id', () => {
        const cache = new ConversationsData()
        expect(cache.get('missing')).toBeUndefined()
    })

    it('set replaces existing record', () => {
        const cache = new ConversationsData()
        const id = 'conv-002'
        cache.set({ conversationId: id })
        cache.set({ conversationId: id })
        expect(cache.get(id)).toEqual({ conversationId: id })
    })

    it('delete removes a record', () => {
        const cache = new ConversationsData()
        const id = 'conv-003'
        cache.set({ conversationId: id })
        expect(cache.delete(id)).toBe(true)
        expect(cache.get(id)).toBeUndefined()
    })

    it('delete returns false for unknown id', () => {
        const cache = new ConversationsData()
        expect(cache.delete('nope')).toBe(false)
    })

    it('clear removes all records', () => {
        const cache = new ConversationsData()
        cache.set({ conversationId: 'a' })
        cache.set({ conversationId: 'b' })
        cache.clear()
        expect(cache.get('a')).toBeUndefined()
        expect(cache.get('b')).toBeUndefined()
    })
})
