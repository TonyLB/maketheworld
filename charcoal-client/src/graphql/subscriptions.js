/* eslint-disable */
// this is an auto generated file. This will be overwritten

export const changedPlayer = /* GraphQL */ `
  subscription ChangedPlayer($PlayerName: String) {
    changedPlayer(PlayerName: $PlayerName) {
      PlayerName
      CodeOfConductConsent
    }
  }
`;
export const changedCharacter = /* GraphQL */ `
  subscription ChangedCharacter {
    changedCharacter {
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
export const changedCharactersInPlay = /* GraphQL */ `
  subscription ChangedCharactersInPlay {
    changedCharactersInPlay {
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
export const changedNode = /* GraphQL */ `
  subscription ChangedNode {
    changedNode {
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
export const changedRoom = /* GraphQL */ `
  subscription ChangedRoom {
    changedRoom {
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
export const addedMessage = /* GraphQL */ `
  subscription AddedMessage($RoomId: String, $CharacterId: String) {
    addedMessage(RoomId: $RoomId, CharacterId: $CharacterId) {
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
export const changedRole = /* GraphQL */ `
  subscription ChangedRole {
    changedRole {
      RoleId
      Name
      Actions
    }
  }
`;
