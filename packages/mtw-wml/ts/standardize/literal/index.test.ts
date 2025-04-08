import { StandardLiteral, StandardLiteralSimple, StandardLiteralRemove, StandardLiteralReplace } from './index'

describe('StandardLiteral', () => {
    it('should create a StandardLiteralSimple from string', () => {
        const literal = new StandardLiteral('test')
        expect(literal._payload).toBeInstanceOf(StandardLiteralSimple)
        expect(literal.toJSON()).toBe('test')
    })

    it('should create a StandardLiteralRemove from string', () => {
        const literal = new StandardLiteral({ tag: 'Remove', match: 'test' })
        expect(literal._payload).toBeInstanceOf(StandardLiteralRemove)
        expect(literal.toJSON()).toEqual({ tag: 'Remove', match: 'test' })
    })

    it('should create a StandardLiteralReplace from string', () => {
        const literal = new StandardLiteral({ tag: 'Replace', payload: 'new', match: 'old' })
        expect(literal._payload).toBeInstanceOf(StandardLiteralReplace)
        expect(literal.toJSON()).toEqual({ tag: 'Replace', match: 'old', payload: 'new' })
    })

    it('should create a StandardLiteralSimple from RenderTree', () => {
        const literal = new StandardLiteral(['test'])
        expect(literal._payload).toBeInstanceOf(StandardLiteralSimple)
        expect(literal.toJSON()).toEqual('test')
    })

    it('should merge two StandardLiteralSimple instances', () => {
        const literal1 = new StandardLiteral('test1')
        const literal2 = new StandardLiteral('test2')
        const merged = literal1.merge(literal2)
        expect(merged).toBeInstanceOf(StandardLiteral)
        expect(merged?._payload).toBeInstanceOf(StandardLiteralSimple)
        expect(merged?.toJSON()).toBe('test1test2')
    })

    it('should diff two StandardLiteralSimple instances', () => {
        const literal1 = new StandardLiteral('test1')
        const literal2 = new StandardLiteral('test2')
        const diff = literal1.diff(literal2)
        expect(diff).toBeInstanceOf(StandardLiteral)
        expect(diff?._payload).toBeInstanceOf(StandardLiteralReplace)
        expect(diff?.toJSON()).toEqual({ tag: 'Replace', match: '1', payload: '2' })
    })

    it('should map contents of StandardLiteralSimple', () => {
        const literal = new StandardLiteral('test')
        const mapped = literal.mapContents(data => data.toUpperCase())
        expect(mapped).toBeInstanceOf(StandardLiteral)
        expect(mapped._payload).toBeInstanceOf(StandardLiteralSimple)
        expect(mapped.toJSON()).toBe('TEST')
    })

    it('should map contents of StandardLiteralRemove', () => {
        const literal = new StandardLiteral({ tag: 'Remove', match: 'test' })
        const mapped = literal.mapContents(data => data.toUpperCase())
        expect(mapped).toBeInstanceOf(StandardLiteral)
        expect(mapped._payload).toBeInstanceOf(StandardLiteralRemove)
        expect(mapped.toJSON()).toEqual({ tag: 'Remove', match: 'TEST' })
    })

    it('should map contents of StandardLiteralReplace', () => {
        const literal = new StandardLiteral({ tag: 'Replace', payload: 'new', match: 'old' })
        const mapped = literal.mapContents(data => data.toUpperCase())
        expect(mapped).toBeInstanceOf(StandardLiteral)
        expect(mapped._payload).toBeInstanceOf(StandardLiteralReplace)
        expect(mapped.toJSON()).toEqual({ tag: 'Replace', match: 'OLD', payload: 'NEW' })
    })
})