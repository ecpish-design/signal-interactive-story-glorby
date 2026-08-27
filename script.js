const A = (name) => `assets/${name}.webp`;

const state = {
  index: 0,
  name: sessionStorage.getItem('glorbAgentName') || '',
  sceneUnlocked: false,
  sound: true,
  graphSeen: new Set(),
  signalsSeen: new Set(),
  selectedEmotion: null,
  sortDone: new Set(),
  strategyDone: new Set(),
  replayChoiceMade: false,
};

const sceneEl = document.getElementById('scene');
const nextBtn = document.getElementById('nextBtn');
const backBtn = document.getElementById('backBtn');
const navHint = document.getElementById('navHint');
const progressBar = document.getElementById('progressBar');
const progressText = document.getElementById('progressText');
const tickerText = document.getElementById('tickerText');
const soundBtn = document.getElementById('soundBtn');
const readBtn = document.getElementById('readBtn');
const transcriptBtn = document.getElementById('transcriptBtn');
const transcriptDialog = document.getElementById('transcriptDialog');
const transcriptContent = document.getElementById('transcriptContent');
const evidenceDialog = document.getElementById('evidenceDialog');
const evidenceTitle = document.getElementById('evidenceTitle');
const evidenceContent = document.getElementById('evidenceContent');

let audioCtx = null;
let currentTranscript = [];

function escapeHTML(value='') {
  return String(value).replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
}
function cleanText(value='') { return String(value).replace(/<[^>]*>/g,'').replace(/\s+/g,' ').trim(); }
function agentName(){ return state.name || 'Earth agent'; }
function resolveText(value=''){ return String(value).replaceAll('{{agent}}', agentName()); }
function initAudio(){
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();
}
function tone(freq=480,duration=.08,type='square',gain=.035,delay=0){
  if(!state.sound) return;
  initAudio();
  const t=audioCtx.currentTime+delay;
  const osc=audioCtx.createOscillator(); const g=audioCtx.createGain();
  osc.type=type; osc.frequency.setValueAtTime(freq,t); g.gain.setValueAtTime(gain,t); g.gain.exponentialRampToValueAtTime(.0001,t+duration);
  osc.connect(g); g.connect(audioCtx.destination); osc.start(t); osc.stop(t+duration);
}
function sfxBeep(){ tone(690,.07,'square',.025,0); tone(690,.07,'square',.025,.16); tone(840,.1,'square',.035,.32); }
function sfxWarn(){ tone(420,.12,'sawtooth',.025,0); tone(540,.12,'sawtooth',.025,.18); tone(650,.15,'sawtooth',.03,.36); }
function sfxCrash(){
  if(!state.sound) return; initAudio(); const t=audioCtx.currentTime;
  const osc=audioCtx.createOscillator(); const g=audioCtx.createGain(); osc.type='sawtooth';
  osc.frequency.setValueAtTime(130,t); osc.frequency.exponentialRampToValueAtTime(32,t+.55);
  g.gain.setValueAtTime(.06,t); g.gain.exponentialRampToValueAtTime(.0001,t+.62); osc.connect(g); g.connect(audioCtx.destination); osc.start(t); osc.stop(t+.65);
  tone(760,.06,'square',.045,.02);
}
function sfxConfirm(){ tone(520,.06,'sine',.025,0); tone(710,.08,'sine',.025,.07); }
function sfxRetry(){ tone(230,.09,'square',.018,0); }

