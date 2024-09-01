import { GenericTree } from "@tonylb/mtw-wml/dist/tree/baseClasses"
import { nestOnChangeChildren, nestOnChangeSubItem } from "./context"
import { SchemaTag } from "@tonylb/mtw-wml/dist/schema/baseClasses"

describe('context nesting helper library', () => {
    it('should nest onChange with nestOnChangeSubItem', () => {
        const onChange = jest.fn()
        nestOnChangeSubItem({
            tree: [
                { data: { tag: 'String', value: 'A' }, children: [] },
                { data: { tag: 'String', value: 'B' }, children: [] },
                { data: { tag: 'String', value: 'C' }, children: [] }
            ],
            index: 1
        })(onChange)({ data: { tag: 'String', value: 'D' }, children: [] })
        expect(onChange).toHaveBeenCalledTimes(1)
        expect(onChange).toHaveBeenCalledWith([
            { data: { tag: 'String', value: 'A' }, children: [] },
            { data: { tag: 'String', value: 'D' }, children: [] },
            { data: { tag: 'String', value: 'C' }, children: [] }
        ])
    })

    it('should nest onChange with nestOnChangeChildren', () => {
        const onChange = jest.fn()
        nestOnChangeChildren({
            data: { tag: 'Description' },
            children: [
                { data: { tag: 'String', value: 'A' }, children: [] },
                { data: { tag: 'String', value: 'B' }, children: [] },
                { data: { tag: 'String', value: 'C' }, children: [] }
            ]
        })(onChange)([
            { data: { tag: 'String', value: 'A' }, children: [] },
            { data: { tag: 'String', value: 'D' }, children: [] },
            { data: { tag: 'String', value: 'C' }, children: [] }
        ])
        expect(onChange).toHaveBeenCalledTimes(1)
        expect(onChange).toHaveBeenCalledWith({
            data: { tag: 'Description' },
            children: [
                { data: { tag: 'String', value: 'A' }, children: [] },
                { data: { tag: 'String', value: 'D' }, children: [] },
                { data: { tag: 'String', value: 'C' }, children: [] }
            ]
        })
    })

    it('should combine nesting', () => {
        const onChange = jest.fn()
        const testSchema: GenericTree<SchemaTag> = [{
            data: { tag: 'Description' },
            children: [
                { data: { tag: 'String', value: 'A' }, children: [] },
                { data: { tag: 'String', value: 'B' }, children: [] },
                { data: { tag: 'String', value: 'C' }, children: [] }
            ]
        }]
        nestOnChangeSubItem({ tree: testSchema[0].children, index: 1 })(nestOnChangeChildren(testSchema[0])(nestOnChangeSubItem({ tree: testSchema, index: 0 })(onChange)))({ data: { tag: 'String', value: 'D' }, children: [] })
        expect(onChange).toHaveBeenCalledTimes(1)
        expect(onChange).toHaveBeenCalledWith([{
            data: { tag: 'Description' },
            children: [
                { data: { tag: 'String', value: 'A' }, children: [] },
                { data: { tag: 'String', value: 'D' }, children: [] },
                { data: { tag: 'String', value: 'C' }, children: [] }
            ]
        }])
    })


})