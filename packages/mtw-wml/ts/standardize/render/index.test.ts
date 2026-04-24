import { StandardRender, PlainClass as StandardRenderSimple, RemoveClass as StandardRenderRemove, ReplaceClass as StandardRenderReplace, StandardRenderSimpleCompareDirection } from './index'
import { Schema, schemaToWML } from '../../schema'
import { deIndentWML } from '../../schema/utils'
import StandardReference from '../keys/reference'
import { isSchemaDescription } from '@tonylb/mtw-base/ts/schema/example'

describe('StandardRenderRemove', () => {
    it('should create an instance from valid incoming schema', () => {
        const schema = new Schema()
        schema.loadWML(`<Remove>Example<Link to=(Feature1)>Link</Link></Remove>`)
        const render = StandardRenderRemove.create(schema.schema)
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
        const render = StandardRenderReplace.create(schema.schema)
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
        const render = StandardRenderSimple.create(schema.schema)
        expect(render.schema).toEqual(schema.schema)
        expect(render.toJSON()).toEqual(['Example', { data: { tag: 'Link', to: 'Feature1', text: 'Link' }, children: ['Link'] }, { data: { tag: 'br' }, children: [] }, 'Another Example', { data: { tag: 'Space' }, children: [] }])
    })

    it('should merge whitespace to a single space', () => {
        const base = StandardRenderSimple.create(['Test '])
        const merged = base.merge(StandardRenderSimple.create([' Test']))
        expect(merged).toBeDefined()
        if (merged) {
            expect(merged.toJSON()).toEqual(StandardRenderSimple.create(['Test Test']).toJSON())
        }
    })

    it('should count a Space tag as a single whitespace', () => {
        const base = StandardRenderSimple.create(['Test', { data: { tag: 'Space' }, children: [] }])
        const merged = base.merge(StandardRenderSimple.create([{ data: { tag: 'Space' }, children: [] }, 'Test']))
        expect(merged).toBeDefined()
        if (merged) {
            expect(merged.toJSON()).toEqual(StandardRenderSimple.create(['Test Test']).toJSON())
        }
    })

    it('should reduce multiple instances of line breaks and whitespace to a single line break', () => {
        const base = StandardRenderSimple.create(['Test', { data: { tag: 'br' }, children: [] }])
        const merged = base.merge(StandardRenderSimple.create([{ data: { tag: 'Space' }, children: [] }, { data: { tag: 'br' }, children: [] }, 'Test']))
        expect(merged).toBeDefined()
        if (merged) {
            expect(merged.toJSON()).toEqual(StandardRenderSimple.create(['Test', { data: { tag: 'br' }, children: [] }, 'Test']).toJSON())
        }
    })

    it('should trim whitespace in strings adjacent to line break', () => {
        const base = StandardRenderSimple.create(['Test ', { data: { tag: 'br' }, children: [] }])
        const merged = base.merge(StandardRenderSimple.create([' Test']))
        expect(merged).toBeDefined()
        if (merged) {
            expect(merged.toJSON()).toEqual(StandardRenderSimple.create(['Test', { data: { tag: 'br' }, children: [] }, 'Test']).toJSON())
        }
    })

    describe('diff', () => {
        describe('diff', () => {
            it('should return undefined for identical schemas', () => {
                const base = StandardRenderSimple.create(['Test', { data: { tag: 'br' }, children: [] }, 'Test 2'])
                const target = StandardRenderSimple.create(['Test', { data: { tag: 'br' }, children: [] }, 'Test 2'])
                expect(base.diff(target)).toBeUndefined()
            })

            it('should return a StandardRender with remove elements when target is shorter', () => {
                const base = StandardRenderSimple.create(['Test', { data: { tag: 'br' }, children: [] }, 'Test 2'])
                const target = StandardRenderSimple.create(['Test'])
                const diff = base.diff(target)
                // factory returns StandardEditableData format: { tag: 'Remove', match: RenderTree }
                const wrappedDiff = diff ? new StandardRender(diff) : undefined
                expect(wrappedDiff?.toJSON()).toEqual({
                    tag: 'Remove',
                    match: [{ data: { tag: 'br' }, children: [] }, 'Test 2']
                })
            })

            it('should return a StandardRender with additional elements when target is longer', () => {
                const base = StandardRenderSimple.create(['Test'])
                const target = StandardRenderSimple.create(['Test', { data: { tag: 'br' }, children: [] }, 'Test 2'])
                const diff = base.diff(target)
                // factory returns StandardEditableData format: plain RenderTree for PlainClass
                const wrappedDiff = diff ? new StandardRender(diff) : undefined
                expect(wrappedDiff?.toJSON()).toEqual([{ data: { tag: 'br' }, children: [] }, 'Test 2'])
            })

            it('should return a StandardRender with replace elements when base and target have different elements', () => {
                const base = StandardRenderSimple.create(['Test', { data: { tag: 'br' }, children: [] }, 'Test 2'])
                const target = StandardRenderSimple.create(['Example', { data: { tag: 'br' }, children: [] }, 'Example 2'])
                const diff = base.diff(target)
                // factory returns StandardEditableData format: { tag: 'Replace', match: RenderTree, payload: RenderTree }
                const wrappedDiff = diff ? new StandardRender(diff) : undefined
                expect(wrappedDiff?.toJSON()).toEqual({
                    tag: 'Replace',
                    match: ['Test', { data: { tag: 'br' }, children: [] }, 'Test 2'],
                    payload: ['Example', { data: { tag: 'br' }, children: [] }, 'Example 2']
                })
            })

            // Regression: Asset Summary jitter - diff from "Test asset" to "Test asset (debug)" must return
            // the added portion " (debug)", not [")"]. Bug was using slice(-1) when firstDifferingIndex === -1
            // and base is a prefix of incoming. Leading space normalizes to Space element.
            it('should return added suffix when base string is prefix of target string', () => {
                const base = StandardRenderSimple.create(['Test asset'])
                const target = StandardRenderSimple.create(['Test asset (debug)'])
                const diff = base.diff(target)
                const wrappedDiff = diff ? new StandardRender(diff) : undefined
                expect(wrappedDiff?.toJSON()).toEqual([{ data: { tag: 'Space' }, children: [] }, '(debug)'])
            })

        })
    })

})