const scenes = [
  { id:'start', type:'start', label:'MISSION // INITIALISE' },
  {
    id:'alert', label:'ZORBAX-9 // 17:06:42', eyebrow:'SOMEWHERE IN ZORBAX // ORBITAL LANE', title:'SYSTEM FAILURE', image:'cockpit-warning', imageClass:'large', effect:'warn',
    lines:[
      {t:'BEEP. BEEP. BEEP!!',c:'system red big'},
      {t:'Ship is going down. I repeat: ship is going down.',c:'glorb'},
      {t:'According to my notes, all elements are pointing to total signal meltdown...',c:'glorb'},
      {t:'My ears. My dashboard. And my.........',c:'glorb'},
      {t:'SHIP.',c:'big red'}
    ], auto:true
  },
  {
    id:'impact', label:'INCIDENT // ESAU-32A', eyebrow:'FLIGHT STATUS // LOST', title:'BOOM.', image:'ship-crash-impact', imageClass:'large', effect:'crash',
    lines:[{t:'Impact detected.',c:'system red'},{t:'...That could have gone better.',c:'glorb'}], auto:true
  },
  {
    id:'wreck', label:'POST-INCIDENT // +00:03:14', eyebrow:'ZORBAX-9 RESEARCH DIVISION', title:'WHAT HAPPENED?', image:'wreck-polaroid',
    lines:[
      {t:'My ship is in several pieces.',c:'glorb'},
      {t:'Before I blame the Gleborna aliens, which is still tempting, I need to work out what actually happened.',c:'glorb'},
      {t:'{{agent}}, the flight recorder survived. Help me reconstruct the day?',c:'system'}
    ],
    choice:{prompt:'WHAT SHOULD GLORB DO FIRST?', options:[
      {label:'TRAVEL BACK TO THE START OF THE DAY',correct:true,feedback:'Yes. Going back to the start of the day can show what happened before the crash.'},
      {label:'THE BROKEN WING',feedback:'The broken wing shows us what happened during the crash, but not what happened before it. Try something that takes us back earlier.'},
      {label:'THE SNACK CUPBOARD',feedback:'Important research, obviously. But snacks cannot show us what happened before the crash. Try something that takes us back to the beginning.'}
    ]}
  },
  {
    id:'rewind', label:'FLIGHT RECORDER // REWIND', eyebrow:'RECONSTRUCTING PERSONAL LOG', title:'EARLIER THAT DAY', image:'glorb-frog-standing', imageClass:'small',
    lines:[{t:'REWINDING...',c:'system'},{t:'Start at the beginning.',c:'glorb'}], auto:true
  },
  {
    id:'morning', label:'LOG // 07:11', eyebrow:'PERSONAL LOG // MORNING', title:'NOT A GREAT MORNING', image:'glorb-low-breakfast-frog', imageClass:'large',
    lines:[
      {t:'Woke up tired.',c:'glorb blue'},
      {t:'Couldn’t start the ship. Just sank.....',c:'glorb'},
      {t:'Had breakfast. Rested.',c:'glorb'},
      {t:'Played with Frog, my flying space dog.',c:'glorb'},
      {t:'After a while, I started to pick up a bit.',c:'glorb'}
    ], auto:true
  },
  {
    id:'steady-flight', label:'LOG // 08:02', eyebrow:'ALL-GRAV STREET // IN TRANSIT', title:'FEELING BETTER', image:'steady-flight-music', imageClass:'large float',
    lines:[
      {t:'Then I started flying.',c:'glorb green'},
      {t:'I had some tunes on.',c:'glorb'},
      {t:'I was dancing a little while I drove.',c:'glorb'},
      {t:'Honestly? I was having a pretty good time.',c:'glorb'}
    ], auto:true
  },
  {
    id:'aliens', label:'LOG // 08:17', eyebrow:'SPLATZZE TERRACE // VISUAL CONTACT', title:'THEN I SAW THEM', image:'gleborna-overload', imageClass:'large',
    lines:[
      {t:'The Gleborna aliens.',c:'glorb'},
      {t:'They made fun of my ears.',c:'glorb'},
      {t:'I asked them to stop.',c:'glorb'},
      {t:'They did not stop.',c:'glorb'}
    ],
    choice:{prompt:'HOW DO YOU THINK GLORB FELT IN THIS MOMENT?', options:[
      {label:'ANNOYED / FRUSTRATED',correct:true,feedback:'Yes. Glorb was getting annoyed and frustrated because they kept going after he asked them to stop.'},
      {label:'CALM',feedback:'Not quite. They kept making fun of Glorb after he asked them to stop. Look for a feeling that shows something was starting to build.'},
      {label:'TIRED',feedback:'Glorb was tired earlier in the day, but this moment is different. Think about how he might feel when someone keeps doing something he has asked them to stop.'}
    ]}
  },
  {
    id:'warnings', label:'LOG // 08:18', eyebrow:'FLIGHT RECORDER // PRE-INCIDENT', title:'TWO WARNINGS', image:'rising-chase-dashboard', imageClass:'large', effect:'warn',
    lines:[
      {t:'I started chasing them.',c:'glorb orange'},
      {t:'My ears started twitching. My whole body felt jumpy and annoyed.',c:'glorb'},
      {t:'Then RISING SIGNAL flashed on the dashboard.',c:'glorb orange'},
      {t:'I noticed both of them.',c:'glorb'},
      {t:'And I kept going.',c:'glorb'}
    ],
    multiChoice:{prompt:'GLORB NOTICED TWO WARNING SIGNS. WHICH TWO WERE THEY?', required:2, options:[
      {label:'HIS BODY FELT DIFFERENT',correct:true},
      {label:'THE DASHBOARD FLASHED',correct:true},
      {label:'THE MUSIC WAS PLAYING',correct:false,feedback:'The music was part of the journey, but it was not a warning sign. Look again at what changed in Glorb’s body and on the ship.'}
    ], feedback:'Yes. Glorb noticed one warning in his body and one on the dashboard.'}
  },
  {
    id:'push', label:'LOG // 08:20', eyebrow:'ENGINE LOAD // INCREASING', title:'PUSH. PUSH. PUSH.', image:'crash-sequence', imageClass:'large', effect:'warn',
    lines:[
      {t:'They kept making fun of my ears.',c:'glorb red'},
      {t:'I chased harder.',c:'glorb'},
      {t:'I ignored the ship warnings.',c:'glorb'},
      {t:'I ignored what was happening in me.',c:'glorb'},
      {t:'Push.',c:'big red'},
      {t:'Push.',c:'big red'},
      {t:'PUSH.',c:'big red'}
    ], auto:true
  },
  {
    id:'crash2', label:'LOG // 08:21', eyebrow:'SIGNAL // CRITICAL', title:'SIGNAL MELTDOWN', image:'crash-glorb-ejected', imageClass:'large', effect:'crash',
    lines:[{t:'!!!',c:'system red big'},{t:'And then everything went sideways.',c:'glorb'}], auto:true
  },
  {
    id:'investigate', label:'INVESTIGATION // RECOVERED', eyebrow:'FLIGHT RECORDER ANALYSIS', title:'THE CRASH WASN’T THE FIRST WARNING', image:'signal-graph-blank', imageClass:'large',
    lines:[
      {t:'The signal did not jump straight to danger.',c:'glorb'},
      {t:'It climbed slowly while I kept pushing the ship harder.',c:'glorb'},
      {t:'The dashboard recorded every second of it.',c:'glorb'}
    ], auto:true
  },
  { id:'graph', type:'graph', label:'ANALYSIS // SIGNAL TRACE' },
  {
    id:'body-link', label:'ANALYSIS // BODY DATA', eyebrow:'GLORB RESEARCH NOTE', title:'WAIT. MY EARS DID IT TOO.', image:'glorb-frog-standing', imageClass:'small',
    lines:[
      {t:'{{agent}}, look at this. The dashboard was changing...',c:'glorb'},
      {t:'...but so was I.',c:'glorb'},
      {t:'My ears changed. My muscles changed. My attention changed.',c:'glorb'},
      {t:'The ship had a signal system.',c:'glorb'},
      {t:'Maybe I did too.',c:'glorb big'}
    ], auto:true
  },
  { id:'learn', type:'learn', label:'RESEARCH // SIGNAL MANUAL' },
  {
    id:'letter', label:'TRANSMISSION // AR', eyebrow:'DEPARTMENT OF AR // ALIEN RESOURCES', title:'FIELD RESEARCH: EARTH',
    lines:[
      {t:'I had to explain to headquarters why my ship was broken.',c:'glorb'},
      {t:'Again.',c:'glorb big'},
      {t:'I decided Earth might be a safer place to continue my research.',c:'glorb'},
      {t:'So I wrote to Amy in AR and told her the plan.',c:'glorb'}
    ], auto:true
  },
  {
    id:'letter-image', type:'artifact', label:'TRANSMISSION // AR', eyebrow:'DEPARTMENT OF AR // ALIEN RESOURCES', title:'LETTER TO AMY', image:'letter-amy'
  },
  {
    id:'school-intro', label:'EARTH LOG // ARRIVAL', eyebrow:'EARTH FIELD RESEARCH', title:'ON EARTH',
    lines:[
      {t:'I found a place called a “school.”',c:'glorb'},
      {t:'I decided it was the perfect place to study humans.',c:'glorb'},
      {t:'Apparently, it is a place where humans go to study.',c:'glorb'},
      {t:'This seemed efficient.',c:'glorb'}
    ], auto:true
  },
  {
    id:'earth', label:'EARTH LOG // DAY 23', eyebrow:'SCHOOL PLAYGROUND // LUNCH', title:'A FEW WEEKS LATER', image:'glorb-closeup', imageClass:'small',
    lines:[
      {t:'Research log. Day 23 on Earth.',c:'glorb'},
      {t:'I have not exploded anything.',c:'glorb'},
      {t:'This feels like the correct amount of progress.',c:'glorb'},
      {t:'However... {{agent}}, today at lunch I went to see my friend Tommy.',c:'glorb'}
    ], auto:true
  },
  {
    id:'tommy1', label:'EARTH LOG // 12:36', eyebrow:'SCHOOL PLAYGROUND // LUNCH', title:'TOMMY BOY!', image:'tommy-neutral', imageClass:'large',
    lines:[
      {t:'I started dancing in his face.',c:'glorb'},
      {t:'“LET’S HAVE A PARTY, TOMMY BOY! THE WORLD IS OURS AND THE DAY IS YOUNG!”',c:'glorb big'},
      {t:'I saw someone do it on TV. The audience laughed.',c:'glorb'},
      {t:'Tommy did not laugh.',c:'system'}
    ], auto:true
  },
  {
    id:'tommy2', label:'EARTH LOG // 12:37', eyebrow:'OBSERVATION // CHANGE DETECTED', title:'SOMETHING CHANGED', image:'tommy-angry', imageClass:'large',
    lines:[
      {t:'Tommy stopped looking neutral.',c:'system'},
      {t:'His face tightened. His body got tense. He looked like he wanted space.',c:'system'},
      {t:'I was still dancing.',c:'glorb'}
    ],
    choice:{prompt:'WHAT DOES TOMMY LOOK LIKE HE IS FEELING?', options:[
      {label:'HAPPY',feedback:'Not quite. A happy body might look more relaxed, open or smiley. Tommy’s face is tighter and his body looks tense.'},
      {label:'ANNOYED',correct:true,feedback:'Yes. Tommy looks annoyed. His face tightened, his body got tense, and he looked like he wanted space.'},
      {label:'SAD',feedback:'Not quite. A sad body might look flatter, droopier or lower in energy. Tommy looks tense and uncomfortable, like he wants Glorb to stop.'}
    ]}
  },
  {
    id:'tommy-choice', label:'EARTH LOG // 12:37', eyebrow:'DECISION POINT // BEFORE OVERLOAD', title:'GLORB COULD NOTICE HERE', image:'tommy-angry', imageClass:'large',
    lines:[{t:'If I had noticed the change right here, I could have responded differently.',c:'glorb'}],
    choice:{prompt:'What would give Tommy’s signal the best chance to settle?', options:[
      {label:'STOP + GIVE HIM SPACE',correct:true,feedback:'Yes. Notice the signal, reduce the pressure, give space.'},
      {label:'DANCE CLOSER SO HE LAUGHS',feedback:'That adds more pressure when Tommy is already showing he wants space.'},
      {label:'SHOUT THE JOKE LOUDER',feedback:'Louder does not make the warning smaller.'}
    ], canonical:'Good choice. Unfortunately, this is not what Glorb did in the original incident.'}
  },
  {
    id:'tommy-push', label:'EARTH LOG // 12:38', eyebrow:'ORIGINAL INCIDENT // OUTCOME', title:'STOP.', image:'tommy-push', imageClass:'large',
    lines:[
      {t:'Tommy pushed me away.',c:'system'},
      {t:'“STOP!”',c:'big red'},
      {t:'Tommy later apologised for pushing me.',c:'glorb'},
      {t:'Pushing was not okay.',c:'glorb'},
      {t:'I also realised I had missed the signs that Tommy wanted me to stop and give him space.',c:'glorb'},
      {t:'Next time, I could notice those signs earlier and respond before things got bigger.',c:'glorb'}
    ], auto:true
  },
  {
    id:'human-link', label:'EARTH LOG // ANALYSIS', eyebrow:'NEW RESEARCH CONNECTION', title:'HUMANS HAVE SIGNALS TOO', image:'glorb-closeup', imageClass:'small',
    lines:[
      {t:'{{agent}}... wait.',c:'glorb big'},
      {t:'My ship has signals.',c:'glorb'},
      {t:'I have signals.',c:'glorb'},
      {t:'Humans have signals too.',c:'glorb'},
      {t:'Maybe humans just wear theirs on the outside instead of on a dashboard.',c:'glorb big'},
      {t:'Face. Voice. Body. Movement. Space.',c:'system'}
    ], auto:true
  },
  { id:'sort', type:'sort', label:'EARTH LAB // HUMAN SIGNALS' },
  { id:'strategies', type:'strategies', label:'EARTH LAB // RESPONSE OPTIONS' },
  { id:'replay', type:'replay', label:'SIMULATION // REPLAY INCIDENT' },
  {
    id:'better', label:'SIMULATION // NEW OUTCOME', eyebrow:'REPLAY RESULT', title:'CAUGHT IT EARLIER', image:'tommy-neutral', imageClass:'large',
    lines:[
      {t:'This time I noticed Tommy’s signal changing.',c:'glorb'},
      {t:'I stopped. I gave him space.',c:'glorb'},
      {t:'The situation did not need to reach overload.',c:'system green'},
      {t:'No push. No explosion. Progress.',c:'glorb'}
    ], auto:true
  },
  { id:'complete', type:'complete', label:'MISSION // COMPLETE' },
  { id:'certificate', type:'certificate', label:'MISSION // CERTIFICATE' }
];

