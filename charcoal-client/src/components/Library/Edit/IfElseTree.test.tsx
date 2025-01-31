jest.mock('../../../environment')
jest.mock('./CodeEditor')
import CodeEditor from './CodeEditor'

import React, { FunctionComponent } from 'react'
import { render } from '@testing-library/react'

import { treeNodeTypeguard } from '@tonylb/mtw-base/ts/genericTree'
import { schemaOutputToString } from '@tonylb/mtw-wml/ts/schema/utils/schemaOutput/schemaOutputToString'
import { EditSchema, useEditContext } from './EditContext'
import { treeTypeGuard } from '@tonylb/mtw-wml/ts/tree/filter'
import IfElseTree from './IfElseTree'
import { isSchemaExit } from '@tonylb/mtw-base/ts/schema/components'
import { isSchemaOutputTag } from '@tonylb/mtw-base/ts/schema'

describe('IfElseTree component', () => {
    const renderComponent: FunctionComponent<{}> = () => {
        const { value } = useEditContext()
        return <React.Fragment>
            { value
                .filter(treeNodeTypeguard(isSchemaExit))
                .map(({ data, children }) => (<div>{ `'${data.from}' to '${data.to}': ${schemaOutputToString(treeTypeGuard({ typeGuard: isSchemaOutputTag, tree: children }))}` }</div>))
            }
        </React.Fragment>
    }

    beforeEach(() => {
        (CodeEditor as jest.Mock).mockReturnValue(null)
    })

    it('renders single statement correctly', () => {
        const { container } = render(
            <EditSchema
                value={[{
                    data: { tag: 'If' },
                    children: [
                        {
                            data: { tag: 'Statement', if: 'true' },
                            children: [
                                { data: { tag: 'Exit', from: 'room1', to: 'room2', key: 'room1#room2' }, children: [{ data: { tag: 'String', value: 'closet' }, children: [] }]},
                                { data: { tag: 'Exit', from: 'room1', to: 'room3', key: 'room1#room3' }, children: [{ data: { tag: 'String', value: 'lobby' }, children: [] }]}
                            ]
                        }
                    ]
                }]}
                onChange={() => {}}
            >
                <IfElseTree render={renderComponent} />
            </EditSchema>
        )
        expect(container).toMatchSnapshot()
    })

    it('renders elseif correctly', () => {
        const { container } = render(
            <EditSchema
                value={[{
                    data: { tag: 'If' },
                    children: [
                        {
                            data: { tag: 'Statement', if: 'true' },
                            children: [{ data: { tag: 'Exit', from: 'room1', to: 'room2', key: 'room1#room2' }, children: [{ data: { tag: 'String', value: 'closet' }, children: [] }]}]
                        },
                        {
                            data: { tag: 'Statement', if: 'false' },
                            children: [{ data: { tag: 'Exit', from: 'room1', to: 'room3', key: 'room1#room3' }, children: [{ data: { tag: 'String', value: 'lobby' }, children: [] }]}]
                        }
                    ]
                }]}
                onChange={() => {}}
            >
                <IfElseTree render={renderComponent} />
            </EditSchema>
        )
        expect(container).toMatchSnapshot()
    })

    it('renders else correctly', () => {
        const { container } = render(
            <EditSchema
                value={[{
                    data: { tag: 'If' },
                    children: [
                        {
                            data: { tag: 'Statement', if: 'true' },
                            children: [{ data: { tag: 'Exit', from: 'room1', to: 'room2', key: 'room1#room2' }, children: [{ data: { tag: 'String', value: 'closet' }, children: [] }]}]
                        },
                        {
                            data: { tag: 'Fallthrough' },
                            children: [{ data: { tag: 'Exit', from: 'room1', to: 'room3', key: 'room1#room3' }, children: [{ data: { tag: 'String', value: 'lobby' }, children: [] }]}]
                        }
                    ]
                }]}
                onChange={() => {}}
            >
                <IfElseTree render={renderComponent} />
            </EditSchema>
        )
        expect(container).toMatchSnapshot()
    })

})