/**
 * Safety centre.
 *
 * The moderation app has `Report` and `Block` models with real
 * constraints — a unique block per pair, a no-self-block check, a
 * symmetric-effect lookup — but `moderation/urls.py` is still
 * `urlpatterns = []`. So there is no blocked list to read and no report
 * to file.
 *
 * That makes this page **the one place in the app where the honest answer
 * is uncomfortable**, because safety is not a nice-to-have. So rather than
 * a generic "coming soon", this page does two things:
 *
 * * It gives real, actionable guidance that works *today* — the guidance
 *   is not dependent on an endpoint existing.
 * * It is explicit that reporting and blocking are not wired up yet, so
 *   nobody is left believing they filed a report that does not exist.
 *
 * The guidance below is deliberately conservative and non-specific about
 * legal process, because that varies by jurisdiction and this app has no
 * compliance review behind it yet.
 */

import { Link } from 'react-router-dom'

import { ComingSoon } from '../../components/ui/ComingSoon'

const TIPS = [
  {
    title: 'Keep conversations in the app',
    body: 'Scammers push for WhatsApp, Telegram or email quickly, because those conversations cannot be reviewed if something goes wrong. There is no reason to move off-platform before you have met.',
  },
  {
    title: 'Never send money',
    body: 'No genuine match needs money for a visa, a flight, a medical bill or a crypto investment. This is the single most common fraud on dating apps and it always follows the same script.',
  },
  {
    title: 'Video chat before meeting',
    body: 'A short video call confirms the person is who their photos say. Someone who repeatedly avoids one is worth a second thought.',
  },
  {
    title: 'Meet somewhere public, and tell someone',
    body: 'First meetings belong in a public place. Tell a friend where you are going and when you expect to be back, and arrange your own transport there and home.',
  },
  {
    title: 'Guard identifying details',
    body: 'Your address, workplace, and daily routine are not first-date conversation. This app never shares your exact location, and you should not either.',
  },
  {
    title: 'Trust the pattern, not the excuse',
    body: 'One odd message is nothing. A pattern of pressure, guilt, secrecy or anger when you set a boundary is the thing to act on.',
  },
]

export function SafetyPage() {
  return (
    <div className="mx-auto max-w-narrow space-y-5">
      <header>
        <h1 className="heading-display">
          Safety centre
        </h1>
        <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
          How to protect yourself, and what to do if something goes wrong.
        </p>
      </header>

      <ComingSoon
        title="Reporting and blocking are not available yet"
        description="The moderation API has not been built, so there is currently no way to file a report or block someone from inside the app. The Report and Block tables exist and the discovery and chat queries already filter on them — but nothing can write to them yet."
        items={[
          'Report a user, with a reason and evidence',
          'Your blocked list, with unblock',
          'Report status, so you can see it was reviewed',
        ]}
        action={
          <Link to="/app/settings" className="btn-secondary">
            Account settings
          </Link>
        }
      />

      <section className="card p-5">
        <h2 className="heading-section">
          Staying safe
        </h2>
        <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
          None of this depends on the features above — it works today.
        </p>

        <div className="mt-4 space-y-4">
          {TIPS.map((tip) => (
            <div
              key={tip.title}
              className="border-l-2 border-brand-200 pl-4 dark:border-brand-900"
            >
              <h3 className="heading-section">
                {tip.title}
              </h3>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                {tip.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="card p-5">
        <h2 className="heading-section">
          If you are in immediate danger
        </h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          Contact your local emergency services first. This app cannot reach
          them for you, and nothing here is a substitute for doing that.
        </p>
        <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">
          For anything that is not an emergency but involves a crime — fraud,
          threats, or images shared without consent — your local police
          non-emergency line is the right place to report it. Keep the
          messages: this app cannot currently export a conversation for you,
          so screenshots are the practical option until it can.
        </p>
      </section>

      <section className="card p-5">
        <h2 className="heading-section">
          What this app does to protect you
        </h2>
        <ul className="mt-3 space-y-2 text-sm text-slate-600 dark:text-slate-400">
          <li>
            <strong className="font-medium text-slate-800 dark:text-slate-200">
              Your exact location is never exposed.
            </strong>{' '}
            Other people see a city and an approximate distance bucket, and a
            jittered map pin — never a coordinate.
          </li>
          <li>
            <strong className="font-medium text-slate-800 dark:text-slate-200">
              Photos are stripped of metadata.
            </strong>{' '}
            Every upload is re-encoded, which discards the GPS coordinates a
            phone camera writes into the file.
          </li>
          <li>
            <strong className="font-medium text-slate-800 dark:text-slate-200">
              Uploads are validated and reviewed.
            </strong>{' '}
            File type and size are checked, and photos are moderated before
            they appear on your profile.
          </li>
          <li>
            <strong className="font-medium text-slate-800 dark:text-slate-200">
              You control your visibility.
            </strong>{' '}
            Hide your profile, go incognito, or restrict it to your matches —
            under Settings.
          </li>
        </ul>
      </section>
    </div>
  )
}