const sortItems = [
  ['tired','low'],
  ['calm','steady'],
  ['frustrated','rising'],
  ['overwhelmed','overload']
];

const fullEmotionSets = {
  low:['sad','embarrassed','lonely','bored','tired','unsure'],
  steady:['calm','focused','proud','content'],
  rising:['upset','disrespected','excited','frustrated','nervous'],
  overload:['furious','panicked','terrified','overwhelmed']
};
const strategies = [
  ['Rest for a few minutes','low'],['Get a drink or snack','low'],
  ['Keep doing what is working','steady'],['Take on a challenge if you are ready','steady'],
  ['Step away for a moment','rising'],['Ask for a break before it gets bigger','rising'],
  ['Get to a safe, quiet space','overload'],['Ask a trusted adult for help','overload']
];
const signalMeta = {
  low:{label:'Low Signal',color:'blue',header:'low-header',report:'report-low',short:'Energy is running low.',desc:'Energy is running low. Glorb may feel flat, tired, slower, less aware or less ready.'},
  steady:{label:'Steady Signal',color:'green',header:'steady-header',report:'report-steady',short:'Things are working as expected.',desc:'Things are working as expected. Glorb is calm enough to focus, notice what is happening and keep going.'},
  rising:{label:'Rising Signal',color:'orange',header:'rising-header',report:'report-rising',short:'Something is building.',desc:'Something is building. Glorb may feel more tense, jumpy, annoyed, excited, urgent or reactive. This is an early-warning stage.'},
  overload:{label:'Signal Overload',color:'red',header:'overload-header',report:'report-overload',short:'The system is overwhelmed.',desc:'The system is overwhelmed. Thinking clearly and making good decisions becomes much harder. Safety and space matter first.'}
};

