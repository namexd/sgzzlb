const fs = require('fs');
const path = require('path');
const http = require('http');

const API_URL = 'http://127.0.0.1:18080/v1/images/generations';
const API_KEY = 'f7bf335983f17f8523708ec25c1cd1b5';
const OUTPUT_DIR = path.join(__dirname, '..', 'data', 'cards');
const CATALOG = path.join(__dirname, '..', 'data', 'catalog.js');
const DELAY_MS = 8000;

const FACTION_COLOR = {
  '魏': 'deep blue and gold tones, icy steel blue ambient light',
  '蜀': 'emerald green and gold tones, bamboo forest green ambient light',
  '吴': 'crimson red and gold tones, fierce fire red ambient light',
  '群': 'dark purple and gold tones, mysterious purple ambient light'
};

const HERO_VISUAL = {
  // ===== 魏 =====
  '曹操': 'middle-aged warlord with thin beard, piercing eyes, three-peaked crown helmet, ornate dark blue armor with gold dragon trim, flowing dark cape',
  '司马懿': 'cunning elderly strategist with hawk-like eyes, patient predatory expression, dark robes with gold trim',
  '张辽': 'mighty cavalry general with fierce expression, blue armor, wielding dual halberds, charging pose',
  '张春华': 'stern beautiful woman with cold eyes, dark elegant robes, sharp demeanor',
  '郭嘉': 'young brilliant strategist with playful smirk, elegant blue robes, wine cup nearby',
  '夏侯惇': 'one-eyed fierce general with scar over left eye, missing eye, heavy armor, defiant expression',
  '徐晃': 'strong broad-shouldered warrior with determined face, wielding massive battle axe, heavy armor',
  '典韦': 'bare-chested giant warrior with wild hair, twin massive halberds, terrifying muscles, fierce expression',
  '许褚': 'tiger-like massive bare warrior, huge muscular build, wild battle rage expression, shirtless with armor',
  '荀攸': 'calm scholarly strategist with thoughtful expression, elegant robes, holding strategy scroll',
  '曹仁': 'defensive fortress general with heavy shield, stern disciplined expression, thick heavy armor',
  '邓艾': 'cautious strategist with slight squint, one eye subtly smaller, patient calculating expression',
  '庞德': 'fierce determined warrior carrying a coffin on his back, death-defying expression, heavy armor',
  '乐进': 'compact fierce warrior with aggressive charging pose, blue armor, determined expression',
  '于禁': 'stern disciplined general with rigid posture, strict expression, formal military armor',
  '张郃': 'experienced tactical general with calculating eyes, spear in hand, battle-hardened armor',
  '夏侯渊': 'swift cavalry general with bow drawn, lean build, speed-focused light armor, fierce eyes',
  '曹丕': 'scheming young emperor with cold calculating eyes, imperial robes, somewhat cruel expression',
  '曹植': 'elegant poetic prince with literary grace, flowing silk robes, brush in hand, dreamy expression',
  '甄姬': 'ethereal beauty with phoenix crown, flowing rainbow silk robes, lotus imagery, mesmerizing',
  '荀彧': 'dignified wise advisor with scholarly bearing, formal court robes, jade pendant, composed expression',
  '程昱': 'cunning elderly strategist with dark sharp eyes, sinister knowing smile, dark robes',
  '钟会': 'ambitious young general with arrogant confident expression, sharp features, ornate armor',
  '王双': 'massive warrior wielding twin battle axes, heavy fur-lined armor, intimidating bulk',
  '陈群': 'scholarly official with formal robes, holding legal scrolls, dignified composed expression',
  '曹纯': 'young cavalry commander in light mobile armor, swift horse, determined expression',
  '满宠': 'stern defensive general with fortress-like stance, heavy armor, resolute expression',
  '王元姬': 'intelligent noblewoman with perceptive eyes, elegant robes, scholarly demeanor',
  'SP荀彧': 'golden-robed celestial advisor with heavenly mandate glow, wise transcendent expression',
  'SP郭嘉': 'young genius strategist with ethereal blue glow, mysterious aura, brilliant eyes',

  // ===== 蜀 =====
  '刘备': 'benevolent middle-aged leader with kind eyes, generous build, green and gold imperial robes, jade pendant',
  '关羽': 'tall imposing warrior with long flowing red beard, green robe, golden dragon armor, guan dao weapon',
  '张飞': 'fierce giant warrior with wild black beard, leopard head, fierce war expression, heavy black armor with gold trim',
  '赵云': 'young handsome warrior with determined expression, silver and gold armor, white cape flowing',
  '诸葛亮': 'wise slender strategist with calm expression, feather fan in hand, tall scholar hat, elegant blue robes',
  '马超': 'young fierce warrior in white armor with silver trim, flowing white cape, horseback rider, determined expression',
  '黄忠': 'powerful elderly archer with white beard, still muscular build, drawing massive bow, wise eyes',
  '庞统': 'brilliant strategist with unusual plain features, balding head, clever knowing smile, simple robes',
  '法正': 'cunning advisor with sharp calculating expression, dark robes, scheming demeanor',
  '黄月英': 'clever inventor woman with bronze skin, mechanical gears nearby, clever determined expression, practical robes',
  '魏延': 'fierce ambitious general with unique skull-like birthmark on forehead, dark armor, intense eyes',
  '关银屏': 'young fierce warrior woman with Guan Yu resemblance, red-tinted armor, determined expression',
  '张苞': 'young fierce warrior with wild black beard like his father, heavy armor, aggressive stance',
  '关兴': 'young noble warrior with reddish features like Guan Yu, green-tinged armor, determined expression',
  '严颜': 'elderly white-bearded general with unyielding dignified expression, heavy armor, stubborn pride',
  '王平': 'cautious practical general with weathered face, simple but functional armor, steady gaze',
  '徐庶': 'scholar-warrior with conflicted expression, elegant robes mixed with armor, holding sword',
  '陈到': 'loyal protective general with steady unwavering expression, white-plumed helmet, shield bearer',
  '蒋琬': 'scholarly administrator with calm composed expression, formal court robes, holding documents',
  '伊籍': 'quick-witted messenger with alert sharp eyes, light traveling robes, nimble appearance',
  'SP诸葛亮': 'transcendent strategist with golden celestial glow, heavenly scrolls, cosmic wisdom aura',

  // ===== 吴 =====
  '孙权': 'broad-faced young ruler with purple eyes, dragon crown, crimson red armor with gold trim, imperial robe',
  '周瑜': 'elegant young commander with refined handsome features, red and gold armor, fire imagery',
  '陆逊': 'young brilliant strategist with gentle scholarly appearance, red-tinged armor, calm wisdom',
  '孙坚': 'fierce veteran warrior with scarred face, red armor, tiger-like ferocity, battle-hardened',
  '孙策': 'young bold warrior with charismatic smile, red armor, dynamic powerful pose, heroic bearing',
  '太史慈': 'mighty archer warrior with muscular build, drawing powerful bow, fierce determined expression, red armor',
  '吕蒙': 'scholar-turned-general with focused intense expression, red armor, books nearby, determined',
  '鲁肃': 'kind generous diplomat with warm benevolent expression, red-tinged formal robes, peaceful demeanor',
  '凌统': 'young fierce warrior with hot-tempered expression, red armor, aggressive combat stance',
  '周泰': 'scarred loyal bodyguard warrior with many visible battle wounds, bare-chested showing scars, fierce devotion',
  '大乔': 'elegant noblewoman with graceful beauty, flowing silk dress, swan imagery, refined poise',
  '小乔': 'youthful beauty with delicate features, light flowing dress, butterfly imagery, gentle expression',
  '程普': 'elderly veteran general with white beard, still strong, red armor, wise experienced eyes',
  '黄盖': 'old loyal warrior with white hair, determined expression, fire attack pose, scarred face',
  '张昭': 'elderly stern scholar-official with disapproving expression, formal court robes, pointing finger',
  '张纮': 'wise elderly scholar with calm composed expression, formal robes, scholarly demeanor',
  '陆抗': 'young capable general with determined expression, red armor, strategic bearing',
  'SP周瑜': 'ethereal fire commander with blazing inferno background, divine flames, transcendent beauty',
  'SP吕蒙': 'stealthy water warrior with river mist, naval elements, determined expression',

  // ===== 群 =====
  '吕布': 'terrifying fierce warrior with feathered headdress, dark armor with dragon motifs, twin halberd, intimidating aura',
  '貂蝉': 'stunningly beautiful woman with delicate features, silk flowing robes, moonflower imagery, graceful pose',
  '华佗': 'elderly sage doctor with white beard, gentle wise eyes, white robes, carrying medicine gourd',
  '左慈': 'mystical old immortal with wild white hair, Daoist robes, magical glowing aura, ethereal presence',
  '董卓': 'massive tyrannical warlord with cruel expression, heavy dark armor, intimidating bulk, dark aura',
  '张角': 'mystical yellow turban rebel leader with wild eyes, yellow robes, lightning imagery, fanatical expression',
  '于吉': 'mysterious ethereal sage with floating appearance, misty robes, supernatural aura, wispy beard',
  '公孙瓒': 'white horse cavalry general with flowing white cape, horseback pose, noble warrior expression',
  '袁绍': 'arrogant noble lord with haughty expression, ornate but impractical armor, entitled demeanor',
  '袁术': 'self-important foolish lord with pompous expression, imperial-style robes, greedy eyes',
  '颜良': 'mighty fierce warrior with massive build, heavy weapon, aggressive charging pose',
  '文丑': 'wild fierce warrior with untamed appearance, heavy armor, berserker rage expression',
  '华雄': 'towering fierce warrior with intimidating presence, heavy armor, arrogant battle stance',
  '高顺': 'disciplined stoic general with rigid posture, perfectly organized armor, unemotional expression',
  '吕布': 'terrifying fierce warrior with feathered headdress, dark armor with dragon motifs, twin halberd, intimidating aura',
  '陈宫': 'proud righteous strategist with moral conviction, dark robes, betrayed expression, principled bearing',
  '袁绍': 'arrogant noble lord with haughty expression, ornate golden armor, entitled demeanor',
  '李儒': 'sinister scheming advisor with dark cunning eyes, poisoned cup nearby, evil smile',
  '祝融夫人': 'fierce barbarian queen with fire weapons, tribal tattoos, wild flame-colored hair, warrior pose',
  '孟获': 'massive barbarian chieftain with tribal armor, beast skins, fierce expression, primal power',
  '兀突骨': 'giant barbarian warrior in vine armor, jungle tribal appearance, poisonous mist aura',
  '吕玲绮': 'young fierce female warrior with father resemblance, dark armor, aggressive spear wielder',
  '蔡文姬': 'melancholic beauty with guqin instrument, scholarly woman, ink and scrolls imagery',
  '田丰': 'stubborn elderly advisor with righteous angry expression, formal robes, unbending posture',
  '沮授': 'loyal strategist with worried concerned expression, formal robes, desperate loyalty',
  '许攸': 'arrogant traitor scholar with smug expression, pointing finger, self-satisfied smirk',
  '张让': 'cunning eunuch with smooth scheming face, dark court robes, manipulative expression',
  '邹氏': 'dangerous seductive beauty with alluring gaze, silk robes, warning aura',
  '董白': 'young noble girl with innocent appearance, elegant robes, surprising strength',
  '蔡邕': 'elderly scholar with scholarly dignity, holding calligraphy brush, wise ancient expression',
  '张昭': 'elderly stern scholar-official with disapproving expression, formal court robes, pointing finger',
  'sp袁绍': 'noble aristocratic lord with siege towers behind, grand army banner, regal armor',
  'sp朱儁': 'siege warfare commander with breaking walls, determined fierce expression, heavy armor',
;

function getDefaultVisual(hero) {
  const tagVisual = {
    '武': 'powerful warrior with weapon, muscular build, battle-scarred armor',
    '战': 'battle-hardened general with war cape, commanding presence, scarred face',
    '谋': 'intellectual strategist with war fan or scroll, elegant robes with armor, sharp eyes',
    '辅': 'wise supportive commander, dignified expression, ornate ceremonial armor',
    '控': 'commanding presence with mystical energy, glowing eyes, authoritative stance',
    '医': 'sage healer with medicine staff, gentle wise expression, flowing robes',
    '盾': 'towering defensive warrior with massive shield, impenetrable heavy armor',
    '政': 'dignified statesman in formal court robes, scholarly appearance, composed expression',
    '魅': 'enchanting beauty with flowing silk robes, captivating gaze, elegant pose',
    '仙': 'ethereal immortal with mystical robes, floating clouds, otherworldly aura',
    '蛮': 'fierce barbarian warrior with tribal markings, beast pelts, raw primal energy',
    '黄': 'rebel leader with yellow cloth wrapping, peasant armor, determined expression',
    '兼': 'versatile balanced warrior, multi-weapon mastery, adaptive stance'
  };
  const tag = hero.tags[0] || '武';
  const age = hero.cost >= 6 ? 'middle-aged' : 'young';
  const gender = ['甄姬','貂蝉','大乔','小乔','蔡文姬','黄月英','祝融夫人','吕玲绮','邹氏','董白','王元姬','张春华','马云禄','张姬','关银屏','孙尚香','SP诸葛亮'].includes(hero.name) ? 'woman' : 'man';
  return `${age} ${gender} with ${tagVisual[tag] || tagVisual['武']}`;
}

function getPrompt(hero) {
  const visual = HERO_VISUAL[hero.name] || getDefaultVisual(hero);
  const color = FACTION_COLOR[hero.faction] || FACTION_COLOR['群'];

  return `High quality character portrait of ${hero.name}, a Three Kingdoms era ${hero.faction} faction commander, command cost ${hero.cost}.
${visual}.
Half-body portrait, wearing ornate armor with gold trim.
${color}, dark moody atmospheric background.
Cinematic lighting, highly detailed face and armor, professional digital painting, 4K quality.
Elegant gold card frame border around the portrait. Hero name ${hero.name} written in Chinese calligraphy on the card. Faction badge ${hero.faction} in top left corner. Command cost number ${hero.cost} displayed in a circular gold badge in the top right corner. NO health bars, NO skill icons, NO mana cost numbers, NO game UI elements.`;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function generateImage(hero, index) {
  const prompt = getPrompt(hero);
  const filename = `${hero.name}.png`;
  const filepath = path.join(OUTPUT_DIR, filename);

  if (fs.existsSync(filepath)) {
    console.log(`[${index+1}/112] SKIP (exists): ${hero.name}`);
    return 'skipped';
  }

  console.log(`[${index+1}/112] Generating: ${hero.name} (${hero.faction}·${hero.tags.join(',')})...`);

  try {
    const body = JSON.stringify({
      model: 'gpt-image-2',
      prompt: prompt,
      n: 1,
      size: '1024x1536',
      response_format: 'b64_json'
    });

    const result = await new Promise((resolve, reject) => {
      const req = http.request(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Length': Buffer.byteLength(body)
        },
        timeout: 300000
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try { resolve(JSON.parse(data)); }
          catch(e) { reject(new Error('Parse: ' + data.slice(0, 200))); }
        });
      });
      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
      req.write(body);
      req.end();
    });

    if (result.data && result.data[0] && result.data[0].b64_json) {
      const imgBuf = Buffer.from(result.data[0].b64_json, 'base64');
      fs.writeFileSync(filepath, imgBuf);
      console.log(`  ✅ Saved: ${filename} (${(imgBuf.length/1024).toFixed(0)}KB)`);
      return 'ok';
    } else {
      const errMsg = result.error ? result.error.message : JSON.stringify(result).slice(0, 200);
      console.log(`  ❌ Error: ${errMsg}`);
      return 'error';
    }
  } catch (err) {
    console.log(`  ❌ Exception: ${err.message}`);
    return 'exception';
  }
}

async function main() {
  const data = require(CATALOG);
  const generals = data.generals;

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  console.log(`\n🎨 开始批量生成 ${generals.length} 张英雄卡牌...\n`);
  console.log(`📁 输出目录: ${OUTPUT_DIR}\n`);

  const results = [];
  for (let i = 0; i < generals.length; i++) {
    const result = await generateImage(generals[i], i);
    results.push({ hero: generals[i].name, status: result });
    if (i < generals.length - 1 && result !== 'skipped') await sleep(DELAY_MS);
  }

  const ok = results.filter(r => r.status === 'ok').length;
  const skipped = results.filter(r => r.status === 'skipped').length;
  const failed = results.filter(r => r.status !== 'ok' && r.status !== 'skipped').length;

  console.log(`\n📊 完成！成功: ${ok}, 跳过: ${skipped}, 失败: ${failed}`);

  if (failed > 0) {
    console.log('\n失败列表:');
    results.filter(r => r.status !== 'ok' && r.status !== 'skipped')
      .forEach(r => console.log(`  - ${r.hero}`));
  }
}

main().catch(console.error);
