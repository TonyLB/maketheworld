import { StandardEditableData } from '@tonylb/mtw-base/ts/editable'
import { StandardEditablePayload, standardEditableFactory, StandardEditableFactoryProps, StandardEditableWrapper } from './index'
import { MergeConflictError } from '@tonylb/mtw-base/ts/standardize'
import { GenericTree, GenericTreeNode, treeNodeTypeguard } from '@tonylb/mtw-base/ts/genericTree'
import { isSchemaTreeNode } from '../../standardize/components/utils'
import { isSchemaString } from '@tonylb/mtw-base/ts/schema/renderTree'
import { SchemaTag } from '@tonylb/mtw-base/ts/schema'
import { schemaToWML } from '../../schema'

interface TestData {
    id: number
    name: string
}

const testTypeguard = (value: any): value is TestData => {
    return typeof value === 'object' && value !== null && typeof value.id === 'number' && typeof value.name === 'string'
}

class testClass implements StandardEditablePayload<TestData> {
    data: TestData
    get schema() {
        return [{ data: { tag: 'String' as const, value: this.data.name }, children: [] }]
    }
    constructor(data: TestData) {
        this.data = data as TestData
    }
    clone() {
        return new testClass(this.data)
    }
    toJSON() {
        return { ...this.data }
    }
}

const testPayloadFactory = (props: StandardEditableData<TestData> | GenericTree<SchemaTag>): testClass | undefined => {
    if (testTypeguard(props)) {
        return new testClass(props)
    }
    if ((Array.isArray(props) && props.every(isSchemaTreeNode)) && treeNodeTypeguard(isSchemaString)(props[0])) {
        return new testClass({ id: 0, name: props[0].data.value })
    }
    return undefined
}

const factoryProps: StandardEditableFactoryProps<TestData, testClass> = {
    typeguard: testTypeguard,
    payloadFactory: testPayloadFactory,
    payload: testClass,
    add: (base, incoming) => {
        return { id: base.id, name: `${base.name}${incoming.name}` }
    },
    subtract: (base, incoming, options: { fromStart?: boolean } = {}) => {
        if (base.name === incoming.name) {
            return {}
        }
        else {
            if (base.name.length > incoming.name.length) {
                if (options.fromStart && base.name.startsWith(incoming.name)) {
                    return { id: base.id, name: base.name.slice(incoming.name.length) }
                }
                else if (base.name.endsWith(incoming.name)) {
                    return { add: { id: base.id, name: base.name.slice(0, base.name.length - incoming.name.length) } }
                }
            }
            else {
                if (options.fromStart && incoming.name.startsWith(base.name)) {
                    return { add: { id: base.id, name: incoming.name.slice(base.name.length) } }
                }
                else if (incoming.name.endsWith(base.name)) {
                    return { remove: { id: base.id, name: incoming.name.slice(0, (incoming.name.length - base.name.length)) } }
                }
            }
        }
        console.log(`throwing merge conflict error`)
        throw new MergeConflictError()
    },
    diff: (base, incoming) => {
        let firstDifferingIndex = 0
        while(firstDifferingIndex < base.name.length && firstDifferingIndex < incoming.name.length && base.name[firstDifferingIndex] === incoming.name[firstDifferingIndex]) {
            firstDifferingIndex++
        }
        if (base.name === incoming.name) {
            return {}
        }
        if (firstDifferingIndex === base.name.length) {
            return { add: { id: base.id, name: incoming.name.slice(firstDifferingIndex) } }
        }
        if (firstDifferingIndex === incoming.name.length) {
            return { remove: { id: base.id, name: base.name.slice(firstDifferingIndex) } }
        }
        return { add: { id: base.id, name: incoming.name.slice(firstDifferingIndex) }, remove: { id: base.id, name: base.name.slice(firstDifferingIndex) } }
    }
}

const { constructorDelta: factory, typeguard, merge, diff } = standardEditableFactory(factoryProps)

const fromDelta = (delta: { add?: TestData, remove?: TestData }): TestContentClass | TestRemoveClass | undefined => {
    const { add, remove } = delta
    if (add) {
        return new TestContentClass(new testClass(add))
    }
    if (remove) {
        return new TestRemoveClass(new testClass(remove))
    }
    return undefined
}

