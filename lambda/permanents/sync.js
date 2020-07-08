const { documentClient } = require('./utilities')

const { TABLE_PREFIX } = process.env;
const permanentTable = `${TABLE_PREFIX}_permanents`

const stripType = (value) => value.split('#').slice(1).join('#')

exports.sync = async () => {
    const { Items = [] } = await documentClient.scan({
        TableName: permanentTable
    }).promise()

    return Items.map(({ PermanentId: rawPermanentId, DataCategory, ...rest }) => {
        const dataType = rawPermanentId.split('#')[0]
        const PermanentId = stripType(rawPermanentId)
        switch (dataType) {

            case 'CHARACTER':
                if (DataCategory === 'Details') {
                    return { Character:
                        {
                            CharacterId: PermanentId,
                            ...rest
                        }
                    }
                }
                if (DataCategory.startsWith('GRANT#')) {
                    const Resource = stripType(DataCategory)
                    const Actions = rest.Actions
                    const Roles = rest.Roles
                    return (Actions || Roles)
                        ? { Grant:
                            {
                                CharacterId: PermanentId,
                                Resource,
                                Actions,
                                Roles
                            }
                        }
                        : null
                }
                return null

            case 'ADMIN':
                if (DataCategory === 'Details') {
                    return { Settings: rest }
                }
                if (DataCategory.startsWith('ROLE#')) {
                    const RoleId = stripType(DataCategory)
                    return { Role:
                        {
                            RoleId,
                            Name: rest.Name,
                            Actions: rest.Actions
                        }
                    }
                }
                if (DataCategory.startsWith('BACKUP#')) {
                    const PermanentId = stripType(DataCategory)
                    return { Backup:
                        {
                            PermanentId,
                            Name: rest.Name,
                            Description: rest.Description,
                            Status: rest.Status
                        }
                    }
                }
                return null

            case 'ROOM':
                if (DataCategory === 'Details') {
                    const { ParentId, Name, Description, Visibility, Topology, Retired } = rest
                    return { Room:
                        {
                            PermanentId,
                            ParentId,
                            Name,
                            Description,
                            Visibility: Visibility || 'Public',
                            Topology,
                            Retired: (Retired === 'RETIRED')
                        }
                    }
                }
                if (DataCategory.startsWith('EXIT#')) {
                    const ToRoomId = stripType(DataCategory)
                    return { Exit:
                        {
                            FromRoomId: PermanentId,
                            ToRoomId,
                            Name: rest.Name
                        }
                    }
                }
                return null

            case 'NEIGHBORHOOD':
                if (DataCategory === 'Details') {
                    const { ParentId, Name, Description, Visibility, Topology, Retired, ContextMapId } = rest
                    return { Neighborhood:
                        {
                            PermanentId,
                            ParentId,
                            Name,
                            Description,
                            Visibility: Visibility || 'Private',
                            Topology,
                            Retired: (Retired === 'RETIRED'),
                            ContextMapId
                        }
                    }
                }
                return null

            case 'MAP':
                if (DataCategory === 'Details') {
                    const { Name, Rooms } = rest
                    return { Map:
                        {
                            MapId: PermanentId,
                            Name,
                            Rooms: Rooms.map(({ PermanentId, X, Y, Locked = false }) => ({ PermanentId, X, Y, Locked }))
                        }
                    }
                }
                return null

            default: return null
        }
    }).filter((value) => (value))

}
