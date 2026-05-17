"use client";

import { useMemo, useSyncExternalStore } from "react";
import { createInitialState } from "@/lib/seed";
import { id } from "@/lib/id";
import type {
  AppState,
  BuildingManagerUpdateAttachment,
  BuildingManagerUpdate,
  Notification,
  NotificationPrefs,
  NotificationType,
  Role,
  User,
  Vote,
  VoteAttachment,
  VoteComment,
  VoteType
} from "@/lib/model";
import { can } from "@/lib/model";

const STORAGE_KEY = "stratavote_bcs_southport_v1";
const AUTH_KEY = "stratavote_bcs_southport_auth_v1";

function safeJsonParse<T>(raw: string | null): T | undefined {
  if (!raw) return undefined;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return undefined;
  }
}

function safeJsonStringify(value: unknown): string {
  return JSON.stringify(value);
}

function clone<T>(value: T): T {
  try {
    return structuredClone(value);
  } catch {
    return JSON.parse(JSON.stringify(value)) as T;
  }
}

function nowIso(): string {
  return new Date().toISOString();
}

function defaultNotificationPrefs(): NotificationPrefs {
  return { enabled: true, votes: true, updates: true, ideas: true, admin: true };
}

function normalizeState(state: AppState): AppState {
  const bmUpdates = state.bmUpdates.map((u) => {
    const raw = u as unknown as { attachments?: unknown };
    const attachments = Array.isArray(raw.attachments) ? (raw.attachments as BuildingManagerUpdateAttachment[]) : [];
    return {
      ...u,
      attachments: attachments.map((a) => ({
        id: a.id || id("bmatt"),
        name: a.name,
        mimeType: a.mimeType,
        size: a.size,
        dataUrl: a.dataUrl,
        url: a.url
      }))
    };
  });
  return { ...state, bmUpdates };
}

function loadStateFromLocalStorage(): AppState {
  const parsed = safeJsonParse<AppState>(typeof window === "undefined" ? null : localStorage.getItem(STORAGE_KEY));
  if (parsed) return parsed;
  return createInitialState();
}

function loadAuthFromLocalStorage(): { currentUserId?: string } {
  const parsed = safeJsonParse<{ currentUserId?: string }>(
    typeof window === "undefined" ? null : localStorage.getItem(AUTH_KEY)
  );
  return parsed ?? {};
}

function persistToLocalStorage(state: AppState): void {
  if (typeof window === "undefined") return;

  const toWrite: AppState = {
    ...state,
    meta: {
      ...state.meta,
      lastWriteAt: nowIso()
    }
  };

  localStorage.setItem(STORAGE_KEY, safeJsonStringify(toWrite));
  localStorage.setItem(AUTH_KEY, safeJsonStringify({ currentUserId: toWrite.auth.currentUserId }));

  // TODO: Replace localStorage persistence with Supabase
  // - Auth: supabase.auth.signInWithPassword / signInWithOtp / exchangeCodeForSession
  // - DB: votes/users/comments/notifications/lots/settings stored in Postgres tables
  // - Realtime: supabase.realtime channels for vote tallies + comments + notifications
  // - Files: supabase storage buckets for vote attachments
  // - Add-ons ready: email + SMS notifications, larger storage quotas, lot-owner voting unlocks, full document library
}

type Listener = () => void;

let _state: AppState | undefined;
const _listeners = new Set<Listener>();
let _initialized = false;

function ensureInitialized(): void {
  if (_initialized) return;
  _initialized = true;

  const base = loadStateFromLocalStorage();
  const auth = loadAuthFromLocalStorage();
  _state = normalizeState({ ...base, auth: { ...base.auth, ...auth } });

  if (typeof window !== "undefined") {
    window.addEventListener("storage", (ev) => {
      if (ev.key === STORAGE_KEY || ev.key === AUTH_KEY) {
        const next = loadStateFromLocalStorage();
        const nextAuth = loadAuthFromLocalStorage();
        _state = normalizeState({ ...next, auth: { ...next.auth, ...nextAuth } });
        emit();
      }
    });
  }
}

function emit(): void {
  for (const l of _listeners) l();
}

export function getState(): AppState {
  ensureInitialized();
  return _state ?? createInitialState();
}

function setState(updater: (prev: AppState) => AppState): void {
  ensureInitialized();
  const prev = _state ?? createInitialState();
  const next = updater(prev);
  _state = next;
  persistToLocalStorage(next);
  emit();
}

