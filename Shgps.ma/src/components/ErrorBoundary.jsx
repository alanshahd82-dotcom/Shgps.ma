import React from 'react'

function isFrench() {
  try {
    return window.localStorage.getItem('athargps_lang') === 'fr'
  } catch {
    return false
  }
}

export default class ErrorBoundary extends React.Component {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, errorInfo) {
    console.error('Athar GPS render error', error, errorInfo)
  }

  handleReload = () => {
    window.location.reload()
  }

  render() {
    if (!this.state.hasError) return this.props.children

    const fr = isFrench()
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
              ? 'Rechargez la page pour reprendre votre session.'
              : 'أعد تحميل الصفحة للمتابعة.'}
          </p>
          <button
            type="button"
            onClick={this.handleReload}
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
            {fr ? 'Recharger' : 'إعادة تحميل'}
          </button>
        </section>
      </main>
    )
  }
}