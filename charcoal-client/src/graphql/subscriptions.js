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
export const changedNeighborhood = /* GraphQL */ `
  subscription ChangedNeighborhood {
    changedNeighborhood {
      PermanentId
      Type
      Name
      Ancestry
      Description
      ParentId
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
      Exits {
        PermanentId
        Name
        RoomId
        Ancestry
      }
      Entries {
        PermanentId
        Name
        RoomId
        Ancestry
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
