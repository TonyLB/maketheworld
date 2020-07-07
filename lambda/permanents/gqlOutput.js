exports.gqlOutput = `Neighborhood {
    PermanentId
    Name
    Description
    ParentId
    Visibility
    Topology
    ContextMapId
  }
  Room {
    PermanentId
    Name
    Description
    ParentId
    Visibility
    Topology
  }
  Map {
    MapId
    Name
    Rooms {
      PermanentId
      X
      Y
      Locked
    }
  }
  Settings {
    ChatPrompt
  }
  Role {
    RoleId
    Name
    Actions
  }
  Backup {
    PermanentId
    Name
    Description
    Status
  }
  Character {
    PlayerName
    Name
    CharacterId
    Pronouns
    FirstImpression
    Outfit
    OneCoolThing
    HomeId
  }
  Grant {
    CharacterId
    Resource
    Actions
    Roles
    Revoke
  }
  Exit {
    FromRoomId
    ToRoomId
    Name
    Delete
  }`
