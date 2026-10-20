/**
 * Your profile.
 *
 * ## Structure
 *
 * The same shape as the profile other people see — portrait header, then
 * tabs — so what you edit and what they read are recognisably the same
 * page. That is the point of the redesign: a member who has spent an hour
 * in the editor should recognise their own profile when they land on
 * someone else's.
 *
 * One tab is not in the visitor's set: **Settings**. Privacy switches and
 * the verification action are things only the owner has, and burying them
 * under "Lifestyle" would be a lie about what they are. Five tabs here,
 * four there.
 *
 * ## The editor is split into sections that save independently
 *
 * Not one giant form. Two reasons: the profile payload is large enough
 * that a single PATCH on every keystroke is wasteful, and a validation
 * error in the bio must not block saving a corrected height. The tab a
 * section sits in has nothing to do with how it saves — `SECTIONS` below
 * is the authority on that, and it is unchanged by the regrouping.
 *
 * ## Interests are the one field with two shapes
 *
 * The API returns a list of interest *objects* and accepts a list of
 * *ids*. Sending back what you received is rejected, so `toIds` converts
 * before every write. This is the single most common way to break this
 * endpoint.
 *
 * The server recomputes `completeness` on every write, so the progress bar
 * reads the response rather than guessing — the `useUpdateMyProfile` hook
 * seeds the cache from it.
 */

import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { PhotoGrid } from '../../components/profiles/PhotoGrid'
import { PhotoManager } from '../../components/profiles/PhotoManager'
import { Avatar } from '../../components/ui/Avatar'
import { Badge, VerifiedBadge } from '../../components/ui/Badge'
import { Checkbox, Select, TextArea, TextField } from '../../components/ui/Form'
import { ConfirmDialog } from '../../components/ui/Modal'
import { ErrorState } from '../../components/ui/States'
import { LoadingState } from '../../components/ui/Spinner'
import { TabPanel, Tabs } from '../../components/ui/Tabs'
import {
  useDeletePhoto,
  useInterests,
  useMyPhotos,
  useMyProfile,
  useReorderPhotos,
  useSetPrimaryPhoto,
  useUpdateMyProfile,
  useUploadPhoto,
} from '../../hooks/useProfile'
import { useAuth } from '../../context/AuthContext'
import {
  GENDERS,
  MAX_LANGUAGES,
  PHOTO_MODERATION,
  RELATIONSHIP_GOALS,
  VERIFICATION_STATUS,
} from '../../utils/constants'
import { formatHeight } from '../../utils/format'

/**
 * The editable shape of a profile payload.
 *
 * One function for both the draft and the server snapshot, because
 * `isDirty` compares them field by field: if the two were written out
 * separately and drifted by a single key, a save would silently stop
 * reporting itself as dirty, or start reporting a change nobody made.
 * Deriving both from here makes that impossible.
 */
function toDraft(data) {
  return {
    headline: data.headline ?? '',
    bio: data.bio ?? '',
    occupation: data.occupation ?? '',
    company: data.company ?? '',
    education: data.education ?? '',
    city: data.city ?? '',
    region: data.region ?? '',
    country: data.country ?? '',
    gender: data.gender ?? '',
    pronouns: data.pronouns ?? '',
    height_cm: data.height_cm ?? '',
    relationship_goal: data.relationship_goal ?? '',
    looking_for: data.looking_for ?? '',
    languages: (data.languages ?? []).join(', '),
    drinking: data.drinking ?? '',
    smoking: data.smoking ?? '',
    exercise: data.exercise ?? '',
    pets: data.pets ?? '',
    children: data.children ?? '',
    // The API returns interest *objects* and accepts *ids*; the draft holds
    // ids so a save can send it back verbatim. `interests_detail` is the
    // object form and is preferred when present.
    interestIds: (data.interests_detail ?? data.interests ?? []).map(
      (interest) => interest.id,
    ),
    // Privacy switches live in their own section but save through the same
    // endpoint.
    is_hidden: data.is_hidden ?? false,
    is_incognito: data.is_incognito ?? false,
    show_distance: data.show_distance ?? true,
    show_age: data.show_age ?? true,
    show_online_status: data.show_online_status ?? true,
    only_show_to_matches: data.only_show_to_matches ?? false,
  }
}