describe('StandardRender', () => {
    it('should create an instance from simple incoming schema', () => {
        const schema = new Schema()
        schema.loadWML(`
            Example<Link to=(Feature1)>Link</Link><br />
            One<Link to=(Feature2)>Link</Link>
            Two<Space />
        `)
        const render = new StandardRender(schema.schema)
        expect(render.schema).toEqual(schema.schema)
    })

    describe('constructor with options.tag (single schema node)', () => {
        it('should create instance from plain content-tag node (e.g. Description)', () => {
            const schema = new Schema()
            schema.loadWML(`<Message key=(m)><Description>Hello world</Description></Message>`)
            const messageNode = schema.schema[0]
            const descriptionNode = messageNode.children[0]
            const render = new StandardRender(descriptionNode, { tag: 'Description', nodeTypeGuard: isSchemaDescription, errorMessage: 'Schema mismatch in test' })
            expect(render.plainString).toBe('Hello world')
        })

        it('should create instance from Remove-wrapped content-tag node', () => {
            const schema = new Schema()
            schema.loadWML(`<Message key=(m)><Remove><Description>Remove me</Description></Remove></Message>`)
            const messageNode = schema.schema[0]
            const removeNode = messageNode.children[0]
            const render = new StandardRender(removeNode, { tag: 'Description', nodeTypeGuard: isSchemaDescription, errorMessage: 'Schema mismatch in test' })
            const expectedSchema = new Schema()
            expectedSchema.loadWML(`<Remove>Remove me</Remove>`)
            expect(render.schema).toEqual(expectedSchema.schema)
        })

        it('should create instance from Replace-wrapped content-tag node', () => {
            const schema = new Schema()
            schema.loadWML(`
                <Message key=(m)>
                    <Replace><Description>Old</Description></Replace>
                    <With><Description>New</Description></With>
                </Message>
            `)
            const messageNode = schema.schema[0]
            const replaceNode = messageNode.children[0]
            const render = new StandardRender(replaceNode, { tag: 'Description', nodeTypeGuard: isSchemaDescription, errorMessage: 'Schema mismatch in test' })
            expect(render.toJSON()).toEqual({ tag: 'Replace', match: ['Old'], payload: ['New'] })
        })
    })

    // Vacuity uses the no-op diff / merge criterion (semantic optionals task plan).
    describe('isEmpty', () => {
        it('returns true for plain empty render tree', () => {
            expect(new StandardRender([]).isEmpty()).toBe(true)
        })

        it('returns false for non-empty plain content', () => {
            const schema = new Schema()
            schema.loadWML(`Example<Link to=(Feature1)>Link</Link>`)
            expect(new StandardRender(schema.schema).isEmpty()).toBe(false)
        })

        it('returns true for Remove with empty match', () => {
            expect(new StandardRender({ tag: 'Remove', match: [] }).isEmpty()).toBe(true)
        })

        it('returns false for Remove with non-empty match', () => {
            const schema = new Schema()
            schema.loadWML(`<Remove>Example</Remove>`)
            expect(new StandardRender(schema.schema).isEmpty()).toBe(false)
        })

        it('returns true for Replace when match and payload have no diff (identity)', () => {
            const tree = ['Test', { data: { tag: 'br' }, children: [] }, 'Test 2'] as const
            const replace = new StandardRender({
                tag: 'Replace',
                match: [...tree],
                payload: [...tree]
            })
            expect(replace.isEmpty()).toBe(true)
        })

        it('returns true for Replace with identical empty trees', () => {
            expect(new StandardRender({ tag: 'Replace', match: [], payload: [] }).isEmpty()).toBe(true)
        })

        it('returns false for Replace when match and payload differ', () => {
            const schema = new Schema()
            schema.loadWML(`
                <Replace>
                    Example<Link to=(Feature1)>Link</Link>
                </Replace>
                <With>
                    Another<Link to=(Feature2)>Link</Link>
                </With>
            `)
            expect(new StandardRender(schema.schema).isEmpty()).toBe(false)
        })
    })

    describe('equals', () => {
        it('is reflexive for plain, remove, and replace', () => {
            const plain = new StandardRender([])
            expect(plain.equals(plain)).toBe(true)
            const schema = new Schema()
            schema.loadWML(`<Remove>Example</Remove>`)
            const remove = new StandardRender(schema.schema)
            expect(remove.equals(remove)).toBe(true)
            schema.loadWML(`
                <Replace>Old</Replace><With>New</With>
            `)
            const replace = new StandardRender(schema.schema)
            expect(replace.equals(replace)).toBe(true)
        })

        it('treats all vacuous shapes as equal', () => {
            const empty = new StandardRender([])
            expect(empty.equals(new StandardRender([]))).toBe(true)
            expect(empty.equals(new StandardRender({ tag: 'Remove', match: [] }))).toBe(true)
            expect(empty.equals(new StandardRender({ tag: 'Replace', match: [], payload: [] }))).toBe(true)
            const tree = ['Test', { data: { tag: 'br' }, children: [] }, 'Test 2'] as const
            const identityReplace = new StandardRender({
                tag: 'Replace',
                match: [...tree],
                payload: [...tree]
            })
            expect(empty.equals(identityReplace)).toBe(true)
            expect(identityReplace.equals(empty)).toBe(true)
        })

        it('returns false when one side is vacuous and the other is not', () => {
            const empty = new StandardRender([])
            const schema = new Schema()
            schema.loadWML(`Example<Link to=(Feature1)>Link</Link>`)
            const nonEmpty = new StandardRender(schema.schema)
            expect(empty.equals(nonEmpty)).toBe(false)
            expect(nonEmpty.equals(empty)).toBe(false)
        })

        it('returns true for two identical non-empty plain renders', () => {
            const schema = new Schema()
            schema.loadWML(`Example<Link to=(Feature1)>Link</Link>`)
            const a = new StandardRender(schema.schema)
            const b = new StandardRender(schema.schema)
            expect(a.equals(b)).toBe(true)
            expect(b.equals(a)).toBe(true)
        })

        it('returns false for clearly different content', () => {
            const s1 = new Schema()
            s1.loadWML(`Alpha`)
            const s2 = new Schema()
            s2.loadWML(`Beta`)
            expect(new StandardRender(s1.schema).equals(new StandardRender(s2.schema))).toBe(false)
        })

        it('plain content is not equal to identity Replace of the same tree (different representation)', () => {
            const tree = ['Test', { data: { tag: 'br' }, children: [] }, 'Test 2'] as const
            const plain = new StandardRender([...tree])
            const identityReplace = new StandardRender({
                tag: 'Replace',
                match: [...tree],
                payload: [...tree]
            })
            expect(identityReplace.isEmpty()).toBe(true)
            expect(plain.isEmpty()).toBe(false)
            expect(plain.equals(identityReplace)).toBe(false)
        })
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
            One<Link to=(Feature2)>Link</Link>
            Two<Space />
        `)
        const base = new StandardRender(baseSchema.schema)
        const merged = base.merge(new StandardRender(incomingSchema.schema))

        expect(schemaToWML(merged!.schema)).toEqual(deIndentWML(`
            Example
            <Link to=(Feature1)>Link</Link>
            One
            <Link to=(Feature2)>Link</Link>
            Two
            <Space />
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
        // factory returns StandardEditableData format: { tag: 'Replace', match: RenderTree, payload: RenderTree }
        expect(render.mapContents((tree) => tree.map((node) => (typeof node === 'string' ? 'String' : node.data.tag))).toJSON()).toEqual({
            tag: 'Replace',
            match: ['String', 'Link'],
            payload: ['String', 'Link']
        })
    })

    it('should mapContents on remove payload', () => {
        const schema = new Schema()
        schema.loadWML(`<Remove>Example<Link to=(Feature1)>Link</Link></Remove>`)
        const render = new StandardRender(schema.schema)
        // factory returns StandardEditableData format: { tag: 'Remove', match: RenderTree }
        expect(render.mapContents((tree) => tree.map((node) => (typeof node === 'string' ? 'String' : node.data.tag))).toJSON()).toEqual({
            tag: 'Remove',
            match: ['String', 'Link']
        })
    })

    it('should remap references correctly', () => {
        const schema = new Schema()
        schema.loadWML(`
            <Replace>
                Example
                <Link to=(Feature1)>Link</Link>
            </Replace>
            <With>
                Another Example
                <Link to=(Feature2)>Link</Link>
            </With>
        `)
        const render = new StandardRender(schema.schema)
        const remapped = render.remapReferences({ mapping: [new StandardReference({ key: 'Feature1', tag: 'Feature', universalKey: 'FEATURE#feature1' }), new StandardReference({ key: 'Feature2', tag: 'Feature', universalKey: 'FEATURE#feature2' })], mapTo: 'universal' })
        expect(schemaToWML(remapped.schema)).toEqual(deIndentWML(`
            <Replace>
                Example
                <Link to=(FEATURE#feature1)>Link</Link>
            </Replace>
            <With>
                Another Example
                <Link to=(FEATURE#feature2)>Link</Link>
            </With>
        `))
    })

    describe('nestedSchema(options)', () => {
        it('with no options returns payload schema (no wrapping)', () => {
            const schema = new Schema()
            schema.loadWML(`Example<Link to=(F1)>L</Link>`)
            const render = new StandardRender(schema.schema)
            const result = render.nestedSchema()
            expect(result).toEqual(render.schema)
        })

        it('with tag returns list of one wrapped node', () => {
            const schema = new Schema()
            schema.loadWML(`Hello world`)
            const render = new StandardRender(schema.schema)
            const result = render.nestedSchema({ tag: 'Description' })
            expect(schemaToWML(result)).toEqual(deIndentWML(`
                <Description>Hello world</Description>
            `))
        })

        it('with tag and mappings remaps then wraps', () => {
            const schema = new Schema()
            schema.loadWML(`<Link to=(FEATURE#f1)>Link</Link>`)
            const render = new StandardRender(schema.schema)
            const mappings = [new StandardReference({ key: 'F1', tag: 'Feature', universalKey: 'FEATURE#f1' })]
            const result = render.nestedSchema({ tag: 'Description', mappings })
            expect(schemaToWML(result)).toEqual(deIndentWML(`
                <Description><Link to=(F1)>Link</Link></Description>
            `))
        })

        it('with tag and empty plain content returns empty list', () => {
            const render = new StandardRender([])
            const result = render.nestedSchema({ tag: 'Description' })
            expect(result).toEqual([])
        })
    })
})