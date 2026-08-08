import { useMixerState } from './hooks/useMixerState'
import { Header } from './components/Header'
import { PresetsCard } from './components/PresetsCard'
import { YourColorsCard } from './components/YourColorsCard'
import { TargetColorCard } from './components/TargetColorCard'
import { EstimatedMixCard } from './components/EstimatedMixCard'
import { Footer } from './components/Footer'

export function App() {
  const { colors, target, image, totalMl, unitMode, feedback, viewModel, actions } = useMixerState()

  return (
    <div>
      <Header />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: 28, alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
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
            targetRgbLabel={viewModel.targetRgbLabel}
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
          feedback={feedback}
          onVolumeChange={actions.setTotalMl}
          onSetUnitMode={actions.setUnitMode}
          onCopyRecipe={actions.copyRecipe}
          onDownloadImage={actions.downloadImage}
          onShare={actions.copyShareLink}
        />
      </div>

      <Footer />
    </div>
  )
}
