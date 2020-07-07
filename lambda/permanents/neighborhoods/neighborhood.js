// Copyright 2020 Tony Lower-Basch. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

const { v4: uuidv4 } = require('/opt/uuid')
const { documentClient } = require('../utilities')

const { TABLE_PREFIX } = process.env;
const permanentTable = `${TABLE_PREFIX}_permanents`

exports.getNeighborhood = ({ PermanentId }) => {

    const neighborhoodLookup = documentClient.get({
        TableName: permanentTable,
        Key: {
            PermanentId: `NEIGHBORHOOD#${PermanentId}`,
            DataCategory: 'Details'
        }
    }).promise()
    .then(({ Item = {} }) => (Item))
    .then(({ ParentId, Name, Description, Visibility = 'Private', Topology = 'Dead-End', Retired = '', ContextMapId }) => ({
        PermanentId,
        ParentId,
        Name,
        Description,
        Visibility,
        Topology,
        ContextMapId,
        Retired: (Retired === 'RETIRED')
    }))

    return neighborhoodLookup
}

exports.putNeighborhood = (event) => {

    const { PermanentId = '', ParentId = '', Description = '', Visibility = 'Private', Topology = 'Dead-End', Retired = false, ContextMapId, Name } = event.arguments

    const newPermanentId = PermanentId || uuidv4()

    const putNeighborhood = documentClient.put({
            TableName: permanentTable,
            Item: {
                PermanentId: `NEIGHBORHOOD#${newPermanentId}`,
                DataCategory: 'Details',
                ...(ParentId ? { ParentId } : {}),
                Name,
                ...(Description ? { Description } : {}),
                ...(Visibility ? { Visibility } : {}),
                ...(Topology ? { Topology } : {}),
                ...(ContextMapId ? { ContextMapId } : {}),
                ...(Retired ? { Retired: 'RETIRED' } : {})
            },
            ReturnValues: "ALL_OLD"
        }).promise()
            .then((old) => ((old && old.Attributes) || {}))
            .then(({ DataCategory, ...rest }) => ({
                ...rest,
                PermanentId: newPermanentId,
                ParentId,
                Name,
                Description,
                Visibility,
                Topology,
                ContextMapId,
                Retired
            }))

    return putNeighborhood
        .then(({
            PermanentId,
            ParentId,
            Name,
            Description,
            Visibility,
            Topology,
            ContextMapId,
            Retired
        }) => ([{
            Neighborhood: {
                PermanentId,
                ParentId,
                Name,
                Description,
                Visibility,
                Topology,
                ContextMapId,
                Retired
            },
            Room: null,
            Map: null
        }]))
        .catch((err) => {
            console.log(`ERROR:`)
            console.log(err)
            return { error: err.stack }
        })

}
