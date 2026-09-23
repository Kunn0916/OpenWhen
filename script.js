(function(){
  const LS_KEYS = {
    apiKey: 'AQ.Ab8RN6JnlyQ9rbjIOK8iCtgATBM_JVMghsapjm75eogcDaIyAQ',
    vaultDate: 'ow_vault_date',
    opened: 'ow_opened_envelopes',
    cache: 'ow_letter_cache'
  };

  const envelopes = [
    { id:'miss-me', icon:'&#127799;', title:"Open When You Miss Me",
      prompt: "Write a short, warm, reassuring letter to my partner for a moment when she misses me. Remind her that the distance is temporary, that she is thought of constantly, and that missing someone is just love with nowhere to go yet. Warm, tender, a little playful, 120-180 words. Sign off as 'yours, always'." },
    { id:'bad-day', icon:'&#127768;', title:"Open When You're Having a Bad Day",
      prompt: "Write a short, comforting letter to my partner for a bad day. Validate that today was genuinely hard, remind her she doesn't need to fix her mood right away, and that she is still doing wonderfully even on rough days. Gentle, grounding, not dismissive of the hard feelings, 120-180 words. Sign off warmly." },
    { id:'cant-sleep', icon:'&#127772;', title:"Open When You Can't Sleep",
      prompt: "Write a short, soft, sleepy letter to my partner for when she can't sleep. Use cozy, quiet, late-night imagery (blankets, low light, slow breathing) to help her wind down. Calm and lulling tone, 110-160 words. End with something like a gentle goodnight." },
    { id:'need-laugh', icon:'&#127881;', title:"Open When You Need a Laugh",
      prompt: "Write a short, playful, lightly funny letter to my partner for when she needs cheering up. Include a couple of silly, affectionate jokes or a goofy hypothetical about our future together. Keep it warm, not corny-forced, 110-170 words." },
    { id:'accomplished', icon:'&#127942;', title:"Open When You Accomplished Something",
      prompt: "Write a short, proud, celebratory letter to my partner for when she's accomplished something. Tell her specifically how proud I am of her effort and growth, not just the result. Warm, admiring, uplifting tone, 120-170 words." },
    { id:'overwhelmed', icon:'&#127772;', title:"Open When You Feel Overwhelmed",
      prompt: "Write a short, grounding letter to my partner for when she feels overwhelmed. Remind her she doesn't have to hold everything at once, that it's okay to pause, and that she is safe and supported. Calm, steady, safe tone, 120-170 words." }
  ];

  const $ = (sel) => document.querySelector(sel);
  const deck = $('#deck');

  function getOpened(){
    try{ return JSON.parse(localStorage.getItem(LS_KEYS.opened) || '{}'); }catch(e){ return {}; }
  }
  function setOpened(map){ localStorage.setItem(LS_KEYS.opened, JSON.stringify(map)); }
  function getCache(){
    try{ return JSON.parse(localStorage.getItem(LS_KEYS.cache) || '{}'); }catch(e){ return {}; }
  }
  function setCache(map){ localStorage.setItem(LS_KEYS.cache, JSON.stringify(map)); }

  function getApiKey(){ return localStorage.getItem(LS_KEYS.apiKey) || ''; }
  function getVaultDate(){
    const v = localStorage.getItem(LS_KEYS.vaultDate);
    if(v) return new Date(v);
    const d = new Date(); d.setDate(d.getDate() + 30);
    return d;
  }

  // ---------- render deck ----------
  function renderDeck(){
    deck.innerHTML = '';
    const opened = getOpened();

    envelopes.forEach(env => {
      const card = document.createElement('div');
      card.className = 'env' + (opened[env.id] ? ' opened' : '');
      card.innerHTML = `
        <div class="env-body">
          <div class="env-flap"></div>
          <div class="seal">&#10084;</div>
          <div class="env-label">
            <span class="icon">${env.icon}</span>
            <span class="title">${env.title}</span>
          </div>
          <div class="badge">${opened[env.id] ? 'Opened' : 'Sealed'}</div>
        </div>`;
      card.addEventListener('click', () => openLetter(env));
      deck.appendChild(card);
    });

    renderVaultCard();
  }

  // ---------- vault ----------
  let vaultTimer = null;
  function renderVaultCard(){
    const card = document.createElement('div');
    const target = getVaultDate();
    const unlocked = new Date() >= target;
    card.className = 'env vault' + (unlocked ? ' unlocked' : '');
    card.innerHTML = `
      <div class="env-body">
        <div class="env-flap"></div>
        <div class="seal">&#128274;</div>
        <div class="env-label">
          <span class="icon">${unlocked ? '&#10024;' : '&#128274;'}</span>
          <span class="title">${unlocked ? 'Our Milestone' : 'Locked Until Our Day'}</span>
        </div>
        <div class="badge">${unlocked ? 'Unlocked' : 'Vault'}</div>
        <div class="countdown" id="vaultCountdown"></div>
      </div>`;
    card.addEventListener('click', () => {
      if(new Date() >= getVaultDate()){
        openLetter({ id:'vault', title:'Our Milestone',
          prompt:"Write a short, deeply heartfelt milestone letter to my partner, to be read the moment our countdown reaches a special anniversary or birthday date. Make it feel like a big, warm, celebratory occasion — reflective, romantic, and a little emotional, 140-200 words." });
      } else {
        openLockModal(getVaultDate());
      }
    });
    deck.appendChild(card);

    clearInterval(vaultTimer);
    const countEl = () => card.querySelector('#vaultCountdown');
    function tick(){
      const now = new Date();
      const diff = getVaultDate() - now;
      const el = countEl();
      if(!el) return;
      if(diff <= 0){
        el.textContent = 'unlocked';
        clearInterval(vaultTimer);
        if(!card.classList.contains('unlocked')){
          renderDeck(); // re-render once to flip visual state
        }
        return;
      }
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      el.textContent = `${d}d ${h}h ${m}m ${s}s`;
    }
    tick();
    vaultTimer = setInterval(tick, 1000);
  }

  function openLockModal(target){
    const overlay = $('#lockOverlay');
    $('#lockBody').textContent = "This one's still sealed — it opens on its own the moment our date arrives. Come back then, I promise it'll be worth it.";
    overlay.classList.add('show');
  }

  // ---------- reader modal + Gemini ----------
  const readerOverlay = $('#readerOverlay');
  const readerTitle = $('#readerTitle');
  const readerBody = $('#readerBody');

  async function openLetter(env){
    readerTitle.textContent = env.title;
    readerOverlay.classList.add('show');

    const cache = getCache();
    if(cache[env.id]){
      readerBody.textContent = cache[env.id];
      markOpened(env.id);
      return;
    }

    const key = getApiKey();
    if(!key){
      readerBody.innerHTML = `<div class="err">I don't have a Gemini API key saved yet, so I can't write this letter live. Add one in settings and try again.<br><button class="primary" id="openSettingsFromReader">Open settings</button></div>`;
      $('#openSettingsFromReader').addEventListener('click', () => {
        readerOverlay.classList.remove('show');
        settingsOverlay.classList.add('show');
      });
      return;
    }

    readerBody.innerHTML = `<div class="loading"><span class="dot"></span><span class="dot"></span><span class="dot"></span> writing something for you...</div>`;

    try{
      const text = await generateLetter(env.prompt, key);
      readerBody.textContent = text;
      cache[env.id] = text;
      setCache(cache);
      markOpened(env.id);
    }catch(e){
      readerBody.innerHTML = `<div class="err">Something went wrong reaching Gemini (${escapeHtml(e.message || 'unknown error')}).<br><button class="primary" id="retryBtn">Try again</button></div>`;
      $('#retryBtn').addEventListener('click', () => openLetter(env));
    }
  }

  function escapeHtml(s){
    return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  function markOpened(id){
    const opened = getOpened();
    if(!opened[id]){
      opened[id] = true;
      setOpened(opened);
      renderDeck();
    }
  }

  async function generateLetter(prompt, apiKey){
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`;
    const body = {
      systemInstruction: {
        parts: [{ text: "You are a loving, romantic, emotionally warm partner writing a short handwritten-style letter. Write in first person, addressed to 'you'. No markdown, no headers, just the letter text, plain and heartfelt." }]
      },
      contents: [{ role: "user", parts: [{ text: prompt }] }]
    };
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if(!res.ok){
      const errText = await res.text().catch(()=> '');
      throw new Error(`request failed (${res.status})`);
    }
    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.map(p => p.text).join('').trim();
    if(!text) throw new Error('empty response');
    return text;
  }

  // ---------- modal chrome ----------
  $('#readerClose').addEventListener('click', () => readerOverlay.classList.remove('show'));
  readerOverlay.addEventListener('click', (e) => { if(e.target === readerOverlay) readerOverlay.classList.remove('show'); });

  $('#lockClose').addEventListener('click', () => $('#lockOverlay').classList.remove('show'));
  $('#lockOverlay').addEventListener('click', (e) => { if(e.target === $('#lockOverlay')) $('#lockOverlay').classList.remove('show'); });

  const settingsOverlay = $('#settingsOverlay');
  $('#settingsBtn').addEventListener('click', () => {
    $('#apiKeyInput').value = getApiKey();
    const d = getVaultDate();
    const pad = n => String(n).padStart(2,'0');
    const local = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    $('#vaultDateInput').value = local;
    settingsOverlay.classList.add('show');
  });
  $('#settingsClose').addEventListener('click', () => settingsOverlay.classList.remove('show'));
  settingsOverlay.addEventListener('click', (e) => { if(e.target === settingsOverlay) settingsOverlay.classList.remove('show'); });

  $('#settingsSave').addEventListener('click', () => {
    const key = $('#apiKeyInput').value.trim();
    const dateVal = $('#vaultDateInput').value;
    if(key) localStorage.setItem(LS_KEYS.apiKey, key);
    if(dateVal) localStorage.setItem(LS_KEYS.vaultDate, new Date(dateVal).toISOString());
    settingsOverlay.classList.remove('show');
    renderDeck();
  });

  document.addEventListener('keydown', (e) => {
    if(e.key === 'Escape'){
      [readerOverlay, $('#lockOverlay'), settingsOverlay].forEach(o => o.classList.remove('show'));
    }
  });

  renderDeck();
})();
