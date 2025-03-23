import { StandardRenderSimple, StandardRenderRemove, StandardRenderReplace, StandardRender, StandardRenderSimpleCompareDirection } from './index'
import { Schema, schemaToWML } from '../../schema'
import { deIndentWML } from '../../schema/utils'

describe('StandardRenderRemove', () => {
    it('should create an instance from valid incoming schema', () => {
        const schema = new Schema()
        schema.loadWML(`<Remove>Example<Link to=(Feature1)>Link</Link></Remove>`)
        const render = new StandardRenderRemove(schema.schema)
        expect(render.schema).toEqual(schema.schema)
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
        const render = new StandardRenderReplace(schema.schema)
        expect(render.schema).toEqual(schema.schema)
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
        expect(render.schema).toEqual(schema.schema)
        expect(render.toJSON()).toEqual(['Example', { data: { tag: 'Link', to: 'Feature1', text: 'Link' }, children: ['Link'] }, { data: { tag: 'br' }, children: [] }, 'Another Example', { data: { tag: 'Space' }, children: [] }])
    })

    it('should merge whitespace to a single space', () => {
        const base = new StandardRenderSimple(['Test '])
        const merged = base.merge(new StandardRenderSimple([' Test']))
        expect(merged).toBeDefined()
        if (merged) {
            expect(merged.toJSON()).toEqual(new StandardRenderSimple(['Test Test']).toJSON())
        }
    })

    it('should count a Space tag as a single whitespace', () => {
        const base = new StandardRenderSimple(['Test', { data: { tag: 'Space' }, children: [] }])
        const merged = base.merge(new StandardRenderSimple([{ data: { tag: 'Space' }, children: [] }, 'Test']))
        expect(merged).toBeDefined()
        if (merged) {
            expect(merged.toJSON()).toEqual(new StandardRenderSimple(['Test Test']).toJSON())
        }
    })

    it('should reduce multiple instances of line breaks and whitespace to a single line break', () => {
        const base = new StandardRenderSimple(['Test', { data: { tag: 'br' }, children: [] }])
        const merged = base.merge(new StandardRenderSimple([{ data: { tag: 'Space' }, children: [] }, { data: { tag: 'br' }, children: [] }, 'Test']))
        expect(merged).toBeDefined()
        if (merged) {
            expect(merged.toJSON()).toEqual(new StandardRenderSimple(['Test', { data: { tag: 'br' }, children: [] }, 'Test']).toJSON())
        }
    })

    it('should trim whitespace in strings adjacent to line break', () => {
        const base = new StandardRenderSimple(['Test ', { data: { tag: 'br' }, children: [] }])
        const merged = base.merge(new StandardRenderSimple([' Test']))
        expect(merged).toBeDefined()
        if (merged) {
            expect(merged.toJSON()).toEqual(new StandardRenderSimple(['Test', { data: { tag: 'br' }, children: [] }, 'Test']).toJSON())
        }
    })

    describe('diff', () => {
        describe('diff', () => {
            it('should return undefined for identical schemas', () => {
                const base = new StandardRenderSimple(['Test', { data: { tag: 'br' }, children: [] }, 'Test 2'])
                const target = new StandardRenderSimple(['Test', { data: { tag: 'br' }, children: [] }, 'Test 2'])
                expect(base.diff(target)).toBeUndefined()
            })

            it('should return a StandardRender with remove elements when target is shorter', () => {
                const base = new StandardRenderSimple(['Test', { data: { tag: 'br' }, children: [] }, 'Test 2'])
                const target = new StandardRenderSimple(['Test'])
                const diff = base.diff(target)
                expect(diff?.toJSON()).toEqual([{
                    data: { tag: 'Remove' },
                    children: [{ data: { tag: 'br' }, children: [] }, 'Test 2']
                }])
            })

            it('should return a StandardRender with additional elements when target is longer', () => {
                const base = new StandardRenderSimple(['Test'])
                const target = new StandardRenderSimple(['Test', { data: { tag: 'br' }, children: [] }, 'Test 2'])
                const diff = base.diff(target)
                expect(diff?.toJSON()).toEqual([{ data: { tag: 'br' }, children: [] }, 'Test 2'])
            })

            it('should return a StandardRender with replace elements when base and target have different elements', () => {
                const base = new StandardRenderSimple(['Test', { data: { tag: 'br' }, children: [] }, 'Test 2'])
                const target = new StandardRenderSimple(['Example', { data: { tag: 'br' }, children: [] }, 'Example 2'])
                const diff = base.diff(target)
                expect(diff?.toJSON()).toEqual([{
                    data: { tag: 'Replace' },
                    children: [
                        { data: { tag: 'ReplaceMatch' }, children: ['Test', { data: { tag: 'br' }, children: [] }, 'Test 2'] },
                        { data: { tag: 'ReplacePayload' }, children: ['Example', { data: { tag: 'br' }, children: [] }, 'Example 2'] }
                    ]
                }])
            })

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
        expect(render.schema).toEqual(schema.schema)
    })

    it('should create an instance from incoming remove', () => {
        const schema = new Schema()
        schema.loadWML(`<Remove>Example<Link to=(Feature1)>Link</Link></Remove>`)
        const render = new StandardRender(schema.schema)
        expect(render.schema).toEqual(schema.schema)
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
        expect(render.schema).toEqual(schema.schema)
    })

    it('should merge simple incoming schema', () => {
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
        const base = new StandardRender(baseSchema.schema)
        const merged = base.merge(new StandardRender(incomingSchema.schema))
        expect(schemaToWML(merged!.schema)).toEqual(deIndentWML(`
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

    it('should merge remove incoming schema into simple base', () => {
        const baseSchema = new Schema()
        baseSchema.loadWML(`
            Example<Link to=(Feature1)>Link</Link>
        `)
        const incomingSchema = new Schema()
        incomingSchema.loadWML(`<Remove><Link to=(Feature1)>Link</Link></Remove>`)
        const base = new StandardRender(baseSchema.schema)
        const merged = base.merge(new StandardRender(incomingSchema.schema))
        expect(schemaToWML(merged!.schema)).toEqual('Example')
    })

    it('should create remainder remove when incoming schema is longer', () => {
        const baseSchema = new Schema()
        baseSchema.loadWML(`<Link to=(Feature1)>Link</Link>`)
        const incomingSchema = new Schema()
        incomingSchema.loadWML(`<Remove>Example<Link to=(Feature1)>Link</Link></Remove>`)
        const base = new StandardRender(baseSchema.schema)
        const merged = base.merge(new StandardRender(incomingSchema.schema))
        expect(schemaToWML(merged!.schema)).toEqual('<Remove>Example</Remove>')
    })

    it('should correctly interpret a Space prefix in a remove schema matching mid-string space', () => {
        const incomingSchema = new Schema()
        incomingSchema.loadWML(`<Remove><Space />More</Remove>`)
        const base = new StandardRender([{ data: { tag: 'String', value: 'Text More' }, children: [] }])
        const merged = base.merge(new StandardRender(incomingSchema.schema))
        expect(merged?.toJSON()).toEqual(['Text'])
    })

    it('should merge replace incoming schema into simple base', () => {
        const baseSchema = new Schema()
        baseSchema.loadWML(`
            Example<Link to=(Feature1)>Link</Link>
        `)
        const incomingSchema = new Schema()
        incomingSchema.loadWML(`
            <Replace>
                <Link to=(Feature1)>Link</Link>
            </Replace>
            <With>
                <Link to=(Feature2)>Link</Link>
            </With>
        `)
        const base = new StandardRender(baseSchema.schema)
        const merged = base.merge(new StandardRender(incomingSchema.schema))
        expect(schemaToWML(merged!.schema)).toEqual(deIndentWML(`
            Example
            <Link to=(Feature2)>Link</Link>
        `))
    })

    it('should create remainder replace when incoming schema is longer', () => {
        const baseSchema = new Schema()
        baseSchema.loadWML(`
            <Link to=(Feature1)>Link</Link>
        `)
        const incomingSchema = new Schema()
        incomingSchema.loadWML(`
            <Replace>
                Example<Link to=(Feature1)>Link</Link>
            </Replace>
            <With>
                <Link to=(Feature2)>Link</Link>
            </With>
        `)
        const base = new StandardRender(baseSchema.schema)
        const merged = base.merge(new StandardRender(incomingSchema.schema))
        expect(schemaToWML(merged!.schema)).toEqual(deIndentWML(`
            <Replace>Example</Replace><With><Link to=(Feature2)>Link</Link></With>
        `))
    })

    it('should create replace when merging simple incoming schema into base remove', () => {
        const baseSchema = new Schema()
        baseSchema.loadWML(`<Remove><Link to=(Feature1)>Link</Link></Remove>`)
        const incomingSchema = new Schema()
        incomingSchema.loadWML(`
            Example<Link to=(Feature2)>Link</Link>
        `)
        const base = new StandardRender(baseSchema.schema)
        const merged = base.merge(new StandardRender(incomingSchema.schema))
        expect(schemaToWML(merged!.schema)).toEqual(deIndentWML(`
            <Replace>
                <Link to=(Feature1)>Link</Link>
            </Replace>
            <With>
                Example
                <Link to=(Feature2)>Link</Link>
            </With>
        `))
    })

    it('should extend match term when merging two remove schemas', () => {
        const baseSchema = new Schema()
        baseSchema.loadWML(`<Remove>Example</Remove>`)
        const incomingSchema = new Schema()
        incomingSchema.loadWML(`<Remove>Another Example</Remove>`)
        const base = new StandardRender(baseSchema.schema)
        const merged = base.merge(new StandardRender(incomingSchema.schema))
        expect(schemaToWML(merged!.schema)).toEqual(deIndentWML(`
            <Remove>Another ExampleExample</Remove>
        `))
    })

    it('should extend replace match terms when merging replace into remove', () => {
        const baseSchema = new Schema()
        baseSchema.loadWML(`<Remove>Example</Remove>`)
        const incomingSchema = new Schema()
        incomingSchema.loadWML(`
            <Replace>
                Another Example
            </Replace>
            <With>
                Yet Another Example
            </With>
        `)
        const base = new StandardRender(baseSchema.schema)
        const merged = base.merge(new StandardRender(incomingSchema.schema))
        expect(schemaToWML(merged!.schema)).toEqual(deIndentWML(`
            <Replace>Another ExampleExample</Replace><With>Yet Another Example</With>
        `))
    })

    it('should throw merge conflict error when merging remove into term that does not match', () => {
        const baseSchema = new Schema()
        baseSchema.loadWML(`<Link to=(Feature1)>Link</Link>`)
        const incomingSchema = new Schema()
        incomingSchema.loadWML(`<Remove>Example</Remove>`)
        const base = new StandardRender(baseSchema.schema)
        expect(() => base.merge(new StandardRender(incomingSchema.schema))).toThrow()
    })

    it('should extend payload when merging simple incoming into replace base', () => {
        const baseSchema = new Schema()
        baseSchema.loadWML(`
            <Replace>
                Example
            </Replace>
            <With>
                Another Example
            </With>
        `)
        const incomingSchema = new Schema()
        incomingSchema.loadWML(`
            Yet Another Example<Link to=(Feature1)>Link</Link>
        `)
        const base = new StandardRender(baseSchema.schema)
        const merged = base.merge(new StandardRender(incomingSchema.schema))
        expect(schemaToWML(merged!.schema)).toEqual(deIndentWML(`
            <Replace>
                Example
            </Replace>
            <With>
                Another ExampleYet Another Example
                <Link to=(Feature1)>Link</Link>
            </With>
        `))
    })

    it('should reduce payload when merging remove into replace base with longer payload', () => {
        const baseSchema = new Schema()
        baseSchema.loadWML(`
            <Replace>
                Example
            </Replace>
            <With>
                AnotherExample
            </With>
        `)
        const incomingSchema = new Schema()
        incomingSchema.loadWML(`<Remove>Example</Remove>`)
        const base = new StandardRender(baseSchema.schema)
        const merged = base.merge(new StandardRender(incomingSchema.schema))
        expect(schemaToWML(merged!.schema)).toEqual(deIndentWML(`
            <Replace>Example</Replace><With>Another</With>
        `))
    })

    it('should extend match term when merging remove into replace base with shorter payload', () => {
        const baseSchema = new Schema()
        baseSchema.loadWML(`
            <Replace>
                Example
            </Replace>
            <With>
                Another Example
            </With>
        `)
        const incomingSchema = new Schema()
        incomingSchema.loadWML(`<Remove>Yet Another Example</Remove>`)
        const base = new StandardRender(baseSchema.schema)
        const merged = base.merge(new StandardRender(incomingSchema.schema))
        expect(schemaToWML(merged!.schema)).toEqual(deIndentWML(`
            <Remove>Yet Example</Remove>
        `))
    })

    it('should chain replace terms when merging replace into replace', () => {
        const baseSchema = new Schema()
        baseSchema.loadWML(`
            <Replace>
                Example
            </Replace>
            <With>
                Another Example
            </With>
        `)
        const incomingSchema = new Schema()
        incomingSchema.loadWML(`
            <Replace>
                Another Example
            </Replace>
            <With>
                Yet Another Example
            </With>
        `)
        const base = new StandardRender(baseSchema.schema)
        const merged = base.merge(new StandardRender(incomingSchema.schema))
        expect(schemaToWML(merged!.schema)).toEqual(deIndentWML(`
            <Replace>Example</Replace><With>Yet Another Example</With>
        `))
    })

    it('should throw merge conflict error when merging replace into term that does not match', () => {
        const baseSchema = new Schema()
        baseSchema.loadWML(`<Link to=(Feature1)>Link</Link>`)
        const incomingSchema = new Schema()
        incomingSchema.loadWML(`
            <Replace>Example</Replace><With>Another Example</With>
        `)
        const base = new StandardRender(baseSchema.schema)
        expect(() => base.merge(new StandardRender(incomingSchema.schema))).toThrow()
    })

    it('should reduce down to a no-op when merging replaces with identical payloads', () => {
        const baseSchema = new Schema()
        baseSchema.loadWML(`
            <Replace>
                Example
            </Replace>
            <With>
                Another Example
            </With>
        `)
        const incomingSchema = new Schema()
        incomingSchema.loadWML(`
            <Replace>
                Another Example
            </Replace>
            <With>
                Example
            </With>
        `)
        const base = new StandardRender(baseSchema.schema)
        const merged = base.merge(new StandardRender(incomingSchema.schema))
        expect(merged).toBeUndefined()
    })

    it('should mapContents on simple payload', () => {
        const schema = new Schema()
        schema.loadWML(`
            Example<Link to=(Feature1)>Link</Link><br />
            Another Example<Space />
        `)
        const render = new StandardRender(schema.schema)
        expect(render.mapContents((tree) => tree.map((node) => (typeof node === 'string' ? 'String' : node.data.tag))).toJSON()).toEqual(
            ['String', 'Link', 'br', 'String', 'Space']
        )
    })

    it('should mapContents on replace payload', () => {
        const schema = new Schema()
        schema.loadWML(`
            <Replace>
                Example<Link to=(Feature1)>Link</Link>
            </Replace>
            <With>
                Another Example<Link to=(Feature2)>Link</Link>
            </With>
        `)
        const render = new StandardRender(schema.schema)
        expect(render.mapContents((tree) => tree.map((node) => (typeof node === 'string' ? 'String' : node.data.tag))).toJSON()).toEqual([{
            data: { tag: 'Replace' },
            children: [
                { data: { tag: 'ReplaceMatch' }, children: ['String', 'Link'] },
                { data: { tag: 'ReplacePayload' }, children: ['String', 'Link'] }
            ]
        }])
    })

    it('should mapContents on remove payload', () => {
        const schema = new Schema()
        schema.loadWML(`<Remove>Example<Link to=(Feature1)>Link</Link></Remove>`)
        const render = new StandardRender(schema.schema)
        expect(render.mapContents((tree) => tree.map((node) => (typeof node === 'string' ? 'String' : node.data.tag))).toJSON()).toEqual([{
            data: { tag: 'Remove' },
            children: ['String', 'Link']
        }])
    })

})