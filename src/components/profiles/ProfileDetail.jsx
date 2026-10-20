/**
 * Someone else's profile, rendered in full.
 *
 * Takes a `PublicProfileSerializer` payload verbatim — the match detail
 * page and the public profile page both hand it that shape, so there is
 * one layout rather than two that drift.
 *
 * ## Structure
 *
 * A portrait header, then tabs. The header answers "who is this and what
 * do they want" in one screenful; everything that needs reading sits
 * behind a tab. The summary strip under the header is the compromise: it
 * shows that About, Interests and Lifestyle each have something in them
 * without making the visitor scroll three sections to find out.
 *
 * ## What this component is careful about
 *
 * * **Location.** It renders `distance_label` and `approximate_location`,
 *   never a coordinate. The server jitters the pin and buckets the
 *   distance precisely so a client cannot reconstruct the exact point;
 *   rendering `distance_km` with more precision than the label would undo
 *   that, so the label is what is shown — and the jittered pin is used
 *   only to label the city it falls in, never to draw a map.
 * * **Absent fields.** Almost everything here is optional, and a blank row
 *   labelled "Occupation:" reads as a bug. Each section is dropped
 *   entirely when it has no content, and a tab with nothing behind it is
 *   not offered at all.
 * * **Verification.** `is_verified` is the server's own verdict from an
 *   approved review. Nothing else in this file may produce that badge.
 *
 * ## Prompts
 *
 * `prompts` is a JSONField of `{question, answer}` with no id, so the
 * index is the only stable key available. That is safe here because the
 * list is read-only and never reordered in place.
 */

import { useState } from 'react'

import { PhotoGrid } from './PhotoGrid'
import { Avatar } from '../ui/Avatar'
import { Badge, PresenceDot, VerifiedBadge } from '../ui/Badge'
import { TabPanel, Tabs } from '../ui/Tabs'
import { ACTIVITY_LABELS, GENDERS, RELATIONSHIP_GOALS } from '../../utils/constants'
import { formatHeight, formatTimeAgo } from '../../utils/format'

/** A labelled row. Renders nothing at all when the value is empty. */
function DetailRow({ label, value }) {
  if (value == null || value === '' || (Array.isArray(value) && value.length === 0)) {
    return null
  }
  return (
    <div className="flex gap-3 py-2">
      <dt className="w-32 shrink-0 text-sm text-slate-500 dark:text-slate-400">
        {label}
      </dt>
      <dd className="text-sm text-slate-800 dark:text-slate-200">{value}</dd>
    </div>
  )
}

/** A card with a heading. Dropped entirely when it would be empty. */
function Section({ title, description, children, className = '' }) {
  if (!children) return null
  return (
    <section className={`card p-5 ${className}`}>
      <h2 className="heading-section">{title}</h2>
      {description ? (
        <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
          {description}
        </p>
      ) : null}
      <div className="mt-3">{children}</div>
    </section>
  )
}

/** A one-line preview of a tab's contents, for the summary strip. */
function SummaryItem({ label, value, onOpen }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex min-w-0 flex-1 flex-col items-start gap-0.5 rounded-xl px-3 py-2 text-left transition-colors hover:bg-sand-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:hover:bg-sand-800"
    >
      <span className="eyebrow">{label}</span>
      <span className="w-full truncate text-sm text-slate-700 dark:text-slate-300">
        {value}
      </span>
    </button>
  )
}

function labelFor(options, value) {
  return options.find((option) => option.value === value)?.label ?? value
}

/** The largest photo available, preferring the primary. */
function heroPhotoFor(profile, photos) {
  const primary = profile.primary_photo
  if (primary?.url) return primary
  return photos[0] ?? null
}

