/**
* @vitest-environment jsdom
*/
import { vi } from 'vitest'
import React, { FunctionComponent, useEffect } from 'react'
import { render, act } from '@testing-library/react'

import { useEditContext, EditSchema, EditSubListSchema, useEditNodeContext, EditChildren } from './EditContext'
import { schemaOutputToString } from '@tonylb/mtw-wml/ts/schema/utils/schemaOutput/schemaOutputToString'
import { treeTypeGuard } from '@tonylb/mtw-wml/ts/tree/filter'
import { GenericTree, treeNodeTypeguard } from '@tonylb/mtw-base/ts/genericTree'
import produce from 'immer'
import { isSchemaOutputTag, SchemaTag } from '@tonylb/mtw-base/ts/schema'
import { isSchemaLink, isSchemaString } from '@tonylb/mtw-base/ts/schema/renderTree'

const Render: FunctionComponent<{}> = () => {
    const { value } = useEditContext()
    return <React.Fragment>
        { schemaOutputToString(treeTypeGuard({ tree: value, typeGuard: isSchemaOutputTag })) }
    </React.Fragment>
}

describe('EditSchema', () => {

    it('should provide value for children', () => {
        expect(render(
                <EditSchema
                    value={[{ data: { tag: 'String', value: 'Test' }, children: [] }]}
                    onChange={() => {}}
                >
                    <Render />
                </EditSchema>
            ).container
        ).toMatchSnapshot()

    })
})

describe('EditChildren', () => {
    const testSchema: GenericTree<SchemaTag> = [{
        data: { tag: 'Description' },
        children: [
            { data: { tag: 'String', value: 'Test1' }, children: [] },
            { data: { tag: 'String', value: 'Test2' }, children: [] },
            { data: { tag: 'String', value: 'Test3' }, children: [] }    
        ]
    }]

    const MultiRender = () => {
        const { value } = useEditContext()
        return <React.Fragment>
            {
                value.map((_, index) => (
                    <EditSubListSchema key={`child-${index}`} index={index}>
                        <Render />
                    </EditSubListSchema>
                ))
            }
        </React.Fragment>
    }

    it('should extract node children', () => {
        expect(render(
                <EditSchema
                    value={testSchema}
                    onChange={() => {}}
                >
                    <EditChildren>
                        <MultiRender />
                    </EditChildren>
                </EditSchema>
            ).container
        ).toMatchSnapshot()
    })

    it('should bubble up onChange events', async () => {
        const ChangeRender: FunctionComponent<{}> = () => {
            const { onChange } = useEditContext()
            useEffect(() => {
                onChange([
                    { data: { tag: 'String', value: 'Test1' }, children: [] },
                    { data: { tag: 'String', value: 'Test change' }, children: [] },
                    { data: { tag: 'String', value: 'Test3' }, children: [] }
                ])
            }, [])
            return <MultiRender />
        }
        const onChange = vi.fn()
        await act(async () => {
            render(
                <EditSchema
                    value={testSchema}
                    onChange={onChange}
                >
                    <EditChildren>
                        <ChangeRender />
                    </EditChildren>
                </EditSchema>
            )
        })
        expect(onChange).toHaveBeenCalledTimes(1)
        expect(onChange).toHaveBeenCalledWith([{
            data: { tag: 'Description' },
            children: [
                { data: { tag: 'String', value: 'Test1' }, children: [] },
                { data: { tag: 'String', value: 'Test change' }, children: [] },
                { data: { tag: 'String', value: 'Test3' }, children: [] }
            ]
        }])
    })

    it('should clear on true isEmpty', async () => {
        const ChangeRender: FunctionComponent<{}> = () => {
            const { onChange } = useEditContext()
            useEffect(() => {
                onChange([
                    { data: { tag: 'String', value: 'Test1' }, children: [] },
                    { data: { tag: 'String', value: 'Test change' }, children: [] },
                    { data: { tag: 'String', value: 'Test3' }, children: [] }
                ])
            }, [])
            return <MultiRender />
        }
        const onChange = vi.fn()
        await act(() => {
            render(
                <EditSchema
                    value={testSchema}
                    onChange={onChange}
                >
                    <EditChildren isEmpty={(tree) => (!Boolean(tree.find(treeNodeTypeguard(isSchemaLink))))}>
                        <ChangeRender />
                    </EditChildren>
                </EditSchema>
            )
        })
        expect(onChange).toHaveBeenCalledTimes(1)
        expect(onChange).toHaveBeenCalledWith([])
    })

})

