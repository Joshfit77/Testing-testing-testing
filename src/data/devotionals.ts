/**
 * "40 Days Through the Narrow Gate" — a daily devotional and faith & fitness challenge.
 *
 * Scripture text is from the King James Version (KJV, 1769 standard text), public domain outside
 * the United Kingdom (see TRANSLATION in ./content.ts).
 *
 * EDITORIAL CHECK REQUIRED: every verse below was entered from a well-known KJV text and MUST be
 * checked word-for-word (including punctuation and capitalisation such as "LORD") against an
 * authoritative KJV source before publication. Devotionals are written to be broadly orthodox,
 * pastoral and non-denominational: God's love is never presented as a reward for fitness results,
 * appearance or completing this challenge.
 *
 * Unit tests (tests/unit/devotionals.test.ts) enforce structure: 40 days numbered 1–40, all fields
 * present, devotional length 120–180 words, one-sentence prayers and no duplicate references.
 */

export type DevotionalTheme =
  | "discipline"
  | "grace"
  | "perseverance"
  | "courage"
  | "trust"
  | "self_control"
  | "stewardship"
  | "rest"
  | "humility"
  | "community"
  | "gratitude";

export interface Devotional {
  /** 1–40 */
  day: number;
  title: string;
  theme: DevotionalTheme;
  /** e.g. "Matthew 7:13–14" (en dash for verse ranges, matching ./content.ts). */
  reference: string;
  /** Full KJV text of the reference. */
  scripture: string;
  /** ~120–180 words. */
  devotional: string;
  /** One sentence. */
  prayer: string;
  /** Today's training prompt, always with a rest-day alternative. */
  train: string;
  /** A reflection question. */
  reflection: string;
}

export const CHALLENGE_SLUG = "narrow-gate-40";
export const CHALLENGE_DAYS = 40;
export const CHALLENGE_NAME = "40 Days Through the Narrow Gate";

const REST_DAY = "Rest day: a 20-minute walk and 10 minutes of mobility.";