class TestContentClass implements StandardEditableWrapper<testClass> {
    payload: testClass
    constructor(data: testClass) {
        this.payload = data
    }
    get schema() {
        return this.payload.schema
    }
    get _delta() {
        return { add: this.payload.toJSON() }
    }
    clone() {
        return new TestContentClass(this.payload)
    }
    toJSON: () => StandardEditableData<{ id: number; name: string }> = () => this.payload.toJSON()
    get plain() { return this.payload }
    merge(other: StandardEditableWrapper<testClass>): TestContentClass | TestRemoveClass | TestReplaceClass | undefined {
        return fromDelta(merge(this._delta, other._delta))
    }
    diff(other: StandardEditableWrapper<testClass>): TestContentClass | TestRemoveClass | TestReplaceClass | undefined {
        return fromDelta(diff(this._delta, other._delta))
    }
}

class TestRemoveClass implements StandardEditableWrapper<testClass> {
    match: testClass
    constructor(match: testClass) {
        this.match = match
    }
    get schema() {
        return [{ data: { tag: 'Remove' as const }, children: [{ data: { tag: 'String' as const, value: this.match.data.name }, children: [] }] }]
    }
    get _delta() {
        return { remove: this.match.toJSON() }
    }
    clone() {
        return new TestRemoveClass(this.match)
    }
    toJSON: () => StandardEditableData<{ id: number; name: string }> = () => ({ tag: 'Remove' as const, match: this.match.toJSON() })
    get plain() { return this.match }
    merge(other: StandardEditableWrapper<testClass>): TestContentClass | TestRemoveClass | TestReplaceClass | undefined {
        return fromDelta(merge(this._delta, other._delta))
    }
    diff(other: StandardEditableWrapper<testClass>): TestContentClass | TestRemoveClass | TestReplaceClass | undefined {
        return fromDelta(diff(this._delta, other._delta))
    }
}

class TestReplaceClass implements StandardEditableWrapper<testClass> {
    match: testClass
    payload: testClass
    constructor(match: testClass, payload: testClass) {
        this.match = match
        this.payload = payload
    }
    get schema() {
        return [{ data: { tag: 'Replace' as const }, children: [
            { data: { tag: 'ReplaceMatch' as const }, children: this.match.schema },
            { data: { tag: 'ReplacePayload' as const }, children: this.payload.schema }
        ] }]
    }
    get _delta() {
        return { remove: this.match.toJSON() }
    }
    clone() {
        return new TestReplaceClass(this.match, this.payload)
    }
    toJSON: () => StandardEditableData<{ id: number; name: string }> = () => ({ tag: 'Replace' as const, match: this.match.toJSON(), payload: this.payload.toJSON() })
    get plain() { return this.payload }
    merge(other: StandardEditableWrapper<testClass>): TestContentClass | TestRemoveClass | TestReplaceClass | undefined {
        return fromDelta(merge(this._delta, other._delta))
    }
    diff(other: StandardEditableWrapper<testClass>): TestContentClass | TestRemoveClass | TestReplaceClass | undefined {
        return fromDelta(diff(this._delta, other._delta))
    }
}


