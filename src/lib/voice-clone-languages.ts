/**
 * Voice-clone recording languages and native-script prompts.
 *
 * Supported set: 10 global languages plus 10 Indian languages. Script translation
 * derives its list from this one (see script-languages.ts), so both stay in step.
 */

export type VoiceCloneLanguage = {
  code: string;
  name: string;
  prompt: string;
};

export const VOICE_CLONE_LANGUAGES: VoiceCloneLanguage[] = [
  {
    code: "en",
    name: "English",
    prompt: "Nothing compares to the joy of hearing my child laugh. It bubbles up from deep inside them, pure and honest. In those moments, all my worries fade away, replaced by a happiness that fills every part of me. It's the sound of perfect love.",
  },
  {
    code: "ja",
    name: "Japanese",
    prompt: "我が子の笑い声を聞く喜びに勝るものはありません。その笑い声は心の奥底から湧き上がる、純粋で偽りのないものです。そんな瞬間には、私の心配事はすべて消え去り、その代わりに私の全身を満たす幸福が広がります。それは、完璧な愛の響きです。",
  },
  {
    code: "zh",
    name: "Chinese",
    prompt: "没有什么能比得上听见孩子笑声时的喜悦。那笑声发自内心深处，纯真而真诚。在那一刻，我所有的烦恼都会烟消云散，取而代之的是一种充盈全身的幸福感。那是完美的爱的声音。",
  },
  {
    code: "ar",
    name: "Arabic",
    prompt: "لا شيء يضاهي فرحة سماع ضحكة طفلي. فهي تنبع من أعماقه، صافية وصادقة. في تلك اللحظات، تتلاشى كل مخاوفي، ويحل محلها شعور بالسعادة يملأ كياني كله. إنه صوت الحب الكامل.",
  },
  {
    code: "fr",
    name: "French",
    prompt: "Rien ne peut égaler la joie d’entendre mon enfant rire. Ce rire jaillit du plus profond de lui, pur et sincère. Dans ces moments-là, tous mes soucis s’effacent, remplacés par un bonheur qui me remplit tout entier. C’est le son de l’amour parfait.",
  },
  {
    code: "de",
    name: "German",
    prompt: "Nichts ist mit der Freude vergleichbar, mein Kind lachen zu hören. Dieses Lachen kommt tief aus seinem Inneren, rein und ehrlich. In diesen Momenten verschwinden all meine Sorgen und werden durch ein Glück ersetzt, das mich ganz erfüllt. Es ist der Klang vollkommener Liebe.",
  },
  {
    code: "ko",
    name: "Korean",
    prompt: "내 아이가 웃는 소리를 듣는 기쁨과 비교할 수 있는 것은 아무것도 없습니다. 그 웃음은 아이의 마음 깊은 곳에서 우러나오는, 순수하고 진실한 웃음입니다. 그런 순간에는 내 모든 걱정이 사라지고, 그 자리를 나를 온전히 채우는 행복이 대신합니다. 그것은 완전한 사랑의 소리입니다.",
  },
  {
    code: "pt",
    name: "Portuguese",
    prompt: "Nada se compara à alegria de ouvir meu filho rir. Essa risada vem do mais profundo de seu ser, pura e sincera. Nesses momentos, todas as minhas preocupações desaparecem, substituídas por uma felicidade que me preenche por inteiro. É o som do amor perfeito.",
  },
  {
    code: "ru",
    name: "Russian",
    prompt: "Ничто не сравнится с радостью слышать смех моего ребёнка. Этот смех идёт из самой глубины его души — чистый и искренний. В такие моменты все мои тревоги исчезают, а на их место приходит счастье, которое наполняет меня целиком. Это звук совершенной любви.",
  },
  {
    code: "es",
    name: "Spanish",
    prompt: "Nada se compara con la alegría de escuchar reír a mi hijo. Esa risa brota de lo más profundo de su ser, pura y sincera. En esos momentos, todas mis preocupaciones se desvanecen y son reemplazadas por una felicidad que me llena por completo. Es el sonido del amor perfecto.",
  },
  {
    code: "hi",
    name: "Hindi",
    prompt: "अपने बच्चे की हँसी सुनने की खुशी का कोई मुकाबला नहीं है। वह हँसी उसके भीतर की गहराइयों से उठती है—बिल्कुल निर्मल और सच्ची। उन पलों में मेरी सारी चिंताएँ जैसे कहीं खो जाती हैं और उनकी जगह ऐसी खुशी भर जाती है, जो मेरे भीतर के हर हिस्से को भर देती है। यह पूर्ण प्रेम की आवाज़ है।",
  },
  {
    code: "bn",
    name: "Bengali",
    prompt: "আমার সন্তানের হাসি শোনার আনন্দের সঙ্গে কোনো কিছুরই তুলনা হয় না। সেই হাসি তার একেবারে অন্তরের গভীর থেকে উঠে আসে—নির্মল ও অকৃত্রিম। সেই মুহূর্তগুলোতে আমার সব দুশ্চিন্তা মিলিয়ে যায়, আর তার জায়গায় এমন এক সুখ এসে আমাকে ভরিয়ে দেয়, যা আমার সত্তার প্রতিটি অংশকে পূর্ণ করে। এ যেন পরিপূর্ণ ভালোবাসার শব্দ।",
  },
  {
    code: "ta",
    name: "Tamil",
    prompt: "என் குழந்தையின் சிரிப்பைக் கேட்பதால் கிடைக்கும் மகிழ்ச்சிக்கு ஈடேதும் இல்லை. அந்தச் சிரிப்பு அதன் உள்ளத்தின் ஆழத்திலிருந்து தூய்மையாகவும் உண்மையாகவும் பொங்கி வருகிறது. அந்தத் தருணங்களில் என் கவலைகள் அனைத்தும் மறைந்து, அவற்றுக்குப் பதிலாக என்னை முழுவதுமாக நிரப்பும் பேரானந்தம் வந்து நிறைகிறது. அது நிறைவான அன்பின் ஒலி.",
  },
  {
    code: "te",
    name: "Telugu",
    prompt: "నా బిడ్డ నవ్వు వినే ఆనందానికి ఏదీ సాటిరాదు. ఆ నవ్వు వారి హృదయంలోని లోతుల్లో నుంచి ఎంతో స్వచ్ఛంగా, నిజాయితీగా పొంగి వస్తుంది. ఆ క్షణాల్లో నా ఆందోళనలన్నీ మాయమైపోతాయి; వాటి స్థానంలో నన్ను పూర్తిగా నింపే ఆనందం వచ్చి చేరుతుంది. అది పరిపూర్ణమైన ప్రేమ యొక్క స్వరం.",
  },
  {
    code: "gu",
    name: "Gujarati",
    prompt: "મારા બાળકનું હસવું સાંભળવાનો આનંદ કોઈ પણ વસ્તુ સાથે સરખાવી શકાય તેમ નથી. એ હાસ્ય તેના અંતરના ઊંડાણમાંથી, એકદમ નિર્મળ અને નિખાલસ રીતે ફૂટે છે. એ પળોમાં મારી બધી ચિંતાઓ ઓગળી જાય છે અને તેમની જગ્યાએ એવી ખુશી આવે છે જે મારા અસ્તિત્વના દરેક અંશને ભરી દે છે. એ સંપૂર્ણ પ્રેમનો અવાજ છે.",
  },
  {
    code: "kn",
    name: "Kannada",
    prompt: "ನನ್ನ ಮಗುವಿನ ನಗುವನ್ನು ಕೇಳುವ ಸಂತೋಷಕ್ಕೆ ಯಾವುದೂ ಸಾಟಿಯಿಲ್ಲ. ಆ ನಗು ಅದರ ಅಂತರಾಳದ ಆಳದಿಂದ ಹೊರಹೊಮ್ಮುತ್ತದೆ—ನಿರ್ಮಲವೂ ನಿಷ್ಕಪಟವೂ ಆಗಿ. ಆ ಕ್ಷಣಗಳಲ್ಲಿ ನನ್ನ ಎಲ್ಲ ಚಿಂತೆಗಳು ಮಾಯವಾಗುತ್ತವೆ; ಅವುಗಳ ಜಾಗದಲ್ಲಿ ನನ್ನ ಅಸ್ತಿತ್ವದ ಪ್ರತಿಯೊಂದು ಭಾಗವನ್ನೂ ತುಂಬುವ ಸಂತೋಷ ಮೂಡುತ್ತದೆ. ಅದು ಪರಿಪೂರ್ಣ ಪ್ರೀತಿಯ ಧ್ವನಿ.",
  },
  {
    code: "ml",
    name: "Malayalam",
    prompt: "എന്റെ കുഞ്ഞിന്റെ ചിരി കേൾക്കുന്നതിലെ സന്തോഷത്തോട് മറ്റൊന്നിനും താരതമ്യം ചെയ്യാനാവില്ല. ആ ചിരി അവന്റെ ഉള്ളിന്റെ ആഴങ്ങളിൽ നിന്ന് പൊട്ടിപ്പുറപ്പെടുന്നതാണ്—തികച്ചും നിർമ്മലവും ആത്മാർത്ഥവുമാണ്. ആ നിമിഷങ്ങളിൽ എന്റെ എല്ലാ ആശങ്കകളും അലിഞ്ഞുപോകുന്നു; അവയുടെ സ്ഥാനത്ത് എന്നെ മുഴുവനായും നിറയ്ക്കുന്ന സന്തോഷം എത്തുന്നു. അത് പരിപൂർണ്ണമായ സ്നേഹത്തിന്റെ ശബ്ദമാണ്.",
  },
  {
    code: "mr",
    name: "Marathi",
    prompt: "माझ्या मुलाचं हसणं ऐकण्याच्या आनंदाची कशाशीच तुलना होऊ शकत नाही. ते हसू त्याच्या अंतःकरणाच्या अगदी खोलातून उमटतं—निर्मळ आणि मनापासून. त्या क्षणी माझ्या सगळ्या चिंता विरून जातात आणि त्यांच्या जागी अशी प्रसन्नता भरून येते, जी माझ्या अस्तित्वाचा प्रत्येक भाग आनंदाने भरून टाकते. तो परिपूर्ण प्रेमाचा आवाज असतो.",
  },
  {
    code: "pa",
    name: "Punjabi",
    prompt: "ਮੇਰੇ ਬੱਚੇ ਦੀ ਹਾਸੀ ਸੁਣਨ ਦੀ ਖੁਸ਼ੀ ਨਾਲ ਕਿਸੇ ਵੀ ਚੀਜ਼ ਦੀ ਤੁਲਨਾ ਨਹੀਂ ਹੋ ਸਕਦੀ। ਉਹ ਹਾਸਾ ਉਸਦੇ ਦਿਲ ਦੀਆਂ ਗਹਿਰਾਈਆਂ ਤੋਂ ਉੱਭਰਦਾ ਹੈ—ਬਿਲਕੁਲ ਪਵਿੱਤਰ ਤੇ ਸੱਚਾ। ਉਹਨਾਂ ਪਲਾਂ ਵਿੱਚ ਮੇਰੀਆਂ ਸਾਰੀਆਂ ਚਿੰਤਾਵਾਂ ਦੂਰ ਹੋ ਜਾਂਦੀਆਂ ਹਨ ਅਤੇ ਉਨ੍ਹਾਂ ਦੀ ਥਾਂ ਇੱਕ ਐਸੀ ਖੁਸ਼ੀ ਆ ਜਾਂਦੀ ਹੈ ਜੋ ਮੇਰੇ ਅੰਦਰ ਦੇ ਹਰ ਹਿੱਸੇ ਨੂੰ ਭਰ ਦਿੰਦੀ ਹੈ। ਇਹ ਪੂਰਨ ਪਿਆਰ ਦੀ ਆਵਾਜ਼ ਹੈ।",
  },
  {
    code: "or",
    name: "Odia",
    prompt: "ମୋ ପିଲାର ହସ ଶୁଣିବାର ଆନନ୍ଦ ସହିତ କିଛି ବି ତୁଳନୀୟ ନୁହେଁ। ସେହି ହସ ତା’ର ଅନ୍ତରର ଗଭୀରତାରୁ ଫୁଟି ଆସେ—ନିର୍ମଳ ଓ ସତ୍ୟ। ସେହି ମୁହୂର୍ତ୍ତଗୁଡ଼ିକରେ ମୋର ସମସ୍ତ ଚିନ୍ତା ଦୂର ହୋଇଯାଏ ଏବଂ ତାହାର ସ୍ଥାନରେ ଏମିତି ଏକ ସୁଖ ଆସେ, ଯାହା ମୋର ପ୍ରତ୍ୟେକ ଅଂଶକୁ ପୂର୍ଣ୍ଣ କରିଦିଏ। ଏହା ସଂପୂର୍ଣ୍ଣ ଭଲପାଇବାର ସ୍ୱର।",
  },
];

const VOICE_CLONE_LANGUAGE_BY_CODE = new Map(
  VOICE_CLONE_LANGUAGES.map((lang) => [lang.code, lang]),
);

export function getVoiceCloneLanguage(code: string | null | undefined): VoiceCloneLanguage | undefined {
  if (!code) return undefined;
  return VOICE_CLONE_LANGUAGE_BY_CODE.get(code);
}

const RTL_VOICE_CLONE_CODES = new Set(['ar']);

export function isVoiceCloneRtl(code: string | null | undefined): boolean {
  return !!code && RTL_VOICE_CLONE_CODES.has(code);
}

