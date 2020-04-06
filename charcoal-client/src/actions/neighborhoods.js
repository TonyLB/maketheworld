import { API, graphqlOperation } from 'aws-amplify'
import { getNeighborhoodTree } from '../graphql/queries'

export const NEIGHBORHOOD_UPDATE = 'NEIGHBORHOOD_UPDATE'
export const NEIGHBORHOOD_MERGE = 'NEIGHBORHOOD_MERGE'

export const neighborhoodUpdate = (neighborhoods) => ({
    type: NEIGHBORHOOD_UPDATE,
    data: neighborhoods
})

export const neighborhoodMerge = (permanentData) => ({
    type: NEIGHBORHOOD_MERGE,
    permanentData
})

export const fetchAllNeighborhoods = () => (dispatch) => {
    return API.graphql(graphqlOperation(getNeighborhoodTree))
    .then(({ data }) => (data || {}))
    .then(({ getNeighborhoodTree }) => (getNeighborhoodTree || []))
    .then((neighborhoodTree) => (neighborhoodTree.map(({
        PermanentId,
        Type,
        ParentId,
        Ancestry,
        Name,
        Description
    }) => ({
        permanentId: PermanentId,
        type: Type,
        parentId: ParentId,
        ancestry: Ancestry,
        name: Name,
        description: Description
    }))))
    .then(response => dispatch(neighborhoodUpdate(response)))
    .catch((err) => { console.log(err)})
}
