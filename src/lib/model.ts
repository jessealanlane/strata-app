export type Role =
  | "BCM_BCMA"
  | "BCC"
  | "BCCA"
  | "COMMITTEE_MEMBER"
  | "BUILDING_MANAGER"
  | "LOT_OWNER";

export const ROLE_LABEL: Record<Role, string> = {
  BCM_BCMA: "BCM/BCMA",
  BCC: "BCC",
  BCCA: "BCCA",
  COMMITTEE_MEMBER: "Committee Member",
  BUILDING_MANAGER: "Building Manager",
  LOT_OWNER: "Lot Owner"
};

export type NotificationType =
  | "VOTE_CREATED"
  | "VOTE_CLOSED"
  | "VOTE_COMMENT"
  | "BM_UPDATE"
  | "IDEA_POSTED"
  | "USER_APPROVAL_NEEDED";

export type NotificationPrefs = {
  enabled: boolean;
  votes: boolean;
  updates: boolean;
  ideas: boolean;
  admin: boolean;
};

export type User = {
  id: string;
  email: string;
  role?: Role;
  approved: boolean;
  createdAt: string;
  lotIds: string[];
  notificationPrefs: NotificationPrefs;
};

export type Location = {
  id: string;
  nickname: string;
  address?: string;
};

export type Lot = {
  id: string;
  name: string;
};

export type VoteType = "QUOTE" | "COMMITTEE_MEETING" | "LOT_OWNER_REQUEST";

export type VoteOption = {
  id: string;
  label: string;
};

export type VoteChoice = {
  optionId: string;
  comment?: string;
  updatedAt: string;
};

export type VoteComment = {
  id: string;
  voteId: string;
  userId: string;
  body: string;
  createdAt: string;
  parentId?: string;
};

export type VoteView = {
  userId: string;
  viewedAt: string;
};

export type VoteAttachment = {
  id: string;
  name: string;
  mimeType?: string;
  size?: number;
  dataUrl?: string;
  url?: string;
};

export type Vote = {
  id: string;
  createdAt: string;
  createdByUserId: string;
  type: VoteType;
  title: string;
  description: string;
  quoteAmount?: number;
  deadlineAt?: string;
  locationId?: string;
  locationText?: string;
  attachments: VoteAttachment[];
  options: VoteOption[];
  minimumQuorum?: number;
  privateNotes?: string;
  excludedUserIds: string[];
  allowLotOwnersToViewOutcome: boolean;
  closedAt?: string;
  closedByUserId?: string;
  reopenedAt?: string;
  reopenedByUserId?: string;
  votesByUserId: Record<string, VoteChoice>;
  views: VoteView[];
  autoApproved?: boolean;
};

export type BuildingManagerUpdateAttachment = {
  id: string;
  name: string;
  mimeType?: string;
  size?: number;
  dataUrl?: string;
  url?: string;
};

export type BuildingManagerUpdate = {
  id: string;
  createdAt: string;
  createdByUserId: string;
  title: string;
  body: string;
  urgent: boolean;
  attachments: BuildingManagerUpdateAttachment[];
};

export type Idea = {
  id: string;
  createdAt: string;
  createdByUserId: string;
  title: string;
  body: string;
  votesByUserId: Record<string, 1 | -1>;
};

export type Notification = {
  id: string;
  createdAt: string;
  userId: string;
  type: NotificationType;
  title: string;
  body?: string;
  href?: string;
  readAt?: string;
};

export type AppSettings = {
  buildingTimeZone: string;
  nextCommitteeMeeting?: {
    when: string;
    locationNickname: string;
  };
  nextAgm?: {
    when: string;
    locationNickname: string;
  };
  autoApprovalThresholdAmount: number;
  notificationOverridesByUserId: Record<
    string,
    Partial<NotificationPrefs> & { forceEnabled?: boolean }
  >;
};

export type MagicLinkToken = {
  token: string;
  email: string;
  createdAt: string;
  expiresAt: string;
};

export type AppState = {
  users: User[];
  lots: Lot[];
  locations: Location[];
  votes: Vote[];
  voteComments: VoteComment[];
  notifications: Notification[];
  bmUpdates: BuildingManagerUpdate[];
  ideas: Idea[];
  settings: AppSettings;
  auth: {
    currentUserId?: string;
  };
  magicLinks: MagicLinkToken[];
  meta: {
    seededAt?: string;
    lastWriteAt?: string;
  };
};

export type Action =
  | "VOTE_CREATE"
  | "VOTE_VIEW"
  | "VOTE_CAST"
  | "VOTE_CLOSE"
  | "VOTE_REOPEN"
  | "SCHEDULE_EDIT"
  | "ADMIN_VIEW"
  | "ADMIN_APPROVE_USERS"
  | "ADMIN_MANAGE_LOTS"
  | "ADMIN_SETTINGS"
  | "BM_UPDATE_CREATE"
  | "BM_UPDATE_EDIT"
  | "BM_UPDATE_DELETE";

export function can(role: Role | undefined, action: Action): boolean {
  if (!role) return false;

  if (action === "ADMIN_VIEW") return role === "BCM_BCMA";
  if (action === "ADMIN_APPROVE_USERS") return role === "BCM_BCMA";
  if (action === "ADMIN_MANAGE_LOTS") return role === "BCM_BCMA";
  if (action === "ADMIN_SETTINGS") return role === "BCM_BCMA";

  if (action === "VOTE_CREATE")
    return (
      role === "BCM_BCMA" ||
      role === "BCC" ||
      role === "BCCA" ||
      role === "BUILDING_MANAGER"
    );

  if (action === "BM_UPDATE_CREATE") return role === "BUILDING_MANAGER" || role === "BCM_BCMA";
  if (action === "BM_UPDATE_EDIT") return role === "BUILDING_MANAGER" || role === "BCM_BCMA";
  if (action === "BM_UPDATE_DELETE") return role === "BUILDING_MANAGER" || role === "BCM_BCMA";

  if (action === "VOTE_VIEW") return true;
  if (action === "VOTE_CAST") return true;
  if (action === "VOTE_CLOSE") return role !== "LOT_OWNER";
  if (action === "VOTE_REOPEN") return role !== "LOT_OWNER";
  if (action === "SCHEDULE_EDIT") return role !== "LOT_OWNER";

  return false;
}
