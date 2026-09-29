'use client';

/**
 * Storybit template lookup by exact backend `animation_type`.
 * Overlay taxonomy names stay in taxonomyVisuals — similar names are not aliases
 * (`fs_title_card` ≠ `full_screen_title_card`, `vo_lower_third` ≠ `lower_third`).
 */
import { Component, type ComponentType, type ReactNode } from 'react';
import type { TemplateProps } from '../../types';

import { FS01TitleCard } from './storybit/FS01TitleCard';
import { FS03TitleMetadata } from './storybit/FS03TitleMetadata';
import { FS04BigNumber } from './storybit/FS04BigNumber';
import { FS06NumberComparison } from './storybit/FS06NumberComparison';
import { FS08QuoteCard } from './storybit/FS08QuoteCard';
import { FS11KeyStatement } from './storybit/FS11KeyStatement';
import { FS14StructuredList } from './storybit/FS14StructuredList';
import { FS20ComparisonColumns } from './storybit/FS20ComparisonColumns';
import { DV01BarChart } from './storybit/DV01BarChart';
import { DV04LineChart } from './storybit/DV04LineChart';
import { DV08PieDonut } from './storybit/DV08PieDonut';
import { DV12Gauge } from './storybit/DV12Gauge';
import { DV14Leaderboard } from './storybit/DV14Leaderboard';
import { DV27IconArray } from './storybit/DV27IconArray';
import { TL02Timeline } from './storybit/TL02Timeline';
import { TL11Roadmap } from './storybit/TL11Roadmap';
import { DG01LinearProcess } from './storybit/DG01LinearProcess';
import { DG05Relationship } from './storybit/DG05Relationship';
import { DG09DecisionTree } from './storybit/DG09DecisionTree';
import { DG10Funnel } from './storybit/DG10Funnel';
import { DG14Hierarchy } from './storybit/DG14Hierarchy';
import { DG17Architecture } from './storybit/DG17Architecture';
import { DG23ProsCons } from './storybit/DG23ProsCons';
import { DG24VsFaceOff } from './storybit/DG24VsFaceOff';
import { DG25MythFact } from './storybit/DG25MythFact';
import { PE01PersonIntro } from './storybit/PE01PersonIntro';
import { PE10ProfileCard } from './storybit/PE10ProfileCard';
import { VO01ImageCaption } from './storybit/VO01ImageCaption';
import { VO06ImageGrid } from './storybit/VO06ImageGrid';
import { VO07ImageMontage } from './storybit/VO07ImageMontage';
import { VO10BeforeAfter } from './storybit/VO10BeforeAfter';
import { VO12LocationTag } from './storybit/VO12LocationTag';
import { VO16LowerThird } from './storybit/VO16LowerThird';
import { VO19StatOverlay } from './storybit/VO19StatOverlay';
import { VO21Callout } from './storybit/VO21Callout';
import { VO29SourceCitation } from './storybit/VO29SourceCitation';
import { KT02PunchWord } from './storybit/KT02PunchWord';
import { KT03StackedText } from './storybit/KT03StackedText';
import { KT08QuestionHook } from './storybit/KT08QuestionHook';
import { KT10Captions } from './storybit/KT10Captions';
import { NV01ChapterCard } from './storybit/NV01ChapterCard';
import { NV04RankReveal } from './storybit/NV04RankReveal';
import { NV05SubscribeReminder } from './storybit/NV05SubscribeReminder';
import { NV07EndScreen } from './storybit/NV07EndScreen';
import { UI01SocialPost } from './storybit/UI01SocialPost';
import { UI04ChatConversation } from './storybit/UI04ChatConversation';
import { UI06NewsHeadline } from './storybit/UI06NewsHeadline';
import { UI07NewspaperClipping } from './storybit/UI07NewspaperClipping';
import { UI08SearchBar } from './storybit/UI08SearchBar';
import { UI12NotificationPop } from './storybit/UI12NotificationPop';
import { DC01DocumentHighlight } from './storybit/DC01DocumentHighlight';
import { DC04InvestigationBoard } from './storybit/DC04InvestigationBoard';
import { DC05CaseFile } from './storybit/DC05CaseFile';
import { DC08ArchivePhoto } from './storybit/DC08ArchivePhoto';
import { DC09StickyNotes } from './storybit/DC09StickyNotes';
import { MP11GlobeZoom } from './storybit/MP11GlobeZoom';
import { MP12RadiusRange } from './storybit/MP12RadiusRange';
import { MP13TravelRoute } from './storybit/MP13TravelRoute';
import { EM04ScribbleAnnotation } from './storybit/EM04ScribbleAnnotation';
import { HC02FloatingCard } from './storybit/HC02FloatingCard';

