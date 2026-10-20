/**
 * Profile, photo and preference queries.
 *
 * One invalidation rule governs this whole module: editing the profile
 * changes `profile_completion`, which the sidebar and the overview both
 * read, so a profile write invalidates the user too. Missing that is the
 * classic "the percentage never updates" bug.
 *
 * The second rule is the avatar. The navbar renders `user.photo` from the
 * session, not from any query, so invalidating caches is not enough to
 * change it — the session object itself has to be patched. Every mutation
 * that can move the primary photo calls `syncAvatar`, which does both that
 * and the cross-tab broadcast. This is the acting tab's half of the same
 * problem the server-side `profile.updated` frame solves for everyone
 * else's tabs.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import * as profilesApi from '../services/profiles'
import { useAuth } from '../context/AuthContext'
import { PHOTO_MODERATION } from '../utils/constants'
import { queryKeys } from './queryKeys'

/**
 * Push the current primary photo into the session, everywhere.
 *
 * Reads the photo list from the cache rather than trusting a response
 * body, because the endpoints disagree about what they return: set-primary
 * echoes the whole list, upload echoes one photo, delete echoes nothing.
 * The cached list is the one thing they all agree on, and it is refetched
 * by the caller either way.
 *
 * **The moderation rule is applied here too.** The cached list is the
 * user's *own* photos, so it includes pending and rejected ones — but the
 * server's rule (`notifications.realtime.avatar_url`, and
 * `_approved_photos` in matching) is that only an approved photo may be
 * someone's face, the owner's own navbar included. Picking `photos[0]`
 * without filtering would show an avatar the next `/auth/me/` would
 * refuse, so the two would disagree until a reload. Mirror the server:
 * primary if approved, else the first approved, else nothing.
 *
 * **The URL form matches `/auth/me/`.** `queryKeys.myPhotos()` is
 * populated by `PhotoSerializer`, which always has a request in context
 * and so always emits an absolute URL — the same form `UserSerializer`
 * now returns for the session. So the string written here is the one the
 * next boot would produce, and the `photo === user?.photo` guard below is
 * a genuine no-op rather than a false negative that would republish a
 * `user.updated` to every tab on every photo mutation. Socket frames are
 * the odd one out: they carry an origin-relative `/media/...` path,
 * because a WebSocket has no request to build an absolute URL from. That
 * is fine for *other* people's avatars, which are rendered straight from
 * the frame and never compared against the session.
 */
function useAvatarSync() {
  const queryClient = useQueryClient()
  const { patchUser, user } = useAuth()

  return () => {
    const photos = queryClient.getQueryData(queryKeys.myPhotos())
    if (!Array.isArray(photos)) return

    const approved = photos.filter(
      (photo) => photo.moderation_status === PHOTO_MODERATION.APPROVED,
    )
    const primary = approved.find((photo) => photo.is_primary) ?? approved[0]
    const photo = primary?.url ?? null
    if (photo === user?.photo) return
    patchUser({ photo })
  }
}

// ── Own profile ──────────────────────────────────────────────────────
export function useMyProfile(options = {}) {
  return useQuery({
    queryKey: queryKeys.myProfile(),
    queryFn: profilesApi.fetchMyProfile,
    // The editor is the only thing that changes this, and it invalidates
    // explicitly, so a background refetch is noise.
    staleTime: 5 * 60 * 1000,
    ...options,
  })
}

export function useMyStats() {
  return useQuery({
    queryKey: queryKeys.myStats(),
    queryFn: profilesApi.fetchMyStats,
    staleTime: 60 * 1000,
  })
}

export function useUpdateMyProfile() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: profilesApi.updateMyProfile,
    onSuccess: (profile) => {
      // Seed the cache with the server's own response rather than
      // patching locally — the server recomputes `completeness`, and
      // guessing at it here would disagree.
      queryClient.setQueryData(queryKeys.myProfile(), profile)
      queryClient.invalidateQueries({ queryKey: queryKeys.myStats() })
      // Completion feeds the sidebar and the overview cards.
      queryClient.invalidateQueries({ queryKey: queryKeys.me() })
    },
  })
}

// ── Interests ────────────────────────────────────────────────────────
/**
 * The selectable tag catalogue.
 *
 * Fetched once and held for a long time: it changes only when an admin
 * adds a tag, and the picker is unusable if it re-fetches mid-selection.
 */
export function useInterests(params = {}) {
  return useQuery({
    queryKey: queryKeys.interests(params),
    queryFn: () => profilesApi.fetchInterests(params),
    staleTime: 30 * 60 * 1000,
  })
}

// ── Preferences ──────────────────────────────────────────────────────
export function useMyPreference() {
  return useQuery({
    queryKey: queryKeys.myPreference(),
    queryFn: profilesApi.fetchMyPreference,
    staleTime: 5 * 60 * 1000,
  })
}

export function useUpdateMyPreference() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: profilesApi.updateMyPreference,
    onSuccess: (preference) => {
      queryClient.setQueryData(queryKeys.myPreference(), preference)
      // Preferences are deal-breakers the scorer applies, so the feed is
      // now wrong. This is the invalidation most easily forgotten.
      queryClient.invalidateQueries({ queryKey: ['feed'] })
    },
  })
}

