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
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          fontSize: 12,
          color: 'var(--text-muted)',
        }}
      >
        <Icon name="lock" />
        100% client-side — nothing you enter is ever sent to a server.
      </div>

      {GITHUB_URL && (
        <a
          href={GITHUB_URL}
          target="_blank"
          rel="noreferrer"
          class="footer-icon-link"
          aria-label="View source on GitHub"
          style={{ color: 'var(--text-muted)', fontSize: 18, display: 'flex' }}
        >
          <Icon name="github" brand />
        </a>
      )}
    </footer>
  )
}
