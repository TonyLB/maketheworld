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

    describe('tag support', () => {
        it('should store tag when provided in constructor', () => {
            const literal = new StandardLiteral('test', { tag: 'ShortName' })
            expect(literal._wrapperTag).toBe('ShortName')
        })

        it('should use stored tag in nestedSchema()', () => {
            const literal = new StandardLiteral('test', { tag: 'ShortName' })
            const schema = literal.nestedSchema()
            expect(schema).toEqual([{ data: { tag: 'ShortName' }, children: [{ data: { tag: 'String', value: 'test' }, children: [] }] }])
        })

        it('should use explicit tag in nestedSchema() when provided (backward compatibility)', () => {
            const literal = new StandardLiteral('test', { tag: 'ShortName' })
            const schema = literal.nestedSchema({ tag: 'Pronouns' })
            expect(schema).toEqual([{ data: { tag: 'Pronouns' }, children: [{ data: { tag: 'String', value: 'test' }, children: [] }] }])
        })

        it('should throw error when nestedSchema() called without tag and no stored tag', () => {
            const literal = new StandardLiteral('test')
            expect(() => literal.nestedSchema()).toThrow('nestedSchema() called without tag argument and no stored wrapper tag')
        })

        it('should preserve tag in merge when both operands have the same tag', () => {
            const literal1 = new StandardLiteral('test1', { tag: 'ShortName' })
            const literal2 = new StandardLiteral('test2', { tag: 'ShortName' })
            const merged = literal1.merge(literal2)
            expect(merged?._wrapperTag).toBe('ShortName')
            expect(merged?.toJSON()).toBe('test1test2')
        })

        it('should not preserve tag in merge when operands have different tags', () => {
            const literal1 = new StandardLiteral('test1', { tag: 'ShortName' })
            const literal2 = new StandardLiteral('test2', { tag: 'Pronouns' })
            const merged = literal1.merge(literal2)
            expect(merged?._wrapperTag).toBeUndefined()
            expect(merged?.toJSON()).toBe('test1test2')
        })

        it('should not preserve tag in merge when one operand has no tag', () => {
            const literal1 = new StandardLiteral('test1', { tag: 'ShortName' })
            const literal2 = new StandardLiteral('test2')
            const merged = literal1.merge(literal2)
            expect(merged?._wrapperTag).toBeUndefined()
            expect(merged?.toJSON()).toBe('test1test2')
        })

        it('should preserve tag in invert()', () => {
            const literal = new StandardLiteral('test', { tag: 'ShortName' })
            const inverted = literal.invert()
            expect(inverted._wrapperTag).toBe('ShortName')
        })

        it('should preserve tag in diff() when both operands have the same tag', () => {
            const literal1 = new StandardLiteral('test1', { tag: 'ShortName' })
            const literal2 = new StandardLiteral('test2', { tag: 'ShortName' })
            const diff = literal1.diff(literal2)
            expect(diff?._wrapperTag).toBe('ShortName')
        })

        it('should preserve tag in diff() when diffing to undefined', () => {
            const literal = new StandardLiteral('test', { tag: 'ShortName' })
            const diff = literal.diff(undefined)
            expect(diff?._wrapperTag).toBe('ShortName')
        })

        it('should preserve tag in mapContents()', () => {
            const literal = new StandardLiteral('test', { tag: 'ShortName' })
            const mapped = literal.mapContents(data => data.toUpperCase())
            expect(mapped._wrapperTag).toBe('ShortName')
            expect(mapped.toJSON()).toBe('TEST')
        })

        it('should handle nestedSchema() with RemoveClass and stored tag', () => {
            const literal = new StandardLiteral({ tag: 'Remove', match: 'old' }, { tag: 'ShortName' })
            const schema = literal.nestedSchema()
            expect(schema).toEqual([{
                data: { tag: 'Remove' },
                children: [{
                    data: { tag: 'ShortName' },
                    children: [{ data: { tag: 'String', value: 'old' }, children: [] }]
                }]
            }])
        })

        it('should handle nestedSchema() with ReplaceClass and stored tag', () => {
            const literal = new StandardLiteral({ tag: 'Replace', match: 'old', payload: 'new' }, { tag: 'ShortName' })
            const schema = literal.nestedSchema()
            expect(schema).toEqual([{
                data: { tag: 'Replace' },
                children: [
                    {
                        data: { tag: 'ReplaceMatch' },
                        children: [{
                            data: { tag: 'ShortName' },
                            children: [{ data: { tag: 'String', value: 'old' }, children: [] }]
                        }]
                    },
                    {
                        data: { tag: 'ReplacePayload' },
                        children: [{
                            data: { tag: 'ShortName' },
                            children: [{ data: { tag: 'String', value: 'new' }, children: [] }]
                        }]
                    }
                ]
            }])
        })

        it('should strip wrapper tag from top level', () => {
            const tree = [{
                data: { tag: 'ShortName' },
                children: [{ data: { tag: 'String', value: 'test' }, children: [] }]
            }]
            const literal = new StandardLiteral(tree, { tag: 'ShortName' })
            expect(literal.toJSON()).toBe('test')
            expect(literal._wrapperTag).toBe('ShortName')
        })

        it('should strip wrapper tag from inside Remove tag', () => {
            const tree = [{
                data: { tag: 'Remove' },
                children: [{
                    data: { tag: 'ShortName' },
                    children: [{ data: { tag: 'String', value: 'test' }, children: [] }]
                }]
            }]
            const literal = new StandardLiteral(tree, { tag: 'ShortName' })
            expect(literal.toJSON()).toEqual({ tag: 'Remove', match: 'test' })
            expect(literal._wrapperTag).toBe('ShortName')
        })

        it('should strip wrapper tag from inside Replace tag', () => {
            const tree = [{
                data: { tag: 'Replace' },
                children: [
                    {
                        data: { tag: 'ReplaceMatch' },
                        children: [{
                            data: { tag: 'ShortName' },
                            children: [{ data: { tag: 'String', value: 'old' }, children: [] }]
                        }]
                    },
                    {
                        data: { tag: 'ReplacePayload' },
                        children: [{
                            data: { tag: 'ShortName' },
                            children: [{ data: { tag: 'String', value: 'new' }, children: [] }]
                        }]
                    }
                ]
            }]
            const literal = new StandardLiteral(tree, { tag: 'ShortName' })
            expect(literal.toJSON()).toEqual({ tag: 'Replace', match: 'old', payload: 'new' })
            expect(literal._wrapperTag).toBe('ShortName')
        })

        it('should handle already-stripped trees (backward compatibility)', () => {
            const tree = [{ data: { tag: 'String', value: 'test' }, children: [] }]
            const literal = new StandardLiteral(tree, { tag: 'ShortName' })
            expect(literal.toJSON()).toBe('test')
            expect(literal._wrapperTag).toBe('ShortName')
        })
    })
})