// ── Photos ───────────────────────────────────────────────────────────
export function useMyPhotos() {
  return useQuery({
    queryKey: queryKeys.myPhotos(),
    queryFn: profilesApi.fetchMyPhotos,
  })
}

export function useUploadPhoto() {
  const queryClient = useQueryClient()
  const syncAvatar = useAvatarSync()

  return useMutation({
    mutationFn: ({ file, caption, onProgress }) =>
      profilesApi.uploadPhoto(file, caption, onProgress),
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.myPhotos() })
      queryClient.invalidateQueries({ queryKey: queryKeys.myProfile() })
      // A new photo can change the primary, and the completeness score
      // counts photos.
      queryClient.invalidateQueries({ queryKey: queryKeys.myStats() })
      queryClient.invalidateQueries({ queryKey: queryKeys.me() })
      // Awaited: the list has to be current before the primary can be
      // read out of it, or the navbar gets the avatar from before this
      // upload.
      await queryClient.refetchQueries({ queryKey: queryKeys.myPhotos() })
      syncAvatar()
    },
  })
}

export function useDeletePhoto() {
  const queryClient = useQueryClient()
  const syncAvatar = useAvatarSync()

  return useMutation({
    mutationFn: profilesApi.deletePhoto,
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.myPhotos() })
      queryClient.invalidateQueries({ queryKey: queryKeys.myProfile() })
      queryClient.invalidateQueries({ queryKey: queryKeys.myStats() })
      // Deleting the primary promotes the next photo, so the avatar moves
      // even though the user did not ask for a new one.
      await queryClient.refetchQueries({ queryKey: queryKeys.myPhotos() })
      syncAvatar()
    },
  })
}

export function useSetPrimaryPhoto() {
  const queryClient = useQueryClient()
  const syncAvatar = useAvatarSync()

  return useMutation({
    mutationFn: profilesApi.setPrimaryPhoto,
    // The endpoint returns the full reordered list, so seed from it.
    onSuccess: (photos) => {
      queryClient.setQueryData(queryKeys.myPhotos(), photos)
      queryClient.invalidateQueries({ queryKey: queryKeys.myProfile() })
      // No refetch needed — the response *is* the list.
      syncAvatar()
    },
  })
}

export function useReorderPhotos() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: profilesApi.reorderPhotos,
    onSuccess: (photos) => {
      queryClient.setQueryData(queryKeys.myPhotos(), photos)
    },
  })
}

export function useUpdatePhoto() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ photoId, caption }) => profilesApi.updatePhoto(photoId, caption),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.myPhotos() })
    },
  })
}

// ── Other users ──────────────────────────────────────────────────────
export function usePublicProfile(profileId, options = {}) {
  return useQuery({
    queryKey: queryKeys.publicProfile(profileId),
    queryFn: () => profilesApi.fetchPublicProfile(profileId),
    enabled: Boolean(profileId),    ...options,
  })
}

export function useMyViewers(page = 1) {
  return useQuery({
    queryKey: queryKeys.myViewers(page),
    queryFn: () => profilesApi.fetchMyViewers(page),
    // Keep the previous page on screen while the next loads, so paging
    // does not collapse the layout.
    placeholderData: (previous) => previous,
  })
}

// ── Saved profiles ───────────────────────────────────────────────────
/**
 * The caller's saved profiles.
 *
 * `placeholderData` keeps the previous page on screen while the next
 * loads, matching `useMyViewers` — paging should not collapse the grid.
 */
export function useSavedProfiles(page = 1) {
  return useQuery({
    queryKey: queryKeys.savedProfiles(page),
    queryFn: () => profilesApi.fetchSavedProfiles(page),
    placeholderData: (previous) => previous,
  })
}

/**
 * Save / unsave, as one mutation with an optimistic flip.
 *
 * A save is a single boolean the user just toggled, so waiting for the
 * round trip to redraw the button makes it feel broken on a slow
 * connection. The public-profile cache is patched immediately and rolled
 * back on error.
 *
 * The saved *list* is invalidated rather than patched: a newly saved
 * profile has to be inserted in `-created_at` order, and guessing where
 * it lands is how a list ends up subtly wrong. The server decides.
 */
export function useToggleSaved(profileId) {
  const queryClient = useQueryClient()
  const publicKey = queryKeys.publicProfile(profileId)

  return useMutation({
    mutationFn: ({ saved, note = '' }) =>
      saved ? profilesApi.saveProfile(profileId, note) : profilesApi.unsaveProfile(profileId),

    onMutate: async ({ saved }) => {
      // Stop an in-flight refetch from landing mid-toggle and undoing it.
      await queryClient.cancelQueries({ queryKey: publicKey })
      const previous = queryClient.getQueryData(publicKey)
      if (previous) {
        queryClient.setQueryData(publicKey, { ...previous, is_saved: saved })
      }
      return { previous }
    },

    onError: (_error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(publicKey, context.previous)
      }
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['saved'] })
    },
  })
}