/** A section wrapper with its own save button and status line. */
function EditorSection({ title, description, children, onSave, isSaving, isDirty, savedAt, error }) {
  return (
    <form
      className="card p-5"
      onSubmit={(event) => {
        event.preventDefault()
        onSave()
      }}
    >
      <div className="mb-3">
        <h2 className="heading-section">
          {title}
        </h2>
        {description ? (
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
            {description}
          </p>
        ) : null}
      </div>

      <div className="space-y-4">{children}</div>

      {error ? (
        <p role="alert" className="mt-3 text-sm text-red-600 dark:text-red-400">
          {error.message}
        </p>
      ) : null}

      <div className="mt-4 flex items-center gap-3">
        <button type="submit" className="btn-primary" disabled={isSaving || !isDirty}>
          {isSaving ? 'Saving…' : 'Save'}
        </button>
        {savedAt && !isDirty ? (
          <span role="status" className="text-sm text-sage-600 dark:text-sage-400">
            Saved
          </span>
        ) : null}
      </div>
    </form>
  )
}

/** A labelled value in the header's at-a-glance list. */
function HeaderFact({ label, value }) {
  if (!value) return null
  return (
    <div className="min-w-0">
      <dt className="eyebrow">{label}</dt>
      <dd className="truncate text-sm text-slate-700 dark:text-slate-300">{value}</dd>
    </div>
  )
}

/**
 * The photo to show as the portrait: the main one if it is approved,
 * otherwise the first approved one, otherwise whatever exists.
 *
 * The middle step matters. A member who has just uploaded a new main photo
 * would otherwise see the portrait go blank for as long as review takes —
 * the row is `pending`, and rendering it would be showing an unreviewed
 * photo of themselves as their public face.
 */
function portraitFor(photoList) {
  const approved = photoList.filter(
    (photo) => photo.moderation_status === PHOTO_MODERATION.APPROVED,
  )
  return (
    approved.find((photo) => photo.is_primary) ??
    approved[0] ??
    photoList.find((photo) => photo.is_primary) ??
    photoList[0] ??
    null
  )
}

