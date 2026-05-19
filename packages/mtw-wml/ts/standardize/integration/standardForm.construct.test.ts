import { Schema, schemaToWML, treeFromWML } from '../../schema'
import { StandardForm, hasShortName } from '..'
import { deIndentWML } from '../../schema/utils'
import { GenericTreeNode } from '@tonylb/mtw-base/ts/genericTree'
import { SchemaTag } from '@tonylb/mtw-base/ts/schema'
import StandardRoom from '../components/room'
import StandardKnowledge from '../components/knowledge'
import StandardCharacter from '../components/character'
import { ReferenceList } from '../keys/referenceList'
import StandardReference from '../keys/reference'
import { StandardKey } from '../keys/key'
import StandardFeature from '../components/feature'
import StandardSituation from '../components/situation'
import { StandardLiteral } from '../literal'
import StandardMap from '../components/map'
import StandardMark, { StandardLens } from '../components/worldState'
import { StandardMarkFacet } from '../keys/facets/mark'
import { StandardExplicitKey } from '../explicit/key'
import { isStandardForm, isStandardFormInput, StandardFormData } from '../components/dataTypes'

jest.mock('@tonylb/mtw-utilities/ts/uuid/index', () => {
    return {
        ...jest.requireActual('@tonylb/mtw-utilities/ts/uuid/___mocks___/index')
    }
})


describe('StandardForm', () => {
    describe('input vs normative typeguards', () => {
        it('accepts missing facet payload in input guard but rejects in normative guard', () => {
            const candidate = {
                universalKey: 'ASSET#test',
                metaData: [],
                components: [
                    {
                        tag: 'Situation',
                        key: 'situation1',
                        universalKey: 'SITUATION#situation1',
                        marks: [
                            {
                                reference: {
                                    tag: 'Mark',
                                    key: 'mark1',
                                    universalKey: 'MARK#mark1'
                                }
                            }
                        ]
                    }
                ]
            }

            expect(isStandardFormInput(candidate)).toBe(true)
            expect(isStandardForm(candidate)).toBe(false)
        })
    })
})
