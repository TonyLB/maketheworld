import { StandardRenderSimple, StandardRenderConditional } from './index'
import { Schema } from '../../schema'

describe('StandardRenderSimple', () => {
    it('should create an instance from valid incoming schema', () => {
        const schema = new Schema()
        schema.loadWML(`
            Example<Link to=(Feature1)>Example</Link><br />
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

})

describe('StandardRenderConditional', () => {
    it('should create an instance from valid incoming schema', () => {
        const schema = new Schema()
        schema.loadWML(`
            <If {true}>
                Example<Link to=(Feature1)>Example</Link>
            </If>
            <Else>
                Another Example<Space />
            </Else>
        `)
        const render = new StandardRenderConditional(schema.schema[0])
        expect(render.toJSON()).toEqual(schema.schema[0])
    })
})
