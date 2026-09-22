'use client';

import type { ComponentType } from 'react';
import type { TemplateProps } from '../../types';
import { BarChart } from './charts/BarChart';
import { LineChart } from './charts/LineChart';
import { PieChart } from './charts/PieChart';
import { DonutChart } from './charts/DonutChart';
import { AreaChart } from './charts/AreaChart';
import { ProgressBars } from './charts/ProgressBars';
import { StatCounter } from './charts/StatCounter';
import { ComparisonChart } from './charts/ComparisonChart';
import { CircularProgress } from './charts/CircularProgress';
import { AnimatedText } from './text/AnimatedText';
import { BounceText } from './text/BounceText';
import { BubblePopText } from './text/BubblePopText';
import { FloatingTextChip } from './text/FloatingTextChip';
import { GlitchText } from './text/GlitchText';
import { PoppingScaleText } from './text/PoppingScaleText';
import { PulsingText } from './text/PulsingText';
import { SlideText } from './text/SlideText';
import { TypewriterSubtitle } from './text/TypewriterSubtitle';
import { AnimatedList } from './content/AnimatedList';
import { CardFlip } from './content/CardFlip';
import { CountdownTimer } from './content/CountdownTimer';
import { NotificationPop } from './content/NotificationPop';
import { ParticleExplosion } from './content/ParticleExplosion';
import { ProgressSteps } from './content/ProgressSteps';
import { RotatingCarousel } from './content/RotatingCarousel';
import { SoundWave } from './content/SoundWave';
import { TextHighlight } from './content/TextHighlight';
import {
  BokehCircles,
  GeometricPatterns,
  GradientShift,
  GridPulse,
  LiquidWave,
  MatrixRain,
  NoiseGrain,
  PixelTransition,
  Starfield,
} from './backgrounds/Backgrounds';
import {
  CameraShake,
  FilmBurn,
  KenBurns,
  LetterboxReveal,
  ParallaxPan,
  SpotlightReveal,
  VignettePulse,
  WhipPan,
  ZoomPulse,
} from './cinematic/Cinematic';
import {
  BlindsTransition,
  ClockWipe,
  CrossDissolve,
  FadeThroughBlack,
  IrisTransition,
  MorphTransition,
  PushTransition,
  SlideWipe,
  ZoomThrough,
} from './transitions/Transitions';
import {
  LogoBlurReveal,
  LogoBounceDrop,
  LogoFadeReveal,
  LogoGlitchReveal,
  LogoScaleRotate,
  LogoSpinReveal,
  LogoSplitReveal,
  LogoStrokeDraw,
  LogoTypewriter,
} from './branding/LogoReveal';
import {
  ChapterTitle,
  CinematicTitleIntro,
  CountdownIntro,
  CreditsRoll,
  EndCard,
  IntroLowerThird,
  QuoteCardIntro,
  SubscribeReminder,
  TitleSplit,
} from './intro/Intros';
import {
  GalleryGrid,
  ImageCarousel,
  ImageComparisonSlider,
  ImageZoomReveal,
  MasonryGallery,
  PhotoStack,
  PictureInPicture,
  PolaroidFrame,
  SplitScreen,
} from './media/Media';
import {
  ChartAnimation,
  FloatingBubbleText,
  FullScreenTransition,
  ImagePip,
  KenBurnsPanZoom,
  ParallaxLayering,
  PipVideo,
  PoppingText,
  QuoteCardTemplate,
  ShakeImpact,
  SplitScreenPanels,
} from './unique/UniqueNames';

export const TEMPLATE_RENDERERS: Record<string, ComponentType<TemplateProps>> = {
  bar_chart: BarChart,
  chart_animation: ChartAnimation,
  line_chart: LineChart,
  pie_chart: PieChart,
  donut_chart: DonutChart,
  area_chart: AreaChart,
  progress_bars: ProgressBars,
  stat_counter: StatCounter,
  comparison_chart: ComparisonChart,
  circular_progress: CircularProgress,
  animated_text: AnimatedText,
  bounce_text: BounceText,
  bubble_pop_text: BubblePopText,
  floating_text_chip: FloatingTextChip,
  floating_bubble_text: FloatingBubbleText,
  glitch_text: GlitchText,
  popping_scale_text: PoppingScaleText,
  popping_text: PoppingText,
  pulsing_text: PulsingText,
  slide_text: SlideText,
  typewriter_subtitle: TypewriterSubtitle,
  animated_list: AnimatedList,
  card_flip: CardFlip,
  countdown_timer: CountdownTimer,
  notification_pop: NotificationPop,
  particle_explosion: ParticleExplosion,
  progress_steps: ProgressSteps,
  rotating_carousel: RotatingCarousel,
  sound_wave: SoundWave,
  text_highlight: TextHighlight,
  bokeh_circles: BokehCircles,
  geometric_patterns: GeometricPatterns,
  gradient_shift: GradientShift,
  grid_pulse: GridPulse,
  liquid_wave: LiquidWave,
  matrix_rain: MatrixRain,
  noise_grain: NoiseGrain,
  pixel_transition: PixelTransition,
  starfield: Starfield,
  camera_shake: CameraShake,
  film_burn: FilmBurn,
  ken_burns: KenBurns,
  ken_burns_pan_zoom: KenBurnsPanZoom,
  letterbox_reveal: LetterboxReveal,
  parallax_pan: ParallaxPan,
  parallax_layering: ParallaxLayering,
  spotlight_reveal: SpotlightReveal,
  vignette_pulse: VignettePulse,
  whip_pan: WhipPan,
  zoom_pulse: ZoomPulse,
  shake_impact: ShakeImpact,
  blinds_transition: BlindsTransition,
  clock_wipe: ClockWipe,
  cross_dissolve: CrossDissolve,
  fade_through_black: FadeThroughBlack,
  iris_transition: IrisTransition,
  morph_transition: MorphTransition,
  push_transition: PushTransition,
  slide_wipe: SlideWipe,
  zoom_through: ZoomThrough,
  full_screen_transition: FullScreenTransition,
  logo_blur_reveal: LogoBlurReveal,
  logo_bounce_drop: LogoBounceDrop,
  logo_fade_reveal: LogoFadeReveal,
  logo_glitch_reveal: LogoGlitchReveal,
  logo_scale_rotate: LogoScaleRotate,
  logo_spin_reveal: LogoSpinReveal,
  logo_split_reveal: LogoSplitReveal,
  logo_stroke_draw: LogoStrokeDraw,
  logo_typewriter: LogoTypewriter,
  chapter_title: ChapterTitle,
  cinematic_title_intro: CinematicTitleIntro,
  countdown_intro: CountdownIntro,
  credits_roll: CreditsRoll,
  end_card: EndCard,
  intro_lower_third: IntroLowerThird,
  intro_quote_card: QuoteCardIntro,
  quote_card: QuoteCardTemplate,
  subscribe_reminder: SubscribeReminder,
  title_split: TitleSplit,
  gallery_grid: GalleryGrid,
  image_carousel: ImageCarousel,
  image_comparison_slider: ImageComparisonSlider,
  image_zoom_reveal: ImageZoomReveal,
  masonry_gallery: MasonryGallery,
  photo_stack: PhotoStack,
  picture_in_picture: PictureInPicture,
  image_pip: ImagePip,
  polaroid_frame: PolaroidFrame,
  split_screen: SplitScreenPanels,
  image_split_screen: SplitScreen,
  pip_video: PipVideo,
};
