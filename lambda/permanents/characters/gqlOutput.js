exports.gqlOutput = `Neighborhood {
    PermanentId
    Name
    Description
    ParentId
    Visibility
    Topology
    ContextMapId
    Grants {
      CharacterId
      Actions
      Roles
    }
  }
  Room {
    PermanentId
    Name
    Description
    ParentId
    Visibility
    Topology
    Exits {
      Name
      RoomId
    }
    Entries {
      Name
      RoomId
    }
    Grants {
      CharacterId
      Actions
      Roles
    }
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
    Grants {
      Resource
      Actions
      Roles
    }
  }`
