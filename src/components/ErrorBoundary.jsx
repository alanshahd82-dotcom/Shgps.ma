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

function formatErrorDetails(error, errorInfo, route) {
  const name = error?.name || 'Error'
  const message = error?.message || String(error || 'Unknown error')
  const stack = String(error?.stack || `${name}: ${message}`)
    .split('\n')
    .slice(0, 8)
    .join('\n')
  const componentStack = String(errorInfo?.componentStack || '')
    .split('\n')
    .filter(Boolean)
    .slice(0, 8)
    .join('\n')

  return [
    `route: ${route}`,
    `name: ${name}`,
    `message: ${message}`,
    '',
    'stack:',
    stack,
    componentStack ? `\ncomponent stack:\n${componentStack}` : '',
  ].filter(Boolean).join('\n')
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
  state = { hasError: false, route: '/', error: null, errorInfo: null }

  componentDidMount() {
    try { window.sessionStorage.removeItem(CHUNK_RELOAD_KEY) } catch {}
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, route: currentRoute(), error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('Athar GPS render error', {
      route: currentRoute(),
      name: error?.name,
      message: error?.message,
      stack: error?.stack,
      componentStack: errorInfo?.componentStack,
    })
    this.setState({ error, errorInfo })
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
      error: null,
      errorInfo: null,
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
          <details open dir="ltr" style={{ margin: '0 auto 22px', textAlign: 'left' }}>
            <summary style={{ cursor: 'pointer', marginBottom: 8 }}>
              {fr ? 'Error details for diagnosis' : 'تفاصيل الخطأ للتشخيص'}
            </summary>
            <pre
              style={{
                maxHeight: 260,
                overflow: 'auto',
                margin: 0,
                padding: 12,
                borderRadius: 10,
                color: '#ffd7d7',
                background: 'rgba(0,0,0,.35)',
                fontSize: 10,
                lineHeight: 1.5,
                whiteSpace: 'pre-wrap',
                overflowWrap: 'anywhere',
              }}
            >
              {formatErrorDetails(this.state.error, this.state.errorInfo, route)}
            </pre>
          </details>
          <button
            type="button"
            onClick={this.handleRetry}
            style={{
              border: 0,
              borderRadius: 12,
              padding: '12px 22px',
              background: '#38bdf8',
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