function lineHTML(line,index){
  const text=resolveText(line.t);
  return `<p class="story-line ${line.c||''}" style="animation-delay:${.12+index*.30}s">${escapeHTML(text)}</p>`;
}
function standardScene(scene){
  currentTranscript = [resolveText(scene.title), ...(scene.lines||[]).map(l=>resolveText(l.t))];
  sceneEl.className = `scene ${scene.effect==='crash'?'flash-white':''}`;
  const hasImage=Boolean(scene.image);
  sceneEl.innerHTML = `
    <section class="scene-wrap ${scene.effect==='warn'?'shake':''} ${hasImage?'':'text-only'}">
      <div class="copy-zone">
        <div class="eyebrow">${escapeHTML(scene.eyebrow||'')}</div>
        <h1 class="scene-title ${scene.title.length>20?'small':''}">${escapeHTML(resolveText(scene.title))}</h1>
        <div class="story-lines">${scene.lines.map(lineHTML).join('')}</div>
        <div id="promptMount"></div>
      </div>
      ${hasImage?`<div class="art-zone"><img class="art-img ${scene.imageClass||''}" src="${A(scene.image)}" alt="${escapeHTML(scene.title)} illustration"></div>`:''}
    </section>`;
  if(scene.choice) renderChoice(scene.choice);
  else if(scene.multiChoice) renderMultiChoice(scene.multiChoice);
  else unlock(scene.auto!==false);
  if(scene.effect==='warn') setTimeout(sfxWarn,140);
  if(scene.effect==='crash') setTimeout(sfxCrash,160);
}

function renderStart(){
  currentTranscript=['Glorb: The Signal Mission','Enter your name to begin the mission.'];
  sceneEl.className='scene';
  sceneEl.innerHTML=`<section class="scene-wrap centered">
    <div class="art-zone" style="min-height:300px"><img class="art-img small" src="${A('glorb-front')}" alt="Glorb standing"></div>
    <div class="copy-zone" style="margin-top:-45px">
      <div class="eyebrow">ZORBAX-9 RESEARCH DIVISION // INCIDENT ESAU-32A</div>
      <h1 class="scene-title">GLORB:<br>THE SIGNAL MISSION</h1>
      <p class="scene-subtitle">Interactive field investigation // Middle-school research access</p>
      <div class="hud-card" style="max-width:680px;margin:0 auto">
        <p style="font-size:19px;line-height:1.55;margin:0">Glorb’s third ship has exploded. Enter the recovered flight log, reconstruct what happened, and follow the clue that changes the way Glorb understands himself and people on Earth.</p>
        <div class="name-entry">
          <input id="nameInput" type="text" maxlength="40" autocomplete="name" placeholder="ENTER AGENT NAME" value="${escapeHTML(state.name)}" aria-label="Enter your name">
          <button id="startMissionBtn" type="button">BEGIN MISSION →</button>
        </div>
        <div id="nameError" class="name-error" aria-live="polite"></div>
      </div>
    </div>
  </section>`;
  document.getElementById('startMissionBtn').addEventListener('click',()=>{
    const v=document.getElementById('nameInput').value.trim();
    if(!v){document.getElementById('nameError').textContent='Enter a name to initialise the mission record.';return;}
    state.name=v; sessionStorage.setItem('glorbAgentName',v); initAudio(); goTo(1);
  });
  document.getElementById('nameInput').addEventListener('keydown',e=>{if(e.key==='Enter')document.getElementById('startMissionBtn').click()});
  setNav(false,false,'ENTER YOUR NAME TO BEGIN');
}

function renderChoice(choice){
  state.sceneUnlocked=false;
  const mount=document.getElementById('promptMount');
  mount.innerHTML=`<div class="prompt-box"><div class="prompt-title">${escapeHTML(choice.prompt)}</div><div class="choice-grid"></div><div class="feedback" hidden></div></div>`;
  const grid=mount.querySelector('.choice-grid'), feedback=mount.querySelector('.feedback');
  choice.options.forEach(opt=>{
    const b=document.createElement('button'); b.type='button'; b.className='choice-card'; b.textContent=opt.label;
    b.addEventListener('click',()=>{
      if(opt.correct){
        grid.querySelectorAll('.choice-card').forEach(x=>x.classList.remove('correct'));
        b.classList.add('correct');
        feedback.className='feedback good';
        feedback.textContent=opt.feedback+(choice.canonical?` ${choice.canonical}`:'');
        feedback.hidden=false;
        sfxConfirm();
        unlock(true);
      } else {
        b.classList.remove('incorrect');
        b.classList.add('tried');
        b.textContent=`${opt.label} — TRIED`;
        b.disabled=true;
        feedback.className='feedback retry';
        feedback.textContent=opt.feedback;
        feedback.hidden=false;
        sfxRetry();
        unlock(false);
      }
    });
    grid.appendChild(b);
  });
  setNav(state.index>0,false,'SELECT AN OPTION TO CONTINUE');
}

