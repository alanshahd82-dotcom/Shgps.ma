import React from 'react'

// Safety net for one page: if a screen crashes, the rest of the app (menus,
// navigation) keeps working and the user can retry or move to another page.
// It resets by itself when the route changes. It does not replace fixing the
// cause of a crash; the technical details stay in the browser console.
export default class PageBoundary extends React.Component {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, info) {
    console.error('Athar GPS page error', {
      route: typeof window !== 'undefined' ? window.location.pathname : '',
      name: error?.name,
      message: error?.message,
      componentStack: info?.componentStack,
    })
  }

  componentDidUpdate(prev) {
    if (this.state.hasError && prev.resetKey !== this.props.resetKey) this.setState({ hasError: false })
  }

  render() {
    if (!this.state.hasError) return this.props.children
    const fr = this.props.lang === 'fr'
    return (
      <div role="alert" dir={fr ? 'ltr' : 'rtl'} className="mx-auto my-10 max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
        <p className="text-base font-extrabold text-slate-900">{fr ? "Cette page n'a pas pu s'afficher" : 'تعذّر عرض هذه الصفحة'}</p>
        <p className="mt-2 text-sm text-slate-500">{fr ? 'Vos données sont intactes. Réessayez ou ouvrez une autre page.' : 'بياناتك سليمة. أعد المحاولة أو افتح صفحة أخرى.'}</p>
        <button type="button" onClick={() => this.setState({ hasError: false })} className="mt-4 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white">
          {fr ? 'Réessayer' : 'إعادة المحاولة'}
        </button>
      </div>
    )
  }
}
