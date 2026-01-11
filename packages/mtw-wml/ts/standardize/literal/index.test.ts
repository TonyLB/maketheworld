import { StandardLiteral, PlainClass, RemoveClass, ReplaceClass } from './index'

describe('StandardLiteral', () => {
    it('should create a StandardLiteralSimple from string', () => {
        const literal = new StandardLiteral('test')
        expect(literal._payload).toBeInstanceOf(PlainClass)
        expect(literal.toJSON()).toBe('test')
    })

    it('should create a StandardLiteralRemove from string', () => {
        const literal = new StandardLiteral({ tag: 'Remove', match: 'test' })
        expect(literal._payload).toBeInstanceOf(RemoveClass)
        expect(literal.toJSON()).toEqual({ tag: 'Remove', match: 'test' })
    })

    it('should create a StandardLiteralReplace from string', () => {
        const literal = new StandardLiteral({ tag: 'Replace', payload: 'new', match: 'old' })
        expect(literal._payload).toBeInstanceOf(ReplaceClass)
        expect(literal.toJSON()).toEqual({ tag: 'Replace', match: 'old', payload: 'new' })
    })

    it('should create a StandardLiteralSimple from RenderTree', () => {
        const literal = new StandardLiteral(['test'])
        expect(literal._payload).toBeInstanceOf(PlainClass)
        expect(literal.toJSON()).toEqual('test')
    })

    it('should merge two StandardLiteralSimple instances', () => {
        const literal1 = new StandardLiteral('test1')
        const literal2 = new StandardLiteral('test2')
        const merged = literal1.merge(literal2)
        expect(merged).toBeInstanceOf(StandardLiteral)
        expect(merged?._payload).toBeInstanceOf(PlainClass)
        expect(merged?.toJSON()).toBe('test1test2')
    })

    it('should diff two StandardLiteralSimple instances', () => {
        const literal1 = new StandardLiteral('test1')
        const literal2 = new StandardLiteral('test2')
        const diff = literal1.diff(literal2)
        expect(diff).toBeInstanceOf(StandardLiteral)
        expect(diff?._payload).toBeInstanceOf(ReplaceClass)
        expect(diff?.toJSON()).toEqual({ tag: 'Replace', match: '1', payload: '2' })
    })

    it('should merge Simple with Remove when values are different', () => {
        // This is what happens in diff(a, b) = b.merge(a.invert()) when a and b are different
        // a.invert() converts Simple to Remove, then we merge Simple(b) with Remove(a)
        const simple = new StandardLiteral('Room Two')
        const remove = new StandardLiteral({ tag: 'Remove', match: 'Room One' })
        const merged = remove.merge(simple)
        // Should produce a Replace operation (different values)
        expect(merged).toBeInstanceOf(StandardLiteral)
        expect(merged?._payload).toBeInstanceOf(ReplaceClass)
        expect(merged?.toJSON()).toEqual({ tag: 'Replace', match: 'One', payload: 'Two' })
    })

    it('should map contents of StandardLiteralSimple', () => {
        const literal = new StandardLiteral('test')
        const mapped = literal.mapContents(data => data.toUpperCase())
        expect(mapped).toBeInstanceOf(StandardLiteral)
        expect(mapped._payload).toBeInstanceOf(PlainClass)
        expect(mapped.toJSON()).toBe('TEST')
    })

    it('should map contents of StandardLiteralRemove', () => {
        const literal = new StandardLiteral({ tag: 'Remove', match: 'test' })
        const mapped = literal.mapContents(data => data.toUpperCase())
        expect(mapped).toBeInstanceOf(StandardLiteral)
        expect(mapped._payload).toBeInstanceOf(RemoveClass)
        expect(mapped.toJSON()).toEqual({ tag: 'Remove', match: 'TEST' })
    })

    it('should map contents of StandardLiteralReplace', () => {
        const literal = new StandardLiteral({ tag: 'Replace', payload: 'new', match: 'old' })
        const mapped = literal.mapContents(data => data.toUpperCase())
        expect(mapped).toBeInstanceOf(StandardLiteral)
        expect(mapped._payload).toBeInstanceOf(ReplaceClass)
        expect(mapped.toJSON()).toEqual({ tag: 'Replace', match: 'OLD', payload: 'NEW' })
    })
})