describe('standardEditableFactory', () => {
    it('should create a valid TestEditable object when given valid data', () => {
        const data: TestData = { id: 1, name: 'Test' }
        const result = factory(data)
        expect(result?.toJSON()).toEqual(data)
    })

    it('should create a valid TestEditable object when given schema tag', () => {
        const data: GenericTree<SchemaTag> = [{ data: { tag: 'String', value: 'Test' }, children: [] }]
        const result = factory(data)
        expect(result?.toJSON()).toEqual({ id: 0, name: 'Test' })
    })

    it('should create a valid TestEditableobject when given WML', () => {
        const result = factory('Test')
        expect(result?.toJSON()).toEqual({ id: 0, name: 'Test' })
    })

    it('should return undefined when given invalid data', () => {
        const data = { id: 'invalid', name: 'Test' }
        const result = factory(data as any)
        expect(result).toBeUndefined()
    })

    it('should correctly identify valid StandardEditableData', () => {
        const data: TestData = { id: 1, name: 'Test' }
        expect(typeguard(data)).toBe(true)
    })

    it('should correctly identify invalid StandardEditableData', () => {
        const data = { id: 'invalid', name: 'Test' }
        expect(typeguard(data)).toBe(false)
    })

    it('should correctly identify Remove tag with valid match', () => {
        const data = { tag: 'Remove', match: { id: 1, name: 'Test' } }
        expect(typeguard(data)).toBe(true)
    })

    it('should correctly identify Replace tag with valid match and payload', () => {
        const data = { tag: 'Replace', match: { id: 1, name: 'Test' }, payload: { id: 2, name: 'Test2' } }
        expect(typeguard(data)).toBe(true)
    })

    it('should return remove class when given valid remove data', () => {
        const data = { tag: 'Remove' as const, match: { id: 1, name: 'Test' } }
        const result = factory(data)
        expect(result?.toJSON()).toEqual(data)
    })

    it('should return remove class when given valid remove schema tag', () => {
        const data = [{ data: { tag: 'Remove' }, children: [{ data: { tag: 'String', value: 'Test' }, children: [] }] }]
        const result = factory(data)
        expect(result?.toJSON()).toEqual({ tag: 'Remove', match: { id: 0, name: 'Test'} })
    })

    it('should return replace class when given valid replace data', () => {
        const data = { tag: 'Replace' as const, match: { id: 1, name: 'Test' }, payload: { id: 1, name: 'TestTwo' } }
        const result = factory(data)
        expect(result?.toJSON()).toEqual(data)
    })

    it('should return replace class when given valid replace schema tag', () => {
        const data = [{
            data: { tag: 'Replace' },
            children: [
                { data: { tag: 'ReplaceMatch' }, children: [{ data: { tag: 'String', value: 'Test' }, children: [] }] },
                { data: { tag: 'ReplacePayload' }, children: [{ data: { tag: 'String', value: 'TestTwo' }, children: [] }] }
            ]
        }]
        const result = factory(data)
        expect(result?.toJSON()).toEqual({ tag: 'Replace', match: { id: 0, name: 'Test'}, payload: { id: 0, name: 'TestTwo' } })
    })

    it('should round-trip content from WML', () => {
        const data = 'Test'
        const editable = factory(data)
        expect(schemaToWML(editable?.schema ?? [])).toEqual(data)
    })

    it('should round-trip remove from WML', () => {
        const data = '<Remove>Test</Remove>'
        const editable = factory(data)
        expect(schemaToWML(editable?.schema ?? [])).toEqual(data)
    })

    it('should round-trip replace from WML', () => {
        const data = '<Replace>Test</Replace><With>Final</With>'
        const editable = factory(data)
        expect(schemaToWML(editable?.schema ?? [])).toEqual(data)
    })

    describe('merge', () => {
        it('should correctly merge two content tags', () => {
            const data1 = { id: 1, name: 'Test' }
            const data2 = { id: 2, name: 'Test2' }
            const editable1 = factory(data1)
            const editable2 = factory(data2)
            expect(editable2).toBeDefined()
            if (editable2) {
                const merged = editable1?.merge(editable2)
                expect(merged?.toJSON()).toEqual({ id: 1, name: 'TestTest2' })
            }
        })
    
        it('should correctly merge a remove into a matching content tag', () => {
            const data1 = { id: 1, name: 'Test' }
            const data2 = { tag: 'Remove' as const, match: { id: 1, name: 'Test' } }
            const editable1 = factory(data1)
            const editable2 = factory(data2)
            const merged = editable1?.merge(editable2!)
            expect(merged?.toJSON()).toBeUndefined()
        })
    
        it('should correctly merge remove into a longer content tag', () => {
            const data1 = { id: 1, name: 'TestOne' }
            const data2 = { tag: 'Remove' as const, match: { id: 1, name: 'One' } }
            const editable1 = factory(data1)
            const editable2 = factory(data2)
            const merged = editable1?.merge(editable2!)
            expect(merged?.toJSON()).toEqual({ id: 1, name: 'Test' })
        })

        it('should correctly merge remove into a shorter content tag', () => {
            const data1 = { id: 1, name: 'One' }
            const data2 = { tag: 'Remove' as const, match: { id: 1, name: 'TestOne' } }
            const editable1 = factory(data1)
            const editable2 = factory(data2)
            const merged = editable1?.merge(editable2!)
            expect(merged?.toJSON()).toEqual({ tag: 'Remove', match: { id: 1, name: 'Test' } })
        })

        it('should throw a merge conflict error when merging remove into conflicting content', () => {
            const data1 = { id: 1, name: 'TestOne' }
            const data2 = { tag: 'Remove' as const, match: { id: 1, name: 'TestTwo' } }
            const editable1 = factory(data1)
            const editable2 = factory(data2)
            expect(() => editable1?.merge(editable2!)).toThrow(MergeConflictError)
        })

        it('should correctly merge remove into a remove tag', () => {
            const data1 = { tag: 'Remove' as const, match: { id: 1, name: 'One' } }
            const data2 = { tag: 'Remove' as const, match: { id: 1, name: 'Test' } }
            const editable1 = factory(data1)
            const editable2 = factory(data2)
            const merged = editable1?.merge(editable2!)
            expect(merged?.toJSON()).toEqual({ tag: 'Remove', match: { id: 1, name: 'TestOne' } })
        })

        it('should correctly merge a replace into a matching content tag', () => {
            const data1 = { id: 1, name: 'Test' }
            const data2 = { tag: 'Replace' as const, match: { id: 1, name: 'Test' }, payload: { id: 1, name: 'TestTwo' } }
            const editable1 = factory(data1)
            const editable2 = factory(data2)
            const merged = editable1?.merge(editable2!)
            expect(merged?.toJSON()).toEqual({ id: 1, name: 'TestTwo' })
        })
    
        it('should correctly merge a replace into a longer content tag', () => {
            const data1 = { id: 1, name: 'TestOne' }
            const data2 = { tag: 'Replace' as const, match: { id: 1, name: 'One' }, payload: { id: 1, name: 'Two' } }
            const editable1 = factory(data1)
            const editable2 = factory(data2)
            const merged = editable1?.merge(editable2!)
            expect(merged?.toJSON()).toEqual({ id: 1, name: 'TestTwo' })
        })

        it('should correctly merge a replace into a shorter content tag', () => {
            const data1 = { id: 1, name: 'One' }
            const data2 = { tag: 'Replace' as const, match: { id: 1, name: 'TestOne' }, payload: { id: 1, name: 'OutputTwo' } }
            const editable1 = factory(data1)
            const editable2 = factory(data2)
            const merged = editable1?.merge(editable2!)
            expect(merged?.toJSON()).toEqual({ tag: 'Replace', match: { id: 1, name: 'Test' }, payload: { id: 1, name: 'OutputTwo' } })
        })

        it('should throw a merge conflict error when merging replace into conflicting content', () => {
            const data1 = { id: 1, name: 'TestOne' }
            const data2 = { tag: 'Replace' as const, match: { id: 1, name: 'TestTwo' }, payload: { id: 1, name: 'Output' } }
            const editable1 = factory(data1)
            const editable2 = factory(data2)
            expect(() => editable1?.merge(editable2!)).toThrow(MergeConflictError)
        })

        it('should correctly merge a replace into a remove tag', () => {
            const data1 = { tag: 'Remove' as const, match: { id: 1, name: 'One' } }
            const data2 = { tag: 'Replace' as const, match: { id: 1, name: 'Test' }, payload: { id: 1, name: 'OutputTwo' } }
            const editable1 = factory(data1)
            const editable2 = factory(data2)
            const merged = editable1?.merge(editable2!)
            expect(merged?.toJSON()).toEqual({ tag: 'Replace', match: { id: 1, name: 'TestOne' }, payload: { id: 1, name: 'OutputTwo' } })
        })

        it('should correctly merge content into a replace tag', () => {
            const data1 = { tag: 'Replace' as const, match: { id: 1, name: 'Test' }, payload: { id: 1, name: 'Output' } }
            const data2 = { id: 1, name: 'Two' }
            const editable1 = factory(data1)
            const editable2 = factory(data2)
            const merged = editable1?.merge(editable2!)
            expect(merged?.toJSON()).toEqual({ tag: 'Replace', match: { id: 1, name: 'Test' }, payload: { id: 1, name: 'OutputTwo' } })
        })

        it('should correctly merge remove into a matching replace tag', () => {
            const data1 = { tag: 'Replace' as const, match: { id: 1, name: 'Test' }, payload: { id: 1, name: 'Output' } }
            const data2 = { tag: 'Remove' as const, match: { id: 1, name: 'Output' } }
            const editable1 = factory(data1)
            const editable2 = factory(data2)
            const merged = editable1?.merge(editable2!)
            expect(merged?.toJSON()).toEqual({ tag: 'Remove', match: { id: 1, name: 'Test' } })
        })

        it('should correctly merge remove into a longer replace tag', () => {
            const data1 = { tag: 'Replace' as const, match: { id: 1, name: 'Test' }, payload: { id: 1, name: 'FinalOutput' } }
            const data2 = { tag: 'Remove' as const, match: { id: 1, name: 'Output' } }
            const editable1 = factory(data1)
            const editable2 = factory(data2)
            const merged = editable1?.merge(editable2!)
            expect(merged?.toJSON()).toEqual({ tag: 'Replace', match: { id: 1, name: 'Test' }, payload: { id: 1, name: 'Final' } })
        })

        it('should correctly merge remove into a shorter replace tag', () => {
            const data1 = { tag: 'Replace' as const, match: { id: 1, name: 'Test' }, payload: { id: 1, name: 'Output' } }
            const data2 = { tag: 'Remove' as const, match: { id: 1, name: 'FinalOutput' } }
            const editable1 = factory(data1)
            const editable2 = factory(data2)
            const merged = editable1?.merge(editable2!)
            expect(merged?.toJSON()).toEqual({ tag: 'Remove', match: { id: 1, name: 'FinalTest' } })
        })

        it('should throw a merge conflict error when merging remove into conflicting replace tag', () => {
            const data1 = { tag: 'Replace' as const, match: { id: 1, name: 'Test' }, payload: { id: 1, name: 'Conflict' } }
            const data2 = { tag: 'Remove' as const, match: { id: 1, name: 'FinalOutput' } }
            const editable1 = factory(data1)
            const editable2 = factory(data2)
            expect(() => editable1?.merge(editable2!)).toThrow(MergeConflictError)
        })

        it('should correctly merge replace into a replace tag', () => {
            const data1 = { tag: 'Replace' as const, match: { id: 1, name: 'One' }, payload: { id: 1, name: 'Two' } }
            const data2 = { tag: 'Replace' as const, match: { id: 1, name: 'Two' }, payload: { id: 1, name: 'Three' } }
            const editable1 = factory(data1)
            const editable2 = factory(data2)
            const merged = editable1?.merge(editable2!)
            expect(merged?.toJSON()).toEqual({ tag: 'Replace', match: { id: 1, name: 'One' }, payload: { id: 1, name: 'Three' } })
        })

        it('should throw a merge conflict error when merging conflicting replace tags', () => {
            const data1 = { tag: 'Replace' as const, match: { id: 1, name: 'One' }, payload: { id: 1, name: 'Two' } }
            const data2 = { tag: 'Replace' as const, match: { id: 1, name: 'One' }, payload: { id: 1, name: 'Three' } }
            const editable1 = factory(data1)
            const editable2 = factory(data2)
            expect(() => editable1?.merge(editable2!)).toThrow(MergeConflictError)
        })
    })

    describe('diff', () => {
        it('should correctly diff two content tags', () => {
            const data1 = { id: 1, name: 'Test' }
            const data2 = { id: 2, name: 'TestTest2' }
            const editable1 = factory(data1)
            const editable2 = factory(data2)
            expect(editable2).toBeDefined()
            if (editable2) {
                const diffed = editable1?.diff(editable2)
                expect(diffed?.toJSON()).toEqual({ id: 1, name: 'Test2' })
            }
        })
    
        it('should correctly diff remove from a longer content tag', () => {
            const data1 = { id: 1, name: 'TestOne' }
            const data2 = { id: 1, name: 'Test' }
            const editable1 = factory(data1)
            const editable2 = factory(data2)
            const merged = editable1?.diff(editable2!)
            expect(merged?.toJSON()).toEqual({ tag: 'Remove' as const, match: { id: 1, name: 'One' } })
        })

        it('should correctly diff remove from a shorter content tag', () => {
            const data1 = { id: 1, name: 'One' }
            const data2 = { tag: 'Remove', match: { id: 1, name: 'Test' } }
            const editable1 = factory(data1)
            const editable2 = factory(data2)
            const merged = editable1?.diff(editable2!)
            expect(merged?.toJSON()).toEqual({ tag: 'Remove' as const, match: { id: 1, name: 'TestOne' } })
        })

        it('should correctly diff remove from a remove tag', () => {
            const data1 = { tag: 'Remove' as const, match: { id: 1, name: 'One' } }
            const data2 = { tag: 'Remove' as const, match: { id: 1, name: 'TestOne' } }
            const editable1 = factory(data1)
            const editable2 = factory(data2)
            const merged = editable1?.diff(editable2!)
            expect(merged?.toJSON()).toEqual({ tag: 'Remove', match: { id: 1, name: 'Test' } })
        })

        it('should correctly diff a replace from a matching content tag', () => {
            const data1 = { id: 1, name: 'Test' }
            const data2 = { id: 1, name: 'Final' }
            const editable1 = factory(data1)
            const editable2 = factory(data2)
            const merged = editable1?.diff(editable2!)
            expect(merged?.toJSON()).toEqual({ tag: 'Replace' as const, match: { id: 1, name: 'Test' }, payload: { id: 1, name: 'Final' } })
        })
    
        it('should correctly diff a replace from a longer content tag', () => {
            const data1 = { id: 1, name: 'TestOne' }
            const data2 = { id: 1, name: 'TestTwo' }
            const editable1 = factory(data1)
            const editable2 = factory(data2)
            const merged = editable1?.diff(editable2!)
            expect(merged?.toJSON()).toEqual({ tag: 'Replace' as const, match: { id: 1, name: 'One' }, payload: { id: 1, name: 'Two' } })
        })

        it('should correctly diff a replace from a shorter content tag', () => {
            const data1 = { id: 1, name: 'One' }
            const data2 = { tag: 'Replace', match: { id: 1, name: 'Test' }, payload: { id: 1, name: 'OutputTwo' } }
            const editable1 = factory(data1)
            const editable2 = factory(data2)
            const merged = editable1?.diff(editable2!)
            expect(merged?.toJSON()).toEqual({ tag: 'Replace' as const, match: { id: 1, name: 'TestOne' }, payload: { id: 1, name: 'OutputTwo' } })
        })

        it('should correctly diff a replace from a chained remove tag', () => {
            const data1 = { tag: 'Remove' as const, match: { id: 1, name: 'One' } }
            const data2 = { tag: 'Replace', match: { id: 1, name: 'TestOne' }, payload: { id: 1, name: 'OutputTwo' } }
            const editable1 = factory(data1)
            const editable2 = factory(data2)
            const merged = editable1?.diff(editable2!)
            expect(merged?.toJSON()).toEqual({ tag: 'Replace' as const, match: { id: 1, name: 'Test' }, payload: { id: 1, name: 'OutputTwo' } })
        })

        it('should correctly diff content from a replace tag', () => {
            const data1 = { tag: 'Replace' as const, match: { id: 1, name: 'Test' }, payload: { id: 1, name: 'Output' } }
            const data2 = { tag: 'Replace', match: { id: 1, name: 'Test' }, payload: { id: 1, name: 'OutputTwo' } }
            const editable1 = factory(data1)
            const editable2 = factory(data2)
            const merged = editable1?.diff(editable2!)
            expect(merged?.toJSON()).toEqual({ id: 1, name: 'Two' })
        })

        it('should correctly diff remove from a matching replace tag', () => {
            const data1 = { tag: 'Replace' as const, match: { id: 1, name: 'Test' }, payload: { id: 1, name: 'Output' } }
            const data2 = { tag: 'Remove', match: { id: 1, name: 'Test' } }
            const editable1 = factory(data1)
            const editable2 = factory(data2)
            const merged = editable1?.diff(editable2!)
            expect(merged?.toJSON()).toEqual({ tag: 'Remove' as const, match: { id: 1, name: 'Output' } })
        })

        it('should correctly diff remove from a longer replace tag', () => {
            const data1 = { tag: 'Replace' as const, match: { id: 1, name: 'Test' }, payload: { id: 1, name: 'FinalOutput' } }
            const data2 = { tag: 'Replace', match: { id: 1, name: 'Test' }, payload: { id: 1, name: 'Final' } }
            const editable1 = factory(data1)
            const editable2 = factory(data2)
            const merged = editable1?.diff(editable2!)
            expect(merged?.toJSON()).toEqual({ tag: 'Remove' as const, match: { id: 1, name: 'Output' } })
        })

        it('should correctly diff remove from a shorter replace tag', () => {
            const data1 = { tag: 'Replace' as const, match: { id: 1, name: 'Test' }, payload: { id: 1, name: 'Output' } }
            const data2 = { tag: 'Remove', match: { id: 1, name: 'FinalTest' } }
            const editable1 = factory(data1)
            const editable2 = factory(data2)
            const merged = editable1?.diff(editable2!)
            expect(merged?.toJSON()).toEqual({ tag: 'Remove' as const, match: { id: 1, name: 'FinalOutput' } })
        })

    })

})