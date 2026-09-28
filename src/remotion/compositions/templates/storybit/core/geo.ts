/**
 * World geography for the map templates (MP-*).
 *
 * Borders follow India's official view — the way Google Maps shows them to users in India:
 * all of Jammu & Kashmir and Ladakh (incl. Gilgit-Baltistan and Aksai Chin) and Arunachal Pradesh
 * are drawn inside India. Source: Natural Earth 1:10m "admin 0 countries — India point of view"
 * (public domain), simplified to 7% and stored as TopoJSON in world-india-view.json (~370 KB).
 *   pnpm add d3-geo topojson-client
 */
import { feature } from 'topojson-client';
import type { Feature, FeatureCollection, Geometry } from 'geojson';
import world from './world-india-view.json';

export type CountryFeature = Feature<Geometry, { name: string; iso: string; continent: string; subregion: string; wb: string }>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const topo = world as any;
const base = feature(topo, topo.objects.countries) as unknown as FeatureCollection<Geometry, CountryFeature['properties']>;
const overrides = new Map<string, CountryFeature>();

/** Replace one country's outline (only needed for custom boundaries). */
export function setCountryShape(name: string, shape: Feature<Geometry> | Geometry) {
  const f = ('type' in shape && shape.type === 'Feature' ? shape : { type: 'Feature', geometry: shape, properties: {} }) as CountryFeature;
  const key = name.toLowerCase();
  const orig = base.features.find((x) => x.properties.name.toLowerCase() === key);
  overrides.set(key, { ...f, properties: { ...(orig?.properties ?? { iso: '', continent: '', subregion: '', wb: '' }), name: orig?.properties.name ?? name } });
}

let cache: CountryFeature[] | null = null;
let cacheSize = -1;
export function countries(): CountryFeature[] {
  if (!cache || cacheSize !== overrides.size) {
    cache = base.features.map((f) => overrides.get(f.properties.name.toLowerCase()) ?? f);
    cacheSize = overrides.size;
  }
  return cache;
}

const ALIASES: Record<string, string> = {
  usa: 'united states of america',
  us: 'united states of america',
  'united states': 'united states of america',
  america: 'united states of america',
  uk: 'united kingdom',
  britain: 'united kingdom',
  uae: 'united arab emirates',
  bharat: 'india',
  'south korea': 'south korea',
  korea: 'south korea',
  'north korea': 'north korea',
  czechia: 'czechia',
  burma: 'myanmar',
};

/** Country by English name, common alias, or ISO-3 code ("IND"). */
export function findCountry(name?: string): CountryFeature | undefined {
  if (!name) return undefined;
  const k = name.trim().toLowerCase();
  const want = ALIASES[k] ?? k;
  return countries().find((f) => f.properties.name.toLowerCase() === want || f.properties.iso.toLowerCase() === want);
}

export const KM_PER_DEG = 111.32;

/** Larger regions that are not in the data as such: lists of ISO-3 codes. */
const GROUPS: Record<string, string[]> = {
  'middle east': ['SAU', 'ARE', 'QAT', 'KWT', 'BHR', 'OMN', 'YEM', 'IRQ', 'IRN', 'JOR', 'SYR', 'LBN', 'ISR', 'PSX', 'TUR', 'EGY'],
  gulf: ['SAU', 'ARE', 'QAT', 'KWT', 'BHR', 'OMN'],
  'gulf countries': ['SAU', 'ARE', 'QAT', 'KWT', 'BHR', 'OMN'],
  saarc: ['IND', 'PAK', 'BGD', 'NPL', 'BTN', 'LKA', 'MDV', 'AFG'],
  'indian subcontinent': ['IND', 'PAK', 'BGD', 'NPL', 'BTN', 'LKA'],
  asean: ['IDN', 'MYS', 'SGP', 'THA', 'PHL', 'VNM', 'MMR', 'KHM', 'LAO', 'BRN'],
  'european union': ['AUT', 'BEL', 'BGR', 'HRV', 'CYP', 'CZE', 'DNK', 'EST', 'FIN', 'FRA', 'DEU', 'GRC', 'HUN', 'IRL', 'ITA', 'LVA', 'LTU', 'LUX', 'MLT', 'NLD', 'POL', 'PRT', 'ROU', 'SVK', 'SVN', 'ESP', 'SWE'],
  eu: ['AUT', 'BEL', 'BGR', 'HRV', 'CYP', 'CZE', 'DNK', 'EST', 'FIN', 'FRA', 'DEU', 'GRC', 'HUN', 'IRL', 'ITA', 'LVA', 'LTU', 'LUX', 'MLT', 'NLD', 'POL', 'PRT', 'ROU', 'SVK', 'SVN', 'ESP', 'SWE'],
  scandinavia: ['NOR', 'SWE', 'DNK'],
};
const REGION_ALIASES: Record<string, string> = {
  'south asia': 'southern asia',
  'southeast asia': 'south-eastern asia',
  'south east asia': 'south-eastern asia',
  'east asia': 'eastern asia',
  'west asia': 'western asia',
  'north africa': 'northern africa',
  'east africa': 'eastern africa',
  'west africa': 'western africa',
  'central africa': 'middle africa',
  'western europe': 'western europe',
  'eastern europe': 'eastern europe',
  'north america': 'north america',
  'south america': 'south america',
  'latin america': 'latin america & caribbean',
  australasia: 'australia and new zealand',
};

/**
 * Countries for a region name: a single country (name / alias / ISO-3), a continent ("Africa"),
 * a UN sub-region ("Southern Asia", "Western Europe"), a World Bank region ("Middle East & North Africa")
 * or a common group ("Middle East", "Gulf", "SAARC", "ASEAN", "EU", "Scandinavia").
 */
export function findRegion(name?: string): CountryFeature[] {
  if (!name || !name.trim()) return [];
  const one = findCountry(name);
  if (one) return [one];
  const k0 = name.trim().toLowerCase();
  const k = REGION_ALIASES[k0] ?? k0;
  const group = GROUPS[k];
  if (group && group.length) return countries().filter((f) => group.includes(f.properties.iso));
  return countries().filter(
    (f) => f.properties.continent.toLowerCase() === k || f.properties.subregion.toLowerCase() === k || f.properties.wb.toLowerCase() === k,
  );
}
