import { Link } from 'react-router-dom'

import { useAuth } from '../context/AuthContext'

export function NotFoundPage() {
  const { isAuthenticated } = useAuth()

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <p className="text-6xl font-bold text-slate-300 dark:text-slate-700">404</p>
      <h1 className="heading-display">
        This page does not exist
      </h1>
      <p className="max-w-sm text-sm text-slate-500 dark:text-slate-400">
        The link may be broken, or the page may have been moved.
      </p>
      <Link to={isAuthenticated ? '/app' : '/login'} className="btn-primary mt-2">
        {isAuthenticated ? 'Back to the dashboard' : 'Go to sign in'}
      </Link>
    </div>
  )
}
