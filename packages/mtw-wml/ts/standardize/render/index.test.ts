import { StandardRenderSimple, StandardRenderConditional, StandardRenderRemove, StandardRenderReplace, StandardRender } from './index'
import { Schema, schemaToWML } from '../../schema'
import { deIndentWML } from '../../schema/utils'

describe('StandardRenderConditional', () => {
    it('should create an instance from valid incoming schema', () => {
        const schema = new Schema()
        schema.loadWML(`
            <If {true}>
                True<Link to=(Feature1)>Example</Link>
            </If>
            <Else>
                False<Space />
            </Else>
        `)
        const render = new StandardRenderConditional(schema.schema[0])
        expect(render.toJSON()).toEqual(schema.schema[0])
    })
})

describe('StandardRenderRemove', () => {
    it('should create an instance from valid incoming schema', () => {
        const schema = new Schema()
        schema.loadWML(`<Remove>Example<Link to=(Feature1)>Link</Link></Remove>`)
        const render = new StandardRenderRemove(schema.schema[0])
        expect(render.toJSON()).toEqual(schema.schema[0])
    })
})

describe('StandardRenderReplace', () => {
    it('should create an instance from valid incoming schema', () => {
        const schema = new Schema()
        schema.loadWML(`
            <Replace>
                Example<Link to=(Feature1)>Link</Link>
            </Replace>
            <With>
                Another<Link to=(Feature2)>Link</Link>
            </With>
        `)
        const render = new StandardRenderReplace(schema.schema[0])
        expect(render.toJSON()).toEqual(schema.schema[0])
    })
})

