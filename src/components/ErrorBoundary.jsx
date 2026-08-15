import React from 'react'

function isFrench() {
  try {
    return window.localStorage.getItem('athargps_lang') === 'fr'
  } catch {
    return false
  }
}

function currentRoute() {
  try {
    return window.location.pathname || '/'
  } catch {
    return '/'
  }
}

const CHUNK_RELOAD_KEY = 'athargps_chunk_reload_attempt'

function isChunkLoadError(error) {
  const text = String(error?.message || error || '').toLowerCase()
  return error?.name === 'ChunkLoadError'
    || text.includes('failed to fetch dynamically imported module')
    || text.includes('importing a module script failed')
    || text.includes('loading chunk')
}

export default class ErrorBoundary extends React.Component {
  state = { hasError: false, route: '/' }

  componentDidMount() {
    try { window.sessionStorage.removeItem(CHUNK_RELOAD_KEY) } catch {}
  }

  static getDerivedStateFromError() {
    return { hasError: true, route: currentRoute() }
  }

  componentDidCatch(error, errorInfo) {
    console.error('Athar GPS render error', error, errorInfo)
    if (isChunkLoadError(error)) {
      try {
        if (!window.sessionStorage.getItem(CHUNK_RELOAD_KEY)) {
          window.sessionStorage.setItem(CHUNK_RELOAD_KEY, '1')
          window.location.reload()
        }
      } catch {}
    }
  }

  handleRetry = () => {
    this.setState(state => ({
      hasError: false,
      route: currentRoute(),
    }))
  }

  render() {
    if (!this.state.hasError) return this.props.children

    const fr = isFrench()
    const route = this.state.route || currentRoute()
    return (
      <main
        dir={fr ? 'ltr' : 'rtl'}
        style={{
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          padding: 24,
          background: '#07111f',
          color: '#edf4f2',
          fontFamily: 'Cairo, Arial, sans-serif',
          textAlign: 'center',
        }}
      >
        <section style={{ maxWidth: 420 }}>
          <div style={{ fontSize: 42, marginBottom: 16 }} aria-hidden="true">!</div>
          <h1 style={{ margin: '0 0 10px', fontSize: 22, fontWeight: 800 }}>
            {fr ? 'Une erreur inattendue' : 'حدث خطأ غير متوقع'}
          </h1>
          <p style={{ margin: '0 0 22px', color: 'rgba(237,244,242,.66)', lineHeight: 1.8 }}>
            {fr
              ? 'Réessayez pour reprendre votre session.'
              : 'أعد المحاولة للمتابعة.'}
          </p>
          <p
            dir="ltr"
            style={{
              margin: '0 0 22px',
              color: 'rgba(237,244,242,.48)',
              fontSize: 12,
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
            }}
          >
            {fr ? 'Route' : 'المسار'}: {route}
          </p>
          <button
            type="button"
            onClick={this.handleRetry}
            style={{
              border: 0,
              borderRadius: 12,
              padding: '12px 22px',
              background: '#38d39f',
              color: '#07111f',
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            {fr ? 'Réessayer' : 'إعادة المحاولة'}
          </button>
        </section>
      </main>
    )
  }
}