/**
 * Profiles, photos, interests and preferences.
 *
 * Note the two id types, because confusing them produces a 404 that looks
 * like a permissions bug: **Profile and Photo ids are UUID strings, User
 * ids are integers.** Everything in this module is addressed by profile
 * or photo id except the like endpoints, which take a user id.
 */

import { api, unwrapPage } from './client'

// ── Own profile ──────────────────────────────────────────────────────
export async function fetchMyProfile() {
  const { data } = await api.get('/profiles/me/')
  return data
}

/**
 * Partial update.
 *
 * `interests` is a list of interest **ids** on write but a list of
 * interest **objects** on read — the same field with two shapes. Sending
 * back what you received will be rejected, so callers must map to ids.
 */
export async function updateMyProfile(payload) {
  const { data } = await api.patch('/profiles/me/', payload)
  return data
}

export async function fetchMyStats() {
  const { data } = await api.get('/profiles/me/stats/')
  return data
}

export async function fetchMyPreference() {
  const { data } = await api.get('/profiles/me/preferences/')
  return data
}

export async function updateMyPreference(payload) {
  const { data } = await api.patch('/profiles/me/preferences/', payload)
  return data
}

export async function fetchMyViewers(page = 1) {
  const response = await api.get('/profiles/me/viewers/', { params: { page } })
  return unwrapPage(response)
}

// ── Interests catalogue ──────────────────────────────────────────────
/**
 * The full selectable tag list. Paginated, and large enough that the
 * picker fetches it once and caches it rather than per-keystroke.
 */
export async function fetchInterests({ page = 1, pageSize = 100, search } = {}) {
  const response = await api.get('/profiles/interests/', {
    params: { page, page_size: pageSize, ...(search ? { search } : {}) },
  })
  return unwrapPage(response)
}

// ── Photos ───────────────────────────────────────────────────────────
export async function fetchMyPhotos() {
  const { data } = await api.get('/profiles/me/photos/')
  return Array.isArray(data) ? data : (data?.results ?? [])
}

/**
 * Upload one photo.
 *
 * Multipart, because the server re-encodes the image to strip EXIF — a
 * photo straight off a phone carries GPS coordinates that would leak the
 * exact location this product deliberately never exposes.
 */
export async function uploadPhoto(file, caption = '', onProgress) {
  const form = new FormData()
  form.append('image', file)
  if (caption) form.append('caption', caption)

  const { data } = await api.post('/profiles/me/photos/', form, {
    onUploadProgress: (event) => {
      if (onProgress && event.total) {
        onProgress(Math.round((event.loaded * 100) / event.total))
      }
    },
  })
  return data
}

/** Only the caption is writable; everything else is read-only server-side. */
export async function updatePhoto(photoId, caption) {
  const { data } = await api.patch(`/profiles/me/photos/${photoId}/`, { caption })
  return data
}

export async function deletePhoto(photoId) {
  await api.delete(`/profiles/me/photos/${photoId}/`)
}

export async function setPrimaryPhoto(photoId) {
  const { data } = await api.post(`/profiles/me/photos/${photoId}/set-primary/`)
  return data
}

/**
 * Persist a drag-and-drop reorder.
 *
 * The body is the complete ordered list of photo ids, not a pair of
 * swapped positions — the server assigns positions from the array index,
 * so a partial list is a meaningful reorder rather than an error.
 */
export async function reorderPhotos(orderedIds) {
  const { data } = await api.post('/profiles/me/photos/reorder/', {
    order: orderedIds,
  })
  return data
}

// ── Other users ──────────────────────────────────────────────────────
/** Another user's public profile, by **profile** UUID. */
export async function fetchPublicProfile(profileId) {
  const { data } = await api.get(`/profiles/${profileId}/`)
  return data
}

// ── Saved profiles ───────────────────────────────────────────────────
/**
 * Profiles the caller has kept.
 *
 * Addressed by **profile** UUID here too, unlike likes and blocks, which
 * take an integer user id. The profile page only ever has a profile id,
 * so this is the one shape that lets the save toggle on that page work
 * without a second lookup.
 */
export async function fetchSavedProfiles(page = 1) {
  const response = await api.get('/profiles/me/saved/', { params: { page } })
  return unwrapPage(response)
}

/** Save a profile. Saving twice updates the note rather than duplicating. */
export async function saveProfile(profileId, note = '') {
  const { data } = await api.post('/profiles/me/saved/', {
    profile_id: profileId,
    note,
  })
  return data
}

/** Unsave, addressed by profile id. */
export async function unsaveProfile(profileId) {
  await api.delete(`/profiles/me/saved/${profileId}/`)
}