export const DEVOTIONALS: Devotional[] = [
  {
    day: 1,
    title: "The Narrow Gate",
    theme: "discipline",
    reference: "Matthew 7:13–14",
    scripture:
      "Enter ye in at the strait gate: for wide is the gate, and broad is the way, that leadeth to destruction, and many there be which go in thereat: Because strait is the gate, and narrow is the way, which leadeth unto life, and few there be that find it.",
    devotional:
      "Jesus spoke of two roads. One is wide and crowded, and it asks nothing of us. The other begins at a narrow gate, and few find it. He was speaking first of life with God, not of exercise, yet the shape of His words echoes through every ordinary choice. The broad way is usually the path of least resistance: the snooze button, the skipped session, the habit we keep meaning to change. The narrow way asks us to choose what is good even when it is not easy. As you begin these forty days, hear this clearly: you are not walking through the gate to earn God's love. That love is already offered freely in Christ. You are choosing to walk in step with Him, one faithful day at a time. Start small. Start honestly. Ask Him for grace to take today's step, and trust Him with the rest of the road.",
    prayer: "Lord, thank You for inviting me onto the narrow way; give me grace to take today's step with You.",
    train: `Complete today's scheduled workout. If it's a rest day: a 20-minute walk and 10 minutes of mobility.`,
    reflection: "Where in your life are you most tempted to take the broad, easy path right now?",
  },
  {
    day: 2,
    title: "Not of Works",
    theme: "grace",
    reference: "Ephesians 2:8–9",
    scripture:
      "For by grace are ye saved through faith; and that not of yourselves: it is the gift of God: Not of works, lest any man should boast.",
    devotional:
      "Before you log a single rep in this challenge, settle this: nothing you do over the next forty days will make God love you more, and nothing you miss will make Him love you less. Paul writes that salvation is a gift received through faith, not a reward for effort, so that no one can boast. That truth frees us. Discipline that grows out of fear quickly turns into pride when we succeed and shame when we fail. Discipline that grows out of grace is different. It says, \"I have been loved and welcomed, so I want to steward this life well.\" Training becomes an act of gratitude rather than a way to prove ourselves. Today, as you move your body, let each effort be a quiet thank-you. And if you fall short, remember that grace was never earned to begin with, so it cannot be lost by a missed day.",
    prayer: "Father, thank You that Your grace is a gift; let my effort today flow from gratitude, not from fear.",
    train: "Complete today's scheduled workout. If it's a rest day: a 20-minute walk, giving thanks for each good thing you notice along the way.",
    reflection: "Do you tend to train from a place of fear and proving, or from gratitude? What would change if it were gratitude?",
  },
  {
    day: 3,
    title: "New Every Morning",
    theme: "grace",
    reference: "Lamentations 3:22–23",
    scripture:
      "It is of the LORD's mercies that we are not consumed, because his compassions fail not. They are new every morning: great is thy faithfulness.",
    devotional:
      "Lamentations was written in the rubble of a ruined city. Its author had every reason to despair, yet in the middle of his grief he remembered something steady: the Lord's compassions do not fail, and His mercies are new every morning. Most fitness journeys stall not because of one bad day but because of what we tell ourselves afterward: \"I've already blown it, so why bother?\" Mercy breaks that cycle. Each morning is a genuine fresh start, not because we have earned it but because God is faithful. Yesterday's missed workout, poor meal or late night does not have to set the tone for today. You do not need to make up for it with punishment. You simply begin again. Receive this morning as a gift, and let His faithfulness, rather than your track record, be the thing you lean on.",
    prayer: "Lord, thank You that Your mercies are new this morning; help me begin again without shame.",
    train: "Complete today's scheduled workout. If it's a rest day: 10 minutes of easy mobility first thing in the morning and a 20-minute walk later.",
    reflection: "What would it look like to treat today as a genuine fresh start rather than a continuation of yesterday?",
  },
  {
    day: 4,
    title: "Faithful in Little",
    theme: "discipline",
    reference: "Luke 16:10",
    scripture:
      "He that is faithful in that which is least is faithful also in much: and he that is unjust in the least is unjust also in much.",
    devotional:
      "Jesus said that whoever is faithful in very little is faithful also in much. We often wait for big moments to prove our commitment, but character is mostly formed in small, unseen choices. Strength works the same way. No single workout transforms you. What changes you is the steady accumulation of ordinary sessions, glasses of water, early bedtimes and honest reps that nobody else notices. That can feel unglamorous, but there is something holy in it. God sees the little things, and He delights in faithfulness more than in flash. Today, look for one small thing you can do well: warm up properly, finish the last set with good form, put your phone away at dinner, or go to bed on time. Do it quietly and wholeheartedly, as an offering rather than a performance. Small faithfulness, repeated over many days, becomes a life.",
    prayer: "Lord, teach me to be faithful in the small things You have placed in front of me today.",
    train: "Complete today's scheduled workout and give extra care to your warm-up and form. Rest day: a 15-minute walk and 10 minutes of stretching.",
    reflection: "Which small, unseen habit would make the biggest difference if you kept it faithfully?",
  },
  {
    day: 5,
    title: "Run That Ye May Obtain",
    theme: "self_control",
    reference: "1 Corinthians 9:24–25",
    scripture:
      "Know ye not that they which run in a race run all, but one receiveth the prize? So run, that ye may obtain. And every man that striveth for the mastery is temperate in all things. Now they do it to obtain a corruptible crown; but we an incorruptible.",
    devotional:
      "Paul lived in a culture that loved athletics. The Isthmian Games were held near Corinth, and his readers knew how hard competitors trained for a wreath of leaves that would wither within days. He uses that picture to ask a searching question: if athletes are temperate in all things for a fading prize, how much more should we live with purpose for one that never fades? Temperance here does not mean grim restriction. It means ordering our desires so that the good things in life serve what matters most. Your training has real value, and so do rest, food and friendship. The question is whether they are pointed somewhere. Today, run your race with focus. Train with intention, eat with gratitude, and remember that the deepest prize is not a number on a scale or a bar, but a life that honours God.",
    prayer: "Lord, order my desires today so that everything I do points toward You.",
    train: "Complete today's scheduled workout with one clear focus for each exercise. Rest day: a 20-minute brisk walk and 10 minutes of mobility.",
    reflection: "What is the \"prize\" that actually motivates your training, and is it one that lasts?",
  },
  {
    day: 6,
    title: "Sufficient Unto the Day",
    theme: "trust",
    reference: "Matthew 6:34",
    scripture:
      "Take therefore no thought for the morrow: for the morrow shall take thought for the things of itself. Sufficient unto the day is the evil thereof.",
    devotional:
      "Forty days can feel long on day six. It is tempting to look ahead and count how much is left, or to worry about the busy week coming and whether you will keep up. Jesus speaks gently into that habit: do not be anxious about tomorrow, for tomorrow will take care of itself. Each day already has enough in it. This is not a call to carelessness. Planning your training is wise. But anxiety about the future steals the strength you need for the present. God gives grace for today, not for next Thursday. So narrow your focus. What does faithfulness look like in the next twenty-four hours? One devotional. One session or one walk. One good meal. One reasonable bedtime. That is enough. Tomorrow will bring its own grace when it arrives, and the same faithful God will be there to meet you in it.",
    prayer: "Father, I give You my worries about tomorrow; help me be faithful with today.",
    train: `Complete today's scheduled workout without thinking past it. ${REST_DAY}`,
    reflection: "What worry about the future is draining energy you need for today?",
  },
  {
    day: 7,
    title: "Go to the Ant",
    theme: "discipline",
    reference: "Proverbs 6:6",
    scripture: "Go to the ant, thou sluggard; consider her ways, and be wise:",
    devotional:
      "Proverbs sends the sluggard to an unlikely teacher: the ant. The verses that follow note that the ant has no guide or ruler standing over her, yet she gathers her food in season. Ants are not dramatic. They do not wait to feel inspired. They simply do the next necessary thing, day after day, and the colony thrives. Motivation is a wonderful feeling, but it is unreliable. Some mornings you will wake up eager to train, and many mornings you will not. Wisdom is building rhythms that carry you when feelings fade: laying out your clothes the night before, scheduling your session like an appointment, keeping the first step small. One week into this challenge, consider the ant. Not because hustle makes you worthy, but because steady, humble diligence is a gift you give your future self and the people who depend on you.",
    prayer: "Lord, give me the wisdom to build steady rhythms that serve me when motivation fades.",
    train: `Complete today's scheduled workout, then set out what you need for your next session. ${REST_DAY}`,
    reflection: "What simple rhythm could carry you on days when you don't feel motivated?",
  },
  {
    day: 8,
    title: "A Sound Mind",
    theme: "courage",
    reference: "2 Timothy 1:7",
    scripture: "For God hath not given us the spirit of fear; but of power, and of love, and of a sound mind.",
    devotional:
      "Paul reminded young Timothy that God has not given us a spirit of fear, but of power, of love and of a sound mind. Fear shows up in training more than we admit: fear of looking foolish at the gym, fear of failing a lift, fear of starting again after a long break, fear that we will never change. Fear shrinks our world. The Spirit enlarges it. Notice the three gifts Paul names. Power is the courage to begin. Love keeps our goals pointed outward, toward God and others. A sound mind brings self-discipline and good judgement, which means training wisely, respecting pain signals and resting when needed. Courage is not recklessness. Today, name one fear that has been holding you back, and take one sensible step past it, trusting that you do not take it alone.",
    prayer: "Holy Spirit, replace my fear with power, love and a sound mind as I take today's step.",
    train: "Complete today's scheduled workout, and sensibly try one exercise you've been hesitant about, with good form. Rest day: a 20-minute walk and 10 minutes of mobility.",
    reflection: "Which fear has been quietly shaping your choices about your health?",
  },
  {
    day: 9,
    title: "Be Strong and of a Good Courage",
    theme: "courage",
    reference: "Joshua 1:9",
    scripture:
      "Have not I commanded thee? Be strong and of a good courage; be not afraid, neither be thou dismayed: for the LORD thy God is with thee whithersoever thou goest.",
    devotional:
      "Joshua stood at the edge of the promised land with an enormous task ahead and a legendary leader behind him. Moses was gone, and the people were looking to Joshua. God's command was not \"be impressive\" but \"be strong and of a good courage\", and the reason was not Joshua's ability. It was God's presence: the Lord your God is with you wherever you go. Strength in Scripture is rarely self-made. It is courage rooted in the faithfulness of Someone else. That matters when you face something daunting, whether a new program, a health diagnosis, or simply the long middle stretch of a challenge like this one. You are not asked to manufacture confidence. You are invited to step forward because you are accompanied. Whatever feels like a river to cross today, God goes before you and walks beside you as you go.",
    prayer: "Lord, thank You that You go with me; give me courage for the task in front of me today.",
    train: "Complete today's scheduled workout. Rest day: a 20-minute walk somewhere new and 10 minutes of mobility.",
    reflection: "What daunting task would look different if you truly believed God was with you in it?",
  },
  {
    day: 10,
    title: "Commit Thy Works",
    theme: "trust",
    reference: "Proverbs 16:3",
    scripture: "Commit thy works unto the LORD, and thy thoughts shall be established.",
    devotional:
      "Ten days in, it is a good moment to pause and hand your plans back to God. The Hebrew word behind \"commit\" carries the picture of rolling something onto someone else, like shifting a heavy load onto stronger shoulders. We tend to grip our goals tightly. We want control over the results: the weight lost, the strength gained, the streak kept. But results are not fully in our hands. Injuries happen. Seasons change. Bodies respond differently. What we can do is offer our efforts honestly and let God shape the outcome. This brings a surprising steadiness. When your training is committed to Him, a setback is not a catastrophe and a success is not a cause for pride. Both become occasions to trust. Before you train today, offer Him your plans for the next thirty days, and leave the results in His hands.",
    prayer: "Lord, I commit my plans and efforts to You; establish my thoughts and hold my results in Your hands.",
    train: `Complete today's scheduled workout, beginning with a brief prayer over your session. ${REST_DAY}`,
    reflection: "Which result are you gripping too tightly, and what would it mean to commit it to God?",
  },
  {
    day: 11,
    title: "Be Not Weary in Well Doing",
    theme: "perseverance",
    reference: "Galatians 6:9",
    scripture: "And let us not be weary in well doing: for in due season we shall reap, if we faint not.",
    devotional:
      "Paul's encouragement is honest: we will be tempted to grow weary. Doing good, whether serving others, keeping our word or caring for our bodies, can feel slow and unrewarded. The harvest picture helps. A farmer plants seeds, waters them and waits. For weeks there is nothing to see above the soil, yet something is happening underneath. Training often feels like that. Strength and endurance build quietly, and the mirror or the scale rarely tells the whole story. Paul's promise is that in due season we shall reap, if we faint not. The season is God's, not ours. Our part is to keep sowing. If you are tired today, that is not failure; it is part of the process. Rest if you need rest. But do not quit on something good just because you cannot yet see the harvest.",
    prayer: "Lord, strengthen me when I am weary, and help me keep sowing what is good.",
    train: `Complete today's scheduled workout, scaling it down if you need to. ${REST_DAY}`,
    reflection: "Where are you tempted to give up on something good because the results feel slow?",
  },
  {
    day: 12,
    title: "The Peaceable Fruit",
    theme: "discipline",
    reference: "Hebrews 12:11",
    scripture:
      "Now no chastening for the present seemeth to be joyous, but grievous: nevertheless afterward it yieldeth the peaceable fruit of righteousness unto them which are exercised thereby.",
    devotional:
      "Hebrews is honest about discipline: no chastening seems joyous in the moment, but grievous. The writer is describing the way God trains His children, and the word translated \"exercised\" comes from the same Greek root that gives us \"gymnasium\". God's discipline is not punishment for its own sake. It is training, the patient work of a loving Father shaping us toward peace and righteousness. Anyone who has trained their body knows the pattern. The last reps burn. The early alarm is unwelcome. Yet afterward comes a fruit that could not have been gathered any other way. The same is often true of the harder lessons God allows in our lives. They are rarely pleasant, but they are not purposeless. Today, when something is uncomfortable, whether a set, a conversation or a craving, ask what fruit this training might produce.",
    prayer: "Father, thank You for training me in love; help me trust Your purpose when it is hard.",
    train: `Complete today's scheduled workout and finish the final set with your best form. ${REST_DAY}`,
    reflection: "What uncomfortable season in your life might God be using to train you?",
  },
  {
    day: 13,
    title: "Let Patience Have Her Perfect Work",
    theme: "perseverance",
    reference: "James 1:2–4",
    scripture:
      "My brethren, count it all joy when ye fall into divers temptations; Knowing this, that the trying of your faith worketh patience. But let patience have her perfect work, that ye may be perfect and entire, wanting nothing.",
    devotional:
      "James begins his letter with a startling instruction: count it all joy when you meet various trials. He is not asking us to pretend hardship feels good. He is pointing to what it produces. The testing of faith works patience, and patience, given time, makes us mature and complete. Strength coaches talk about progressive overload: muscles grow because they are challenged a little beyond what is comfortable, then given time to adapt. James describes something similar in the soul. Trials are the load; patience is the adaptation. The key phrase is \"let patience have her perfect work.\" We often want to rush the process or escape it. Today, whatever is stretching you, from a stalled lift to a strained relationship, try not to run from it. Let patience do its work, and trust God to finish what He has started.",
    prayer: "Lord, help me let patience do its full work in me, and give me joy in the process.",
    train: `Complete today's scheduled workout; if progress has stalled, focus on clean technique rather than more weight. ${REST_DAY}`,
    reflection: "What trial are you trying to rush through that might be building patience in you?",
  },
  {
    day: 14,
    title: "Tribulation Worketh Patience",
    theme: "perseverance",
    reference: "Romans 5:3–4",
    scripture:
      "And not only so, but we glory in tribulations also: knowing that tribulation worketh patience; And patience, experience; and experience, hope:",
    devotional:
      "Paul links a chain together: tribulation produces patience, patience produces experience, a word that can also be translated as proven character, and experience produces hope. Hard things, received in faith, do not leave us empty. They leave us tested and hopeful. Two weeks into a challenge, many people hit a wall. The novelty has worn off, life has interrupted, and the finish line still feels far away. This is exactly where character is formed. Anyone can start; perseverance happens in the middle. If you have missed days, catch up gently and keep going. If you are on track, stay humble and steady. Either way, the hope Paul describes is not wishful thinking about your fitness. It rests on God's love, which he says in the very next verse is shed abroad in our hearts by the Holy Ghost.",
    prayer: "Lord, use the hard parts of this season to build patience, character and hope in me.",
    train: `Complete today's scheduled workout. If you've missed days, catch up on one devotional too. ${REST_DAY}`,
    reflection: "Looking back, how has a past hardship shaped your character for good?",
  },
  {
    day: 15,
    title: "He That Ruleth His Spirit",
    theme: "self_control",
    reference: "Proverbs 16:32",
    scripture: "He that is slow to anger is better than the mighty; and he that ruleth his spirit than he that taketh a city.",
    devotional:
      "Proverbs makes a bold comparison: the person who rules their own spirit is greater than the one who captures a city. We celebrate visible victories, such as a new personal record, a race finished or a dramatic photo. Scripture values something less visible but more difficult: mastery of our own impulses, temper and appetites. Self-control is not about crushing every desire or living in fear of every indulgence. It is about not being ruled by them. It is the ability to pause, to choose, and to say yes to what is better. In training, it looks like stopping a set when form breaks down, choosing rest over ego, or walking away from comparison. In life, it looks like a gentle answer instead of an angry one. Today, practise ruling your spirit in one specific moment, and ask the Spirit to help you.",
    prayer: "Holy Spirit, grow self-control in me, and help me choose what is better in the moments that test me.",
    train: `Complete today's scheduled workout, ending each set when your form starts to break down. ${REST_DAY}`,
    reflection: "In what situation do you most need to rule your spirit this week?",
  },
  {
    day: 16,
    title: "A City With Walls",
    theme: "self_control",
    reference: "Proverbs 25:28",
    scripture: "He that hath no rule over his own spirit is like a city that is broken down, and without walls.",
    devotional:
      "In the ancient world, a city without walls was exposed to every raider and every storm. Proverbs says a person without rule over their own spirit is like that city: broken down and defenceless. Healthy boundaries are not prison bars. They are walls that protect what is valuable. A bedtime protects your sleep. A planned meal protects you from grazing out of stress. A firm \"no\" to some commitments protects your ability to give a wholehearted \"yes\" to others. Many people resist boundaries because they feel restrictive. But a life without them is not freer; it is more vulnerable. Think about the gates in your own walls. Where do things slip in that wear you down? Late-night scrolling, constant snacking, an overloaded calendar? Today, rebuild one small section of the wall by choosing one boundary that would protect your health and peace.",
    prayer: "Lord, help me build wise boundaries that protect what You have entrusted to me.",
    train: `Complete today's scheduled workout, then set one boundary for tonight, such as a screen-off time. ${REST_DAY}`,
    reflection: "Which boundary, if you kept it, would most protect your health and peace?",
  },
  {
    day: 17,
    title: "The Fruit of the Spirit",
    theme: "self_control",
    reference: "Galatians 5:22–23",
    scripture:
      "But the fruit of the Spirit is love, joy, peace, longsuffering, gentleness, goodness, faith, Meekness, temperance: against such there is no law.",
    devotional:
      "The fruit of the Spirit is a single fruit with many flavours: love, joy, peace, longsuffering, gentleness, goodness, faith, meekness and temperance. Notice that temperance, or self-control, comes at the end of a list that begins with love. That order matters. Self-control grown apart from love can become harsh, proud or anxious. Self-control that grows from the Spirit is gentle and joyful. Notice also that these are fruit, not achievements. Fruit grows when a branch stays connected to the vine. We do not manufacture patience or peace by sheer effort; we cultivate the conditions in which God grows them, through prayer, Scripture, community and obedience. Today, as you train, pay attention to the spirit in which you do it. Is there joy? Gentleness with yourself? Peace instead of frantic striving? Invite the Spirit to grow His fruit in you.",
    prayer: "Holy Spirit, grow Your fruit in me today, beginning with love.",
    train: `Complete today's scheduled workout with a calm, unhurried mindset. ${REST_DAY}`,
    reflection: "Which fruit of the Spirit do you most want to see grow in you over the next few weeks?",
  },
  {
    day: 18,
    title: "Pressing Toward the Mark",
    theme: "perseverance",
    reference: "Philippians 3:13–14",
    scripture:
      "Brethren, I count not myself to have apprehended: but this one thing I do, forgetting those things which are behind, and reaching forth unto those things which are before, I press toward the mark for the prize of the high calling of God in Christ Jesus.",
    devotional:
      "Paul, late in his ministry, says he has not yet arrived. Instead, he does one thing: forgetting what is behind and reaching toward what is ahead, he presses on toward the prize of God's high calling in Christ. Forgetting the past does not mean pretending it never happened. It means refusing to let it define us, whether past failures that weigh us down or past successes that make us complacent. Many of us carry an old version of ourselves into every workout. \"I used to be stronger.\" \"I've never been athletic.\" \"I always quit.\" Paul invites us to set those stories down. The mark is ahead, not behind. Nearly halfway through this challenge, where you have been matters less than the direction you are facing. Lean forward today, and take the next step toward the calling God has placed on your life.",
    prayer: "Lord, help me release what is behind and press on toward the calling You have for me.",
    train: `Complete today's scheduled workout without comparing yourself to a past version of you. ${REST_DAY}`,
    reflection: "What old story about yourself do you need to stop carrying into today?",
  },
  {
    day: 19,
    title: "Heartily, as to the Lord",
    theme: "discipline",
    reference: "Colossians 3:23",
    scripture: "And whatsoever ye do, do it heartily, as to the Lord, and not unto men;",
    devotional:
      "Paul first wrote these words to servants doing unglamorous, often unnoticed work. His counsel was to do it heartily, as to the Lord and not to men. That changes the audience of everything we do. When we train for applause, our motivation rises and falls with attention. When we train as an offering to God, even an unobserved session matters. Heartily does not mean frantically or perfectly. It means wholeheartedly, with presence and care. It might look like giving full attention to a warm-up instead of rushing through it, or bringing a good attitude to a workout you would rather skip. The same applies to your job, your chores and your relationships. Today, choose one task you usually do half-heartedly and do it as if Jesus were your only audience. Notice how that changes the experience, and how it changes you.",
    prayer: "Lord, let my work and training today be wholehearted offerings to You.",
    train: "Complete today's scheduled workout, giving full attention to each set. Rest day: a 20-minute walk and 10 minutes of mobility, without your phone.",
    reflection: "Whose approval are you most often training or working for?",
  },
  {
    day: 20,
    title: "Strength Made Perfect in Weakness",
    theme: "grace",
    reference: "2 Corinthians 12:9",
    scripture:
      "And he said unto me, My grace is sufficient for thee: for my strength is made perfect in weakness. Most gladly therefore will I rather glory in my infirmities, that the power of Christ may rest upon me.",
    devotional:
      "Halfway through this challenge, you may be more aware of your limits than when you started: tight hips, a tired body, a busy schedule, a stubborn habit. Paul knew limits too. He asked God three times to remove a thorn in the flesh, and God's answer was not removal but grace: \"My grace is sufficient for thee: for my strength is made perfect in weakness.\" This is a different kind of strength from the gym. It does not deny weakness or push recklessly through pain. It brings weakness honestly to God and finds Him enough. If you are injured, ill or limited, your part in this challenge is not lesser. Adapt your training, rest when you need to, and seek good medical advice. God is not waiting for you to become strong before He works. His power rests on those who know they need Him.",
    prayer: "Lord, I bring You my weakness today; let Your grace be sufficient for me.",
    train: "Complete today's scheduled workout, adapting anything that hurts. Rest day, or managing an injury: gentle mobility in a pain-free range and a short walk if comfortable.",
    reflection: "What weakness or limitation do you need to bring honestly to God instead of hiding?",
  },
  {
    day: 21,
    title: "The Temple of the Holy Ghost",
    theme: "stewardship",
    reference: "1 Corinthians 6:19–20",
    scripture:
      "What? know ye not that your body is the temple of the Holy Ghost which is in you, which ye have of God, and ye are not your own? For ye are bought with a price: therefore glorify God in your body, and in your spirit, which are God's.",
    devotional:
      "Paul tells the Corinthians that their bodies are temples of the Holy Ghost, and that they are not their own; they were bought with a price. In a culture that both indulged and despised the body, this was radical. The body is not a prison to escape or an idol to perfect. It is a dwelling place for God's Spirit, purchased through Christ's sacrifice. This changes why we care for it. Not to earn approval, chase an ideal image or compete with others, but to honour the One who lives in us and to have strength to serve. Stewardship includes training, but also sleep, nourishment, medical care, rest and refusing to harm our bodies through neglect or extremes. Today, think of your body with gratitude rather than criticism. It is not a project to perfect; it is a gift entrusted to you.",
    prayer: "Lord, thank You for the gift of this body; help me care for it as Your dwelling place.",
    train: `Complete today's scheduled workout, then drink a full glass of water and thank God for something your body did today. ${REST_DAY}`,
    reflection: "How does seeing your body as a temple, rather than a project, change how you care for it?",
  },
  {
    day: 22,
    title: "A Living Sacrifice",
    theme: "stewardship",
    reference: "Romans 12:1",
    scripture:
      "I beseech you therefore, brethren, by the mercies of God, that ye present your bodies a living sacrifice, holy, acceptable unto God, which is your reasonable service.",
    devotional:
      "After eleven chapters describing God's mercy, Paul finally urges a response: present your bodies a living sacrifice, holy and acceptable to God, which is your reasonable service. Notice the order. Mercy comes first; offering follows. We do not give ourselves to God to obtain His mercy; we give ourselves because we have already received it. And Paul says bodies, not just hearts or minds. Faith is lived out in physical, everyday actions: where our feet go, what our hands do, how we spend our energy. A living sacrifice is not consumed in a single dramatic moment. It is offered daily in ordinary ways. Getting up to train, preparing a nourishing meal, resting when you are depleted and using your strength to help someone can all be worship when offered to God. Today, consciously offer your body and your day to God before you begin anything else.",
    prayer: "Lord, in view of Your mercy, I offer You my body and my day as a living sacrifice.",
    train: `Complete today's scheduled workout, starting with a short prayer offering it to God. ${REST_DAY}`,
    reflection: "What ordinary action today could become an act of worship?",
  },
  {
    day: 23,
    title: "Fearfully and Wonderfully Made",
    theme: "gratitude",
    reference: "Psalm 139:14",
    scripture:
      "I will praise thee; for I am fearfully and wonderfully made: marvellous are thy works; and that my soul knoweth right well.",
    devotional:
      "David marvels at how God formed him: \"I am fearfully and wonderfully made.\" It is worth noticing what he does with that realisation. He does not analyse his flaws or measure himself against others. He praises. Many of us struggle to speak about our bodies with anything other than criticism. We focus on what we wish were different and overlook the astonishing things our bodies do every moment: breathing, healing, balancing, carrying, embracing. Fitness culture can feed that criticism if we are not careful, turning training into a constant attempt to fix what is wrong. Scripture offers a different starting point. You are not a mistake to be corrected. You are a creation to be cared for. Training can then flow from gratitude rather than shame. Today, before you look in a mirror or step on a scale, praise God for one specific way your body works.",
    prayer: "Creator God, I praise You, for I am fearfully and wonderfully made.",
    train: `Complete today's scheduled workout, noticing what your body can do rather than how it looks. ${REST_DAY}`,
    reflection: "What would change if you spoke about your body the way David speaks to God about it?",
  },
  {
    day: 24,
    title: "The LORD Looketh on the Heart",
    theme: "humility",
    reference: "1 Samuel 16:7",
    scripture:
      "But the LORD said unto Samuel, Look not on his countenance, or on the height of his stature; because I have refused him: for the LORD seeth not as man seeth; for man looketh on the outward appearance, but the LORD looketh on the heart.",
    devotional:
      "When Samuel went to anoint Israel's next king, he was impressed by Eliab's appearance and height. God corrected him: man looks on the outward appearance, but the Lord looks on the heart. The youngest son, David, out tending sheep, was God's choice. We live in a world preoccupied with appearance, and fitness spaces can intensify it. Before-and-after photos, filtered images and constant comparison quietly suggest that our worth rises and falls with how we look. God does not measure you that way. Your value is not in your waistline, muscle definition or age. He sees your heart. That does not make the body unimportant, but it puts appearance in its proper place. Today, if comparison creeps in, remember that God's gaze rests on your heart, and His love for you is not a reward for looking a certain way.",
    prayer: "Lord, free me from comparison, and help me care most about what You see in my heart.",
    train: `Complete today's scheduled workout, focusing on how you feel and move rather than how you look. ${REST_DAY}`,
    reflection: "How much does appearance shape the way you value yourself and others?",
  },
  {
    day: 25,
    title: "Bodily Exercise Profiteth Little",
    theme: "humility",
    reference: "1 Timothy 4:8",
    scripture:
      "For bodily exercise profiteth little: but godliness is profitable unto all things, having promise of the life that now is, and of that which is to come.",
    devotional:
      "It may seem strange to find this verse in a fitness challenge. Paul tells Timothy that bodily exercise profits little, but godliness is profitable for all things, holding promise for this life and the life to come. Paul is not dismissing exercise; he grants that it has some value. But he refuses to let it become ultimate. That is a healthy guardrail. Training is good, but it can quietly become an idol: the thing that defines our identity, dictates our mood and crowds out relationships and worship. A wise disciple holds fitness with an open hand. It serves the greater goal of a godly life: loving God, loving neighbours and being useful in His kingdom. Today, enjoy your training, but also invest in godliness. Spend a few extra minutes in prayer, reach out to someone in need, or practise patience. That training lasts forever.",
    prayer: "Lord, keep my training in its right place, and grow in me a godliness that lasts.",
    train: `Complete today's scheduled workout, then spend five minutes in prayer or Scripture. ${REST_DAY}`,
    reflection: "Is there any sign that fitness has become too central in your life? What would rebalancing look like?",
  },
  {
    day: 26,
    title: "Do All to the Glory of God",
    theme: "stewardship",
    reference: "1 Corinthians 10:31",
    scripture: "Whether therefore ye eat, or drink, or whatsoever ye do, do all to the glory of God.",
    devotional:
      "Paul says that whether we eat, drink or do anything else, we should do all to the glory of God. Food is one of the most ordinary parts of life, and one of the places where many of us struggle most. Some people eat to numb stress. Others feel constant guilt about every bite. Neither honours God. Eating to His glory begins with gratitude: receiving food as a good gift, giving thanks sincerely and enjoying meals with others. It includes wisdom: nourishing our bodies well enough to work, serve and recover. And it includes freedom: food is not a moral scorecard, and a single meal does not determine your worth. Today, slow down at one meal. Give thanks before you eat. Eat with attention rather than distraction. Notice how food can become an occasion for worship rather than a source of anxiety.",
    prayer: "Lord, thank You for the food You provide; help me eat with gratitude, wisdom and freedom.",
    train: `Complete today's scheduled workout, and eat one meal slowly and without screens, giving thanks first. ${REST_DAY}`,
    reflection: "Is your relationship with food marked more by gratitude, guilt or distraction?",
  },
  {
    day: 27,
    title: "And He Rested",
    theme: "rest",
    reference: "Genesis 2:2",
    scripture:
      "And on the seventh day God ended his work which he had made; and he rested on the seventh day from all his work which he had made.",
    devotional:
      "On the seventh day, God rested from all His work. The Almighty did not need to recover from fatigue; He was establishing a pattern for His creation. Rest is woven into the fabric of the world from the very beginning. It is not a reward for the productive or a concession for the weak. It is part of how we were made to flourish. Every good training program includes rest days, because the body adapts during recovery, not during the workout itself. Our souls work in a similar way. Without rhythms of rest, we grow brittle, anxious and less able to love others well. Many driven people find rest harder than effort. If that is you, consider that rest is an act of trust. It says, \"The world does not depend on me.\" Today, whether it is a training day or not, build in a real pause, and receive it as a gift.",
    prayer: "Lord, teach me to rest as You designed, trusting You with what I leave undone.",
    train: "If today is a training day, complete your scheduled workout and plan a genuine rest day this week. If it's a rest day: rest fully, with a gentle 15-minute walk if you'd like.",
    reflection: "Do you treat rest as a gift, a reward or a weakness? Why?",
  },
  {
    day: 28,
    title: "Come Ye Apart and Rest a While",
    theme: "rest",
    reference: "Mark 6:31",
    scripture:
      "And he said unto them, Come ye yourselves apart into a desert place, and rest a while: for there were many coming and going, and they had no leisure so much as to eat.",
    devotional:
      "The disciples had just returned from a busy mission, full of stories. So many people were coming and going that they had no time even to eat. Jesus did not tell them to push harder. He said, \"Come ye yourselves apart into a desert place, and rest a while.\" Jesus cares about the exhaustion of His followers. He invites them to step away, not as a reward, but as a necessity. Notice too that He says \"come\", which means with Him. Rest is not merely the absence of activity; it is time in His presence. In a culture that celebrates busyness, slowing down can feel like falling behind. But overtraining, chronic stress and poor sleep wear down both body and soul. Today, find a quiet place, even for ten minutes, to sit with Jesus. Bring Him your fatigue and let Him restore you.",
    prayer: "Jesus, I come to You in my weariness; give me rest in Your presence.",
    train: "Complete today's scheduled workout at a comfortable effort. Rest day: 10 minutes of quiet prayer, then a slow 20-minute walk.",
    reflection: "When did you last truly step away to rest with Jesus? What keeps you from it?",
  },
  {
    day: 29,
    title: "He Giveth His Beloved Sleep",
    theme: "rest",
    reference: "Psalm 127:2",
    scripture:
      "It is vain for you to rise up early, to sit up late, to eat the bread of sorrows: for so he giveth his beloved sleep.",
    devotional:
      "The psalmist observes that it is vain to rise up early and sit up late, eating the bread of anxious toil, for God gives His beloved sleep. Sleep is one of the clearest pictures of our dependence. Every night we must stop, lie down and trust that the world will keep turning without us. For many, sleep is the first thing sacrificed to a busy schedule, yet it is among the most powerful tools for recovery, mood and health. Anxious overwork, the psalm suggests, is ultimately fruitless, because unless the Lord builds the house, the builders labour in vain. Choosing sleep can be an act of faith, confessing that we are creatures, not machines. Tonight, protect your sleep. Set a reasonable bedtime, put devices away, and before you close your eyes, commit tomorrow's concerns to the One who never sleeps.",
    prayer: "Lord, I trust You with what is undone; grant me restful sleep tonight.",
    train: "Complete today's scheduled workout, earlier in the day if you can, and aim to be in bed 30 minutes earlier tonight. Rest day: a 20-minute walk and gentle stretching before bed.",
    reflection: "What keeps you from getting the sleep your body needs, and what is one change you could make?",
  },
  {
    day: 30,
    title: "They That Wait Upon the LORD",
    theme: "rest",
    reference: "Isaiah 40:31",
    scripture:
      "But they that wait upon the LORD shall renew their strength; they shall mount up with wings as eagles; they shall run, and not be weary; and they shall walk, and not faint.",
    devotional:
      "Isaiah wrote to weary people who felt forgotten by God. His answer was not a pep talk about trying harder. It was an invitation to wait upon the Lord. Waiting, in the biblical sense, is not passive. It is hopeful dependence, looking to God for what we cannot generate ourselves. And the result is renewed strength: mounting up with wings as eagles, running without weariness, walking without fainting. Notice the order: soaring, then running, then walking. Sometimes the greatest strength is simply to keep walking. Ten days remain in this challenge. You may feel energised, or you may be running on empty. Either way, strength for the final stretch does not come from willpower alone. It comes from returning, again and again, to the One who renews. Take a few minutes today to wait on Him in silence before you do anything else.",
    prayer: "Lord, I wait on You; renew my strength for the road ahead.",
    train: "Complete today's scheduled workout. Rest day: two minutes of silent prayer, then a 20-minute walk and 10 minutes of mobility.",
    reflection: "Are you trying to renew your strength on your own? What would waiting on the Lord look like today?",
  },
  {
    day: 31,
    title: "He Restoreth My Soul",
    theme: "rest",
    reference: "Psalm 23:1–3",
    scripture:
      "The LORD is my shepherd; I shall not want. He maketh me to lie down in green pastures: he leadeth me beside the still waters. He restoreth my soul: he leadeth me in the paths of righteousness for his name's sake.",
    devotional:
      "Psalm 23 is beloved because it describes a God who cares for the whole person. The shepherd provides, so \"I shall not want.\" He leads to green pastures and still waters, places of nourishment and rest. He restores the soul. And He leads in paths of righteousness for His name's sake. Notice that the sheep do not make themselves lie down; the shepherd makes them lie down. Sometimes God's care comes as a gentle limit: an illness that slows us, a season that forces rest. Restoration is not only physical. Our souls are depleted by stress, conflict, grief and constant noise. Exercise can help, but it cannot restore a soul on its own. Only the Shepherd can. Today, follow His lead to a still place. Read the whole psalm slowly, and let Him restore what is depleted in you.",
    prayer: "Good Shepherd, lead me beside still waters today and restore my soul.",
    train: "Complete today's scheduled workout. Rest day: a slow 20-minute walk outdoors, praying Psalm 23 as you go.",
    reflection: "Where do you need the Shepherd's restoration most right now?",
  },
  {
    day: 32,
    title: "Two Are Better Than One",
    theme: "community",
    reference: "Ecclesiastes 4:9–10",
    scripture:
      "Two are better than one; because they have a good reward for their labour. For if they fall, the one will lift up his fellow: but woe to him that is alone when he falleth; for he hath not another to help him up.",
    devotional:
      "The Preacher observes that two are better than one, because if one falls, the other can lift him up. Woe to the one who is alone when he falls. We were never meant to walk the narrow way alone. Faith is lived in community, and so, often, is perseverance. A training partner makes it harder to skip an early session. A friend who knows your struggles can encourage you when you are discouraged. A church family can carry you through seasons when you cannot carry yourself. Many of us find it easier to help others than to ask for help, but receiving support is also a form of humility. Today, consider who walks alongside you. Is there someone you could invite to train with you, pray with you or simply check in on you? And is there someone who is falling and needs your hand?",
    prayer: "Lord, thank You for the people You've placed around me; help me lift others and let others lift me.",
    train: "Complete today's scheduled workout, and invite someone to join you for a session or walk this week. Rest day: a 20-minute walk with a friend or family member if you can.",
    reflection: "Who could you invite to walk with you in your faith or your health?",
  },
  {
    day: 33,
    title: "Iron Sharpeneth Iron",
    theme: "community",
    reference: "Proverbs 27:17",
    scripture: "Iron sharpeneth iron; so a man sharpeneth the countenance of his friend.",
    devotional:
      "\"Iron sharpeneth iron; so a man sharpeneth the countenance of his friend.\" Sharpening involves friction. Two blades scrape against each other, and both become more useful. Good friendships are not always comfortable. A true friend will tell you when your form is off, when you are overtraining, or when your priorities are drifting. They challenge you to grow, and they let you return the favour. This kind of relationship requires humility and honesty. It is easy to surround ourselves with people who only affirm us, or to avoid close relationships entirely to protect ourselves. But growth happens in honest community. Training partners, small groups and mentors can all be iron in our lives. Today, think about who sharpens you, and whether you sharpen anyone. Thank someone who has spoken honestly to you, and be ready to receive correction with grace.",
    prayer: "Lord, give me friends who sharpen me, and make me a friend who sharpens others in love.",
    train: `Complete today's scheduled workout, and ask someone you trust for honest feedback on your form or routine. ${REST_DAY}`,
    reflection: "Who sharpens you, and how can you be that kind of friend to someone else?",
  },
  {
    day: 34,
    title: "Bear Ye One Another's Burdens",
    theme: "community",
    reference: "Galatians 6:2",
    scripture: "Bear ye one another's burdens, and so fulfil the law of Christ.",
    devotional:
      "Paul instructs us to bear one another's burdens and so fulfil the law of Christ. The law of Christ is love, and love is often expressed by sharing a load someone cannot carry alone. Strength is a gift meant to be shared. The physical strength you are building can help a neighbour move furniture, carry groceries for an elderly friend, or keep up with children at play. The perseverance you are developing can help you sit patiently with someone who is grieving. The discipline you are practising can make you dependable when others need you. Fitness that only serves ourselves misses its highest purpose. Today, look for a burden to share. It might be practical, like helping with a chore, or relational, like a phone call to someone who is struggling. Let your strength become a blessing to someone else.",
    prayer: "Lord, show me whose burden I can help carry today, and give me a willing heart.",
    train: "Complete today's scheduled workout, then use some of your strength to help someone in a practical way. Rest day: a 20-minute walk and one act of service.",
    reflection: "Whose burden could you help carry this week?",
  },
  {
    day: 35,
    title: "Walk Humbly With Thy God",
    theme: "humility",
    reference: "Micah 6:8",
    scripture:
      "He hath shewed thee, O man, what is good; and what doth the LORD require of thee, but to do justly, and to love mercy, and to walk humbly with thy God?",
    devotional:
      "The people in Micah's day wondered what offering would please God: burnt offerings, thousands of rams, rivers of oil? Micah's answer cuts through religious performance: do justly, love mercy, walk humbly with your God. Walking humbly is a fitting image for this stage of the challenge. Humility is not thinking poorly of ourselves; it is seeing ourselves truthfully, as beloved creatures who depend on God. In training, humility means using honest weights, respecting our limits and celebrating others' progress without envy. It means admitting when we need rest or help. In life, it means caring about justice and mercy more than about our image. A walk is not a sprint. It is steady, companionable and daily. Five days remain. Walk them humbly, not trying to impress God, but simply staying close to Him.",
    prayer: "Lord, teach me to do justly, love mercy and walk humbly with You.",
    train: "Complete today's scheduled workout with honest weights and no ego lifting. Rest day: a 30-minute walk, praying as you go.",
    reflection: "In what area of life is pride or performance getting in the way of walking humbly with God?",
  },
  {
    day: 36,
    title: "Good Stewards of Grace",
    theme: "stewardship",
    reference: "1 Peter 4:10",
    scripture:
      "As every man hath received the gift, even so minister the same one to another, as good stewards of the manifold grace of God.",
    devotional:
      "Peter writes that every person has received a gift, and we are to use it to serve one another as good stewards of God's manifold grace. Stewards do not own what they manage; they care for it on behalf of someone else. Your health, energy, time and abilities are all gifts. Over these weeks you have been stewarding your body. Now consider the other gifts entrusted to you. Perhaps you are an encourager, a teacher, an organiser, a good listener or someone who makes people laugh. These gifts are not for private enjoyment. They are given so that grace can flow through you to others. As the challenge nears its end, ask how your growing strength and discipline might serve. Could you encourage a beginner, volunteer, or walk alongside someone just starting their journey? Grace received becomes grace shared.",
    prayer: "Lord, thank You for the gifts You have given me; help me use them faithfully to serve others.",
    train: `Complete today's scheduled workout, then send a word of encouragement to someone who is just starting out. ${REST_DAY}`,
    reflection: "What gift has God entrusted to you that could serve someone else this week?",
  },
  {
    day: 37,
    title: "Content in Every State",
    theme: "trust",
    reference: "Philippians 4:12–13",
    scripture:
      "I know both how to be abased, and I know how to abound: every where and in all things I am instructed both to be full and to be hungry, both to abound and to suffer need. I can do all things through Christ which strengtheneth me.",
    devotional:
      "\"I can do all things through Christ which strengtheneth me\" is one of the most quoted verses in sport. Yet in context, Paul is not talking about winning. He is talking about contentment. He has learned to be full and to be hungry, to abound and to suffer need. The strength Christ gives is strength to be faithful and content in every circumstance, including hard ones. This matters for anyone pursuing fitness goals. You may reach your target, or you may not. You may set a personal record, or an injury may sideline you. Paul's secret is not that Christ guarantees outcomes, but that Christ is sufficient in all of them. Contentment does not kill ambition; it frees it from anxiety. Today, whatever your results so far, give thanks for where you are and ask for strength to be faithful in it.",
    prayer: "Lord Jesus, teach me to be content in every circumstance, and strengthen me to be faithful in each one.",
    train: `Complete today's scheduled workout, whatever your energy level, and be content with your honest best. ${REST_DAY}`,
    reflection: "Is your peace currently tied to reaching a particular outcome? What would contentment look like?",
  },
  {
    day: 38,
    title: "In Every Thing Give Thanks",
    theme: "gratitude",
    reference: "1 Thessalonians 5:18",
    scripture: "In every thing give thanks: for this is the will of God in Christ Jesus concerning you.",
    devotional:
      "Paul writes, \"In every thing give thanks: for this is the will of God in Christ Jesus concerning you.\" Notice that he says in every thing, not for every thing. We do not have to be grateful for pain, injustice or loss. But in the middle of any circumstance, we can find reasons to thank God, because He is present and good. Gratitude reshapes our perspective. It turns our attention from what is lacking to what has been given. Look back over these thirty-eight days. What can you give thanks for? Perhaps a workout you did not want to do but finished. A morning you felt strong. A friend who encouraged you. A verse that met you at the right moment. Even the days you missed can remind you of grace. Today, write down five things you are thankful for from this challenge, and thank God for each one.",
    prayer: "Father, thank You for Your presence in every part of this journey; make me a grateful person.",
    train: "Complete today's scheduled workout, giving thanks between sets. Rest day: a 20-minute gratitude walk, naming one thing you're thankful for each minute.",
    reflection: "What are five things from this challenge that you are thankful for?",
  },
  {
    day: 39,
    title: "Nothing Shall Separate Us",
    theme: "grace",
    reference: "Romans 8:38–39",
    scripture:
      "For I am persuaded, that neither death, nor life, nor angels, nor principalities, nor powers, nor things present, nor things to come, Nor height, nor depth, nor any other creature, shall be able to separate us from the love of God, which is in Christ Jesus our Lord.",
    devotional:
      "As the challenge draws to a close, Paul's great declaration is worth hearing again: nothing in all creation can separate us from the love of God which is in Christ Jesus our Lord. Not death or life, not angels or powers, not things present or things to come. That list does not mention a missed workout, a stalled scale or a broken streak, but if angels and powers cannot separate us from God's love, those certainly cannot. Some people will finish these forty days with every box ticked. Others will have gaps and catch-up days. Some may feel they have failed. Hear this clearly: your standing with God has never depended on your performance in this challenge. His love was not earned on day one and cannot be lost on day thirty-nine. The disciplines matter, but they are responses to love, not the price of it.",
    prayer: "Lord, thank You that nothing can separate me from Your love in Christ Jesus.",
    train: `Complete today's scheduled workout, and if you have missed days, catch up on one devotional. ${REST_DAY}`,
    reflection: "How does knowing that God's love doesn't depend on your performance change the way you see this challenge?",
  },
  {
    day: 40,
    title: "I Have Finished My Course",
    theme: "perseverance",
    reference: "2 Timothy 4:7",
    scripture: "I have fought a good fight, I have finished my course, I have kept the faith:",
    devotional:
      "Near the end of his life, Paul wrote, \"I have fought a good fight, I have finished my course, I have kept the faith.\" These are not the words of someone who never struggled. Paul was shipwrecked, beaten, imprisoned and abandoned. His course was not smooth, but he finished it faithfully. Today you finish a course too, small compared with Paul's but real. You have spent forty days with Scripture and with your body, practising discipline, perseverance, rest and gratitude. Whatever your path looked like, finishing matters. Yet this is not the end of the narrow way. The goal was never forty days of perfection, but a life of faithful steps. Celebrate today. Thank God for His grace along the way. Then consider which habits you want to carry forward, and keep walking through the narrow gate, one day at a time.",
    prayer: "Lord, thank You for carrying me through these forty days; help me keep the faith and keep walking with You.",
    train: "Complete today's scheduled workout as a celebration of the journey. Rest day: a 30-minute celebration walk, thanking God for what you've learned.",
    reflection: "Which habit from these forty days do you most want to carry forward?",
  },
];

export function devotionalForDay(day: number): Devotional {
  const clamped = Math.min(CHALLENGE_DAYS, Math.max(1, Math.trunc(day)));
  return DEVOTIONALS[clamped - 1]!;
}

export const DEVOTIONAL_THEME_LABELS: Record<DevotionalTheme, string> = {
  discipline: "Discipline",
  grace: "Grace",
  perseverance: "Perseverance",
  courage: "Courage",
  trust: "Trust",
  self_control: "Self-control",
  stewardship: "Stewardship",
  rest: "Rest",
  humility: "Humility",
  community: "Community",
  gratitude: "Gratitude",
};