export function subscribe(listener: Listener): () => void {
  ensureInitialized();
  _listeners.add(listener);
  return () => _listeners.delete(listener);
}

export function useAppStore<T>(selector: (s: AppState) => T): T {
  const state = useSyncExternalStore(subscribe, getState, getState);
  return selector(state);
}

export function useCurrentUser(): User | undefined {
  return useAppStore((s) => s.users.find((u) => u.id === s.auth.currentUserId));
}

export function effectiveNotificationPrefs(state: AppState, user: User): NotificationPrefs {
  const override = state.settings.notificationOverridesByUserId[user.id];
  if (!override) return user.notificationPrefs;

  const forcedEnabled = override.forceEnabled ? true : user.notificationPrefs.enabled;
  return {
    enabled: override.enabled ?? forcedEnabled,
    votes: override.votes ?? user.notificationPrefs.votes,
    updates: override.updates ?? user.notificationPrefs.updates,
    ideas: override.ideas ?? user.notificationPrefs.ideas,
    admin: override.admin ?? user.notificationPrefs.admin
  };
}

function shouldShowNotification(state: AppState, user: User, n: Notification): boolean {
  const prefs = effectiveNotificationPrefs(state, user);
  if (!prefs.enabled) return false;

  const typeToPref: Partial<Record<NotificationType, keyof NotificationPrefs>> = {
    VOTE_CREATED: "votes",
    VOTE_CLOSED: "votes",
    VOTE_COMMENT: "votes",
    BM_UPDATE: "updates",
    IDEA_POSTED: "ideas",
    USER_APPROVAL_NEEDED: "admin"
  };

  const key = typeToPref[n.type];
  if (!key) return true;
  return Boolean(prefs[key]);
}

