/** Voice-clone recording languages and native-script prompts. */

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
    code: "af",
    name: "Afrikaans",
    prompt: "Niks kan vergelyk word met die vreugde om my kind te hoor lag nie. Dit borrel diep uit hulle binneste op, suiwer en opreg. In daardie oomblikke verdwyn al my bekommernisse, en word dit vervang deur ’n geluk wat elke deel van my vul. Dit is die klank van volmaakte liefde.",
  },
  {
    code: "am",
    name: "Amharic",
    prompt: "ልጄ ሲስቅ መስማት ከሚሰጠኝ ደስታ ጋር የሚወዳደር ምንም የለም። ያ ሳቅ ከውስጡ ጥልቅ ቦታ የሚፈልቅ፣ ንጹሕና ከልብ የመጣ ነው። በእነዚያ ጊዜያት ጭንቀቶቼ ሁሉ ይጠፋሉ፤ በእነሱም ምትክ ልቤን ሙሉ በሙሉ የሚሞላ ደስታ ይመጣል። የፍጹም ፍቅር ድምፅ ነው።",
  },
  {
    code: "as",
    name: "Assamese",
    prompt: "মোৰ শিশুটিৰ হাঁহি শুনি পোৱা আনন্দৰ সৈতে একোৱেই তুলনা নহয়। সেই হাঁহি তাৰ অন্তৰৰ গভীৰতাৰ পৰা স্বতঃস্ফূৰ্তভাৱে ওলাই আহে—নিৰ্মল আৰু সঁচা। সেই মুহূৰ্তবোৰত মোৰ সকলো চিন্তা-ভাৱনা আঁতৰি যায়, আৰু তাৰ ঠাইত এনে এক সুখে মোক ভৰাই তোলে যি মোৰ সত্তাৰ প্ৰতিটো অংশ পূৰ্ণ কৰি দিয়ে। সেয়া যেন নিখুঁত ভালপোৱাৰ শব্দ।",
  },
  {
    code: "az",
    name: "Azerbaijani",
    prompt: "Heç nə uşağımın gülüşünü eşitmək sevincimlə müqayisə oluna bilməz. O gülüş onun daxilindən, dərinliklərdən, saf və səmimi şəkildə gəlir. Belə anlarda bütün qayğılarım yox olur və yerini bütün varlığımı dolduran bir xoşbəxtlik tutur. Bu, mükəmməl sevginin səsidir.",
  },
  {
    code: "be",
    name: "Belarusian",
    prompt: "Нішто не параўнаецца з радасцю чуць смех майго дзіцяці. Гэты смех уздымаецца з самай глыбіні яго душы — чысты і шчыры. У такія моманты ўсе мае клопаты знікаюць, а іх месца займае шчасце, якое напаўняе мяне цалкам. Гэта гук дасканалай любові.",
  },
  {
    code: "bg",
    name: "Bulgarian",
    prompt: "Нищо не може да се сравни с радостта да чуя как детето ми се смее. Този смях идва дълбоко отвътре — чист и искрен. В онези мигове всичките ми тревоги изчезват, а на тяхно място идва щастие, което изпълва всяка част от мен. Това е звукът на съвършената любов.",
  },
  {
    code: "bn",
    name: "Bengali",
    prompt: "আমার সন্তানের হাসি শোনার আনন্দের সঙ্গে কোনো কিছুরই তুলনা হয় না। সেই হাসি তার একেবারে অন্তরের গভীর থেকে উঠে আসে—নির্মল ও অকৃত্রিম। সেই মুহূর্তগুলোতে আমার সব দুশ্চিন্তা মিলিয়ে যায়, আর তার জায়গায় এমন এক সুখ এসে আমাকে ভরিয়ে দেয়, যা আমার সত্তার প্রতিটি অংশকে পূর্ণ করে। এ যেন পরিপূর্ণ ভালোবাসার শব্দ।",
  },
  {
    code: "bo",
    name: "Tibetan",
    prompt: "ངའི་ཕྲུ་གུའི་གད་མོ་ཐོས་པའི་དགའ་སྤྲོ་དང་འགྲན་ཐུབ་པ་གང་ཡང་མེད། གད་མོ་དེ་ཁོང་གི་སེམས་ཀྱི་གཏིང་ནས་འཕྱུར་བ་ཡིན་ཏེ། གཙང་མ་དང་དྲང་པོ་ཡིན། དེ་འདྲའི་སྐད་ཅིག་ཏུ་ངའི་སེམས་ཁྲལ་ཐམས་ཅད་ཡལ་ནས། དེའི་ཚབ་ཏུ་ང་ཡོངས་སུ་གང་བའི་བདེ་སྐྱིད་ཤོར་ཡོང་། དེ་ནི་ཕུན་སུམ་ཚོགས་པའི་བྱམས་པའི་སྒྲ་ཡིན།",
  },
  {
    code: "br",
    name: "Breton",
    prompt: "N’eus netra a c’hall keñveriañ gant al levenez da glevet va bugel o c’hoarzhin. Ar c’hoarzh-se a sav eus don e galon, glan ha gwirion. En amzerioù-se e treuzkuzh va prederioù holl, erlec’hiet gant ur laouenadenn a leun ac’hanon penn-da-benn. Setu son ar garantez peurvat.",
  },
  {
    code: "bs",
    name: "Bosnian",
    prompt: "Ništa se ne može porediti s radošću koju osjećam kada čujem svoje dijete kako se smije. Taj smijeh dolazi duboko iz njega, čist i iskren. U tim trenucima sve moje brige nestaju, a zamjenjuje ih sreća koja ispunjava svaki dio mene. To je zvuk savršene ljubavi.",
  },
  {
    code: "ca",
    name: "Catalan",
    prompt: "Res no es pot comparar amb l’alegria de sentir riure el meu fill. Aquest riure brolla del més profund del seu interior, pur i sincer. En aquells moments, totes les meves preocupacions s’esvaeixen i són substituïdes per una felicitat que m’omple per dins. És el so de l’amor perfecte.",
  },
  {
    code: "cs",
    name: "Czech",
    prompt: "Nic se nevyrovná radosti, kterou cítím, když slyším smích svého dítěte. Ten smích vychází z jeho nitra, čistý a upřímný. V těch chvílích všechny mé starosti mizí a nahrazuje je štěstí, které naplňuje celou mou bytost. Je to zvuk dokonalé lásky.",
  },
  {
    code: "cy",
    name: "Welsh",
    prompt: "Does dim byd yn cymharu â’r llawenydd o glywed fy mhlentyn yn chwerthin. Mae’r chwerthin hwnnw’n byrlymu o ddyfnderoedd ei galon, yn bur ac yn onest. Yn yr eiliadau hynny, mae fy holl bryderon yn diflannu, gan gael eu disodli gan hapusrwydd sy’n llenwi pob rhan ohonof. Dyna sain cariad perffaith.",
  },
  {
    code: "da",
    name: "Danish",
    prompt: "Intet kan måle sig med glæden ved at høre mit barn le. Latteren kommer helt indefra, ren og ærlig. I de øjeblikke forsvinder alle mine bekymringer og bliver erstattet af en lykke, der fylder hele mig. Det er lyden af perfekt kærlighed.",
  },
  {
    code: "el",
    name: "Greek",
    prompt: "Τίποτα δεν συγκρίνεται με τη χαρά του να ακούω το παιδί μου να γελά. Αυτό το γέλιο βγαίνει από τα βάθη της ψυχής του, καθαρό και αληθινό. Εκείνες τις στιγμές, όλες μου οι έγνοιες χάνονται και αντικαθίστανται από μια ευτυχία που γεμίζει κάθε κομμάτι μου. Είναι ο ήχος της τέλειας αγάπης.",
  },
  {
    code: "et",
    name: "Estonian",
    prompt: "Miski ei ole võrreldav rõõmuga, mida tunnen oma lapse naeru kuuldes. See naer tuleb sügavalt tema seest, puhas ja siiras. Neil hetkedel kaovad kõik mu mured ning nende asemele tuleb õnn, mis täidab mind täielikult. See on täiusliku armastuse heli.",
  },
  {
    code: "eu",
    name: "Basque",
    prompt: "Ez dago nire haurraren barrea entzuteak ematen didan pozarekin alderatzerik. Barre hori haren barru-barrutik sortzen da, garbi eta zintzo. Une horietan, nire kezka guztiak desagertu egiten dira, eta haien ordez ni barru-barrutik betetzen nauen zoriontasuna iristen da. Maitasun perfektuaren soinua da.",
  },
  {
    code: "fa",
    name: "Persian",
    prompt: "هیچ چیز با لذت شنیدن خندهٔ فرزندم برابری نمی‌کند. آن خنده از ژرفای وجودش می‌جوشد؛ پاک و صمیمی. در آن لحظه‌ها، همهٔ نگرانی‌هایم محو می‌شوند و جای خود را به شادی‌ای می‌دهند که تمام وجودم را پر می‌کند. این صدای عشق کامل است.",
  },
  {
    code: "fi",
    name: "Finnish",
    prompt: "Mikään ei vedä vertoja sille ilolle, jonka tunnen kuullessani lapseni nauravan. Nauru kumpuaa hänen syvältä sisältään, puhtaana ja vilpittömänä. Noina hetkinä kaikki huoleni katoavat, ja niiden tilalle tulee onnellisuus, joka täyttää minut kokonaan. Se on täydellisen rakkauden ääni.",
  },
  {
    code: "fo",
    name: "Faroese",
    prompt: "Einki kann samanberast við gleðina at hoyra barnið mítt læa. Látrið kemur djúpt inni frá, reint og ærligt. Í teimum løtunum hvørva allar áhyggjur mínar og verða avloystar av eini lukku, ið fyllir meg allan. Tað er ljóðið av fullkomnari kærleika.",
  },
  {
    code: "gl",
    name: "Galician",
    prompt: "Nada se pode comparar coa alegría de escoitar rir o meu fillo. Esa risa nace do máis profundo do seu ser, pura e sincera. Neses momentos, todas as miñas preocupacións desaparecen e son substituídas por unha felicidade que me enche por completo. É o son do amor perfecto.",
  },
  {
    code: "gu",
    name: "Gujarati",
    prompt: "મારા બાળકનું હસવું સાંભળવાનો આનંદ કોઈ પણ વસ્તુ સાથે સરખાવી શકાય તેમ નથી. એ હાસ્ય તેના અંતરના ઊંડાણમાંથી, એકદમ નિર્મળ અને નિખાલસ રીતે ફૂટે છે. એ પળોમાં મારી બધી ચિંતાઓ ઓગળી જાય છે અને તેમની જગ્યાએ એવી ખુશી આવે છે જે મારા અસ્તિત્વના દરેક અંશને ભરી દે છે. એ સંપૂર્ણ પ્રેમનો અવાજ છે.",
  },
  {
    code: "hi",
    name: "Hindi",
    prompt: "अपने बच्चे की हँसी सुनने की खुशी का कोई मुकाबला नहीं है। वह हँसी उसके भीतर की गहराइयों से उठती है—बिल्कुल निर्मल और सच्ची। उन पलों में मेरी सारी चिंताएँ जैसे कहीं खो जाती हैं और उनकी जगह ऐसी खुशी भर जाती है, जो मेरे भीतर के हर हिस्से को भर देती है। यह पूर्ण प्रेम की आवाज़ है।",
  },
  {
    code: "hr",
    name: "Croatian",
    prompt: "Ništa se ne može usporediti s radošću koju osjećam kada čujem svoje dijete kako se smije. Taj smijeh dolazi iz njegove dubine, čist i iskren. U tim trenucima sve moje brige nestaju, a zamjenjuje ih sreća koja ispunjava svaki dio mene. To je zvuk savršene ljubavi.",
  },
  {
    code: "ht",
    name: "Haitian Creole",
    prompt: "Pa gen anyen ki ka konpare ak kè kontan mwen santi lè m tande pitit mwen ri. Ri sa a soti byen fon nan li, li pwòp e li sensè. Nan moman sa yo, tout enkyetid mwen yo disparèt, epi yo ranplase ak yon kè kontan ki ranpli tout mwen. Se son lanmou pafè.",
  },
  {
    code: "hu",
    name: "Hungarian",
    prompt: "Semmi sem ér fel azzal az örömmel, amikor meghallom a gyermekem nevetését. Ez a nevetés a legmélyéről tör elő, tisztán és őszintén. Ezekben a pillanatokban minden aggodalmam eltűnik, és a helyét olyan boldogság veszi át, amely teljesen betölt. Ez a tökéletes szeretet hangja.",
  },
  {
    code: "hy",
    name: "Armenian",
    prompt: "Ոչինչ չի համեմատվում երեխայիս ծիծաղը լսելու ուրախության հետ։ Այդ ծիծաղը գալիս է նրա խորքից՝ մաքուր ու անկեղծ։ Այդ պահերին բոլոր հոգսերս անհետանում են, և դրանց փոխարինում է մի երջանկություն, որը լցնում է ինձ ամբողջությամբ։ Դա կատարյալ սիրո ձայնն է։",
  },
  {
    code: "id",
    name: "Indonesian",
    prompt: "Tak ada yang sebanding dengan kebahagiaan mendengar anakku tertawa. Tawa itu muncul dari lubuk hatinya, murni dan tulus. Pada saat-saat seperti itu, semua kekhawatiranku lenyap, digantikan kebahagiaan yang memenuhi seluruh diriku. Itulah suara cinta yang sempurna.",
  },
  {
    code: "is",
    name: "Icelandic",
    prompt: "Ekkert jafnast á við gleðina sem fylgir því að heyra barnið mitt hlæja. Hláturinn kemur djúpt innan frá, hreinn og einlægur. Á þeim augnablikum hverfa allar áhyggjur mínar og í staðinn kemur hamingja sem fyllir mig alla. Þetta er hljóð fullkominnar ástar.",
  },
  {
    code: "it",
    name: "Italian",
    prompt: "Niente è paragonabile alla gioia di sentire ridere mio figlio. Quella risata nasce dal profondo del suo essere, pura e sincera. In quei momenti tutte le mie preoccupazioni svaniscono, sostituite da una felicità che mi riempie completamente. È il suono dell’amore perfetto.",
  },
  {
    code: "he",
    name: "Hebrew",
    prompt: "אין דבר שמשתווה לשמחה שאני מרגיש כשאני שומע את הילד שלי צוחק. הצחוק הזה עולה מעומק ליבו, טהור וכן. ברגעים האלה כל הדאגות שלי נעלמות, ובמקומן מגיע אושר שממלא אותי כולי. זה הצליל של אהבה מושלמת.",
  },
  {
    code: "jw",
    name: "Javanese",
    prompt: "Ora ana sing bisa mbandhingake karo kabungahan nalika krungu anakku ngguyu. Guyune metu saka njero atine, resik lan tulus. Ing wektu-wektu kuwi, kabeh rasa kuwatirku ilang, diganti rasa seneng sing ngisi saben bagean saka awakku. Kuwi swarane katresnan sing sampurna.",
  },
  {
    code: "ka",
    name: "Georgian",
    prompt: "არაფერი შეედრება იმ სიხარულს, რომელსაც ჩემი შვილის სიცილის მოსმენა მანიჭებს. ეს სიცილი მისი შინაგანი სიღრმიდან ამოდის — სუფთა და გულწრფელი. ასეთ მომენტებში ყველა ჩემი საზრუნავი ქრება და მის ადგილს იკავებს ბედნიერება, რომელიც მთლიანად მავსებს. ეს სრულყოფილი სიყვარულის ხმაა.",
  },
  {
    code: "kk",
    name: "Kazakh",
    prompt: "Баланың күлкісін естуден асқан қуаныш жоқ. Ол күлкі оның ішкі тереңінен, таза әрі шынайы болып төгіледі. Сондай сәттерде барлық уайымым сейіліп, оның орнын бүкіл жанымды толтыратын бақыт басады. Бұл — мінсіз махаббаттың үні.",
  },
  {
    code: "km",
    name: "Khmer",
    prompt: "គ្មានអ្វីអាចប្រៀបផ្ទឹមនឹងសេចក្តីរីករាយនៃការឮសំណើចរបស់កូនខ្ញុំបានឡើយ។ សំណើចនោះផុសចេញពីជម្រៅក្នុងចិត្តរបស់គេ ដ៏បរិសុទ្ធ និងស្មោះត្រង់។ នៅក្នុងពេលវេលាទាំងនោះ កង្វល់របស់ខ្ញុំទាំងអស់រលាយបាត់ ហើយត្រូវបានជំនួសដោយសុភមង្គលដែលពេញដល់គ្រប់ផ្នែកនៃខ្ញុំ។ នោះគឺជាសំឡេងនៃសេចក្តីស្រឡាញ់ដ៏ល្អឥតខ្ចោះ។",
  },
  {
    code: "kn",
    name: "Kannada",
    prompt: "ನನ್ನ ಮಗುವಿನ ನಗುವನ್ನು ಕೇಳುವ ಸಂತೋಷಕ್ಕೆ ಯಾವುದೂ ಸಾಟಿಯಿಲ್ಲ. ಆ ನಗು ಅದರ ಅಂತರಾಳದ ಆಳದಿಂದ ಹೊರಹೊಮ್ಮುತ್ತದೆ—ನಿರ್ಮಲವೂ ನಿಷ್ಕಪಟವೂ ಆಗಿ. ಆ ಕ್ಷಣಗಳಲ್ಲಿ ನನ್ನ ಎಲ್ಲ ಚಿಂತೆಗಳು ಮಾಯವಾಗುತ್ತವೆ; ಅವುಗಳ ಜಾಗದಲ್ಲಿ ನನ್ನ ಅಸ್ತಿತ್ವದ ಪ್ರತಿಯೊಂದು ಭಾಗವನ್ನೂ ತುಂಬುವ ಸಂತೋಷ ಮೂಡುತ್ತದೆ. ಅದು ಪರಿಪೂರ್ಣ ಪ್ರೀತಿಯ ಧ್ವನಿ.",
  },
  {
    code: "la",
    name: "Latin",
    prompt: "Nihil cum gaudio comparari potest, quod filium meum ridentem audire sentio. Risus ille ex intimis eius partibus oritur, purus et sincerus. His momentis omnes curae meae evanescunt, earumque locum occupat felicitas quae totum me implet. Hic est sonus amoris perfecti.",
  },
  {
    code: "lt",
    name: "Lithuanian",
    prompt: "Niekas neprilygsta džiaugsmui girdėti savo vaiko juoką. Tas juokas kyla iš pačių jo gelmių – tyras ir nuoširdus. Tokiomis akimirkomis visi mano rūpesčiai išnyksta, o jų vietą užima laimė, pripildanti mane visą. Tai tobulos meilės garsas.",
  },
  {
    code: "lv",
    name: "Latvian",
    prompt: "Nekas nav salīdzināms ar prieku, ko jūtu, dzirdot savu bērnu smejamies. Šie smiekli nāk no viņa dziļākās būtības, tīri un patiesi. Šajos brīžos visas manas raizes izzūd, un to vietā nāk laime, kas piepilda mani visu. Tā ir pilnīgas mīlestības skaņa.",
  },
  {
    code: "mi",
    name: "Maori",
    prompt: "Kāore he mea e rite ki te harikoa o te rongo i taku tamaiti e kata ana. Ka pupū ake taua kata i roto tonu i a ia, he parakore, he pono. I aua wā, ka memeha katoa aku māharahara, ka whakakapia e te hari e kī ana i ahau katoa. Koia te tangi o te aroha tino pai.",
  },
  {
    code: "mk",
    name: "Macedonian",
    prompt: "Ништо не може да се спореди со радоста кога го слушам моето дете како се смее. Таа смеа доаѓа од длабочината на неговата душа, чиста и искрена. Во тие мигови сите мои грижи исчезнуваат, а на нивно место доаѓа среќа што ме исполнува целосно. Тоа е звукот на совршената љубов.",
  },
  {
    code: "ml",
    name: "Malayalam",
    prompt: "എന്റെ കുഞ്ഞിന്റെ ചിരി കേൾക്കുന്നതിലെ സന്തോഷത്തോട് മറ്റൊന്നിനും താരതമ്യം ചെയ്യാനാവില്ല. ആ ചിരി അവന്റെ ഉള്ളിന്റെ ആഴങ്ങളിൽ നിന്ന് പൊട്ടിപ്പുറപ്പെടുന്നതാണ്—തികച്ചും നിർമ്മലവും ആത്മാർത്ഥവുമാണ്. ആ നിമിഷങ്ങളിൽ എന്റെ എല്ലാ ആശങ്കകളും അലിഞ്ഞുപോകുന്നു; അവയുടെ സ്ഥാനത്ത് എന്നെ മുഴുവനായും നിറയ്ക്കുന്ന സന്തോഷം എത്തുന്നു. അത് പരിപൂർണ്ണമായ സ്നേഹത്തിന്റെ ശബ്ദമാണ്.",
  },
  {
    code: "mn",
    name: "Mongolian",
    prompt: "Хүүхдийнхээ инээдийг сонсох баяртай юуг ч зүйрлэшгүй. Тэр инээд хүүхдийн минь дотроос, сэтгэлийн гүнээс цэвэр ариун, чин сэтгэлээсээ оргилон гардаг. Тийм мөчүүдэд бүх санаа зовнил минь арилж, оронд нь намайг бүхэлд нь дүүргэх аз жаргал ирдэг. Энэ бол төгс хайрын дуу чимээ юм.",
  },
  {
    code: "mr",
    name: "Marathi",
    prompt: "माझ्या मुलाचं हसणं ऐकण्याच्या आनंदाची कशाशीच तुलना होऊ शकत नाही. ते हसू त्याच्या अंतःकरणाच्या अगदी खोलातून उमटतं—निर्मळ आणि मनापासून. त्या क्षणी माझ्या सगळ्या चिंता विरून जातात आणि त्यांच्या जागी अशी प्रसन्नता भरून येते, जी माझ्या अस्तित्वाचा प्रत्येक भाग आनंदाने भरून टाकते. तो परिपूर्ण प्रेमाचा आवाज असतो.",
  },
  {
    code: "ms",
    name: "Malay",
    prompt: "Tiada yang dapat menandingi kegembiraan mendengar anak saya ketawa. Ketawa itu lahir dari lubuk hatinya, suci dan tulus. Pada saat-saat itu, segala kebimbangan saya lenyap, digantikan dengan kebahagiaan yang memenuhi setiap bahagian diri saya. Itulah suara cinta yang sempurna.",
  },
  {
    code: "my",
    name: "Burmese",
    prompt: "ကလေးရဲ့ရယ်သံကို ကြားရတဲ့ပျော်ရွှင်မှုနဲ့ ဘာကိုမှ နှိုင်းယှဉ်လို့မရပါဘူး။ အဲဒီရယ်သံဟာ သူ့ရဲ့အတွင်းအကျဆုံးနေရာကနေ သန့်ရှင်းပြီး ရိုးသားစွာ ပေါ်ထွက်လာတာပါ။ အဲဒီအချိန်တွေမှာ ကျွန်တော့်ရဲ့စိုးရိမ်ပူပန်မှုတွေအားလုံး ပျောက်ကွယ်သွားပြီး ကျွန်တော့်တစ်ကိုယ်လုံးကို ဖြည့်ပေးတဲ့ ပျော်ရွှင်မှုနဲ့ အစားထိုးခံရပါတယ်။ အဲဒါဟာ ပြီးပြည့်စုံတဲ့အချစ်ရဲ့အသံပါ။",
  },
  {
    code: "ne",
    name: "Nepali",
    prompt: "आफ्नो बच्चाको हाँसो सुन्नुको आनन्दसँग कुनै पनि कुरा तुलना गर्न सकिँदैन। त्यो हाँसो उसको अन्तरमनको गहिराइबाट निस्कन्छ—निर्मल र साँचो। ती क्षणहरूमा मेरा सबै चिन्ता हराउँछन् र तिनको ठाउँमा यस्तो खुसी आउँछ, जसले मलाई पूरै भरिदिन्छ। त्यो पूर्ण प्रेमको आवाज हो।",
  },
  {
    code: "nl",
    name: "Dutch",
    prompt: "Niets kan tippen aan de vreugde van het horen lachen van mijn kind. Die lach borrelt op uit het diepste van hem of haar, puur en oprecht. Op zulke momenten verdwijnen al mijn zorgen en worden ze vervangen door een geluk dat me helemaal vervult. Het is het geluid van volmaakte liefde.",
  },
  {
    code: "nn",
    name: "Norwegian Nynorsk",
    prompt: "Ingenting kan måle seg med gleden ved å høre barnet mitt le. Latteren kommer dypt innenfra, ren og ekte. I slike øyeblikk forsvinner alle bekymringene mine og blir erstattet av en lykke som fyller hele meg. Det er lyden av perfekt kjærlighet.",
  },
  {
    code: "no",
    name: "Norwegian",
    prompt: "Ingenting kan måle seg med gleden ved å høre barnet mitt le. Latteren kommer dypt innenfra, ren og ekte. I slike øyeblikk forsvinner alle bekymringene mine og blir erstattet av en lykke som fyller hele meg. Det er lyden av perfekt kjærlighet.",
  },
  {
    code: "pa",
    name: "Punjabi",
    prompt: "ਮੇਰੇ ਬੱਚੇ ਦੀ ਹਾਸੀ ਸੁਣਨ ਦੀ ਖੁਸ਼ੀ ਨਾਲ ਕਿਸੇ ਵੀ ਚੀਜ਼ ਦੀ ਤੁਲਨਾ ਨਹੀਂ ਹੋ ਸਕਦੀ। ਉਹ ਹਾਸਾ ਉਸਦੇ ਦਿਲ ਦੀਆਂ ਗਹਿਰਾਈਆਂ ਤੋਂ ਉੱਭਰਦਾ ਹੈ—ਬਿਲਕੁਲ ਪਵਿੱਤਰ ਤੇ ਸੱਚਾ। ਉਹਨਾਂ ਪਲਾਂ ਵਿੱਚ ਮੇਰੀਆਂ ਸਾਰੀਆਂ ਚਿੰਤਾਵਾਂ ਦੂਰ ਹੋ ਜਾਂਦੀਆਂ ਹਨ ਅਤੇ ਉਨ੍ਹਾਂ ਦੀ ਥਾਂ ਇੱਕ ਐਸੀ ਖੁਸ਼ੀ ਆ ਜਾਂਦੀ ਹੈ ਜੋ ਮੇਰੇ ਅੰਦਰ ਦੇ ਹਰ ਹਿੱਸੇ ਨੂੰ ਭਰ ਦਿੰਦੀ ਹੈ। ਇਹ ਪੂਰਨ ਪਿਆਰ ਦੀ ਆਵਾਜ਼ ਹੈ।",
  },
  {
    code: "pl",
    name: "Polish",
    prompt: "Nic nie może się równać z radością, jaką daje mi słuchanie śmiechu mojego dziecka. Ten śmiech płynie z jego najgłębszego wnętrza, czysty i szczery. W takich chwilach wszystkie moje troski znikają, a ich miejsce zajmuje szczęście, które wypełnia mnie całego. To dźwięk doskonałej miłości.",
  },
  {
    code: "ps",
    name: "Pashto",
    prompt: "د خپل ماشوم د خندا له اورېدو سره هېڅ خوښي نه شي برابرېدای. هغه خندا د ماشوم له زړه له ژورو څخه راټوکېږي، پاکه او رښتینې ده. په هغو شېبو کې زما ټولې اندېښنې له منځه ځي او پر ځای یې داسې خوښي راځي چې زما ټول وجود ډکوي. دا د بشپړې مینې غږ دی.",
  },
  {
    code: "ro",
    name: "Romanian",
    prompt: "Nimic nu se compară cu bucuria de a-mi auzi copilul râzând. Râsul lui izvorăște din adâncul ființei sale, curat și sincer. În acele clipe, toate grijile mele dispar și sunt înlocuite de o fericire care mă umple cu totul. Este sunetul iubirii perfecte.",
  },
  {
    code: "sa",
    name: "Sanskrit",
    prompt: "मम शिशोः हास्यं श्रुत्वा यः आनन्दः जायते, तेन सह किमपि तुलनीयम् नास्ति। तत् हास्यं तस्य अन्तःकरणस्य गभीरतात् उदेति—शुद्धं निष्कपटं च। तेषु क्षणेषु मम सर्वाः चिन्ताः विलीयन्ते, तासां स्थाने च एतादृशः आनन्दः आगच्छति यः मां सर्वतः पूरयति। एषः परिपूर्णप्रेम्णः नादः अस्ति।",
  },
  {
    code: "sd",
    name: "Sindhi",
    prompt: "منهنجي ٻار جي کل ٻڌڻ جي خوشيءَ سان ڪا به شيءِ ڀيٽي نٿي سگهجي. اها کل سندس اندر جي گهراين مان نڪري ٿي، صاف ۽ سچي. انهن لمحن ۾ منهنجون سڀ پريشانيون ختم ٿي وڃن ٿيون ۽ انهن جي جاءِ تي اهڙي خوشي اچي ٿي جيڪا منهنجي وجود جي هر حصي کي ڀري ڇڏي ٿي. اهو مڪمل محبت جو آواز آهي.",
  },
  {
    code: "si",
    name: "Sinhala",
    prompt: "මගේ දරුවාගේ සිනහව ඇසීමෙන් ලැබෙන සතුටට කිසිවක් සමාන කළ නොහැක. ඒ සිනහව ඔහුගේ හදවතේ ගැඹුරින්ම, පිරිසිදුව හා අවංකව මතුවෙයි. ඒ මොහොතවල මගේ සියලු කනස්සල්ල මැකී ගොස්, ඒ වෙනුවට මාව සම්පූර්ණයෙන් පුරවන සතුටක් පැමිණෙයි. එය පරිපූර්ණ ආදරයේ හඬයි.",
  },
  {
    code: "sk",
    name: "Slovak",
    prompt: "Nič sa nevyrovná radosti, ktorú cítim, keď počujem smiech svojho dieťaťa. Ten smiech vychádza z jeho najhlbšieho vnútra, čistý a úprimný. V tých chvíľach všetky moje starosti zmiznú a nahradí ich šťastie, ktoré napĺňa celú moju bytosť. Je to zvuk dokonalej lásky.",
  },
  {
    code: "sl",
    name: "Slovenian",
    prompt: "Nič se ne more primerjati z veseljem, ko slišim smeh svojega otroka. Ta smeh prihaja iz njegove najgloblje notranjosti, čist in iskren. V takih trenutkih vse moje skrbi izginejo, nadomesti pa jih sreča, ki me popolnoma napolni. To je zvok popolne ljubezni.",
  },
  {
    code: "sn",
    name: "Shona",
    prompt: "Hapana chinofananidzwa nomufaro wokunzwa mwana wangu achiseka. Kuseka ikoko kunobva pakadzika pemwoyo wake, kwakachena uye kwechokwadi. Panguva idzodzo, kunetseka kwangu kwose kunopera, kuchitsiviwa nomufaro unozadza chikamu chose changu. Ndiyo inzwi rerudo rwakakwana.",
  },
  {
    code: "sq",
    name: "Albanian",
    prompt: "Asgjë nuk krahasohet me gëzimin që ndiej kur dëgjoj fëmijën tim të qeshë. Ajo e qeshur buron thellë nga brenda tij, e pastër dhe e sinqertë. Në ato çaste, të gjitha shqetësimet e mia treten dhe zëvendësohen nga një lumturi që më mbush tërësisht. Është tingulli i dashurisë së përsosur.",
  },
  {
    code: "sr",
    name: "Serbian",
    prompt: "Ništa se ne može porediti sa radošću kada čujem svoje dete kako se smeje. Taj smeh dolazi iz dubine njegovog bića, čist i iskren. U tim trenucima sve moje brige nestaju, a njihovo mesto zauzima sreća koja ispunjava svaki deo mene. To je zvuk savršene ljubavi.",
  },
  {
    code: "sv",
    name: "Swedish",
    prompt: "Inget kan jämföras med glädjen i att höra mitt barn skratta. Skrattet bubblar upp från djupet av honom eller henne, rent och ärligt. I de stunderna försvinner alla mina bekymmer och ersätts av en lycka som fyller hela mig. Det är ljudet av perfekt kärlek.",
  },
  {
    code: "sw",
    name: "Swahili",
    prompt: "Hakuna kitu kinachoweza kulinganishwa na furaha ya kusikia mtoto wangu akicheka. Kicheko hicho hutoka ndani kabisa ya moyo wake, safi na cha kweli. Katika nyakati hizo, wasiwasi wangu wote hupotea na nafasi yake huchukuliwa na furaha inayonijaza kabisa. Huo ni mlio wa upendo mkamilifu.",
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
    code: "th",
    name: "Thai",
    prompt: "ไม่มีอะไรเทียบได้กับความสุขที่ได้ยินเสียงหัวเราะของลูก เสียงหัวเราะนั้นเปล่งออกมาจากส่วนลึกในใจของเขาอย่างบริสุทธิ์และจริงใจ ในช่วงเวลาเหล่านั้น ความกังวลทั้งหมดของฉันจะจางหายไป และถูกแทนที่ด้วยความสุขที่เติมเต็มตัวฉันทั้งหมด นั่นคือเสียงของความรักที่สมบูรณ์แบบ",
  },
  {
    code: "tl",
    name: "Tagalog / Filipino",
    prompt: "Walang maihahambing sa saya ng marinig ang tawa ng aking anak. Nagmumula ito sa kaibuturan niya, dalisay at taos-puso. Sa mga sandaling iyon, nawawala ang lahat ng aking alalahanin at napapalitan ng kaligayahang pumupuno sa bawat bahagi ng aking pagkatao. Iyon ang tunog ng perpektong pag-ibig.",
  },
  {
    code: "tr",
    name: "Turkish",
    prompt: "Çocuğumun gülüşünü duymakla yaşadığım mutluluğun tarifi yok. O gülüş, onun içinin derinliklerinden, tertemiz ve içten bir şekilde yükseliyor. O anlarda bütün kaygılarım silinip gidiyor ve yerini beni bütünüyle dolduran bir mutluluk alıyor. Bu, kusursuz sevginin sesi.",
  },
  {
    code: "uk",
    name: "Ukrainian",
    prompt: "Ніщо не зрівняється з радістю чути сміх моєї дитини. Цей сміх лине з найглибшої частини її душі — чистий і щирий. У такі моменти всі мої турботи зникають, а на їхньому місці з’являється щастя, яке наповнює мене цілком. Це звук досконалої любові.",
  },
  {
    code: "ur",
    name: "Urdu",
    prompt: "اپنے بچے کی ہنسی سننے کی خوشی کا کوئی مقابلہ نہیں۔ وہ ہنسی اس کے دل کی گہرائیوں سے پھوٹتی ہے، بالکل پاکیزہ اور سچی۔ ان لمحوں میں میری ساری پریشانیاں جیسے غائب ہو جاتی ہیں، اور ان کی جگہ ایسی خوشی لے لیتی ہے جو میرے وجود کے ہر حصے کو بھر دیتی ہے۔ یہ مکمل محبت کی آواز ہے۔",
  },
  {
    code: "vi",
    name: "Vietnamese",
    prompt: "Không gì có thể sánh với niềm vui khi nghe tiếng con mình cười. Tiếng cười ấy bật lên từ sâu thẳm bên trong con, trong trẻo và chân thành. Trong những khoảnh khắc ấy, mọi lo âu của tôi tan biến, nhường chỗ cho niềm hạnh phúc lấp đầy con người tôi. Đó là âm thanh của tình yêu trọn vẹn.",
  },
  {
    code: "yi",
    name: "Yiddish",
    prompt: "גאָרנישט קען זיך פֿאַרגלײַכן מיט דער פֿרייד צו הערן ווי מײַן קינד לאַכט. דער געלעכטער קומט פֿון זײַן טיפֿסטן אינעווייניק, ריין און אָפנהאַרציק. אין יענע מאָמענטן פֿאַרשווינדן אַלע מײַנע זאָרגן, און אין זייער אָרט קומט אַ גליק וואָס פֿילט מיך אינגאַנצן. דאָס איז דער קלאַנג פֿון שליימעסדיקער ליבע.",
  },
  {
    code: "yo",
    name: "Yoruba",
    prompt: "Ko si ohun tí a lè fi wé ayọ̀ tí mo máa ń ní nígbà tí mo bá gbọ́ ọmọ mi tí ń rẹ́rìn-ín. Ẹ̀rín náà ń jáde láti inú ọkàn rẹ̀ gan-an, ó mọ́, ó sì jẹ́ òtítọ́. Ní àwọn àkókò wọ̀nyẹn, gbogbo àníyàn mi máa ń pòórá, ayọ̀ kan tí ń kún gbogbo ara mi sì máa ń wá sípò wọn. Ìró ìfẹ́ pípé ni.",
  }
];

const VOICE_CLONE_LANGUAGE_BY_CODE = new Map(
  VOICE_CLONE_LANGUAGES.map((lang) => [lang.code, lang]),
);

export function getVoiceCloneLanguage(code: string | null | undefined): VoiceCloneLanguage | undefined {
  if (!code) return undefined;
  return VOICE_CLONE_LANGUAGE_BY_CODE.get(code);
}

const RTL_VOICE_CLONE_CODES = new Set(['ar', 'fa', 'he', 'ps', 'sd', 'ur', 'yi']);

export function isVoiceCloneRtl(code: string | null | undefined): boolean {
  return !!code && RTL_VOICE_CLONE_CODES.has(code);
}

