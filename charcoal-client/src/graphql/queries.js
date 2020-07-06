/* eslint-disable */
// this is an auto generated file. This will be overwritten

export const getPlayer = /* GraphQL */ `
  query GetPlayer($PlayerName: String!) {
    getPlayer(PlayerName: $PlayerName) {
      PlayerName
      CodeOfConductConsent
    }
  }
`;
export const getCharacter = /* GraphQL */ `
  query GetCharacter($playerName: String!, $name: String!) {
    getCharacter(playerName: $playerName, name: $name) {
      PlayerName
      Name
      CharacterId
      Pronouns
      FirstImpression
      Outfit
      OneCoolThing
      HomeId
    }
  }
`;
export const getPlayerCharacters = /* GraphQL */ `
  query GetPlayerCharacters {
    getPlayerCharacters {
      PlayerName
      Name
      CharacterId
      Pronouns
      FirstImpression
      Outfit
      OneCoolThing
      HomeId
    }
  }
`;
export const getAllCharacters = /* GraphQL */ `
  query GetAllCharacters {
    getAllCharacters {
      PlayerName
      Name
      CharacterId
      Pronouns
      FirstImpression
      Outfit
      OneCoolThing
      HomeId
    }
  }
`;
export const getCharactersInPlay = /* GraphQL */ `
  query GetCharactersInPlay {
    getCharactersInPlay {
      CharacterId
      RoomId
      Connected
    }
  }
`;
export const getNeighborhoodTree = /* GraphQL */ `
  query GetNeighborhoodTree {
    getNeighborhoodTree {
      Neighborhood {
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
        Retired
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
        Retired
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
      }
      Grant {
        CharacterId
        Resource
        Actions
        Roles
      }
    }
  }
`;
export const getNeighborhood = /* GraphQL */ `
  query GetNeighborhood($PermanentId: String!) {
    getNeighborhood(PermanentId: $PermanentId) {
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
      Retired
    }
  }
`;
export const getRoom = /* GraphQL */ `
  query GetRoom($PermanentId: String!) {
    getRoom(PermanentId: $PermanentId) {
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
      Retired
    }
  }
`;
export const getRoomRecap = /* GraphQL */ `
  query GetRoomRecap($PermanentId: String!) {
    getRoomRecap(PermanentId: $PermanentId) {
      MessageId
      CreatedTime
      Target
      Message
      RoomId
      CharacterId
      FromCharacterId
      ToCharacterId
      Recap
      ExpirationTime
      Type
      Title
    }
  }
`;
export const getRoomByCharacter = /* GraphQL */ `
  query GetRoomByCharacter($CharacterId: String!) {
    getRoomByCharacter(CharacterId: $CharacterId) {
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
      Retired
    }
  }
`;
export const getRoles = /* GraphQL */ `
  query GetRoles {
    getRoles {
      RoleId
      Name
      Actions
    }
  }
`;
export const getMaps = /* GraphQL */ `
  query GetMaps {
    getMaps {
      MapId
      Name
      Rooms {
        PermanentId
        X
        Y
        Locked
      }
    }
  }
`;
export const getSettings = /* GraphQL */ `
  query GetSettings {
    getSettings {
      ChatPrompt
    }
  }
`;
export const getBackups = /* GraphQL */ `
  query GetBackups {
    getBackups {
      PermanentId
      Name
      Description
      Status
    }
  }
`;
export const getGrants = /* GraphQL */ `
  query GetGrants {
    getGrants {
      Neighborhood {
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
        Retired
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
        Retired
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
      }
      Grant {
        CharacterId
        Resource
        Actions
        Roles
      }
    }
  }
`;
