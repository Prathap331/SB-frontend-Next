/**
 * Loads every font (17 families) the Storybit templates can use (Google Fonts via @remotion/google-fonts).
 * Call once at the top of your Remotion entry (Root.tsx) — text measuring needs the fonts loaded.
 *   npm i @remotion/google-fonts@4.0.513
 */
import { loadFont as poppins } from '@remotion/google-fonts/Poppins';
import { loadFont as inter } from '@remotion/google-fonts/Inter';
import { loadFont as montserrat } from '@remotion/google-fonts/Montserrat';
import { loadFont as dmSans } from '@remotion/google-fonts/DMSans';
import { loadFont as spaceGrotesk } from '@remotion/google-fonts/SpaceGrotesk';
import { loadFont as oswald } from '@remotion/google-fonts/Oswald';
import { loadFont as bebasNeue } from '@remotion/google-fonts/BebasNeue';
import { loadFont as playfair } from '@remotion/google-fonts/PlayfairDisplay';
import { loadFont as robotoSlab } from '@remotion/google-fonts/RobotoSlab';
import { loadFont as lora } from '@remotion/google-fonts/Lora';
import { loadFont as baloo2 } from '@remotion/google-fonts/Baloo2';
import { loadFont as mukta } from '@remotion/google-fonts/Mukta';
import { loadFont as hind } from '@remotion/google-fonts/Hind';
import { loadFont as kalam } from '@remotion/google-fonts/Kalam';
import { loadFont as notoDevanagari } from '@remotion/google-fonts/NotoSansDevanagari';
import { loadFont as notoTelugu } from '@remotion/google-fonts/NotoSansTelugu';
import { loadFont as notoTamil } from '@remotion/google-fonts/NotoSansTamil';

export function loadStorybitFonts(): Promise<unknown> {
  const all = [
    poppins('normal', { weights: ['500', '600', '700', '800'] }),
    inter('normal', { weights: ['500', '600', '700', '800'] }),
    montserrat('normal', { weights: ['500', '600', '700', '800'] }),
    dmSans('normal', { weights: ['500', '600', '700', '800'] }),
    spaceGrotesk('normal', { weights: ['500', '600', '700'] }),
    oswald('normal', { weights: ['500', '600', '700'] }),
    bebasNeue('normal', { weights: ['400'] }),
    playfair('normal', { weights: ['500', '600', '700', '800'] }),
    robotoSlab('normal', { weights: ['500', '600', '700', '800'] }),
    lora('normal', { weights: ['500', '600', '700'] }),
    baloo2('normal', { weights: ['500', '600', '700', '800'] }),
    mukta('normal', { weights: ['500', '600', '700', '800'] }),
    hind('normal', { weights: ['500', '600', '700'] }),
    kalam('normal', { weights: ['400', '700'] }),
    notoDevanagari('normal', { weights: ['500', '600', '700', '800'] }),
    notoTelugu('normal', { weights: ['500', '600', '700', '800'] }),
    notoTamil('normal', { weights: ['500', '600', '700', '800'] }),
  ];
  return Promise.all(all.map((f) => f.waitUntilDone()));
}