describe('StandardRenderSimple', () => {
    it('should create an instance from valid incoming schema', () => {
        const schema = new Schema()
        schema.loadWML(`
            Example<Link to=(Feature1)>Link</Link><br />
            Another Example<Space />
        `)
        const render = new StandardRenderSimple(schema.schema)
        expect(render.toJSON()).toEqual(schema.schema)
    })

    it('should merge whitespace to a single space', () => {
        const base = new StandardRenderSimple(['Test '])
        expect(base.merge(new StandardRenderSimple([' Test'])).toJSON()).toEqual(new StandardRenderSimple(['Test Test']).toJSON())
    })

    it('should count a Space tag as a single whitespace', () => {
        const base = new StandardRenderSimple(['Test', { data: { tag: 'Space' }, children: [] }])
        expect(base.merge(new StandardRenderSimple([{ data: { tag: 'Space' }, children: [] }, 'Test'])).toJSON()).toEqual(new StandardRenderSimple(['Test Test']).toJSON())
    })

    it('should reduce multiple instances of line breaks and whitespace to a single line break', () => {
        const base = new StandardRenderSimple(['Test', { data: { tag: 'br' }, children: [] }])
        expect(base.merge(new StandardRenderSimple([{ data: { tag: 'Space' }, children: [] }, { data: { tag: 'br' }, children: [] }, 'Test'])).toJSON()).toEqual(new StandardRenderSimple(['Test', { data: { tag: 'br' }, children: [] }, 'Test']).toJSON())
    })

    it('should trim whitespace in strings adjacent to line break', () => {
        const base = new StandardRenderSimple(['Test ', { data: { tag: 'br' }, children: [] }])
        expect(base.merge(new StandardRenderSimple([' Test'])).toJSON()).toEqual(new StandardRenderSimple(['Test', { data: { tag: 'br' }, children: [] }, 'Test']).toJSON())
    })

    it('should round-trip a schema with conditionals', () => {
        const schema = new Schema()
        schema.loadWML(`
            Example<Link to=(Feature1)>Link</Link><br />
            <If {true}>
                True<Link to=(Feature2)>Link</Link>
            </If>
            <Else>
                False<Space />
            </Else>
        `)
        const render = new StandardRenderSimple(schema.schema)
        expect(render.toJSON()).toEqual(schema.schema)
    })

    it('should correctly merge conditionals', () => {
        const baseSchema = new Schema()
        baseSchema.loadWML(`
            Example<Link to=(Feature1)>Link</Link>
        `)
        const incomingSchema = new Schema()
        incomingSchema.loadWML(`
            <If {true}>
                True<Link to=(Feature2)>Link</Link>
            </If>
            <Else>
                False<Space />
            </Else>
        `)
        const base = new StandardRenderSimple(baseSchema.schema)
        const merged = base.merge(new StandardRenderSimple(incomingSchema.schema))
        expect(schemaToWML(merged.toJSON())).toEqual(deIndentWML(`
            Example
            <Link to=(Feature1)>Link</Link>
            <If {true}>
                True
                <Link to=(Feature2)>Link</Link>
            </If>
            <Else>
                False
                <Space />
            </Else>
        `))
    })

    describe('compare', () => {
        it('should return Equal for identical schemas', () => {
            const base = new StandardRenderSimple(['Test', { data: { tag: 'br' }, children: [] }, 'Test 2'])
            const incoming = new StandardRenderSimple(['Test', { data: { tag: 'br' }, children: [] }, 'Test 2'])
            expect(base.compare(incoming)).toEqual({ outcome: 'Equal' })
        })

        it('should return remainder for shorter incoming schema', () => {
            const base = new StandardRenderSimple(['Test', { data: { tag: 'br' }, children: [] }, 'Test 2'])
            const incoming = new StandardRenderSimple(['Test 2'])
            const comparison = base.compare(incoming)
            expect(comparison.outcome).toEqual('Base Longer')
            expect(comparison.remainder?.toJSON()).toEqual([{ data: { tag: 'String', value: 'Test' }, children: [] }, { data: { tag: 'br' }, children: [] }])
        })

        it('should return remainder for shorter base schema', () => {
            const base = new StandardRenderSimple(['Test 2'])
            const incoming = new StandardRenderSimple(['Test', { data: { tag: 'br' }, children: [] }, 'Test 2'])
            const comparison = base.compare(incoming)
            expect(comparison.outcome).toEqual('Incoming Longer')
            expect(comparison.remainder?.toJSON()).toEqual([{ data: { tag: 'String', value: 'Test' }, children: [] }, { data: { tag: 'br' }, children: [] }])
        })

        it('should return conflict for different schemas', () => {
            const base = new StandardRenderSimple(['Test', { data: { tag: 'br' }, children: [] }, 'Test 2'])
            const incoming = new StandardRenderSimple(['Test', { data: { tag: 'br' }, children: [] }, 'Test 3'])
            const comparison = base.compare(incoming)
            expect(comparison.outcome).toEqual('Conflict')
        })
    })

})

describe('StandardRender', () => {
    it('should create an instance from simple incoming schema', () => {
        const schema = new Schema()
        schema.loadWML(`
            Example<Link to=(Feature1)>Link</Link><br />
            <If {true}>
                True<Link to=(Feature2)>Link</Link>
            </If>
            <Else>
                False<Space />
            </Else>
        `)
        const render = new StandardRender(schema.schema)
        expect(render.toJSON()).toEqual(schema.schema)
    })

    it('should create an instance from incoming remove', () => {
        const schema = new Schema()
        schema.loadWML(`<Remove>Example<Link to=(Feature1)>Link</Link></Remove>`)
        const render = new StandardRender(schema.schema)
        expect(render.toJSON()).toEqual(schema.schema)
    })

    it('should create an instance from incoming replace', () => {
        const schema = new Schema()
        schema.loadWML(`
            <Replace>
                Example<Link to=(Feature1)>Link</Link>
            </Replace>
            <With>
                Another<Link to=(Feature2)>Link</Link>
            </With>
        `)
        const render = new StandardRender(schema.schema)
        expect(render.toJSON()).toEqual(schema.schema)
    })

})