export const TEMPLATE_RENDERERS: Record<string, ComponentType<TemplateProps>> = {
  fs_title_card: FS01TitleCard,
  fs_title_metadata: FS03TitleMetadata,
  fs_big_number: FS04BigNumber,
  fs_number_comparison: FS06NumberComparison,
  fs_quote_card: FS08QuoteCard,
  fs_key_statement: FS11KeyStatement,
  fs_structured_list: FS14StructuredList,
  fs_comparison_columns: FS20ComparisonColumns,
  dv_bar_chart: DV01BarChart,
  dv_line_chart: DV04LineChart,
  dv_pie_donut: DV08PieDonut,
  dv_gauge: DV12Gauge,
  dv_leaderboard: DV14Leaderboard,
  dv_icon_array: DV27IconArray,
  tl_timeline: TL02Timeline,
  tl_roadmap: TL11Roadmap,
  dg_linear_process: DG01LinearProcess,
  dg_relationship: DG05Relationship,
  dg_decision_tree: DG09DecisionTree,
  dg_funnel: DG10Funnel,
  dg_hierarchy: DG14Hierarchy,
  dg_architecture: DG17Architecture,
  dg_pros_cons: DG23ProsCons,
  dg_vs_faceoff: DG24VsFaceOff,
  dg_myth_fact: DG25MythFact,
  pe_person_intro: PE01PersonIntro,
  pe_profile_card: PE10ProfileCard,
  vo_image_caption: VO01ImageCaption,
  vo_image_grid: VO06ImageGrid,
  vo_image_montage: VO07ImageMontage,
  vo_before_after: VO10BeforeAfter,
  vo_location_tag: VO12LocationTag,
  vo_lower_third: VO16LowerThird,
  vo_stat_overlay: VO19StatOverlay,
  vo_callout: VO21Callout,
  vo_source_citation: VO29SourceCitation,
  kt_punch_word: KT02PunchWord,
  kt_stacked_text: KT03StackedText,
  kt_question_hook: KT08QuestionHook,
  kt_captions: KT10Captions,
  nv_chapter_card: NV01ChapterCard,
  nv_rank_reveal: NV04RankReveal,
  nv_subscribe: NV05SubscribeReminder,
  nv_end_screen: NV07EndScreen,
  ui_social_post: UI01SocialPost,
  ui_chat: UI04ChatConversation,
  ui_news_headline: UI06NewsHeadline,
  ui_newspaper_clipping: UI07NewspaperClipping,
  ui_search_bar: UI08SearchBar,
  ui_notification: UI12NotificationPop,
  dc_document_highlight: DC01DocumentHighlight,
  dc_investigation_board: DC04InvestigationBoard,
  dc_case_file: DC05CaseFile,
  dc_archive_photo: DC08ArchivePhoto,
  dc_sticky_notes: DC09StickyNotes,
  mp_globe_zoom: MP11GlobeZoom,
  mp_radius_range: MP12RadiusRange,
  mp_travel_route: MP13TravelRoute,
  em_scribble: EM04ScribbleAnnotation,
  hc_floating_card: HC02FloatingCard,
};

export function getTemplateRenderer(type: string): ComponentType<TemplateProps> | undefined {
  return TEMPLATE_RENDERERS[type];
}

export class TemplateErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (this.state.failed) return null;
    return this.props.children;
  }
}
