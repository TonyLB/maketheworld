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

        it('should split the base string in remainder when incoming matches only part of it', () => {
            const base = new StandardRenderSimple(['Test/Another Test', { data: { tag: 'br' }, children: [] }, 'Test 2'])
            const incoming = new StandardRenderSimple(['Another Test', { data: { tag: 'br' }, children: [] }, 'Test 2'])
            const comparison = base.compare(incoming)
            expect(comparison.outcome).toEqual('Base Longer')
            expect(comparison.remainder?.toJSON()).toEqual([{ data: { tag: 'String', value: 'Test/' }, children: [] }])
        })

        it('should split the incoming string in remainder when Base matches only part of it', () => {
            const base = new StandardRenderSimple(['Another Test', { data: { tag: 'br' }, children: [] }, 'Test 2'])
            const incoming = new StandardRenderSimple(['Test/Another Test', { data: { tag: 'br' }, children: [] }, 'Test 2'])
            const comparison = base.compare(incoming)
            expect(comparison.outcome).toEqual('Incoming Longer')
            expect(comparison.remainder?.toJSON()).toEqual([{ data: { tag: 'String', value: 'Test/' }, children: [] }])
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

    it('should merge remove incoming schema into simple base', () => {
        const baseSchema = new Schema()
        baseSchema.loadWML(`
            Example<Link to=(Feature1)>Link</Link>
        `)
        const incomingSchema = new Schema()
        incomingSchema.loadWML(`<Remove><Link to=(Feature1)>Link</Link></Remove>`)
        const base = new StandardRender(baseSchema.schema)
        const merged = base.merge(new StandardRender(incomingSchema.schema))
        expect(schemaToWML(merged.toJSON())).toEqual('Example')
    })

    it('should create remainder remove when incoming schema is longer', () => {
        const baseSchema = new Schema()
        baseSchema.loadWML(`<Link to=(Feature1)>Link</Link>`)
        const incomingSchema = new Schema()
        incomingSchema.loadWML(`<Remove>Example<Link to=(Feature1)>Link</Link></Remove>`)
        const base = new StandardRender(baseSchema.schema)
        const merged = base.merge(new StandardRender(incomingSchema.schema))
        expect(schemaToWML(merged.toJSON())).toEqual('<Remove>Example</Remove>')
    })

    it('should correctly interpret a Space prefix in a remove schema matching mid-string space', () => {
        const incomingSchema = new Schema()
        incomingSchema.loadWML(`<Remove><Space />More</Remove>`)
        const base = new StandardRender([{ data: { tag: 'String', value: 'Text More' }, children: [] }])
        const merged = base.merge(new StandardRender(incomingSchema.schema))
        expect(merged.toNDJSON()).toEqual(['Text'])
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
        expect(schemaToWML(merged.toJSON())).toEqual(deIndentWML(`
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
        expect(schemaToWML(merged.toJSON())).toEqual(deIndentWML(`
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
        expect(schemaToWML(merged.toJSON())).toEqual(deIndentWML(`
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
        expect(schemaToWML(merged.toJSON())).toEqual(deIndentWML(`
            <Remove>ExampleAnother Example</Remove>
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
        expect(schemaToWML(merged.toJSON())).toEqual(deIndentWML(`
            <Replace>ExampleAnother Example</Replace><With>Yet Another Example</With>
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
        expect(schemaToWML(merged.toJSON())).toEqual(deIndentWML(`
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
        expect(schemaToWML(merged.toJSON())).toEqual(deIndentWML(`
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
        expect(schemaToWML(merged.toJSON())).toEqual(deIndentWML(`
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
        expect(schemaToWML(merged.toJSON())).toEqual(deIndentWML(`
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
        expect(schemaToWML(merged.toJSON())).toEqual('')
    })

    it('should mapContents on simple payload', () => {
        const schema = new Schema()
        schema.loadWML(`
            Example<Link to=(Feature1)>Link</Link><br />
            Another Example<Space />
        `)
        const render = new StandardRender(schema.schema)
        expect(render.mapContents((tree) => tree.map((node) => ({ data: { tag: 'String', value: node.data.tag }, children: [] }))).toJSON()).toEqual(
            ['String', 'Link', 'br', 'String', 'Space'].map((tag) => ({ data: { tag: 'String', value: tag }, children: [] }))
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
        expect(render.mapContents((tree) => tree.map((node) => ({ data: { tag: 'String', value: node.data.tag }, children: [] }))).toJSON()).toEqual([{
            data: { tag: 'Replace' },
            children: [
                { data: { tag: 'ReplaceMatch' }, children: ['String', 'Link'].map((tag) => ({ data: { tag: 'String', value: tag }, children: [] })) },
                { data: { tag: 'ReplacePayload' }, children: ['String', 'Link'].map((tag) => ({ data: { tag: 'String', value: tag }, children: [] })) }
            ]
        }])
    })

    it('should mapContents on remove payload', () => {
        const schema = new Schema()
        schema.loadWML(`<Remove>Example<Link to=(Feature1)>Link</Link></Remove>`)
        const render = new StandardRender(schema.schema)
        expect(render.mapContents((tree) => tree.map((node) => ({ data: { tag: 'String', value: node.data.tag }, children: [] }))).toJSON()).toEqual([{
            data: { tag: 'Remove' },
            children: ['String', 'Link'].map((tag) => ({ data: { tag: 'String', value: tag }, children: [] }))
        }])
    })

    it('should combine adjacent conditional tags with compatible statements', () => {
        const baseSchema = new Schema()
        baseSchema.loadWML(`
            <If {true}>
                True<Link to=(Feature1)>Link</Link>
            </If>
        `)
        const incomingSchema = new Schema()
        incomingSchema.loadWML(`
            <If {true}>
                Another True<Link to=(Feature2)>Link</Link>
            </If>
        `)
        const base = new StandardRenderSimple(baseSchema.schema)
        const merged = base.merge(new StandardRenderSimple(incomingSchema.schema))
        expect(schemaToWML(merged.toJSON())).toEqual(deIndentWML(`
            <If {true}>
                True
                <Link to=(Feature1)>Link</Link>
                Another True
                <Link to=(Feature2)>Link</Link>
            </If>
        `))
    })

    it('should not combine adjacent conditional tags with incompatible statements', () => {
        const baseSchema = new Schema()
        baseSchema.loadWML(`
            <If {true}>
                True<Link to=(Feature1)>Link</Link>
            </If>
        `)
        const incomingSchema = new Schema()
        incomingSchema.loadWML(`
            <If {false}>
                False<Link to=(Feature2)>Link</Link>
            </If>
        `)
        const base = new StandardRenderSimple(baseSchema.schema)
        const merged = base.merge(new StandardRenderSimple(incomingSchema.schema))
        expect(schemaToWML(merged.toJSON())).toEqual(deIndentWML(`
            <If {true}>
                True
                <Link to=(Feature1)>Link</Link>
            </If>
            <If {false}>
                False
                <Link to=(Feature2)>Link</Link>
            </If>
        `))
    })

    it('should combine adjacent conditional tags with compatible statements and fallthrough', () => {
        const baseSchema = new Schema()
        baseSchema.loadWML(`
            <If {true}>
                True<Link to=(Feature1)>Link</Link>
            </If>
            <Else>
                Base Fallthrough<Space />
            </Else>
        `)
        const incomingSchema = new Schema()
        incomingSchema.loadWML(`
            <If {true}>
                Another True<Link to=(Feature2)>Link</Link>
            </If>
            <Else>
                Incoming Fallthrough
            </Else>
        `)
        const base = new StandardRenderSimple(baseSchema.schema)
        const merged = base.merge(new StandardRenderSimple(incomingSchema.schema))
        expect(schemaToWML(merged.toJSON())).toEqual(deIndentWML(`
            <If {true}>
                True
                <Link to=(Feature1)>Link</Link>
                Another True
                <Link to=(Feature2)>Link</Link>
            </If>
            <Else>
                Base Fallthrough Incoming Fallthrough
            </Else>
        `))
    })

    it('should combine adjacent conditional tags with compatible fallthrough in the first tag', () => {
        const baseSchema = new Schema()
        baseSchema.loadWML(`
            <If {true}>
                True<Link to=(Feature1)>Link</Link>
            </If>
            <Else>
                Base Fallthrough<Space />
            </Else>
        `)
        const incomingSchema = new Schema()
        incomingSchema.loadWML(`
            <If {true}>
                Another True<Link to=(Feature2)>Link</Link>
            </If>
        `)
        const base = new StandardRenderSimple(baseSchema.schema)
        const merged = base.merge(new StandardRenderSimple(incomingSchema.schema))
        expect(schemaToWML(merged.toJSON())).toEqual(deIndentWML(`
            <If {true}>
                True
                <Link to=(Feature1)>Link</Link>
                Another True
                <Link to=(Feature2)>Link</Link>
            </If>
            <Else>
                Base Fallthrough
                <Space />
            </Else>
        `))
    })

    it('should not combine adjacent conditional tags with incompatible fallthrough', () => {
        const baseSchema = new Schema()
        baseSchema.loadWML(`
            <If {true}>
                True<Link to=(Feature1)>Link</Link>
            </If>
            <ElseIf {false}>
                Base Else If
            </ElseIf>
        `)
        const incomingSchema = new Schema()
        incomingSchema.loadWML(`
            <If {true}>
                Another True<Link to=(Feature2)>Link</Link>
            </If>
            <Else>
                Fallthrough
            </Else>
        `)
        const base = new StandardRenderSimple(baseSchema.schema)
        const merged = base.merge(new StandardRenderSimple(incomingSchema.schema))
        expect(schemaToWML(merged.toJSON())).toEqual(deIndentWML(`
            <If {true}>
                True
                <Link to=(Feature1)>Link</Link>
            </If>
            <ElseIf {false}>
                Base Else If
            </ElseIf>
            <If {true}>
                Another True
                <Link to=(Feature2)>Link</Link>
            </If>
            <Else>
                Fallthrough
            </Else>
        `))
    })

})