function renderMultiChoice(cfg){
  state.sceneUnlocked=false;
  const mount=document.getElementById('promptMount');
  mount.innerHTML=`<div class="prompt-box"><div class="prompt-title">${escapeHTML(cfg.prompt)}</div><div class="choice-grid"></div><div class="feedback" hidden></div></div>`;
  const grid=mount.querySelector('.choice-grid'), feedback=mount.querySelector('.feedback'); let chosen=new Set();
  cfg.options.forEach((opt,i)=>{
    const b=document.createElement('button'); b.type='button'; b.className='choice-card'; b.textContent=opt.label;
    b.addEventListener('click',()=>{
      if(!opt.correct){
        b.classList.add('tried');
        b.textContent=`${opt.label} — TRIED`;
        b.disabled=true;
        feedback.textContent=opt.feedback||'That one is not a warning sign. Look again at what changed.';
        feedback.className='feedback retry';
        feedback.hidden=false;
        sfxRetry();
        unlock(false);
        return;
      }
      if(chosen.has(i)){
        chosen.delete(i);
        b.classList.remove('selected','correct');
      } else if(chosen.size<cfg.required){
        chosen.add(i);
        b.classList.add('selected');
      }
      if(chosen.size===cfg.required){
        [...chosen].forEach(j=>grid.children[j].classList.add('correct'));
        feedback.textContent=cfg.feedback;
        feedback.className='feedback good';
        feedback.hidden=false;
        sfxConfirm();
        unlock(true);
      } else {
        feedback.hidden=true;
        setNav(true,false,`SELECT ${cfg.required-chosen.size} MORE WARNING${cfg.required-chosen.size===1?'':'S'}`);
      }
    }); grid.appendChild(b);
  });
  setNav(true,false,'SELECT TWO WARNINGS');
}

function renderArtifact(scene){
  currentTranscript=[resolveText(scene.title),'Open the letter from Glorb to Amy in Alien Resources.'];
  sceneEl.className='scene';
  sceneEl.innerHTML=`<section class="scene-wrap full artifact-scene">
    <div class="eyebrow">${escapeHTML(scene.eyebrow||'')}</div>
    <h1 class="scene-title small">${escapeHTML(resolveText(scene.title))}</h1>
    <div class="artifact-frame"><img src="${A(scene.image)}" alt="${escapeHTML(scene.title)}"></div>
  </section>`;
  unlock(true);
}

function renderGraph(){
  currentTranscript=['Flight recorder analysis','The signal moved through four stages: Low Signal, Steady Signal, Rising Signal, Signal Overload.','Click each part of the trace to inspect it.'];
  sceneEl.className='scene';
  sceneEl.innerHTML=`<section class="scene-wrap full">
    <div class="eyebrow">FLIGHT RECORDER // CLICK EACH SECTION</div>
    <h1 class="scene-title small">THE SIGNAL CLIMBED</h1>
    <p style="font-size:20px;max-width:900px;line-height:1.55">The recorder shows four different patterns across Glorb’s day. Inspect all four before continuing.</p>
    <div class="graph-inspector hud-card">
      <div class="graph-wrap"><img src="${A('signal-graph-labelled')}" alt="Graph showing Low Signal, Steady Signal, Rising Signal and Signal Overload"></div>
      <div class="graph-nodes">
        ${Object.keys(signalMeta).map(k=>`<button class="graph-node" data-key="${k}">${signalMeta[k].label}</button>`).join('')}
      </div>
      <div id="graphReadout" class="graph-readout">Select a part of the trace.</div>
    </div>
  </section>`;
  document.querySelectorAll('.graph-node').forEach(btn=>btn.addEventListener('click',()=>{
    const k=btn.dataset.key; state.graphSeen.add(k); document.querySelectorAll('.graph-node').forEach(x=>x.classList.toggle('active',x===btn));
    document.getElementById('graphReadout').innerHTML=`<strong class="${signalMeta[k].color}">${signalMeta[k].label}</strong>: ${signalMeta[k].desc}`;
    tone(k==='low'?260:k==='steady'?390:k==='rising'?520:700,.07,'sine',.018);
    if(state.graphSeen.size===4) unlock(true); else setNav(true,false,`INSPECTED ${state.graphSeen.size}/4`);
  }));
  unlock(state.graphSeen.size===4); if(state.graphSeen.size<4)setNav(true,false,`INSPECTED ${state.graphSeen.size}/4`);
}

function renderLearn(){
  currentTranscript=['Glorb creates the Signal Manual.','Low Signal: energy low.','Steady Signal: system working normally.','Rising Signal: early warning, tension and reactivity rising.','Signal Overload: overwhelmed and hard to think clearly.'];
  sceneEl.className='scene';
  sceneEl.innerHTML=`<section class="scene-wrap full">
    <div class="eyebrow">ZORBAX-9 RESEARCH DIVISION // NEW CLASSIFICATION</div>
    <h1 class="scene-title small">GLORB BUILDS THE SIGNAL MANUAL</h1>
    <p style="font-size:20px;line-height:1.55;max-width:950px">The crash gives Glorb a new idea: the ship was not the only thing sending warnings. Compare the dashboard with what was happening to Glorb himself.</p>
    <div class="signal-tabs">${Object.keys(signalMeta).map(k=>`<button class="signal-tab" data-signal="${k}">${signalMeta[k].label}</button>`).join('')}</div>
    <div id="signalPanel" class="signal-panel"><div class="signal-copy"><h3>Select a signal</h3><p>Open all four research tabs.</p></div><div></div></div>
  </section>`;
  document.querySelectorAll('.signal-tab').forEach(btn=>btn.addEventListener('click',()=>showSignal(btn.dataset.signal,btn)));
  unlock(state.signalsSeen.size===4); if(state.signalsSeen.size<4)setNav(true,false,`RESEARCHED ${state.signalsSeen.size}/4 SIGNALS`);
}
function showSignal(k,btn){
  state.signalsSeen.add(k); document.querySelectorAll('.signal-tab').forEach(x=>x.classList.toggle('active',x===btn)); const m=signalMeta[k];
  document.getElementById('signalPanel').innerHTML=`
    <div><img src="${A(m.header)}" alt="${m.label} graphic"></div>
    <div class="signal-copy"><div class="eyebrow">SHIP + GLORB // SAME PATTERN</div><h3 class="${m.color}">${m.label}</h3><p>${m.desc}</p><p><strong>Glorb’s key discovery:</strong> the ship changes on the dashboard at the same time that his ears, muscles, attention and energy change in his body.</p><p class="signal-note">DASHBOARD DATA ↔ GLORB BODY DATA</p></div>`;
  if(state.signalsSeen.size===4){sfxConfirm();unlock(true)}else setNav(true,false,`RESEARCHED ${state.signalsSeen.size}/4 SIGNALS`);
}