export function ProfilePage() {
  const { user, refreshUser } = useAuth()
  const profile = useMyProfile()
  const photos = useMyPhotos()
  const interestsQuery = useInterests({ pageSize: 100 })

  const updateProfile = useUpdateMyProfile()
  const uploadPhoto = useUploadPhoto()
  const deletePhoto = useDeletePhoto()
  const setPrimaryPhoto = useSetPrimaryPhoto()
  const reorderPhotos = useReorderPhotos()

  // Drafts, seeded from the server payload once it lands. Kept separate
  // from the query cache so a background refetch cannot overwrite what
  // the user is mid-way through typing.
  //
  // Seeded lazily, during the first render that has data, rather than in an
  // effect. An effect runs *after* paint, so on a warm cache the page would
  // paint a full-screen spinner for one frame and then replace it — a flash
  // of "loading" on a screen that was never loading.
  const [draft, setDraft] = useState(null)
  const [savedSection, setSavedSection] = useState(null)
  const [sectionError, setSectionError] = useState({})
  const [isVerifyOpen, setIsVerifyOpen] = useState(false)
  const [tab, setTab] = useState('photos')

  const activeDraft = draft ?? (profile.data ? toDraft(profile.data) : null)

  const serverSnapshot = useMemo(
    () => (profile.data ? toDraft(profile.data) : null),
    [profile.data],
  )

  const interests = useMemo(
    () => interestsQuery.data?.results ?? [],
    [interestsQuery.data],
  )

  const set = (patch) =>
    setDraft((current) => ({ ...(current ?? activeDraft), ...patch }))

  if (profile.isLoading || !activeDraft) {
    return <LoadingState message="Loading your profile…" />
  }
  if (profile.isError) {
    return <ErrorState error={profile.error} onRetry={profile.refetch} />
  }

  /** Which fields belong to which section, for dirty-checking and saving. */
  const SECTIONS = {
    about: ['headline', 'bio', 'occupation', 'company', 'education'],
    details: ['gender', 'pronouns', 'height_cm', 'relationship_goal', 'looking_for'],
    location: ['city', 'region', 'country'],
    lifestyle: ['drinking', 'smoking', 'exercise', 'pets', 'children'],
    interests: ['interestIds'],
    languages: ['languages'],
    privacy: [
      'is_hidden',
      'is_incognito',
      'show_distance',
      'show_age',
      'show_online_status',
      'only_show_to_matches',
    ],
  }

  const isDirty = (section) =>
    SECTIONS[section].some(
      (field) =>
        JSON.stringify(activeDraft[field]) !== JSON.stringify(serverSnapshot[field]),
    )

  const save = async (section) => {
    setSectionError((current) => ({ ...current, [section]: null }))
    setSavedSection(null)

    const payload = {}
    for (const field of SECTIONS[section]) {
      // Empty strings are the server's `allow_blank` case for text, but
      // an empty *number* field must be sent as null, not "".
      if (field === 'height_cm') {
        payload.height_cm =
          activeDraft.height_cm === '' ? null : Number(activeDraft.height_cm)
      } else if (field === 'languages') {
        const list = activeDraft.languages
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean)
        payload.languages = list.slice(0, MAX_LANGUAGES)
      } else {
        payload[field] = activeDraft[field]
      }
    }

    try {
      await updateProfile.mutateAsync(payload)
      setSavedSection(section)
      // `profile_completion` feeds the sidebar and the overview, so the
      // session user is refreshed alongside the profile itself.
      refreshUser()
    } catch (error) {
      setSectionError((current) => ({ ...current, [section]: error }))
    }
  }

  const verification = profile.data.verification_status
  const photoList = photos.data ?? []
  const portrait = portraitFor(photoList)

  const location = [activeDraft.city, activeDraft.country && activeDraft.country !== activeDraft.city ? activeDraft.country : null]
    .filter(Boolean)
    .join(', ')

  const selectedInterests = interests.filter((interest) =>
    activeDraft.interestIds.includes(interest.id),
  )

  const tabs = [
    { value: 'photos', label: 'Photos', count: photoList.length },
    { value: 'about', label: 'About' },
    { value: 'interests', label: 'Interests', count: activeDraft.interestIds.length },
    { value: 'lifestyle', label: 'Lifestyle' },
    { value: 'settings', label: 'Settings' },
  ]

  return (
    <div className="mx-auto max-w-content space-y-5">
      {/* ── Portrait header ──────────────────────────────────────── */}
      <header className="card overflow-hidden">
        <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-start">
          <div className="mx-auto w-32 shrink-0 sm:mx-0 sm:w-40">
            {portrait?.url ? (
              <img
                src={portrait.url}
                alt="Your main photo"
                className="aspect-[4/5] w-full rounded-2xl object-cover"
              />
            ) : (
              <div className="flex aspect-[4/5] w-full items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800">
                <Avatar name={profile.data.name} size="2xl" />
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <h1 className="heading-display">
                {profile.data.name}
                {profile.data.age ? (
                  <span className="font-normal text-slate-500 dark:text-slate-400">
                    , {profile.data.age}
                  </span>
                ) : null}
              </h1>
              {verification === VERIFICATION_STATUS.APPROVED ? (
                <VerifiedBadge size="md" />
              ) : null}
            </div>

            <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
              {user?.email}
            </p>

            {activeDraft.headline ? (
              <p className="mt-2 text-base font-medium text-slate-700 dark:text-slate-300">
                {activeDraft.headline}
              </p>
            ) : null}

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Badge tone="brand">
                {labelForGoal(activeDraft.relationship_goal) ?? 'No intent set'}
              </Badge>
              {verification === VERIFICATION_STATUS.PENDING ? (
                <Badge tone="warning">Verification pending</Badge>
              ) : null}
              {/* These describe how the world sees you *right now*, so they
                  read the saved payload rather than the draft. A badge that
                  said "Incognito" the moment you ticked the box would be
                  claiming a state the server has not been told about. */}
              {profile.data.is_incognito ? <Badge tone="info">Incognito</Badge> : null}
              {profile.data.is_hidden ? (
                <Badge tone="warning">Hidden from Discover</Badge>
              ) : null}
            </div>

            {/*
              Primary actions.

              The preview link is only offered when the profile is not
              hidden, because `PublicProfileView.get_queryset` filters
              `is_hidden=False` — including for the owner. A hidden member
              previewing themselves would get a 404, so the badge above
              ("Hidden from Discover") is the honest answer instead of a
              button that cannot work.
            */}
            <div className="mt-4 flex flex-wrap gap-2">
              {profile.data.is_hidden ? null : (
                <Link to={`/app/profile/${profile.data.id}`} className="btn-secondary">
                  Preview as others see you
                </Link>
              )}
              {verification === VERIFICATION_STATUS.APPROVED ||
              verification === VERIFICATION_STATUS.PENDING ? null : (
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => setIsVerifyOpen(true)}
                >
                  Get verified
                </button>
              )}
              <button
                type="button"
                className="btn-ghost"
                onClick={() => setTab('photos')}
              >
                Manage photos
              </button>
            </div>
          </div>
        </div>

        {/* Completeness. The server recomputes it on every write, so this
            is the response value rather than a client-side guess. */}
        <div className="border-t border-sand-200 px-5 py-4 dark:border-sand-800">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
              {profile.data.completeness}% complete
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              A complete profile is shown to more people.
            </p>
          </div>
          <div
            className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800"
            role="progressbar"
            aria-valuenow={profile.data.completeness}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Profile completeness"
          >
            <div
              className="h-full rounded-full bg-brand-600 transition-all duration-500 motion-reduce:transition-none"
              style={{ width: `${profile.data.completeness}%` }}
            />
          </div>

          <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <HeaderFact label="Location" value={location} />
            <HeaderFact label="Photos" value={`${photoList.length}`} />
            <HeaderFact label="Interests" value={`${activeDraft.interestIds.length}`} />
            <HeaderFact
              label="Height"
              value={activeDraft.height_cm ? formatHeight(Number(activeDraft.height_cm)) : null}
            />
          </dl>
        </div>
      </header>

      <Tabs
        tabs={tabs}
        value={tab}
        onChange={setTab}
        ariaLabel="Your profile sections"
      />

      {/* ── Photos ───────────────────────────────────────────────── */}
      <TabPanel tabValue="photos" value={tab} className="space-y-5">
        <div className="card p-5">
          <PhotoManager
            photos={photoList}
            onUpload={(file, onProgress) => uploadPhoto.mutateAsync({ file, onProgress })}
            onDelete={(photoId) => deletePhoto.mutateAsync(photoId)}
            onSetPrimary={(photoId) => setPrimaryPhoto.mutateAsync(photoId)}
            onReorder={(orderedIds) => reorderPhotos.mutateAsync(orderedIds)}
            isBusy={
              uploadPhoto.isPending ||
              deletePhoto.isPending ||
              setPrimaryPhoto.isPending ||
              reorderPhotos.isPending
            }
          />
        </div>

        {/* How the approved photos read as a grid, which is what a visitor
            actually sees. Distinct from the manager above: that one is
            about ordering and review state, this one is the result. */}
        <div className="card p-5">
          <h2 className="heading-section">How your photos appear</h2>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
            Only approved photos are shown to other people. Select one to open it
            full screen.
          </p>
          <PhotoGrid
            photos={photoList.filter(
              (photo) => photo.moderation_status === PHOTO_MODERATION.APPROVED,
            )}
            name={profile.data.name}
            showStatus
            className="mt-3"
            emptyTitle="No approved photos yet"
            emptyDescription="Photos are reviewed after upload. Approved ones will appear here."
          />
        </div>
      </TabPanel>

      {/* ── About ────────────────────────────────────────────────── */}
      <TabPanel tabValue="about" value={tab} className="space-y-5">
        <EditorSection
          title="About you"
          description="This is the first thing people read."
          onSave={() => save('about')}
          isSaving={updateProfile.isPending}
          isDirty={isDirty('about')}
          savedAt={savedSection === 'about'}
          error={sectionError.about}
        >
          <TextField
            label="Headline"
            name="headline"
            value={activeDraft.headline}
            onChange={(event) => set({ headline: event.target.value })}
            maxLength={120}
            placeholder="Something short and specific"
            hint="Up to 120 characters."
          />
          <TextArea
            label="Bio"
            name="bio"
            value={activeDraft.bio}
            onChange={(event) => set({ bio: event.target.value })}
            rows={5}
            maxLength={2000}
            showCount
            placeholder="What should people know about you?"
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label="Occupation"
              name="occupation"
              value={activeDraft.occupation}
              onChange={(event) => set({ occupation: event.target.value })}
              maxLength={100}
            />
            <TextField
              label="Company"
              name="company"
              value={activeDraft.company}
              onChange={(event) => set({ company: event.target.value })}
              maxLength={100}
            />
          </div>
          <TextField
            label="Education"
            name="education"
            value={activeDraft.education}
            onChange={(event) => set({ education: event.target.value })}
            maxLength={150}
          />
        </EditorSection>

        <EditorSection
          title="Details"
          description="Used to match you with the right people."
          onSave={() => save('details')}
          isSaving={updateProfile.isPending}
          isDirty={isDirty('details')}
          savedAt={savedSection === 'details'}
          error={sectionError.details}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Select
              label="Gender"
              name="gender"
              value={activeDraft.gender}
              onChange={(event) => set({ gender: event.target.value })}
              options={GENDERS}
              placeholder="Prefer not to say"
            />
            <TextField
              label="Pronouns"
              name="pronouns"
              value={activeDraft.pronouns}
              onChange={(event) => set({ pronouns: event.target.value })}
              maxLength={30}
              placeholder="e.g. she/her"
            />
            <TextField
              label="Height (cm)"
              name="height_cm"
              type="number"
              inputMode="numeric"
              value={activeDraft.height_cm}
              onChange={(event) => set({ height_cm: event.target.value })}
              min={100}
              max={250}
            />
            <Select
              label="Looking for"
              name="relationship_goal"
              value={activeDraft.relationship_goal}
              onChange={(event) => set({ relationship_goal: event.target.value })}
              options={RELATIONSHIP_GOALS}
              placeholder="Prefer not to say"
            />
          </div>
          <TextField
            label="What you are looking for"
            name="looking_for"
            value={activeDraft.looking_for}
            onChange={(event) => set({ looking_for: event.target.value })}
            maxLength={200}
            placeholder="A short sentence in your own words"
          />
        </EditorSection>

        <EditorSection
          title="Location"
          description="Only your city and an approximate distance are ever shown — never your exact location."
          onSave={() => save('location')}
          isSaving={updateProfile.isPending}
          isDirty={isDirty('location')}
          savedAt={savedSection === 'location'}
          error={sectionError.location}
        >
          <div className="grid gap-4 sm:grid-cols-3">
            <TextField
              label="City"
              name="city"
              value={activeDraft.city}
              onChange={(event) => set({ city: event.target.value })}
              maxLength={80}
            />
            <TextField
              label="Region"
              name="region"
              value={activeDraft.region}
              onChange={(event) => set({ region: event.target.value })}
              maxLength={80}
            />
            <TextField
              label="Country"
              name="country"
              value={activeDraft.country}
              onChange={(event) => set({ country: event.target.value })}
              maxLength={80}
            />
          </div>
        </EditorSection>
      </TabPanel>

      {/* ── Interests ────────────────────────────────────────────── */}
      <TabPanel tabValue="interests" value={tab} className="space-y-5">
        <EditorSection
          title="Interests"
          description="Shared interests are the strongest signal in your match score."
          onSave={() => save('interests')}
          isSaving={updateProfile.isPending}
          isDirty={isDirty('interests')}
          savedAt={savedSection === 'interests'}
          error={sectionError.interests}
        >
          {interestsQuery.isLoading ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Loading interests…
            </p>
          ) : (
            <div className="scrollbar-thin flex max-h-64 flex-wrap gap-1.5 overflow-y-auto rounded-xl border border-sand-200 p-3 dark:border-sand-800">
              {interests.map((interest) => {
                const selected = activeDraft.interestIds.includes(interest.id)
                return (
                  <button
                    key={interest.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() =>
                      set({
                        interestIds: selected
                          ? activeDraft.interestIds.filter((id) => id !== interest.id)
                          : [...activeDraft.interestIds, interest.id],
                      })
                    }
                    className={[
                      'badge transition-colors',
                      selected
                        ? 'bg-brand-600 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700',
                    ].join(' ')}
                  >
                    {interest.name}
                  </button>
                )
              })}
            </div>
          )}
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {activeDraft.interestIds.length} selected
          </p>
        </EditorSection>

        <EditorSection
          title="Languages"
          description={`Comma-separated, up to ${MAX_LANGUAGES}.`}
          onSave={() => save('languages')}
          isSaving={updateProfile.isPending}
          isDirty={isDirty('languages')}
          savedAt={savedSection === 'languages'}
          error={sectionError.languages}
        >
          <TextField
            label="Languages"
            name="languages"
            value={activeDraft.languages}
            onChange={(event) => set({ languages: event.target.value })}
            placeholder="English, Hindi, Spanish"
          />
        </EditorSection>

        {/* The read-back: what the visitor's Interests tab will show. */}
        <div className="card p-5">
          <h2 className="heading-section">How your interests appear</h2>
          {selectedInterests.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              Nothing selected yet. Save your interests and they will show here.
            </p>
          ) : (
            <div className="mt-3 flex flex-wrap gap-2">
              {selectedInterests.map((interest) => (
                <Badge key={interest.id} tone="neutral">
                  {interest.name}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </TabPanel>

      {/* ── Lifestyle ────────────────────────────────────────────── */}
      <TabPanel tabValue="lifestyle" value={tab}>
        <EditorSection
          title="Lifestyle"
          onSave={() => save('lifestyle')}
          isSaving={updateProfile.isPending}
          isDirty={isDirty('lifestyle')}
          savedAt={savedSection === 'lifestyle'}
          error={sectionError.lifestyle}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label="Drinking"
              name="drinking"
              value={activeDraft.drinking}
              onChange={(event) => set({ drinking: event.target.value })}
              maxLength={40}
              placeholder="e.g. Socially"
            />
            <TextField
              label="Smoking"
              name="smoking"
              value={activeDraft.smoking}
              onChange={(event) => set({ smoking: event.target.value })}
              maxLength={40}
            />
            <TextField
              label="Exercise"
              name="exercise"
              value={activeDraft.exercise}
              onChange={(event) => set({ exercise: event.target.value })}
              maxLength={40}
            />
            <TextField
              label="Pets"
              name="pets"
              value={activeDraft.pets}
              onChange={(event) => set({ pets: event.target.value })}
              maxLength={40}
            />
          </div>
          <TextField
            label="Children"
            name="children"
            value={activeDraft.children}
            onChange={(event) => set({ children: event.target.value })}
            maxLength={40}
          />
        </EditorSection>
      </TabPanel>

      {/* ── Settings (owner only — not in a visitor's tab set) ───── */}
      <TabPanel tabValue="settings" value={tab} className="space-y-5">
        <EditorSection
          title="Privacy"
          description="Control who can find and see you."
          onSave={() => save('privacy')}
          isSaving={updateProfile.isPending}
          isDirty={isDirty('privacy')}
          savedAt={savedSection === 'privacy'}
          error={sectionError.privacy}
        >
          <Checkbox
            label="Hide my profile from Discover"
            name="is_hidden"
            checked={activeDraft.is_hidden}
            onChange={(event) => set({ is_hidden: event.target.checked })}
            hint="You keep your matches and conversations, but nobody new finds you."
          />
          <Checkbox
            label="Incognito — only visible to people you like"
            name="is_incognito"
            checked={activeDraft.is_incognito}
            onChange={(event) => set({ is_incognito: event.target.checked })}
            hint="You can browse without appearing in anyone's feed until you like them."
          />
          <Checkbox
            label="Show my approximate distance"
            name="show_distance"
            checked={activeDraft.show_distance}
            onChange={(event) => set({ show_distance: event.target.checked })}
            hint="Always approximate — your exact location is never exposed either way."
          />
          <Checkbox
            label="Show my age"
            name="show_age"
            checked={activeDraft.show_age}
            onChange={(event) => set({ show_age: event.target.checked })}
          />
          <Checkbox
            label="Show when I am online"
            name="show_online_status"
            checked={activeDraft.show_online_status}
            onChange={(event) => set({ show_online_status: event.target.checked })}
          />
          <Checkbox
            label="Only show my profile to people I have matched with"
            name="only_show_to_matches"
            checked={activeDraft.only_show_to_matches}
            onChange={(event) => set({ only_show_to_matches: event.target.checked })}
          />
        </EditorSection>
      </TabPanel>

      <ConfirmDialog
        isOpen={isVerifyOpen}
        onClose={() => setIsVerifyOpen(false)}
        onConfirm={() => setIsVerifyOpen(false)}
        title="Get verified"
        description="Verification reviews are handled by our moderation team. The verification queue API is not built yet — this is coming in the admin dashboard step. Your photos are still reviewed automatically on upload."
        confirmLabel="Got it"
      />
    </div>
  )
}

/** The relationship-goal label, or null when nothing is chosen. */
function labelForGoal(value) {
  if (!value) return null
  return RELATIONSHIP_GOALS.find((goal) => goal.value === value)?.label ?? value
}
