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
      Grants {
        Resource
        Actions
        Roles
      }
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
      Grants {
        Resource
        Actions
        Roles
      }
    }
  }
`;
export const getCharactersInPlay = /* GraphQL */ `
  query GetCharactersInPlay {
    getCharactersInPlay {
      CharacterId
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
      RoomId
      ConnectionId
    }
  }
`;
export const getNeighborhoodTree = /* GraphQL */ `
  query GetNeighborhoodTree {
    getNeighborhoodTree {
      PermanentId
      Type
      Name
      Ancestry
      Description
      ParentId
      ... on Neighborhood {
        Visibility
        Topology
        Grants {
          CharacterId
          Actions
          Roles
        }
      }
      ... on Room {
        Visibility
        Topology
        Exits {
          Name
          RoomId
          Ancestry
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
      ... on AnyNode {
        Visibility
        Topology
        Grants {
          CharacterId
          Actions
          Roles
        }
      }
    }
  }
`;
export const getNeighborhood = /* GraphQL */ `
  query GetNeighborhood($PermanentId: String!) {
    getNeighborhood(PermanentId: $PermanentId) {
      PermanentId
      Type
      Name
      Ancestry
      Description
      ParentId
      Visibility
      Topology
      Grants {
        CharacterId
        Actions
        Roles
      }
    }
  }
`;
export const getRoom = /* GraphQL */ `
  query GetRoom($PermanentId: String!) {
    getRoom(PermanentId: $PermanentId) {
      PermanentId
      Type
      Name
      Ancestry
      Description
      ParentId
      Visibility
      Topology
      Exits {
        Name
        RoomId
        Ancestry
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
      Type
      Name
      Ancestry
      Description
      ParentId
      Visibility
      Topology
      Exits {
        Name
        RoomId
        Ancestry
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