function shuffle(arr){ return arr.map(v=>[Math.random(),v]).sort((a,b)=>a[0]-b[0]).map(v=>v[1]); }
function renderSort(){
  currentTranscript=['Human Signal Lab','Sort four example feelings into Low Signal, Steady Signal, Rising Signal and Signal Overload.'];
  sceneEl.className='scene';
  if(!state.sortOrder) state.sortOrder=shuffle(sortItems.slice());
  sceneEl.innerHTML=`<section class="scene-wrap full">
    <div class="eyebrow">EARTH FIELD LAB // HUMAN SIGNALS</div>
    <h1 class="scene-title small">HUMANS WEAR THEIR SIGNALS ON THE OUTSIDE</h1>
    <p style="font-size:19px;max-width:1000px;line-height:1.5">Sort four example feelings into Glorb’s signal zones. When all four are matched, the full Human Signal Guide will appear.</p>
    <div class="sort-layout">
      <aside class="card-bank"><div class="bank-title">UNSORTED HUMAN SIGNALS // <span id="sortCount"></span></div><div id="emotionBank" class="emotion-bank"></div><div id="sortFeedback" class="sort-status">SELECT A CARD</div></aside>
      <div id="dropGrid" class="drop-grid">
        ${Object.keys(signalMeta).map(k=>`<div class="drop-zone ${k}" data-zone="${k}" tabindex="0" role="button" aria-label="Place selected feeling in ${signalMeta[k].label}"><h3>${signalMeta[k].label}</h3><p class="zone-desc">${signalMeta[k].short}</p><div class="placed-list" id="placed-${k}"></div><div id="reveal-${k}"></div></div>`).join('')}
      </div>
    </div>
  </section>`;
  const bank=document.getElementById('emotionBank');
  state.sortOrder.forEach(([word,cat])=>{
    const b=document.createElement('button');b.type='button';b.className='emotion-card';b.textContent=word.toUpperCase();b.dataset.word=word;b.dataset.cat=cat;b.draggable=true;
    if(state.sortDone.has(word)) b.classList.add('done');
    b.addEventListener('click',()=>selectEmotion(b));
    b.addEventListener('dragstart',e=>{state.selectedEmotion=word;e.dataTransfer.setData('text/plain',word);}); bank.appendChild(b);
  });
  document.querySelectorAll('.drop-zone').forEach(zone=>{
    zone.addEventListener('dragover',e=>{e.preventDefault();zone.classList.add('dragover')}); zone.addEventListener('dragleave',()=>zone.classList.remove('dragover'));
    zone.addEventListener('drop',e=>{e.preventDefault();zone.classList.remove('dragover');placeEmotion(e.dataTransfer.getData('text/plain'),zone.dataset.zone)});
    zone.addEventListener('click',()=>{if(state.selectedEmotion)placeEmotion(state.selectedEmotion,zone.dataset.zone)});
    zone.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&state.selectedEmotion){e.preventDefault();placeEmotion(state.selectedEmotion,zone.dataset.zone)}});
  });
  refreshSort();
}
function selectEmotion(btn){
  if(btn.classList.contains('done'))return; document.querySelectorAll('.emotion-card').forEach(x=>x.classList.remove('selected')); btn.classList.add('selected'); state.selectedEmotion=btn.dataset.word; document.getElementById('sortFeedback').textContent=`SELECTED: ${btn.textContent} // CHOOSE A SIGNAL ZONE`;
}
function placeEmotion(word,zone){
  const item=sortItems.find(x=>x[0]===word); if(!item||state.sortDone.has(word))return;
  const f=document.getElementById('sortFeedback');
  if(item[1]===zone){
    state.sortDone.add(word);
    state.selectedEmotion=null;
    sfxConfirm();
    f.textContent=`YES. ${word.toUpperCase()} FITS ${signalMeta[zone].label.toUpperCase()} — ${signalMeta[zone].short}`;
    refreshSort();
  } else {
    const correctZone=item[1];
    sfxRetry();
    f.textContent=`NOT QUITE. ${signalMeta[zone].label.toUpperCase()} MEANS: ${signalMeta[zone].desc} ${word.toUpperCase()} FITS BETTER WITH ${signalMeta[correctZone].label.toUpperCase()}: ${signalMeta[correctZone].short}`;
  }
}
function refreshSort(){
  document.querySelectorAll('.emotion-card').forEach(b=>b.classList.toggle('done',state.sortDone.has(b.dataset.word)));
  const complete=state.sortDone.size===sortItems.length;
  Object.keys(signalMeta).forEach(k=>{
    const list=document.getElementById(`placed-${k}`); if(!list)return;
    const words=complete ? fullEmotionSets[k] : sortItems.filter(([w,c])=>c===k&&state.sortDone.has(w)).map(([w])=>w);
    list.innerHTML=words.map(w=>`<span class="placed-pill">${escapeHTML(w)}</span>`).join('');
  });
  document.getElementById('sortCount').textContent=`${state.sortDone.size}/${sortItems.length}`;
  if(complete){
    const strip={low:'low-strip',steady:'steady-strip',rising:'rising-strip',overload:'overload-strip'};
    Object.keys(strip).forEach(k=>document.getElementById(`reveal-${k}`).innerHTML=`<img class="reveal-strip" src="${A(strip[k])}" alt="Completed ${signalMeta[k].label} human signal guide">`);
    document.getElementById('sortFeedback').textContent='HUMAN SIGNAL GUIDE COMPLETE.'; unlock(true); sfxConfirm();
  } else unlock(false,`SORTED ${state.sortDone.size}/${sortItems.length}`);
}

