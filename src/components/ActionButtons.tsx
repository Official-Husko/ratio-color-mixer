import type { FeedbackKind } from '../types'
import { pillButton } from '../styles'
import { Icon } from './ui/Icon'

interface ActionButtonsProps {
  feedback: FeedbackKind
  onCopyRecipe: () => void
  onDownloadImage: () => void
  onShare: () => void
}

function buttonStyle(active: boolean) {
  return {
    ...pillButton,
    color: active ? 'var(--accent)' : '#b0b0b0',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
  }
}

export function ActionButtons({ feedback, onCopyRecipe, onDownloadImage, onShare }: ActionButtonsProps) {
  const recipeActive = feedback === 'recipe'
  const imageActive = feedback === 'image'
  const linkActive = feedback === 'link'

  return (
    <div style={{ display: 'flex', gap: 10, marginTop: 20, flexWrap: 'wrap' }}>
      <button
        type="button"
        onClick={onCopyRecipe}
        class={`action-btn${recipeActive ? ' feedback-pop' : ''}`}
        style={buttonStyle(recipeActive)}
      >
        <Icon name={recipeActive ? 'check' : 'copy'} />
        {recipeActive ? 'Copied!' : 'Copy recipe'}
      </button>
      <button
        type="button"
        onClick={onDownloadImage}
        class={`action-btn${imageActive ? ' feedback-pop' : ''}`}
        style={buttonStyle(imageActive)}
      >
        <Icon name={imageActive ? 'check' : 'download'} />
        {imageActive ? 'Saved!' : 'Download image'}
      </button>
      <button
        type="button"
        onClick={onShare}
        class={`action-btn${linkActive ? ' feedback-pop' : ''}`}
        style={buttonStyle(linkActive)}
      >
        <Icon name={linkActive ? 'check' : 'share-nodes'} />
        {linkActive ? 'Link copied' : 'Share'}
      </button>
    </div>
  )
}
