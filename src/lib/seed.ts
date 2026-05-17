import { id } from "@/lib/id";
import type { AppState } from "@/lib/model";

export function createInitialState(now = new Date()): AppState {
  const nowIso = now.toISOString();

  return {
    users: [],
    lots: [],
    locations: [
      {
        id: id("loc"),
        nickname: "Lobby",
        address: "BCS Southport"
      },
      {
        id: id("loc"),
        nickname: "Meeting Room",
        address: "On-site"
      }
    ],
    votes: [],
    voteComments: [],
    notifications: [],
    bmUpdates: [
      {
        id: id("bmupd"),
        createdAt: nowIso,
        createdByUserId: "system",
        title: "Weekly report placeholder",
        body: "In production this will be created by the Building Manager. For now it demonstrates the UI and notifications.",
        urgent: false,
        attachments: []
      }
    ],
    ideas: [],
    settings: {
      buildingTimeZone: "Australia/Brisbane",
      nextCommitteeMeeting: {
        when: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        locationNickname: "Meeting Room"
      },
      nextAgm: {
        when: new Date(now.getTime() + 45 * 24 * 60 * 60 * 1000).toISOString(),
        locationNickname: "Lobby"
      },
      autoApprovalThresholdAmount: 250,
      notificationOverridesByUserId: {}
    },
    auth: {},
    magicLinks: [],
    meta: {
      seededAt: nowIso,
      lastWriteAt: nowIso
    }
  };
}