function renderStrategies(){
  currentTranscript=['What might help?','Which signal could this help with?','Different things help different people. These are just examples.'];
  sceneEl.className='scene';
  sceneEl.innerHTML=`<section class="scene-wrap full">
    <div class="eyebrow">EARTH FIELD LAB // RESPONSE OPTIONS</div>
    <h1 class="scene-title small">WHAT MIGHT HELP?</h1>
    <p style="font-size:19px;max-width:950px;line-height:1.5"><strong>Which signal could this help with?</strong><br>Different things help different people. These are just examples.</p>
    <div id="strategyBoard" class="strategy-board"></div>
    <div id="strategyStatus" class="sort-status"></div>
  </section>`;
  const board=document.getElementById('strategyBoard');
  strategies.forEach(([text,cat],i)=>{
    const done=state.strategyDone.has(i);
    const card=document.createElement('div');
    card.className='strategy-card';
    card.innerHTML=`<div class="eyebrow">RESPONSE ${String(i+1).padStart(2,'0')}</div><h3>${escapeHTML(text)}</h3><div class="strategy-prompt">Which signal could this help with?</div><div class="strategy-options">${Object.keys(signalMeta).map(k=>`<button type="button" class="signal-choice ${k}" data-k="${k}" ${done?'disabled':''}>${signalMeta[k].label}</button>`).join('')}</div>`;
    card.querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>{
      if(b.dataset.k===cat){
        state.strategyDone.add(i);
        b.classList.add('good');
        card.querySelectorAll('button').forEach(x=>x.disabled=true);
        sfxConfirm();
        refreshStrategies();
      } else {
        b.classList.remove('bad');
        b.classList.add('tried');
        b.textContent=`${signalMeta[b.dataset.k].label} — TRIED`;
        b.disabled=true;
        sfxRetry();
      }
    }));
    board.appendChild(card);
  });
  refreshStrategies();
}
function refreshStrategies(){
  const s=document.getElementById('strategyStatus');if(!s)return;s.textContent=`MATCHED ${state.strategyDone.size}/${strategies.length}`;
  if(state.strategyDone.size===strategies.length){s.textContent='RESPONSE GUIDE COMPLETE // READY TO REPLAY INCIDENT';unlock(true);sfxConfirm();} else unlock(false,`MATCHED ${state.strategyDone.size}/${strategies.length}`);
}

function renderReplay(){
  currentTranscript=['Replay the Tommy incident.','Tommy’s face tightens and his body becomes tense.','Choose what Glorb should do while the signal is still rising.'];
  sceneEl.className='scene';
  sceneEl.innerHTML=`<section class="scene-wrap">
    <div class="copy-zone"><div class="eyebrow">SIMULATION // 12:37 // PAUSED</div><h1 class="scene-title small">REPLAY THE MOMENT BEFORE IT GOT BIGGER</h1>
      <div class="story-lines"><p class="story-line system" style="animation-delay:.1s">Tommy’s face tightens.</p><p class="story-line system" style="animation-delay:.25s">His body gets tense.</p><p class="story-line glorb" style="animation-delay:.4s">I know what that means now. His signal is rising.</p></div>
      <div class="prompt-box"><div class="prompt-title">Choose Glorb’s response.</div><div class="choice-grid" id="replayChoices"></div><div class="feedback" id="replayFeedback" hidden></div></div>
    </div>
    <div class="art-zone"><img class="art-img large" src="${A('tommy-angry')}" alt="Tommy becoming angry while Glorb dances nearby"></div>
  </section>`;
  const opts=[
    ['KEEP DANCING UNTIL HE LAUGHS',false,'That adds more pressure when Tommy is already showing he wants space.'],
    ['STOP, STEP BACK + GIVE SPACE',true,'You noticed the rising signal and reduced the pressure.'],
    ['GET CLOSER SO HE CAN HEAR',false,'Closer is the opposite of the space Tommy is signalling for.'],
    ['ASK: “DO YOU WANT SOME SPACE?”',true,'Good. Glorb notices the signal and checks what Tommy needs.']
  ];
  const grid=document.getElementById('replayChoices'),fb=document.getElementById('replayFeedback');
  opts.forEach(([label,good,msg])=>{const b=document.createElement('button');b.type='button';b.className='choice-card';b.textContent=label;b.addEventListener('click',()=>{
    if(good){
      b.classList.add('correct');
      fb.className='feedback good';
      fb.textContent=msg;
      fb.hidden=false;
      state.replayChoiceMade=true;
      sfxConfirm();
      unlock(true);
    } else {
      b.classList.add('tried');
      b.textContent=`${label} — TRIED`;
      b.disabled=true;
      fb.className='feedback retry';
      fb.textContent=msg;
      fb.hidden=false;
      sfxRetry();
      unlock(false);
    }
  });grid.appendChild(b)});
  unlock(state.replayChoiceMade);
}

function renderComplete(){
  currentTranscript=['Mission complete',`${agentName()} investigated Glorb’s crash, learned the four signals, connected ship signals to body signals, identified human signals and changed the outcome of the Tommy incident.`];
  sceneEl.className='scene';
  sceneEl.innerHTML=`<section class="mission-complete">
    <img class="art-img small" src="${A('glorb-front')}" alt="Glorb standing" style="margin:0 auto 18px">
    <div class="eyebrow">ZORBAX-9 RESEARCH DIVISION // FIELD AGENT RESULT</div>
    <h1 class="scene-title">MISSION COMPLETE</h1>
    <p style="font-size:21px;line-height:1.55">${escapeHTML(agentName())}, Glorb has completed the Signal Manual and updated his Earth field notes.</p>
    <div class="complete-grid"><div class="complete-item">CRASH<br>INVESTIGATED ✓</div><div class="complete-item">SHIP + BODY<br>CONNECTED ✓</div><div class="complete-item">HUMAN SIGNALS<br>DECODED ✓</div><div class="complete-item">OUTCOME<br>CHANGED ✓</div></div>
    <div class="hud-card" style="max-width:780px;margin:0 auto;text-align:left"><strong>GLORB // FINAL NOTE</strong><p style="font-size:18px;line-height:1.6;margin-bottom:0">“I thought the important part was knowing what to do after everything went wrong. Turns out the useful information was there much earlier. The ship showed it. My ears showed it. Tommy showed it too.”</p></div>
  </section>`;
  unlock(true,'OPEN YOUR CERTIFICATE');
}

