/**
* @vitest-environment jsdom
*/

import { vi } from 'vitest'
import React from 'react'
import { render } from '@testing-library/react'
import { Provider } from 'react-redux'
import configureStore from 'redux-mock-store'
import LibraryAsset, { useLibraryAsset } from './LibraryAsset'

vi.mock('../../../cacheDB')
import { Schema } from '@tonylb/mtw-wml/ts/schema'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'

const mockStore = configureStore()
const currentWML = `
<Asset uuid=(Test)>
    <Import from=(BASE)>
        <Room key=(DEF) />
    </Import>
    <Feature key=(clockTower)>
        <Description>
            A worn stone clock tower.
        </Description>
    </Feature>
    <Room key=(ABC)>
        <Name>Vortex</Name>
        <Description>
            Vortex
            <Link to=(toggleOpen)>(toggle)</Link>
        </Description>
        <Exit to=(DEF)>welcome</Exit>
    </Room>
    <Room key=(DEF)>
        <Name>Welcome</Name>
        <Exit to=(ABC)>vortex</Exit>
    </Room>
</Asset>
`
const schemaConvert = new Schema()
schemaConvert.loadWML(currentWML)
const baseSchema = schemaConvert.schema

const standardForm = new StandardForm(baseSchema[0])
const inherited = new StandardForm(`<Asset uuid=(Test)>
    <Room key=(DEF)><Description>A welcome area</Description></Room>
</Asset>`)
const combined = inherited.merge(standardForm)
const schema = combined.schema

const store = mockStore({
    personalAssets: {
       byId: {
           ['ASSET#Test']: {
                publicData: {
                    originalWML: currentWML,
                    currentWML,
                    baseSchema,
                    schema,
                    base: standardForm.toJSON(),
                    edit: {
                        ...standardForm.toJSON(),
                        components: []
                    },
                    pendingEdits: [],
                    standard: standardForm.toJSON(),
                    inherited: inherited.toJSON(),
                    importDefaults: {},
                    importData: {
                        BASE: [inherited.schema]
                    }
                },
                meta: {
                   currentState: 'FRESH',
                   desiredStates: ['FRESH', 'WMLDIRTY', 'SCHEMADIRTY']
                }
           }
       }
    },
    player: {}
})

describe('LibraryAsset context provider', () => {

    beforeEach(() => {
        store.clearActions()
        vi.clearAllMocks()
        vi.resetAllMocks()
    })

    it('should provide currentWML', () => {
        const TestComponent = () => {
            const { currentWML } = useLibraryAsset()
            return <div>{ currentWML }</div>
        }
        const { container } = render(
            <Provider store={store}>
                <LibraryAsset assetKey='Test' >
                    <TestComponent />
                </LibraryAsset>
            </Provider>
        )
        expect(container.textContent).toMatchSnapshot()

    })

})