export const actions = {
  auth: {
    loginWithPassword: (email: string, _password: string): void => {
      const trimmed = email.trim().toLowerCase();
      if (!trimmed) return;

      setState((prev) => {
        const existing = prev.users.find((u) => u.email.toLowerCase() === trimmed);
        let user: User;
        let users = prev.users;
        let notifications = prev.notifications;

        if (existing) {
          user = existing;
        } else {
          user = {
            id: id("usr"),
            email: trimmed,
            role: undefined,
            approved: false,
            createdAt: nowIso(),
            lotIds: [],
            notificationPrefs: defaultNotificationPrefs()
          };

          users = [user, ...users];

          const admins = users.filter((u) => u.role === "BCM_BCMA");
          for (const a of admins) {
            notifications = [
              {
                id: id("ntf"),
                createdAt: nowIso(),
                userId: a.id,
                type: "USER_APPROVAL_NEEDED",
                title: "New user pending approval",
                body: trimmed,
                href: "/admin"
              },
              ...notifications
            ];
          }
        }

        return {
          ...prev,
          users,
          notifications,
          auth: { currentUserId: user.id }
        };
      });
    },
    quickLoginAsRole: (role: Role): void => {
      const email = `${role.toLowerCase()}@demo.local`;
      setState((prev) => {
        const existing = prev.users.find((u) => u.email === email);
        const user: User =
          existing ??
          ({
            id: id("usr"),
            email,
            role,
            approved: true,
            createdAt: nowIso(),
            lotIds: [],
            notificationPrefs: defaultNotificationPrefs()
          } satisfies User);
        const users = existing ? prev.users : [user, ...prev.users];
        return { ...prev, users, auth: { currentUserId: user.id } };
      });
    },
    logout: (): void => {
      setState((prev) => ({ ...prev, auth: {} }));
    },
    setCurrentUserRole: (role: Role): void => {
      setState((prev) => {
        const currentUserId = prev.auth.currentUserId;
        if (!currentUserId) return prev;
        const users = prev.users.map((u) => (u.id === currentUserId ? { ...u, role } : u));
        return { ...prev, users };
      });
    },
    setCurrentUserApproved: (approved: boolean): void => {
      setState((prev) => {
        const currentUserId = prev.auth.currentUserId;
        if (!currentUserId) return prev;
        const users = prev.users.map((u) => (u.id === currentUserId ? { ...u, approved } : u));
        return { ...prev, users };
      });
    },
    sendMagicLink: (email: string): string | undefined => {
      const trimmed = email.trim().toLowerCase();
      if (!trimmed) return undefined;

      const token = id("ml");
      const createdAt = nowIso();
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

      setState((prev) => ({
        ...prev,
        magicLinks: [{ token, email: trimmed, createdAt, expiresAt }, ...prev.magicLinks]
      }));

      return token;
    },
    consumeMagicLink: (token: string): boolean => {
      const t = token.trim();
      if (!t) return false;

      let ok = false;

      setState((prev) => {
        const found = prev.magicLinks.find((m) => m.token === t);
        if (!found) return prev;
        if (new Date(found.expiresAt).getTime() < Date.now()) {
          return { ...prev, magicLinks: prev.magicLinks.filter((m) => m.token !== t) };
        }

        const email = found.email;
        let users = prev.users;
        let user = users.find((u) => u.email.toLowerCase() === email.toLowerCase());
        if (!user) {
          user = {
            id: id("usr"),
            email,
            role: undefined,
            approved: false,
            createdAt: nowIso(),
            lotIds: [],
            notificationPrefs: defaultNotificationPrefs()
          };
          users = [user, ...users];
        }

        ok = true;

        return {
          ...prev,
          users,
          magicLinks: prev.magicLinks.filter((m) => m.token !== t),
          auth: { currentUserId: user.id }
        };
      });

      return ok;
    }
  },

  users: {
    approveUser: (userId: string, approved: boolean): void => {
      setState((prev) => ({
        ...prev,
        users: prev.users.map((u) => (u.id === userId ? { ...u, approved } : u))
      }));
    },
    setUserRole: (userId: string, role: Role): void => {
      setState((prev) => ({
        ...prev,
        users: prev.users.map((u) => (u.id === userId ? { ...u, role } : u))
      }));
    },
    setUserLots: (userId: string, lotIds: string[]): void => {
      setState((prev) => ({
        ...prev,
        users: prev.users.map((u) => (u.id === userId ? { ...u, lotIds } : u))
      }));
    },
    updateCurrentUserNotificationPrefs: (patch: Partial<NotificationPrefs>): void => {
      setState((prev) => {
        const uid = prev.auth.currentUserId;
        if (!uid) return prev;
        const users = prev.users.map((u) =>
          u.id === uid ? { ...u, notificationPrefs: { ...u.notificationPrefs, ...patch } } : u
        );
        return { ...prev, users };
      });
    }
  },

  admin: {
    setNotificationOverrideForUser: (
      userId: string,
      patch: Partial<NotificationPrefs> & { forceEnabled?: boolean }
    ): void => {
      setState((prev) => ({
        ...prev,
        settings: {
          ...prev.settings,
          notificationOverridesByUserId: {
            ...prev.settings.notificationOverridesByUserId,
            [userId]: { ...prev.settings.notificationOverridesByUserId[userId], ...patch }
          }
        }
      }));
    },
    setAutoApprovalThresholdAmount: (amount: number): void => {
      const v = Number.isFinite(amount) ? Math.max(0, Math.round(amount)) : 0;
      setState((prev) => ({ ...prev, settings: { ...prev.settings, autoApprovalThresholdAmount: v } }));
    },
    bulkCreateLots: (start: number, end: number): void => {
      const s = Math.max(1, Math.floor(start));
      const e = Math.max(s, Math.floor(end));
      setState((prev) => {
        const existingNames = new Set(prev.lots.map((l) => l.name.toLowerCase()));
        const nextLots = [...prev.lots];
        for (let i = s; i <= e; i++) {
          const name = `Lot ${i}`;
          if (existingNames.has(name.toLowerCase())) continue;
          nextLots.push({ id: id("lot"), name });
        }
        nextLots.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
        return { ...prev, lots: nextLots };
      });
    },
    removeLot: (lotId: string): void => {
      setState((prev) => {
        const lots = prev.lots.filter((l) => l.id !== lotId);
        const users = prev.users.map((u) => ({ ...u, lotIds: u.lotIds.filter((x) => x !== lotId) }));
        return { ...prev, lots, users };
      });
    },
    renameLot: (lotId: string, name: string): void => {
      const nextName = name.trim();
      if (!nextName) return;
      setState((prev) => {
        const lots = prev.lots.map((l) => (l.id === lotId ? { ...l, name: nextName } : l));
        lots.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
        return { ...prev, lots };
      });
    },
    mergeLots: (fromLotId: string, toLotId: string): void => {
      if (!fromLotId || !toLotId) return;
      if (fromLotId === toLotId) return;
      setState((prev) => {
        const lots = prev.lots.filter((l) => l.id !== fromLotId);
        const users = prev.users.map((u) => {
          if (!u.lotIds.includes(fromLotId)) return u;
          const next = Array.from(new Set([...u.lotIds.filter((x) => x !== fromLotId), toLotId]));
          return { ...u, lotIds: next };
        });
        return { ...prev, lots, users };
      });
    }
  },

  locations: {
    upsertLocation: (nickname: string, address?: string): string => {
      const nick = nickname.trim();
      if (!nick) return "";
      const idCreated = id("loc");
      setState((prev) => {
        const existing = prev.locations.find((l) => l.nickname.toLowerCase() === nick.toLowerCase());
        const locations = existing
          ? prev.locations.map((l) => (l.id === existing.id ? { ...l, address: address ?? l.address } : l))
          : [{ id: idCreated, nickname: nick, address }, ...prev.locations];
        return { ...prev, locations };
      });
      const after = getState().locations.find((l) => l.nickname.toLowerCase() === nick.toLowerCase());
      return after?.id ?? idCreated;
    }
  },

  votes: {
    createVote: (input: {
      type: VoteType;
      title: string;
      description: string;
      deadlineAt?: string;
      locationId?: string;
      locationText?: string;
      attachments: Array<Pick<VoteAttachment, "name" | "url" | "mimeType" | "size" | "dataUrl">>;
      options: string[];
      minimumQuorum?: number;
      privateNotes?: string;
      excludedUserIds: string[];
      allowLotOwnersToViewOutcome: boolean;
      quoteAmount?: number;
    }): string | undefined => {
      const state = getState();
      const me = state.users.find((u) => u.id === state.auth.currentUserId);
      if (!me) return undefined;
      if (!can(me.role, "VOTE_CREATE")) return undefined;

      const voteId = id("vote");
      const createdAt = nowIso();

      setState((prev) => {
        const creator = prev.users.find((u) => u.id === prev.auth.currentUserId);
        if (!creator) return prev;

        const baseOptions = input.options.filter((o) => o.trim()).map((label) => ({ id: id("opt"), label: label.trim() }));
        const options = baseOptions.length > 0 ? baseOptions : [
          { id: id("opt"), label: "Approve" },
          { id: id("opt"), label: "Deny" },
          { id: id("opt"), label: "Abstain" }
        ];

        const vote: Vote = {
          id: voteId,
          createdAt,
          createdByUserId: creator.id,
          type: input.type,
          title: input.title.trim() || "Untitled vote",
          description: input.description.trim(),
          quoteAmount: typeof input.quoteAmount === "number" ? input.quoteAmount : undefined,
          deadlineAt: input.deadlineAt || undefined,
          locationId: input.locationId || undefined,
          locationText: input.locationText?.trim() || undefined,
          attachments: input.attachments
            .map((a) => ({
              id: id("att"),
              name: a.name.trim(),
              url: a.url,
              mimeType: a.mimeType,
              size: a.size,
              dataUrl: a.dataUrl
            }))
            .filter((a) => Boolean(a.name)),
          options,
          minimumQuorum: input.minimumQuorum,
          privateNotes: input.privateNotes?.trim() || undefined,
          excludedUserIds: input.excludedUserIds,
          allowLotOwnersToViewOutcome: input.allowLotOwnersToViewOutcome,
          votesByUserId: {},
          views: [],
          autoApproved: false
        };

        if (
          input.type === "QUOTE" &&
          creator.role === "BUILDING_MANAGER" &&
          typeof input.quoteAmount === "number" &&
          input.quoteAmount <= prev.settings.autoApprovalThresholdAmount
        ) {
          vote.autoApproved = true;
          vote.closedAt = nowIso();
          vote.closedByUserId = creator.id;
        }

        let notifications = prev.notifications;
        const recipients = prev.users.filter((u) => !vote.excludedUserIds.includes(u.id) && u.id !== creator.id);
        for (const u of recipients) {
          notifications = [
            {
              id: id("ntf"),
              createdAt: nowIso(),
              userId: u.id,
              type: "VOTE_CREATED",
              title: "New vote",
              body: vote.title,
              href: `/votes/${vote.id}`
            },
            ...notifications
          ];
        }

        return { ...prev, votes: [vote, ...prev.votes], notifications };
      });

      return voteId;
    },

    logView: (voteId: string): void => {
      setState((prev) => {
        const uid = prev.auth.currentUserId;
        if (!uid) return prev;
        const vote = prev.votes.find((v) => v.id === voteId);
        if (!vote) return prev;
        if (vote.excludedUserIds.includes(uid)) return prev;

        const already = vote.views.some((v) => v.userId === uid);
        if (already) return prev;

        const votes = prev.votes.map((v) =>
          v.id === voteId ? { ...v, views: [...v.views, { userId: uid, viewedAt: nowIso() }] } : v
        );
        return { ...prev, votes };
      });
    },

    castVote: (voteId: string, optionId: string, comment?: string): void => {
      setState((prev) => {
        const uid = prev.auth.currentUserId;
        if (!uid) return prev;
        const me = prev.users.find((u) => u.id === uid);
        if (!me || !can(me.role, "VOTE_CAST")) return prev;

        const vote = prev.votes.find((v) => v.id === voteId);
        if (!vote) return prev;
        if (vote.excludedUserIds.includes(uid)) return prev;
        if (vote.closedAt) return prev;
        if (!vote.options.some((o) => o.id === optionId)) return prev;

        const choice = { optionId, comment: comment?.trim() || undefined, updatedAt: nowIso() };
        const votes = prev.votes.map((v) => (v.id === voteId ? { ...v, votesByUserId: { ...v.votesByUserId, [uid]: choice } } : v));

        let voteComments = prev.voteComments;
        if (choice.comment) {
          voteComments = [
            {
              id: id("cmt"),
              voteId,
              userId: uid,
              body: choice.comment,
              createdAt: nowIso()
            },
            ...voteComments
          ];
        }

        return { ...prev, votes, voteComments };
      });
    },

    closeVote: (voteId: string): void => {
      setState((prev) => {
        const uid = prev.auth.currentUserId;
        if (!uid) return prev;
        const me = prev.users.find((u) => u.id === uid);
        if (!me || !can(me.role, "VOTE_CLOSE")) return prev;

        const vote = prev.votes.find((v) => v.id === voteId);
        if (!vote) return prev;
        if (vote.closedAt) return prev;

        const isCreator = vote.createdByUserId === uid;
        if (!isCreator && me.role !== "BCM_BCMA") return prev;

        const closedAt = nowIso();
        const votes = prev.votes.map((v) => (v.id === voteId ? { ...v, closedAt, closedByUserId: uid } : v));

        let notifications = prev.notifications;
        const recipients = prev.users.filter((u) => !vote.excludedUserIds.includes(u.id) && u.id !== uid);
        for (const u of recipients) {
          notifications = [
            {
              id: id("ntf"),
              createdAt: nowIso(),
              userId: u.id,
              type: "VOTE_CLOSED",
              title: "Vote closed",
              body: vote.title,
              href: `/votes/${vote.id}`
            },
            ...notifications
          ];
        }

        return { ...prev, votes, notifications };
      });
    },

    reopenVote: (voteId: string): void => {
      setState((prev) => {
        const uid = prev.auth.currentUserId;
        if (!uid) return prev;
        const me = prev.users.find((u) => u.id === uid);
        if (!me || !can(me.role, "VOTE_REOPEN")) return prev;

        const vote = prev.votes.find((v) => v.id === voteId);
        if (!vote) return prev;
        if (!vote.closedAt) return prev;

        const isCreator = vote.createdByUserId === uid;
        if (!isCreator && me.role !== "BCM_BCMA") return prev;

        const votes = prev.votes.map((v) =>
          v.id === voteId
            ? { ...v, closedAt: undefined, closedByUserId: undefined, reopenedAt: nowIso(), reopenedByUserId: uid, autoApproved: false }
            : v
        );

        return { ...prev, votes };
      });
    },

    setAllowLotOwnersToViewOutcome: (voteId: string, allow: boolean): void => {
      setState((prev) => {
        const uid = prev.auth.currentUserId;
        if (!uid) return prev;
        const me = prev.users.find((u) => u.id === uid);
        if (!me) return prev;
        const vote = prev.votes.find((v) => v.id === voteId);
        if (!vote) return prev;
        const isCreator = vote.createdByUserId === uid;
        if (!isCreator && me.role !== "BCM_BCMA") return prev;

        const votes = prev.votes.map((v) => (v.id === voteId ? { ...v, allowLotOwnersToViewOutcome: allow } : v));
        return { ...prev, votes };
      });
    },

    setExcludedUserIds: (voteId: string, excludedUserIds: string[]): void => {
      setState((prev) => {
        const uid = prev.auth.currentUserId;
        if (!uid) return prev;
        const me = prev.users.find((u) => u.id === uid);
        if (!me) return prev;
        const vote = prev.votes.find((v) => v.id === voteId);
        if (!vote) return prev;
        const isCreator = vote.createdByUserId === uid;
        if (!isCreator && me.role !== "BCM_BCMA") return prev;

        const uniq = Array.from(new Set(excludedUserIds)).filter((x) => x && x !== vote.createdByUserId);
        const votes = prev.votes.map((v) => (v.id === voteId ? { ...v, excludedUserIds: uniq } : v));
        return { ...prev, votes };
      });
    },

    deleteVote: (voteId: string): void => {
      setState((prev) => {
        const uid = prev.auth.currentUserId;
        if (!uid) return prev;
        const me = prev.users.find((u) => u.id === uid);
        if (!me) return prev;
        const vote = prev.votes.find((v) => v.id === voteId);
        if (!vote) return prev;
        const isCreator = vote.createdByUserId === uid;
        if (!isCreator && me.role !== "BCM_BCMA") return prev;

        return {
          ...prev,
          votes: prev.votes.filter((v) => v.id !== voteId),
          voteComments: prev.voteComments.filter((c) => c.voteId !== voteId),
          notifications: prev.notifications.filter((n) => n.href !== `/votes/${voteId}`)
        };
      });
    }
  },

  comments: {
    addVoteComment: (voteId: string, body: string, parentId?: string): void => {
      const text = body.trim();
      if (!text) return;

      setState((prev) => {
        const uid = prev.auth.currentUserId;
        if (!uid) return prev;
        const vote = prev.votes.find((v) => v.id === voteId);
        if (!vote) return prev;
        if (vote.excludedUserIds.includes(uid)) return prev;

        const comment: VoteComment = {
          id: id("cmt"),
          voteId,
          userId: uid,
          body: text,
          createdAt: nowIso(),
          parentId: parentId || undefined
        };

        let notifications = prev.notifications;
        const recipients = prev.users.filter((u) => u.id !== uid && !vote.excludedUserIds.includes(u.id));
        for (const u of recipients) {
          notifications = [
            {
              id: id("ntf"),
              createdAt: nowIso(),
              userId: u.id,
              type: "VOTE_COMMENT",
              title: "New comment",
              body: vote.title,
              href: `/votes/${vote.id}`
            },
            ...notifications
          ];
        }

        return { ...prev, voteComments: [comment, ...prev.voteComments], notifications };
      });
    }
  },

  notifications: {
    markRead: (notificationId: string): void => {
      setState((prev) => ({
        ...prev,
        notifications: prev.notifications.map((n) => (n.id === notificationId ? { ...n, readAt: n.readAt ?? nowIso() } : n))
      }));
    },
    markAllReadForCurrentUser: (): void => {
      setState((prev) => {
        const uid = prev.auth.currentUserId;
        if (!uid) return prev;
        return {
          ...prev,
          notifications: prev.notifications.map((n) =>
            n.userId === uid ? { ...n, readAt: n.readAt ?? nowIso() } : n
          )
        };
      });
    },
    clearAllForCurrentUser: (): void => {
      setState((prev) => {
        const uid = prev.auth.currentUserId;
        if (!uid) return prev;
        return { ...prev, notifications: prev.notifications.filter((n) => n.userId !== uid) };
      });
    }
  },

  bmUpdates: {
    createUpdate: (input: {
      title: string;
      body: string;
      urgent: boolean;
      attachments?: Array<Pick<BuildingManagerUpdateAttachment, "name" | "mimeType" | "size" | "dataUrl" | "url">>;
    }): void => {
      const title = input.title.trim();
      const body = input.body.trim();
      if (!title || !body) return;

      setState((prev) => {
        const uid = prev.auth.currentUserId;
        if (!uid) return prev;
        const me = prev.users.find((u) => u.id === uid);
        if (!me || !can(me.role, "BM_UPDATE_CREATE")) return prev;

        const update: BuildingManagerUpdate = {
          id: id("bmupd"),
          createdAt: nowIso(),
          createdByUserId: uid,
          title,
          body,
          urgent: input.urgent,
          attachments: (input.attachments ?? []).map((a) => ({ id: id("bmatt"), ...a }))
        };

        let notifications = prev.notifications;
        for (const u of prev.users) {
          if (u.id === uid) continue;
          notifications = [
            {
              id: id("ntf"),
              createdAt: nowIso(),
              userId: u.id,
              type: "BM_UPDATE",
              title: input.urgent ? "Urgent update" : "Building Manager update",
              body: title,
              href: "/"
            },
            ...notifications
          ];
        }

        return { ...prev, bmUpdates: [update, ...prev.bmUpdates], notifications };
      });
    },
    updateUpdate: (
      updateId: string,
      input: {
        title: string;
        body: string;
        urgent: boolean;
        attachments: BuildingManagerUpdateAttachment[];
      }
    ): void => {
      const title = input.title.trim();
      const body = input.body.trim();
      if (!title || !body) return;

      setState((prev) => {
        const uid = prev.auth.currentUserId;
        if (!uid) return prev;
        const me = prev.users.find((u) => u.id === uid);
        if (!me || !can(me.role, "BM_UPDATE_EDIT")) return prev;

        const existing = prev.bmUpdates.find((u) => u.id === updateId);
        if (!existing) return prev;
        const canEdit = me.role === "BCM_BCMA" || existing.createdByUserId === uid;
        if (!canEdit) return prev;

        const bmUpdates = prev.bmUpdates.map((u) =>
          u.id === updateId ? { ...u, title, body, urgent: input.urgent, attachments: input.attachments } : u
        );
        return { ...prev, bmUpdates };
      });
    },
    deleteUpdate: (updateId: string): void => {
      setState((prev) => {
        const uid = prev.auth.currentUserId;
        if (!uid) return prev;
        const me = prev.users.find((u) => u.id === uid);
        if (!me || !can(me.role, "BM_UPDATE_DELETE")) return prev;

        const existing = prev.bmUpdates.find((u) => u.id === updateId);
        if (!existing) return prev;
        const canDelete = me.role === "BCM_BCMA" || existing.createdByUserId === uid;
        if (!canDelete) return prev;

        return { ...prev, bmUpdates: prev.bmUpdates.filter((u) => u.id !== updateId) };
      });
    }
  },

  ideas: {
    postIdea: (title: string, body: string): void => {
      const t = title.trim();
      const b = body.trim();
      if (!t || !b) return;

      setState((prev) => {
        const uid = prev.auth.currentUserId;
        if (!uid) return prev;
        const idea = {
          id: id("idea"),
          createdAt: nowIso(),
          createdByUserId: uid,
          title: t,
          body: b,
          votesByUserId: {}
        };

        let notifications = prev.notifications;
        for (const u of prev.users) {
          if (u.id === uid) continue;
          notifications = [
            {
              id: id("ntf"),
              createdAt: nowIso(),
              userId: u.id,
              type: "IDEA_POSTED",
              title: "New idea",
              body: t,
              href: "/"
            },
            ...notifications
          ];
        }

        return { ...prev, ideas: [idea, ...prev.ideas], notifications };
      });
    },
    voteIdea: (ideaId: string, delta: 1 | -1): void => {
      setState((prev) => {
        const uid = prev.auth.currentUserId;
        if (!uid) return prev;
        const ideas = prev.ideas.map((i) => {
          if (i.id !== ideaId) return i;
          const current = i.votesByUserId[uid];
          const next = current === delta ? undefined : delta;
          const votesByUserId = { ...i.votesByUserId };
          if (next) votesByUserId[uid] = next;
          else delete votesByUserId[uid];
          return { ...i, votesByUserId };
        });
        return { ...prev, ideas };
      });
    }
  }
} as const;

export function useUnreadNotificationCount(): number {
  const me = useCurrentUser();
  return useAppStore((s) => {
    if (!me) return 0;
    return s.notifications.filter((n) => n.userId === me.id && !n.readAt && shouldShowNotification(s, me, n)).length;
  });
}

export function useNotificationsForCurrentUser(): Notification[] {
  const me = useCurrentUser();
  return useAppStore((s) => {
    if (!me) return [];
    const list = s.notifications.filter((n) => n.userId === me.id && shouldShowNotification(s, me, n));
    return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  });
}

export function useVoteById(voteId: string): Vote | undefined {
  return useAppStore((s) => s.votes.find((v) => v.id === voteId));
}

export function useMemoized<T>(factory: () => T, deps: unknown[]): T {
  return useMemo(factory, deps);
}