describe('EditSubListSchema', () => {
    const testSchema: GenericTree<SchemaTag> = [
        { data: { tag: 'String', value: 'Test1' }, children: [] },
        { data: { tag: 'String', value: 'Test2' }, children: [] },
        { data: { tag: 'String', value: 'Test3' }, children: [] }
    ]

    it('should extract an indexed value from node children', () => {
        expect(render(
                <EditSchema
                    value={testSchema}
                    onChange={() => {}}
                >
                    <EditSubListSchema index={1}>
                        <Render />
                    </EditSubListSchema>
                </EditSchema>
            ).container
        ).toMatchSnapshot()
    })

    it('should bubble up onChange events', async () => {
        const ChangeRender: FunctionComponent<{}> = () => {
            const { onChange } = useEditNodeContext()
            useEffect(() => {
                onChange({ data: { tag: 'String', value: 'Test change' }, children: [] })
            }, [])
            return <Render />
        }
        const onChange = vi.fn()
        await act(() => {
            render(
                <EditSchema
                    value={testSchema}
                    onChange={onChange}
                >
                    <EditSubListSchema index={1}>
                        <ChangeRender />
                    </EditSubListSchema>
                </EditSchema>
            )
        })
        expect(onChange).toHaveBeenCalledTimes(1)
        expect(onChange).toHaveBeenCalledWith([
            { data: { tag: 'String', value: 'Test1' }, children: [] },
            { data: { tag: 'String', value: 'Test change' }, children: [] },
            { data: { tag: 'String', value: 'Test3' }, children: [] }
        ])
    })

    it('should bubble up functional onChange events', async () => {
        const ChangeRender: FunctionComponent<{}> = () => {
            const { onChange } = useEditNodeContext()
            useEffect(() => {
                onChange((draft) => {
                    const { data } = draft
                    if (isSchemaString(data)) {
                        data.value = 'Test change'
                    }
                })
            }, [])
            return <Render />
        }
        const onChange = vi.fn()
        await act(() => {
            render(
                <EditSchema
                    value={testSchema}
                    onChange={onChange}
                >
                    <EditSubListSchema index={1}>
                        <ChangeRender />
                    </EditSubListSchema>
                </EditSchema>
            )
        })
        expect(onChange).toHaveBeenCalledTimes(1)
        expect(produce(
            [
                { data: { tag: 'String', value: 'Test1' }, children: [] },
                { data: { tag: 'String', value: 'Test2' }, children: [] },
                { data: { tag: 'String', value: 'Test3' }, children: [] }
            ],
            onChange.mock.calls[0][0]
        )).toEqual([
            { data: { tag: 'String', value: 'Test1' }, children: [] },
            { data: { tag: 'String', value: 'Test change' }, children: [] },
            { data: { tag: 'String', value: 'Test3' }, children: [] }
        ])
    })

    it('should bubble up onDelete events', async () => {
        const ChangeRender: FunctionComponent<{}> = () => {
            const { onDelete } = useEditNodeContext()
            useEffect(() => {
                onDelete()
            }, [])
            return <Render />
        }
        const onChange = vi.fn()
        await act(() => {
            render(
                <EditSchema
                    value={testSchema}
                    onChange={onChange}
                >
                    <EditSubListSchema index={1}>
                        <ChangeRender />
                    </EditSubListSchema>
                </EditSchema>
            )
        })
        expect(onChange).toHaveBeenCalledTimes(1)
        expect(onChange).toHaveBeenCalledWith([
            { data: { tag: 'String', value: 'Test1' }, children: [] },
            { data: { tag: 'String', value: 'Test3' }, children: [] }
        ])
    })
})