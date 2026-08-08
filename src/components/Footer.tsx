import { GITHUB_URL } from '../lib/constants'
import { Icon } from './ui/Icon'

export function Footer() {
  return (
    <footer
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
        marginTop: 48,
        paddingTop: 20,
        borderTop: '1px solid var(--divider)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Icon name="lock" style={{ color: 'var(--text-muted)' }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            100% client-side: nothing you enter is ever sent to a server.*
          </span>
          <span style={{ fontSize: 8, color: 'var(--text-faint)' }}>
            *The only exception is Share Link, which stores that one palette on our server for 30 days.{' '}
            <a href="/privacy.html" class="footer-text-link" style={{ color: 'var(--text-muted)', textDecoration: 'underline' }}>
              Privacy
            </a>
          </span>
        </div>
      </div>

      {GITHUB_URL && (
        <a
          href={GITHUB_URL}
          target="_blank"
          rel="noreferrer"
          class="footer-icon-link"
          aria-label="View source on GitHub"
          style={{ color: 'var(--text-muted)', fontSize: 18, display: 'flex', textDecoration: 'none' }}
        >
          <Icon name="github" brand />
        </a>
      )}
    </footer>
  )
}
