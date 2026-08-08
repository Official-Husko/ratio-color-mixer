import { useMixerState } from './hooks/useMixerState'
import { Header } from './components/Header'
import { PresetsCard } from './components/PresetsCard'
import { YourColorsCard } from './components/YourColorsCard'
import { TargetColorCard } from './components/TargetColorCard'
import { EstimatedMixCard } from './components/EstimatedMixCard'
import { Footer } from './components/Footer'

export function App() {
  const {
    colors,
    target,
    image,
    totalMl,
    unitMode,
    volumeUnit,
    feedback,
    isSharing,
    shareCodeStatus,
    sharedLinkUrl,
    viewModel,
    actions,
  } = useMixerState()

  return (
    <div>
      <Header />

      {shareCodeStatus && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 13,
            padding: '10px 14px',
            borderRadius: 10,
            marginBottom: 20,
            background: shareCodeStatus === 'error' ? 'rgba(224,129,125,0.12)' : 'rgba(125,224,201,0.12)',
            color: shareCodeStatus === 'error' ? '#e0817d' : 'var(--accent)',
          }}
        >
          {shareCodeStatus === 'loading'
            ? 'Loading shared palette…'
            : "This share link has expired or no longer exists, so we're showing your last palette instead."}
        </div>
      )}

      <div class="main-grid" style={{ display: 'grid', alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24, minWidth: 0 }}>
          <PresetsCard onAdd={actions.addPreset} />
          <YourColorsCard
            colors={colors}
            canSimplify={viewModel.canSimplify}
            colorCountLabel={viewModel.colorCountLabel}
            onCustomColorPicked={actions.addCustomColor}
            onSimplify={actions.simplifyMix}
            onClearAll={actions.clearAllColors}
            onUpdateHex={actions.updateColorHex}
            onUpdateName={actions.updateColorName}
            onRemove={actions.removeColor}
          />
          <TargetColorCard
            target={target}
            targetRgb={viewModel.targetRgb}
            image={image}
            onTargetChange={actions.setTarget}
            onImageUpload={actions.uploadImage}
            onImageSample={actions.sampleImageAt}
            onImageRemove={actions.removeImage}
          />
        </div>

        <EstimatedMixCard
          vm={viewModel}
          target={target}
          totalMl={totalMl}
          unitMode={unitMode}
          volumeUnit={volumeUnit}
          feedback={feedback}
          isSharing={isSharing}
          sharedLinkUrl={sharedLinkUrl}
          onVolumeChange={actions.setTotalMl}
          onSetUnitMode={actions.setUnitMode}
          onSetVolumeUnit={actions.setVolumeUnit}
          onCopyRecipe={actions.copyRecipe}
          onDownloadImage={actions.downloadImage}
          onShare={actions.copyShareLink}
          onDismissSharedLink={actions.dismissSharedLink}
        />
      </div>

      <Footer />
    </div>
  )
}
