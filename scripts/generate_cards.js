const fs = require('fs');
const path = require('path');
const http = require('http');

const API_URL = 'http://127.0.0.1:18080/v1/images/generations';
const API_KEY = 'f7bf335983f17f8523708ec25c1cd1b5';
const OUTPUT_DIR = path.join(__dirname, '..', 'data', 'cards');
const CATALOG = path.join(__dirname, '..', 'data', 'catalog.js');
const CONVERSATION_STATE = '/Users/lengwangxd/Documents/GPT生成图自由/chatgpt2api/data/image_conversation_state.json';
const DELAY_MS = 5000; // 每张图间隔5秒
const CLEAR_EVERY = 8; // 每8张清理一次会话

const FACTION_COLOR = {
  '魏': 'deep blue and gold tones, icy steel blue ambient light',
  '蜀': 'emerald green and gold tones, bamboo forest green ambient light',
  '吴': 'crimson red and gold tones, fierce fire red ambient light',
  '群': 'dark purple and gold tones, mysterious purple ambient light'
};

const HERO_VISUAL = {
  '曹操': 'middle-aged warlord with thin beard, piercing eyes, three-peaked crown helmet, ornate dark blue armor with gold dragon trim, flowing dark cape',
  '孙权': 'broad-faced young ruler with purple eyes, dragon crown, crimson red armor with gold trim, imperial robe',
  '刘备': 'benevolent middle-aged leader with kind eyes, generous build, green and gold imperial robes, jade pendant',
  '张飞': 'fierce giant warrior with wild black beard, leopard head, fierce war expression, heavy black armor with gold trim',
  '关羽': 'tall imposing warrior with long flowing red beard, green robe, golden dragon armor, guan dao weapon',
  '赵云': 'young handsome warrior with determined expression, silver and gold armor, white cape flowing',
  '诸葛亮': 'wise slender strategist with calm expression, feather fan in hand, tall scholar hat, elegant blue robes',
  '吕布': 'terrifying fierce warrior with feathered headdress, dark armor with dragon motifs, twin halberd, intimidating aura',
  '周瑜': 'elegant young commander with refined handsome features, red and gold armor, fire imagery',
  '司马懿': 'cunning elderly strategist with hawk-like eyes, patient predatory expression, dark robes with gold trim',
  '貂蝉': 'stunningly beautiful woman with delicate features, silk flowing robes, moonflower imagery, graceful pose',
  '华佗': 'elderly sage doctor with white beard, gentle wise eyes, white robes, carrying medicine gourd',
  '左慈': 'mystical old immortal with wild white hair, Daoist robes, magical glowing aura, ethereal presence',
  '董卓': 'massive tyrannical warlord with cruel expression, heavy dark armor, intimidating bulk, dark aura',
  '大乔': 'elegant noblewoman with graceful beauty, flowing silk dress, swan imagery, refined poise',
  '小乔': 'youthful beauty with delicate features, light flowing dress, butterfly imagery, gentle expression',
  '甄姬': 'ethereal beauty with phoenix crown, flowing rainbow silk robes, lotus imagery, mesmerizing',
  '黄月英': 'clever inventor woman with bronze skin, mechanical gears nearby, clever determined expression, practical robes',
  '蔡文姬': 'melancholic beauty with guqin instrument, scholarly woman, ink and scrolls imagery',
  '祝融夫人': 'fierce barbarian queen with fire weapons, tribal tattoos, wild flame-colored hair, warrior pose',
  '孟获': 'massive barbarian chieftain with tribal armor, beast skins, fierce expression, primal power',
  '兀突骨': 'giant barbarian warrior in vine armor, jungle tribal appearance, poisonous mist aura',
  'SP诸葛亮': 'transcendent strategist with golden celestial glow, heavenly scrolls, cosmic wisdom aura',
  'SP周瑜': 'ethereal fire commander with blazing inferno background, divine flames, transcendent beauty',
  'SP袁绍': 'noble aristocratic lord with siege towers behind, grand army banner, regal armor',
  'SP吕蒙': 'stealthy water warrior with river mist, naval elements, determined expression',
  'SP荀彧': 'golden-robed celestial advisor, heavenly mandate glow, wise dignified expression',
  'SP郭嘉': 'young genius strategist with ethereal blue glow, mysterious aura, brilliant eyes',
  'SP朱儁': 'siege warfare commander with breaking walls, determined fierce expression, heavy armor',
};

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
  const gender = ['甄姬','貂蝉','大乔','小乔','蔡文姬','黄月英','祝融夫人','吕玲绮','邹氏','董白','王元姬','张春华','马云禄','张姬','关银屏'].includes(hero.name) ? 'woman' : 'man';
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
Elegant gold card frame border around the portrait. Hero name written in Chinese calligraphy on the card. Command cost number ${hero.cost} displayed in a circular badge on the card. NO health bars, NO skill icons, NO mana cost numbers, NO game UI elements.`;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function clearConversation() {
  try {
    if (fs.existsSync(CONVERSATION_STATE)) {
      fs.unlinkSync(CONVERSATION_STATE);
      console.log('  🔄 会话状态已清理');
    }
  } catch (e) {
    console.log('  ⚠️ 清理会话失败:', e.message);
  }
}

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
        timeout: 300000 // 5分钟超时
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

  // 开始前清理一次会话
  console.log('\n🔄 清理旧会话状态...');
  clearConversation();

  console.log(`\n🎨 开始批量生成 ${generals.length} 张英雄卡牌...\n`);
  console.log(`📁 输出目录: ${OUTPUT_DIR}\n`);

  const results = [];
  let sinceLastClear = 0;

  for (let i = 0; i < generals.length; i++) {
    // 每8张清理一次会话，避免会话过长
    if (sinceLastClear >= CLEAR_EVERY) {
      console.log('\n🔄 定期清理会话状态...');
      clearConversation();
      sinceLastClear = 0;
      await sleep(2000);
    }

    const result = await generateImage(generals[i], i);
    results.push({ hero: generals[i].name, status: result });

    if (result !== 'skipped') {
      sinceLastClear++;
    }

    if (i < generals.length - 1 && result !== 'skipped') {
      await sleep(DELAY_MS);
    }
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