export function ProfileDetail({ profile, className = '' }) {
  const [tab, setTab] = useState('photos')

  if (!profile) return null

  const photos = profile.photos ?? []
  const interests = profile.interests ?? []
  const prompts = Array.isArray(profile.prompts) ? profile.prompts : []
  const languages = Array.isArray(profile.languages) ? profile.languages : []

  const hero = heroPhotoFor(profile, photos)

  const lifestyle = [
    ['Drinking', profile.drinking],
    ['Smoking', profile.smoking],
    ['Exercise', profile.exercise],
    ['Pets', profile.pets],
    ['Children', profile.children],
  ].filter(([, value]) => value)

  // The About tab carries the narrative fields; `looking_for` is its own
  // thing (a sentence in the member's words) so it is kept distinct from
  // `relationship_goal`, which is a choice from a fixed list.
  const aboutRows = [
    ['Looking for', labelFor(RELATIONSHIP_GOALS, profile.relationship_goal)],
    ['Interested in', profile.looking_for],
    ['Gender', labelFor(GENDERS, profile.gender)],
    ['Pronouns', profile.pronouns],
    ['Height', profile.height_cm ? formatHeight(profile.height_cm) : null],
    ['Occupation', profile.occupation],
    ['Company', profile.company],
    ['Education', profile.education],
    ['Activity', ACTIVITY_LABELS[profile.activity_level] ?? null],
  ].filter(([, value]) => value)

  const hasAbout = Boolean(profile.bio) || aboutRows.length > 0 || prompts.length > 0
  const hasLifestyle = lifestyle.length > 0 || languages.length > 0

  // Only tabs with content are offered. An empty tab is a promise the page
  // cannot keep, and on this page it is the first thing a visitor clicks.
  //
  // Photos is the exception, and is always present: it is the anchor tab, so
  // a profile with nothing filled in still renders *something* — the grid's
  // own empty state — rather than a header over blank space.
  const tabs = [
    { value: 'photos', label: 'Photos', count: photos.length || null },
    hasAbout ? { value: 'about', label: 'About' } : null,
    interests.length > 0
      ? { value: 'interests', label: 'Interests', count: interests.length }
      : null,
    hasLifestyle ? { value: 'lifestyle', label: 'Lifestyle' } : null,
  ].filter(Boolean)

  // The active tab has to survive the default being absent — a profile whose
  // only other sections are empty would otherwise open on a tab that is not
  // in the list.
  const activeTab = tabs.some((item) => item.value === tab) ? tab : tabs[0]?.value

  const intent = labelFor(RELATIONSHIP_GOALS, profile.relationship_goal)
  const location = [profile.city, profile.country && profile.country !== profile.city ? profile.country : null]
    .filter(Boolean)
    .join(', ')

  return (
    <div className={`space-y-5 ${className}`}>
      {/* ── Portrait header ──────────────────────────────────────── */}
      <header className="card overflow-hidden">
        <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-start">
          {/*
            A portrait, not a banner. A fixed-ratio block that object-covers
            whatever the member uploaded keeps the layout stable without
            cropping a face out of frame the way a wide hero does.
          */}
          <div className="mx-auto w-40 shrink-0 sm:mx-0 sm:w-48">
            {hero?.url ? (
              <img
                src={hero.url}
                alt={`${profile.name}'s photo`}
                className="aspect-[4/5] w-full rounded-2xl object-cover"
              />
            ) : (
              <div className="flex aspect-[4/5] w-full items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800">
                <Avatar name={profile.name} size="2xl" />
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <h1 className="heading-display">
                {profile.name}
                {profile.age ? (
                  <span className="font-normal text-slate-500 dark:text-slate-400">
                    , {profile.age}
                  </span>
                ) : null}
              </h1>
              {profile.is_verified ? <VerifiedBadge size="md" /> : null}
            </div>

            {profile.headline ? (
              <p className="mt-1 text-base font-medium text-slate-700 dark:text-slate-300">
                {profile.headline}
              </p>
            ) : null}

            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500 dark:text-slate-400">
              {location ? <span>{location}</span> : null}
              {/* Only ever the bucket label — see the note at the top. */}
              {profile.distance_label ? (
                <span>· {profile.distance_label}</span>
              ) : null}
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              {/* Intent is the one thing a dating profile has to state. */}
              {intent ? <Badge tone="brand">{intent}</Badge> : null}
              {profile.is_online != null ? (
                <PresenceDot isOnline={profile.is_online} showLabel />
              ) : null}
              {profile.last_active_at ? (
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  Active {formatTimeAgo(profile.last_active_at)}
                </span>
              ) : null}
            </div>
          </div>
        </div>

        {tabs.length > 1 ? (
          <div className="flex divide-x divide-sand-200 border-t border-sand-200 px-2 dark:divide-sand-800 dark:border-sand-800">
            {tabs.some((item) => item.value === 'about') ? (
              <SummaryItem
                label="About"
                value={profile.bio || aboutRows[0]?.[1] || '—'}
                onOpen={() => setTab('about')}
              />
            ) : null}
            {interests.length > 0 ? (
              <SummaryItem
                label="Interests"
                value={interests
                  .slice(0, 3)
                  .map((interest) => interest.name)
                  .join(' · ')}
                onOpen={() => setTab('interests')}
              />
            ) : null}
            {hasLifestyle ? (
              <SummaryItem
                label="Lifestyle"
                value={lifestyle[0]?.[1] ?? languages[0] ?? '—'}
                onOpen={() => setTab('lifestyle')}
              />
            ) : null}
          </div>
        ) : null}
      </header>

      {/* ── Tabs ─────────────────────────────────────────────────── */}
      {tabs.length > 1 ? (
        <Tabs
          tabs={tabs}
          value={activeTab}
          onChange={setTab}
          ariaLabel={`${profile.name}'s profile sections`}
        />
      ) : null}

      <TabPanel tabValue="photos" value={activeTab}>
        <Section title="Photos">
          <PhotoGrid
            photos={photos}
            name={profile.name}
            emptyTitle="No photos yet"
            emptyDescription={`${profile.name} has not added any photos.`}
          />
        </Section>
      </TabPanel>

      <TabPanel tabValue="about" value={activeTab}>
        <div className="space-y-5">
          {profile.bio ? (
            <Section title="About">
              <p className="whitespace-pre-line text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                {profile.bio}
              </p>
            </Section>
          ) : null}

          {aboutRows.length > 0 ? (
            <Section title="Details">
              <dl className="divide-y divide-sand-100 dark:divide-sand-800">
                {aboutRows.map(([label, value]) => (
                  <DetailRow key={label} label={label} value={value} />
                ))}
              </dl>
            </Section>
          ) : null}

          {prompts.length > 0 ? (
            <Section title="In their own words">
              <div className="space-y-3">
                {prompts.map((prompt, index) => (
                  <div
                    // No id on a prompt — see the note at the top of the file.
                    key={index}
                    className="rounded-xl border border-sand-200 p-3 dark:border-sand-800"
                  >
                    <p className="eyebrow">
                      {prompt.question ?? prompt.prompt ?? prompt.title}
                    </p>
                    <p className="mt-1 text-sm text-slate-800 dark:text-slate-200">
                      {prompt.answer ?? prompt.body ?? prompt.text}
                    </p>
                  </div>
                ))}
              </div>
            </Section>
          ) : null}
        </div>
      </TabPanel>

      <TabPanel tabValue="interests" value={activeTab}>
        <Section
          title="Interests"
          description="Shared interests carry the most weight in a match score."
        >
          <div className="flex flex-wrap gap-2">
            {interests.map((interest) => (
              <Badge key={interest.id} tone="neutral">
                {interest.name}
              </Badge>
            ))}
          </div>
        </Section>
      </TabPanel>

      <TabPanel tabValue="lifestyle" value={activeTab}>
        <Section title="Lifestyle">
          <dl className="divide-y divide-sand-100 dark:divide-sand-800">
            {lifestyle.map(([label, value]) => (
              <DetailRow key={label} label={label} value={value} />
            ))}
            <DetailRow label="Languages" value={languages.join(', ')} />
          </dl>
        </Section>
      </TabPanel>
    </div>
  )
}
