jest.mock('./CodeEditor')
import CodeEditor from './CodeEditor'

import renderer from 'react-test-renderer'
import React, { FunctionComponent } from 'react'

import ListWithConditions from './ListWithConditions'
import { isSchemaExit, isSchemaOutputTag, SchemaExitTag, SchemaTag } from '@tonylb/mtw-wml/dist/schema/baseClasses'
import { GenericTreeNodeFiltered, treeNodeTypeguard } from '@tonylb/mtw-wml/dist/tree/baseClasses'
import { schemaOutputToString } from '@tonylb/mtw-wml/dist/schema/utils/schemaOutput/schemaOutputToString'
import { EditSchema, useEditContext } from './EditContext'
import { treeTypeGuard } from '@tonylb/mtw-wml/dist/tree/filter'
import IfElseTree from './IfElseTree'

describe('IfElseTree component', () => {
    const render: FunctionComponent<{}> = () => {
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
        expect(renderer
            .create(
                <EditSchema
                    field={{ data: { tag: 'String', value: '' } ,children: [], id: '' }}
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
                    <IfElseTree render={render} />
                </EditSchema>
            ).toJSON()
        ).toMatchSnapshot()
    })

})