function renderCertificate(){
  currentTranscript=['Certificate of completion',`${agentName()} completed Glorb: The Signal Mission.`];
  sceneEl.className='scene';
  sceneEl.innerHTML=`<section class="certificate" id="certificateBlock">
    <div class="eyebrow">ZORBAX-9 RESEARCH DIVISION // EARTH FIELD AGENT</div>
    <h1>CERTIFICATE<br>OF COMPLETION</h1>
    <p>This certifies that</p>
    <div class="cert-name">${escapeHTML(agentName())}</div>
    <div class="cert-body"><p>has completed <strong>GLORB: THE SIGNAL MISSION: INCIDENT ESAU-32A</strong>.</p>
    <p>During this mission, ${escapeHTML(agentName())} investigated Glorb’s ship crash, tracked how signals changed from Low to Steady to Rising to Overload, connected dashboard warnings to Glorb’s ears and body, recognised human emotions as outside signals, matched helpful responses and used the learning to change the outcome of a replayed Earth incident.</p>
    <p><strong>${escapeHTML(agentName())} can now:</strong> notice changing signals, recognise when a person may need support or space, and choose a response before a situation gets bigger.</p></div>
    <div class="cert-stamp">MISSION STATUS // COMPLETE &nbsp;&nbsp; RESEARCH LOG // VERIFIED</div>
    <div class="cert-actions"><button class="nav-btn primary" id="printCert">PRINT / SAVE PDF</button><button class="nav-btn ghost" id="shareCert">SHARE RESULT</button><button class="nav-btn ghost" id="restartMission">RESTART MISSION</button></div>
  </section>`;
  document.getElementById('printCert').addEventListener('click',()=>window.print());
  document.getElementById('shareCert').addEventListener('click',async()=>{
    const text=`${agentName()} completed Glorb: The Signal Mission: Incident ESAU-32A.`;
    if(navigator.share){try{await navigator.share({title:'Glorb: The Signal Mission',text});}catch(e){}}
    else{await navigator.clipboard.writeText(text);alert('Completion message copied to clipboard.');}
  });
  document.getElementById('restartMission').addEventListener('click',()=>{sessionStorage.removeItem('glorbAgentName');location.reload()});
  setNav(true,false,'PRINT, SAVE OR SHARE YOUR RESULT');
}

function renderScene(){
  const scene=scenes[state.index];
  state.sceneUnlocked=false;
  progressText.textContent=scene.label;
  tickerText.textContent=`${scene.label} // ZORBAX-9 RESEARCH DIVISION // INCIDENT ESAU-32A // ${state.name?`AGENT: ${state.name.toUpperCase()} // `:''}INTERNAL USE ONLY //`;
  const pct=Math.max(0,Math.round((state.index)/(scenes.length-1)*100));progressBar.style.width=`${pct}%`;
  if(scene.type==='start')renderStart();
  else if(scene.type==='graph')renderGraph();
  else if(scene.type==='learn')renderLearn();
  else if(scene.type==='artifact')renderArtifact(scene);
  else if(scene.type==='sort')renderSort();
  else if(scene.type==='strategies')renderStrategies();
  else if(scene.type==='replay')renderReplay();
  else if(scene.type==='complete')renderComplete();
  else if(scene.type==='certificate')renderCertificate();
  else standardScene(scene);
  backBtn.disabled=state.index===0;
  sceneEl.focus({preventScroll:true});window.scrollTo({top:0,behavior:'smooth'});
}
function unlock(value=true,hint='CONTINUE WHEN READY'){state.sceneUnlocked=value;setNav(state.index>0,value,hint)}
function setNav(back,next,hint){backBtn.disabled=!back;nextBtn.disabled=!next;nextBtn.style.visibility=state.index===scenes.length-1?'hidden':'visible';navHint.textContent=hint||'';}
function goTo(i){if(i<0||i>=scenes.length)return;window.speechSynthesis?.cancel();readBtn.textContent='READ';readBtn.title='Read this screen aloud';state.index=i;renderScene();}

nextBtn.addEventListener('click',()=>{if(state.sceneUnlocked)goTo(state.index+1)});
backBtn.addEventListener('click',()=>goTo(state.index-1));
soundBtn.addEventListener('click',()=>{state.sound=!state.sound;soundBtn.textContent=`SOUND: ${state.sound?'ON':'OFF'}`;soundBtn.setAttribute('aria-pressed',String(state.sound));if(state.sound){initAudio();sfxConfirm();}});
readBtn.addEventListener('click',()=>{
  if(!('speechSynthesis'in window))return;
  if(window.speechSynthesis.speaking || window.speechSynthesis.pending){
    window.speechSynthesis.cancel();
    readBtn.textContent='READ';
    readBtn.title='Read this screen aloud';
    return;
  }
  const u=new SpeechSynthesisUtterance(currentTranscript.map(cleanText).join('. '));
  u.rate=.94;
  u.pitch=1;
  u.onstart=()=>{
    readBtn.textContent='STOP READING';
    readBtn.title='Stop reading aloud';
  };
  const resetReadButton=()=>{
    readBtn.textContent='READ';
    readBtn.title='Read this screen aloud';
  };
  u.onend=resetReadButton;
  u.onerror=resetReadButton;
  window.speechSynthesis.speak(u);
});
transcriptBtn.addEventListener('click',()=>{transcriptContent.innerHTML=currentTranscript.map(t=>`<p>${escapeHTML(cleanText(t))}</p>`).join('');transcriptDialog.showModal();});
document.querySelectorAll('[data-close-dialog]').forEach(b=>b.addEventListener('click',()=>b.closest('dialog').close()));
[transcriptDialog,evidenceDialog].forEach(d=>d.addEventListener('click',e=>{if(e.target===d)d.close()}));
function openEvidence(title,img){evidenceTitle.textContent=title;evidenceContent.innerHTML=`<img src="${img}" alt="${escapeHTML(title)}">`;evidenceDialog.showModal();}

document.addEventListener('keydown',e=>{
  if(e.key==='ArrowRight'&&state.sceneUnlocked&&!document.querySelector('dialog[open]'))goTo(state.index+1);
  if(e.key==='ArrowLeft'&&state.index>0&&!document.querySelector('dialog[open]'))goTo(state.index-1);
});

renderScene();