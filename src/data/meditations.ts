/* ------------------------------------------------------------------ */
/* Daily meditation bank — original short reflections (AR + EN).       */
/* Each entry is keyed to a Gospel; the app picks one per day based    */
/* on the Liturgy Gospel's book so the reflection matches the reading.*/
/* ------------------------------------------------------------------ */

export type GospelBook = 'Matthew' | 'Mark' | 'Luke' | 'John';

export interface Meditation {
  book: GospelBook;
  ar: string;
  en: string;
}

export const MEDITATIONS: Meditation[] = [
  /* ------------------------------ Matthew ------------------------------ */
  {
    book: 'Matthew',
    ar: '«طوبى لأنقياء القلب، لأنهم يعاينون الله» (مت ٥: ٨). النقاوة ليست الكمال، بل القلب الواحد الذي لا يعيش بوجهين. اسأل نفسك اليوم: هل قلبي مقسوم بين الله والعالم، أم كلّه له؟ ابدأ بخطوة صغيرة: اعتراف صادق، ونية واحدة صافية.',
    en: '\u201CBlessed are the pure in heart, for they shall see God\u201D (Mt 5:8). Purity is not perfection \u2014 it is a single heart with no masks. Ask yourself today: is my heart divided between God and the world, or fully His? Start small: one honest confession, one sincere intention.',
  },
  {
    book: 'Matthew',
    ar: '«أنتم ملح الأرض... أنتم نور العالم» (مت ٥: ١٣-١٤). الملح لا يُرى لكنه يُذاق، والنور لا يصرخ لكنه يُرى. لا تحتاج أن تكون مشهوراً لتغيّر من حولك؛ حضورك الصامت المملوء محبة يملّح البيت ويُنير مكان العمل.',
    en: '\u201CYou are the salt of the earth... you are the light of the world\u201D (Mt 5:13-14). Salt is unseen but tasted; light makes no noise but is seen. You don\u2019t need fame to change those around you \u2014 a quiet presence filled with love seasons your home and brightens your workplace.',
  },
  {
    book: 'Matthew',
    ar: '«ادخلوا من الباب الضيق» (مت ٧: ١٣). الطريق الضيق ليس عقوبة، بل حضن: الله يضيّق الطريق ليحميك لا ليحرمك. كل «لا» يقولها الله لشهوة، هي «نعم» كبيرة لحريتك وسلامك. امشِ فيه اليوم بثقة الابن لا بخوف العبد.',
    en: '\u201CEnter by the narrow gate\u201D (Mt 7:13). The narrow way is not a punishment but an embrace: God narrows the road to protect you, not to deprive you. Every \u201Cno\u201D He says to a desire is a great \u201Cyes\u201D to your freedom and peace. Walk it today with a son\u2019s trust, not a servant\u2019s fear.',
  },
  {
    book: 'Matthew',
    ar: '«إلى سبعين مرة سبع مرات» (مت ١٨: ٢٢). الغفران ليس شعوراً ينتظر أن يأتي، بل قرار يُتخذ كل يوم. من غفر له الكثير يحب كثيراً. جرّب اليوم: صلِّ من قلبك لأجل من أساء إليك، وستشعر أن القيد انكسر من يدك أنت أولاً.',
    en: '\u201CUp to seventy times seven\u201D (Mt 18:22). Forgiveness is not a feeling you wait for \u2014 it is a decision you make daily. The one forgiven much loves much. Try it today: pray from your heart for the one who hurt you, and you will feel the chain break off your own hands first.',
  },
  {
    book: 'Matthew',
    ar: 'الراعي ترك التسعة والتسعين وذهب لأجل الضال الواحد (مت ١٨: ١٢). عند الله أنت لست رقماً في القطيع، بل اسماً على كفه. مهما ابتعدت، هو يبحث عنك شخصياً. لا تؤجل الرجوع؛ خطوتك الواحدة نحوه تقابلها خطوات ركض منه إليك.',
    en: 'The shepherd left the ninety-nine and went after the one lost sheep (Mt 18:12). To God you are not a number in the flock but a name on His palm. No matter how far you wandered, He seeks you personally. Don\u2019t delay your return \u2014 your single step toward Him is met with His running toward you.',
  },
  {
    book: 'Matthew',
    ar: '«إن لم ترجعوا وتصيروا مثل الأولاد فلن تدخلوا ملكوت السماوات» (مت ١٨: ٣). الطفل يثق بلا حسابات، ويفرح بالقليل، ويسامح بسرعة. كبرنا فتعلمنا الشك والحساب والخصام. اليوم، استعِد طفولتك الروحية: ثق، افرح، وسامح.',
    en: '\u201CUnless you turn and become like children, you will never enter the kingdom of heaven\u201D (Mt 18:3). A child trusts without calculations, rejoices in little, forgives quickly. Growing up, we learned doubt, score-keeping, and grudges. Today, recover your spiritual childhood: trust, rejoice, forgive.',
  },
  {
    book: 'Matthew',
    ar: 'بيتان: واحد على الصخر وواحد على الرمل، والمطر نزل على الاثنين (مت ٧: ٢٤-٢٧). العواصف لا تفرّق بين الناس، لكن الأساس يفرّق. كلمة الله المسموعة والمعمول بها هي الصخر. اسمع اليوم، واعمل بشيء واحد سمعته.',
    en: 'Two houses: one on rock, one on sand \u2014 and the rain fell on both (Mt 7:24-27). Storms don\u2019t distinguish between people, but foundations do. God\u2019s word, heard and practiced, is the rock. Hear today, and act on one thing you heard.',
  },
  {
    book: 'Matthew',
    ar: '«تعالوا إليّ يا جميع المتعبين والثقيلي الأحمال وأنا أريحكم» (مت ١١: ٢٨). الراحة ليست في انتهاء المشاكل، بل في حضن المسيح وسط المشاكل. تعال كما أنت: متعباً، مثقلاً، حتى بلا كلمات. هو لا يطلب منك ترتيب نفسك أولاً.',
    en: '\u201CCome to Me, all who labor and are heavy laden, and I will give you rest\u201D (Mt 11:28). Rest is not found in the end of troubles but in Christ\u2019s embrace amid troubles. Come as you are: weary, burdened, even wordless. He doesn\u2019t ask you to tidy yourself up first.',
  },

  /* ------------------------------- Mark -------------------------------- */
  {
    book: 'Mark',
    ar: '«اتبعني» ـ كلمة واحدة، فسمعان وأندراوس «تركا شباكهما وتبعاه» في الحال (مر ١: ١٧-١٨). الطاعة الفورية تختصر سنوات من التردد. عندما يهمس الله في قلبك بخطوة، لا تؤجلها للغد؛ البركة تسكن في «الحال».',
    en: '\u201CFollow Me\u201D \u2014 one word, and Simon and Andrew \u201Cimmediately left their nets and followed Him\u201D (Mk 1:17-18). Immediate obedience saves years of hesitation. When God whispers a step to your heart, don\u2019t postpone it to tomorrow; the blessing lives in \u201Cimmediately.\u201D',
  },
  {
    book: 'Mark',
    ar: 'أربعة أصدقاء نقبوا السقف وأنزلوا المفلوج أمام يسوع، «فلما رأى يسوع إيمانهم» شفاه (مر ٢: ٥). إيمانك يمكن أن يحمل غيرك! صلاتك عن صديق بعيد، وإلحاحك لأجل مريض، يفتح سقف السماء فوقه. لا تستهن بصلاة المحبة.',
    en: 'Four friends broke through the roof and lowered the paralytic before Jesus, and \u201Cwhen Jesus saw their faith\u201D He healed him (Mk 2:5). Your faith can carry others! Your prayer for a distant friend, your persistence for the sick, opens heaven\u2019s ceiling above them. Never underestimate the prayer of love.',
  },
  {
    book: 'Mark',
    ar: 'العاصفة هاجت والتلاميذ صرخوا، أما يسوع فكان نائماً في السفينة (مر ٤: ٣٨). نومه لم يكن إهمالاً بل سلاماً. سلام الله لا يعني غياب العاصفة، بل حضوره فيها. اهدأ: الذي معك في السفينة أقوى من الريح.',
    en: 'The storm raged and the disciples cried out, while Jesus slept in the boat (Mk 4:38). His sleep was not neglect but peace. God\u2019s peace doesn\u2019t mean the absence of the storm \u2014 it means His presence in it. Be still: the One with you in the boat is stronger than the wind.',
  },
  {
    book: 'Mark',
    ar: 'الأرملة ألقت فلسين ـ «كل معيشتها» ـ فمدحها يسوع أكثر من الأغنياء (مر ١٢: ٤٤). الله لا يقيس العطاء بالرقم بل بالقلب. عطاء صغير بحب كامل أثمن عنده من الكثير بلا حب. أعطِ اليوم مما عندك، ولو كان قليلاً.',
    en: 'The widow gave two coins \u2014 \u201Call she had\u201D \u2014 and Jesus praised her above the rich (Mk 12:44). God measures giving by the heart, not the amount. A small gift with full love is worth more to Him than much without love. Give today from what you have, even if it is little.',
  },
  {
    book: 'Mark',
    ar: '«من أراد أن يكون أولاً فليكن للجميع خادماً» (مر ١٠: ٤٤). في ملكوت الله السلّم مقلوب: الصعود يكون بالنزول، والعظمة بالخدمة. ابحث اليوم عن شخص تخدمه في الخفاء؛ السماء تسجّل ما لا يراه الناس.',
    en: '\u201CWhoever would be first must be servant of all\u201D (Mk 10:44). In God\u2019s kingdom the ladder is upside down: ascent comes through descent, greatness through service. Find someone to serve in secret today; heaven records what people don\u2019t see.',
  },
  {
    book: 'Mark',
    ar: 'بارتيماوس الأعمى صرخ: «يا يسوع ابن داود ارحمني!» فلما انتهروه «صرخ أكثر» (مر ١٠: ٤٨). لا تدع أصوات الإحباط تسكت صرخة قلبك. الإلحاح في الصلاة ليس إزعاجاً لله، بل إعلان أنك تؤمن أنه يسمع.',
    en: 'Blind Bartimaeus cried, \u201CJesus, Son of David, have mercy on me!\u201D And when they rebuked him, \u201Che cried out all the more\u201D (Mk 10:48). Don\u2019t let discouraging voices silence your heart\u2019s cry. Persistence in prayer doesn\u2019t bother God \u2014 it declares that you believe He hears.',
  },
  {
    book: 'Mark',
    ar: '«من قال لهذا الجبل انتقل وانطرح في البحر ولا يشك في قلبه بل يؤمن... يكون له» (مر ١١: ٢٣). الجبال في حياتك ـ همّ، مرض، عادة ـ تتحرك بالإيمان المصلّي لا بالقلق. تكلّم إلى جبلك اليوم باسم الرب بدل أن تتكلم عنه للناس.',
    en: '\u201CWhoever says to this mountain, \u2018Be taken up and thrown into the sea,\u2019 and does not doubt... it will be done\u201D (Mk 11:23). The mountains in your life \u2014 worry, illness, habit \u2014 move by praying faith, not by anxiety. Speak to your mountain today in the Lord\u2019s name instead of speaking about it to people.',
  },
  {
    book: 'Mark',
    ar: 'في جثسيماني صلى يسوع: «ليس ما أريد أنا بل ما تريد أنت» (مر ١٤: ٣٦). أصعب صلاة وأعظمها: تسليم الإرادة. عندما لا تفهم الطريق، سلّم القيادة لمن يرى النهاية. مشيئته صالحة حتى حين تؤلم.',
    en: 'In Gethsemane Jesus prayed, \u201CNot what I will, but what You will\u201D (Mk 14:36). The hardest prayer and the greatest: surrender of the will. When you can\u2019t understand the road, hand the steering to the One who sees the end. His will is good even when it hurts.',
  },

  /* ------------------------------- Luke -------------------------------- */
  {
    book: 'Luke',
    ar: 'السامري الصالح لم يسأل الجريح عن جنسيته أو دينه؛ رآه محتاجاً فاقترب (لو ١٠: ٣٣). القريب ليس من يشبهك، بل من يحتاجك. اليوم، قد يضع الله في طريقك «جريحاً» ـ برسالة، بمكالمة، بنظرة. لا تعبر إلى الجانب الآخر.',
    en: 'The Good Samaritan didn\u2019t ask the wounded man about his nationality or religion; he saw need and drew near (Lk 10:33). Your neighbor is not the one who resembles you but the one who needs you. Today God may place a \u201Cwounded\u201D one in your path \u2014 a message, a call, a glance. Don\u2019t pass by on the other side.',
  },
  {
    book: 'Luke',
    ar: 'الابن الضال قرر العودة، «وإذ كان لم يزل بعيداً رآه أبوه فتحنن وركض» (لو ١٥: ٢٠). الآب لم ينتظر اعتذاراً كاملاً؛ ركض! مهما ابتعدت ومهما طال الغياب، الحضن مفتوح والركض بدأ من ناحيته. ارجع اليوم.',
    en: 'The prodigal son decided to return, and \u201Cwhile he was still a long way off, his father saw him and was filled with compassion and ran\u201D (Lk 15:20). The father didn\u2019t wait for a perfect apology \u2014 he ran! No matter how far you went or how long you\u2019ve been away, the embrace is open and the running has begun on His side. Return today.',
  },
  {
    book: 'Luke',
    ar: 'الأرملة ألحّت على القاضي الظالم حتى أنصفها، «أفلا ينصف الله مختاريه الصارخين إليه نهاراً وليلاً؟» (لو ١٨: ٧). اللجاجة في الصلاة ليست تكراراً مملاً، بل ثقة أن الآب الصالح يسمع. لا تتوقف عن الطلب؛ التأخير ليس رفضاً.',
    en: 'The widow persisted with the unjust judge until he granted her justice \u2014 \u201Cwill not God bring about justice for His chosen ones, who cry out to Him day and night?\u201D (Lk 18:7). Persistence in prayer is not boring repetition but trust that the good Father hears. Don\u2019t stop asking; delay is not denial.',
  },
  {
    book: 'Luke',
    ar: 'زكا كان قصيراً ومرفوضاً، فصعد الجميزة ليرى يسوع، فيسوع نظر إليه وناداه باسمه: «يا زكا أسرع وانزل» (لو ١٩: ٥). هو يعرف اسمك وقصتك، ويدعوك شخصياً. لا تختفِ فوق شجرتك؛ انزل وقابله، فهو «جاء ليطلب ويخلّص ما قد هلك».',
    en: 'Zacchaeus was short and rejected, so he climbed the sycamore to see Jesus \u2014 and Jesus looked up and called him by name: \u201CZacchaeus, come down immediately\u201D (Lk 19:5). He knows your name and your story, and He calls you personally. Don\u2019t hide up your tree; come down and meet Him, for He \u201Ccame to seek and to save the lost.\u201D',
  },
  {
    book: 'Luke',
    ar: 'عشرة برص طهروا، «فواحد منهم لما رأى أنه شُفي رجع يمجد الله» (لو ١٧: ١٥). تسعة نالوا الشفاء ومضوا، وواحد نال الشفاء والشكر. الشكر يكمّل العطية ويحوّلها إلى علاقة. قبل أن تطلب اليوم، اشكر على ما نلته أمس.',
    en: 'Ten lepers were cleansed, \u201Cthen one of them, when he saw that he was healed, turned back, praising God\u201D (Lk 17:15). Nine received healing and left; one received healing and thanksgiving. Gratitude completes the gift and turns it into a relationship. Before you ask today, give thanks for what you received yesterday.',
  },
  {
    book: 'Luke',
    ar: 'مرثا انشغلت بالكثير، أما مريم «فاختارت النصيب الصالح» ـ الجلوس عند قدمي يسوع (لو ١٠: ٤٢). «الحاجة إلى واحد». وسط زحمة اليوم، احجز دقائق تجلس فيها عند قدميه قبل أن تخدمه بيديك؛ الخدمة بلا جلوس تُتعب، والجلوس يملأ الخدمة.',
    en: 'Martha was distracted by much serving, but Mary \u201Cchose the good portion\u201D \u2014 sitting at Jesus\u2019 feet (Lk 10:42). \u201COne thing is needed.\u201D Amid today\u2019s rush, reserve minutes to sit at His feet before serving Him with your hands; service without sitting exhausts, and sitting fills service.',
  },
  {
    book: 'Luke',
    ar: 'الغني قال لنفسه: «يا نفس لك خيرات كثيرة... استريحي وكلي واشربي وافرحي»، فسمع: «يا غبي! هذه الليلة تُطلب نفسك منك» (لو ١٢: ١٩-٢٠). الغنى ليس خطية، لكن تخزينه للنفس فقط هو الغباء. كن غنياً لله اليوم: شارك، أعطِ، واكنز في السماء.',
    en: 'The rich man said to himself, \u201CSoul, you have ample goods... relax, eat, drink, be merry,\u201D and heard: \u201CFool! This night your soul is required of you\u201D (Lk 12:19-20). Wealth is not the sin \u2014 hoarding it only for yourself is the folly. Be rich toward God today: share, give, store up in heaven.',
  },
  {
    book: 'Luke',
    ar: '«يا رب، علّمنا أن نصلي» (لو ١١: ١). التلاميذ لم يطلبوا أن يتعلموا الوعظ أو صنع المعجزات، بل الصلاة؛ لأنهم رأوا فيها سرّ قوته. الصلاة ليست كلمات محفوظة بل حديث قلب مع أب. ابدأ اليوم بـ«يا أبانا» وقلها ببطء كأنك تقولها أول مرة.',
    en: '\u201CLord, teach us to pray\u201D (Lk 11:1). The disciples didn\u2019t ask to learn preaching or miracles, but prayer \u2014 for they saw in it the secret of His power. Prayer is not memorized words but a heart\u2019s conversation with a Father. Begin today with \u201COur Father,\u201D saying it slowly as if for the first time.',
  },

  /* ------------------------------- John -------------------------------- */
  {
    book: 'John',
    ar: '«اثبتوا فيّ وأنا فيكم... الذي يثبت فيّ وأنا فيه هذا يأتي بثمر كثير» (يو ١٥: ٤-٥). الثبات ليس مجهوداً متوتراً، بل اتصال دائم: الغصن لا «يحاول» أن يثمر، بل يبقى متصلاً بالكرمة. ابقَ متصلاً اليوم ـ بصلاة قصيرة، بآية، بشكر ـ والثمر سيأتي.',
    en: '\u201CAbide in Me, and I in you... He who abides in Me, and I in him, bears much fruit\u201D (Jn 15:4-5). Abiding is not strained effort but constant connection: the branch doesn\u2019t \u201Ctry\u201D to bear fruit \u2014 it stays connected to the vine. Stay connected today \u2014 a short prayer, a verse, a thanks \u2014 and the fruit will come.',
  },
  {
    book: 'John',
    ar: '«أنا هو الراعي الصالح... يدعو خرافه الخاصة بأسماء» (يو ١٠: ٣-٤). وسط ضجيج الأصوات التي تناديك كل يوم، هناك صوت يعرف اسمك ويحبك شخصياً. تعلّم أن تميّز صوته: يتكلم بالسلام لا بالاضطراب، وبالرجاء لا باليأس.',
    en: '\u201CI am the good shepherd... he calls his own sheep by name\u201D (Jn 10:3-4). Amid the noise of voices calling you every day, there is a voice that knows your name and loves you personally. Learn to recognize it: it speaks in peace, not turmoil; in hope, not despair.',
  },
  {
    book: 'John',
    ar: '«أنا هو نور العالم. من يتبعني فلا يمشي في الظلمة» (يو ٨: ١٢). النور لا يجادل الظلمة ولا يخافها؛ مجرد حضوره يبددها. لا تحارب ظلامك بالكلام الكثير، بل اقترب من النور: آية، صلاة، قداس. الظلمة تهرب من وجهه.',
    en: '\u201CI am the light of the world. Whoever follows Me will not walk in darkness\u201D (Jn 8:12). Light doesn\u2019t argue with darkness or fear it; its mere presence dispels it. Don\u2019t fight your darkness with many words \u2014 draw near to the Light: a verse, a prayer, a liturgy. Darkness flees His face.',
  },
  {
    book: 'John',
    ar: 'السامرية جاءت تستقي ماءً، فرحلت تاركة جرتها بعدما وجدت «الماء الحي» (يو ٤: ١٤). عطش القلب الحقيقي لا يرويه ماء العالم ـ نجاح، مال، علاقات ـ بل المسيح وحده. ما هي «جرتك» التي ما زلت تحملها؟ اتركها اليوم وارتوِ منه.',
    en: 'The Samaritan woman came to draw water and left her jar behind once she found the \u201Cliving water\u201D (Jn 4:14). The heart\u2019s true thirst is not quenched by the world\u2019s water \u2014 success, money, relationships \u2014 but by Christ alone. What is the \u201Cjar\u201D you still carry? Leave it today and drink deeply of Him.',
  },
  {
    book: 'John',
    ar: 'في الليلة الأخيرة «قام عن العشاء وغسل أرجل التلاميذ» (يو ١٣: ٤-٥). الرب انحنى! العظمة الحقيقية تنحني لتخدم. ابحث اليوم عن «قدمين» تغسلهما: خدمة صغيرة لشخص لا يستطيع ردّها لك. هذه هي المحبة العملية.',
    en: 'On the last night, \u201CHe rose from supper and washed the disciples\u2019 feet\u201D (Jn 13:4-5). The Lord stooped! True greatness bends to serve. Find \u201Cfeet\u201D to wash today: a small service for someone who cannot repay you. That is love in action.',
  },
  {
    book: 'John',
    ar: '«سلاماً أترك لكم. سلامي أعطيكم. ليس كما يعطي العالم أعطيكم أنا» (يو ١٤: ٢٧). سلام العالم يعتمد على الظروف؛ سلام المسيح يعتمد على حضوره. الظروف تتغير، وهو لا يتغير. استلم سلامه اليوم: «لا تضطرب قلوبكم ولا ترهب».',
    en: '\u201CPeace I leave with you; My peace I give you. Not as the world gives do I give to you\u201D (Jn 14:27). The world\u2019s peace depends on circumstances; Christ\u2019s peace depends on His presence. Circumstances change \u2014 He doesn\u2019t. Receive His peace today: \u201CDo not let your hearts be troubled.\u201D',
  },
  {
    book: 'John',
    ar: 'توما شكّ، فيسوع لم يوبّخه بل أراه يديه: «طوبى للذين آمنوا ولم يروا» (يو ٢٠: ٢٩). الشك الصادق ليس عدو الإيمان، بل طريقه؛ المهم أن تأتي بشكّك إلى المسيح لا أن تهرب به منه. اعرض عليه أسئلتك اليوم بصراحة طفل.',
    en: 'Thomas doubted, and Jesus didn\u2019t rebuke him but showed him His hands: \u201CBlessed are those who have not seen and yet have believed\u201D (Jn 20:29). Honest doubt is not faith\u2019s enemy but its pathway \u2014 what matters is bringing your doubts to Christ, not running from Him with them. Lay your questions before Him today with a child\u2019s honesty.',
  },
  {
    book: 'John',
    ar: 'بعد القيامة سأل يسوع بطرس ثلاثاً: «أتحبني؟» ثم قال: «ارعَ غنمي» (يو ٢١: ١٧). المحبة للمسيح تُترجم دائماً إلى محبة للناس وخدمتهم. لا تقل «أحبك يا رب» وتبخل على إخوتك؛ المحبة الصادقة لها يدان تخدم.',
    en: 'After the resurrection Jesus asked Peter three times, \u201CDo you love Me?\u201D then said, \u201CFeed My sheep\u201D (Jn 21:17). Love for Christ always translates into love for people and service to them. Don\u2019t say \u201CI love You, Lord\u201D while withholding from your brothers and sisters \u2014 genuine love has hands that serve.',
  },
];

/** Day-of-year (1-366) for a date, in local time. */
export function dayOfYear(d: Date): number {
  const start = new Date(d.getFullYear(), 0, 0);
  return Math.floor((d.getTime() - start.getTime()) / 86400000);
}

/**
 * Pick the day's meditation: prefer entries matching the Liturgy Gospel's
 * book so the reflection echoes the day's reading; rotate by day of year.
 */
export function meditationForDay(bookName: string | null, d: Date): Meditation {
  const norm = (bookName || '').toLowerCase();
  const book: GospelBook | null =
    norm.includes('matthew') ? 'Matthew'
    : norm.includes('mark') ? 'Mark'
    : norm.includes('luke') ? 'Luke'
    : norm.includes('john') && !norm.includes('1 john') && !norm.includes('2 john') && !norm.includes('3 john') ? 'John'
    : null;
  const pool = book ? MEDITATIONS.filter((m) => m.book === book) : MEDITATIONS;
  const list = pool.length > 0 ? pool : MEDITATIONS;
  return list[dayOfYear(d) % list.length];
}
