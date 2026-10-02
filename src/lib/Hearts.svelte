<script lang="ts">
  import { onMount } from 'svelte';
  import Rules from '$lib/Rules.svelte';
  export let onHome: () => void;

  type View = 'setup' | 'digital' | 'own' | 'round' | 'finish';
  type Mode = 'digital' | 'own';
  type Suit = '♣' | '♦' | '♠' | '♥';
  type Card = { suit: Suit; rank: number };
  type Player = { name: string; human: boolean; hand: Card[]; taken: Card[]; score: number };
  type Save = { view: View; names: string[]; mode: Mode; players: Player[]; round: number; leader: number; active: number; trick: { player: number; card: Card }[]; heartsBroken: boolean; passDirection: number; selected: string[]; passSeat: number; revealed: boolean; ownScores: number[]; log: string[] };
  const suits: Suit[] = ['♣','♦','♠','♥'];
  const saveKey = 'hearts-match-v1';
  let view: View = 'setup';
  let mode: Mode = 'digital';
  let names = ['Player 1'];
  let players: Player[] = [];
  let round = 0;
  let leader = 0;
  let active = 0;
  let trick: { player: number; card: Card }[] = [];
  let heartsBroken = false;
  let passDirection = 1;
  let selected: string[] = [];
  let passSeat = 0;
  let revealed = false;
  let ownScores = [0,0,0,0];
  let log: string[] = [];
  let busy = false;
  let mounted = false;

  $: current = players[active];
  $: passLabel = passDirection === 1 ? 'Pass left' : passDirection === 3 ? 'Pass right' : passDirection === 2 ? 'Pass across' : 'Keep cards';
  $: sorted = [...players].sort((a,b) => a.score - b.score);
  $: ownTotal = ownScores.reduce((sum, value) => sum + Number(value || 0), 0);
  $: if (mounted) { view; names; mode; players; round; leader; active; trick; heartsBroken; passDirection; selected; passSeat; revealed; ownScores; log; persist(); }

  onMount(() => {
    try { const raw = localStorage.getItem(saveKey); if (raw) { const state = JSON.parse(raw) as Save; if (state.players?.length && state.view !== 'setup') ({ view,names,mode,players,round,leader,active,trick,heartsBroken,passDirection,selected,passSeat,revealed,ownScores,log } = state); } } catch { /* fresh game */ }
    mounted = true;
  });
  function persist() { if (view !== 'setup' && view !== 'finish') localStorage.setItem(saveKey, JSON.stringify({ view,names,mode,players,round,leader,active,trick,heartsBroken,passDirection,selected,passSeat,revealed,ownScores,log } satisfies Save)); }
  function addPlayer() { if (names.length < 4) names = [...names, `Player ${names.length + 1}`]; }
  function removePlayer(i:number) { if (names.length > 1) names = names.filter((_,index) => index !== i); }
  function rename(i:number,value:string) { names[i] = value; names = [...names]; }
  function cardId(card:Card) { return `${card.suit}${card.rank}`; }
  function rank(card:Card) { return card.rank === 14 ? 'A' : card.rank === 13 ? 'K' : card.rank === 12 ? 'Q' : card.rank === 11 ? 'J' : String(card.rank); }
  function value(card:Card) { return card.suit === '♥' ? 1 : card.suit === '♠' && card.rank === 12 ? 13 : 0; }
  function sortHand(hand:Card[]) { return [...hand].sort((a,b) => suits.indexOf(a.suit)-suits.indexOf(b.suit) || a.rank-b.rank); }
  function deck() { const cards = suits.flatMap((suit) => Array.from({length:13},(_,i) => ({ suit, rank:i+2 }))); for(let i=51;i>0;i--){const j=Math.floor(Math.random()*(i+1));[cards[i],cards[j]]=[cards[j],cards[i]];} return cards; }

  function start() {
    players = Array.from({length:4},(_,i) => ({ name: names[i]?.trim() || `Computer ${i-names.length+1}`, human:i<names.length, hand:[], taken:[], score:0 }));
    round = 0; log = []; mode === 'digital' ? dealRound() : (view = 'own');
  }
  function dealRound() {
    round += 1; const cards=deck(); heartsBroken=false; trick=[]; selected=[]; revealed=false; busy=false;
    players = players.map((p,i) => ({...p, hand:sortHand(cards.slice(i*13,i*13+13)),taken:[]}));
    passDirection = [1,3,2,0][(round-1)%4]; passSeat=0;
    if (passDirection === 0) beginTricks(); else { view='round'; preparePassSeat(); }
  }
  function preparePassSeat() {
    while(passSeat<4 && !players[passSeat].human) passSeat++;
    if(passSeat>=4) performPass(); else { selected=[]; revealed=false; }
  }
  function togglePass(card:Card) {
    const id=cardId(card); if(selected.includes(id)) selected=selected.filter((item)=>item!==id); else if(selected.length<3) selected=[...selected,id];
  }
  let humanPasses: Record<number,string[]> = {};
  function submitPass() { if(selected.length!==3)return; humanPasses={...humanPasses,[passSeat]:selected}; passSeat++; preparePassSeat(); }
  function performPass() {
    const outgoing:Card[][] = players.map((p,i) => {
      const ids = p.human ? (humanPasses[i] || []) : [...p.hand].sort((a,b)=>value(b)-value(a)||b.rank-a.rank).slice(0,3).map(cardId);
      const picked=p.hand.filter((card)=>ids.includes(cardId(card))); p.hand=p.hand.filter((card)=>!ids.includes(cardId(card))); return picked;
    });
    players.forEach((p,i)=>p.hand=sortHand([...p.hand,...outgoing[(i-passDirection+4)%4]]));
    players=[...players]; humanPasses={}; beginTricks();
  }
  function beginTricks() {
    view='digital'; leader=players.findIndex((p)=>p.hand.some((c)=>c.suit==='♣'&&c.rank===2)); active=leader; revealed=false; queueBots();
  }
  function legalCards(player:Player) {
    if(!trick.length && players.every((p)=>p.hand.length===13)) return player.hand.filter((c)=>c.suit==='♣'&&c.rank===2);
    if(trick.length){const suit=trick[0].card.suit;const follow=player.hand.filter((c)=>c.suit===suit);if(follow.length)return follow;if(players.every((p)=>p.hand.length===13)){const clean=player.hand.filter((c)=>value(c)===0);if(clean.length)return clean;}return player.hand;}
    const nonHearts=player.hand.filter((c)=>c.suit!=='♥');return heartsBroken||!nonHearts.length?player.hand:nonHearts;
  }
  function canPlay(card:Card) { return !busy && current?.human && revealed && legalCards(current).some((c)=>cardId(c)===cardId(card)); }
  function play(card:Card) {
    if(!legalCards(players[active]).some((c)=>cardId(c)===cardId(card)))return;
    const seat=active; players[seat].hand=players[seat].hand.filter((c)=>cardId(c)!==cardId(card)); if(card.suit==='♥')heartsBroken=true;
    trick=[...trick,{player:seat,card}];players=[...players];active=(active+1)%4;revealed=false;
    if(trick.length===4) finishTrick(); else queueBots();
  }
  function botCard(player:Player) { const legal=legalCards(player); return [...legal].sort((a,b)=>value(a)-value(b)||a.rank-b.rank)[0]; }
  async function queueBots() {
    if(view!=='digital'||busy)return; busy=true;
    while(trick.length<4 && !players[active].human){await new Promise(r=>setTimeout(r,360));const card=botCard(players[active]);const seat=active;players[seat].hand=players[seat].hand.filter(c=>cardId(c)!==cardId(card));if(card.suit==='♥')heartsBroken=true;trick=[...trick,{player:seat,card}];players=[...players];active=(active+1)%4;}
    busy=false;if(trick.length===4)finishTrick();
  }
  async function finishTrick() {
    busy=true;await new Promise(r=>setTimeout(r,650));const lead=trick[0].card.suit;const winner=[...trick].filter(x=>x.card.suit===lead).sort((a,b)=>b.card.rank-a.card.rank)[0].player;const pts=trick.reduce((sum,x)=>sum+value(x.card),0);players[winner].taken=[...players[winner].taken,...trick.map(x=>x.card)];log=[`${players[winner].name} took ${pts} point${pts===1?'':'s'}`,...log].slice(0,8);leader=winner;active=winner;trick=[];players=[...players];busy=false;
    if(players.every(p=>!p.hand.length))scoreRound();else{revealed=false;queueBots();}
  }
  function scoreRound() {
    const points=players.map(p=>p.taken.reduce((sum,c)=>sum+value(c),0));const moon=points.indexOf(26);
    players=players.map((p,i)=>({...p,score:p.score+(moon>=0?(i===moon?0:26):points[i])}));log=[moon>=0?`${players[moon].name} shot the moon`:`Round ${round}: ${points.join(' · ')}`,...log];view='round';selected=[];passSeat=-1;
  }
  function nextRound(){if(players.some(p=>p.score>=100))finish();else dealRound();}
  function addOwnRound(){if(ownTotal!==26)return;players=players.map((p,i)=>({...p,score:p.score+Number(ownScores[i]||0)}));log=[`Round ${round+1}: ${ownScores.join(' · ')}`,...log];round++;ownScores=[0,0,0,0];if(players.some(p=>p.score>=100))finish();}
  function finish(){view='finish';localStorage.removeItem(saveKey);}
  function home(){localStorage.removeItem(saveKey);onHome();}
  function abandon(){if(confirm('Leave this game of Hearts?'))home();}
</script>

{#if view==='setup'}
<div class="hearts-rules"><Rules game="Hearts" sections={[{title:'Goal',text:'Avoid points: hearts are worth 1 and the queen of spades is worth 13.'},{title:'Pass',text:'Pass three cards left, right, or across; every fourth round has no pass.'},{title:'Tricks',text:'The two of clubs starts. Follow suit; the highest card of the led suit wins.'},{title:'Hearts',text:'Hearts cannot lead until broken. First-trick points are forbidden unless unavoidable.'},{title:'Moon',text:'Taking all 26 points gives every opponent 26. At 100, lowest wins.'}]}/></div>
<section class="h-setup"><button class="back" on:click={onHome}>‹ All games</button><h1>Hearts</h1><div class="setup-grid"><div class="panel"><header><h2>Human players</h2><span>{names.length}</span></header><div class="names">{#each names as name,i}<label><small>{String(i+1).padStart(2,'0')}</small><input aria-label={"Player " + (i + 1) + " name"} value={name} on:input={(e)=>rename(i,e.currentTarget.value)} /><button disabled={names.length===1} on:click={()=>removePlayer(i)} aria-label={"Remove " + name}>×</button></label>{/each}</div><button class="add" disabled={names.length>=4} on:click={addPlayer}>＋ Add player</button></div><div class="panel"><header><h2>Cards</h2><span>52</span></header><div class="mode"><button class:chosen={mode==='digital'} on:click={()=>mode='digital'}>Digital cards</button><button class:chosen={mode==='own'} on:click={()=>mode='own'}>Own cards</button></div><p>{mode==='digital'?'Empty seats become computer players.':'Use your deck; this keeps the scores.'}</p></div></div><button class="start" on:click={start}>Start game <span>›</span></button></section>
{:else if view==='own'}
<section class="own"><header class="top"><button on:click={abandon}><span>♥</span><b>Hearts</b></button><div aria-live="polite"><small>Round {round+1}</small><strong>Enter scores</strong></div><button on:click={abandon} aria-label="Close game">×</button></header><main><h1>{ownTotal}<small>/ 26 points</small></h1><div class="score-entry">{#each players as player,i}<label><span>{player.name}<small>{player.score} total</small></span><input type="number" min="0" max="26" bind:value={ownScores[i]} /></label>{/each}</div><button class="add-round" disabled={ownTotal!==26} on:click={addOwnRound}>Add round ›</button><button class="cash" on:click={finish}>Finish game</button></main></section>
{:else if view==='round' && passSeat>=0}
<section class="handoff"><span>♥</span><small>Round {round} · {passLabel}</small><h1>{players[passSeat]?.name}</h1>{#if revealed}<p>Choose three cards to pass.</p><div class="hand">{#each players[passSeat].hand as card}<button class:red={card.suit==='♥'||card.suit==='♦'} class:selected={selected.includes(cardId(card))} on:click={()=>togglePass(card)}><b>{rank(card)}</b><span>{card.suit}</span></button>{/each}</div><button class="continue" disabled={selected.length!==3} on:click={submitPass}>Pass {selected.length}/3 ›</button>{:else}<p>Pass the device, then reveal your hand.</p><button class="continue" on:click={()=>revealed=true}>Reveal hand</button>{/if}</section>
{:else if view==='round'}
<section class="handoff"><span>♥</span><small>Round {round} complete</small><h1>{players.map(p=>p.score).join(' · ')}</h1><p>Lowest score wins. The game ends at 100.</p><button class="continue" on:click={nextRound}>Next round ›</button><button class="quiet" on:click={finish}>Finish game</button></section>
{:else if view==='digital'}
<section class="h-game"><header class="top"><button on:click={abandon}><span>♥</span><b>Hearts</b></button><div aria-live="polite"><small>Round {round} · {heartsBroken?'Hearts broken':'Hearts closed'}</small><strong>{current?.name}</strong></div><button on:click={abandon} aria-label="Close game">×</button></header><div class="layout"><div class="felt"><div class="players">{#each players as player,i}<article class:active={i===active}><b>{player.name}</b><span>{player.score} pts · {player.hand.length} cards</span></article>{/each}</div><div class="trick">{#each trick as played}<div class="table-card" class:red={played.card.suit==='♥'||played.card.suit==='♦'}><b>{rank(played.card)}</b><span>{played.card.suit}</span><small>{players[played.player].name}</small></div>{/each}</div>{#if current?.human}<div class="hand-zone">{#if revealed}<div class="hand">{#each current.hand as card}<button class:red={card.suit==='♥'||card.suit==='♦'} class:legal={canPlay(card)} disabled={!canPlay(card)} on:click={()=>play(card)}><b>{rank(card)}</b><span>{card.suit}</span></button>{/each}</div>{:else}<button class="reveal" disabled={busy} on:click={()=>revealed=true}>Reveal {current.name}'s hand</button>{/if}</div>{/if}</div><aside><h2>Tricks</h2>{#each log as item}<p>{item}</p>{/each}{#if !log.length}<p>Play the two of clubs to begin.</p>{/if}</aside></div></section>
{:else}<section class="finish"><span>♥</span><h1>Final scores</h1><p>Lowest score wins.</p><div>{#each sorted as player,i}<article class:winner={i===0}><small>{String(i+1).padStart(2,'0')}</small><b>{player.name}</b><strong>{player.score}</strong></article>{/each}</div><footer><button on:click={start}>Replay ›</button><button on:click={home}>Home</button></footer></section>{/if}

<style>
.hearts-rules{position:absolute;z-index:5;top:34px;margin-left:calc((100% - min(1120px,calc(100% - 40px)))/2 + 82px)}
:global(*){box-sizing:border-box}.h-setup,.finish{width:min(1120px,calc(100% - 40px));min-height:100vh;margin:auto;padding:34px 0;color:#191914}.back{border:0;background:none;padding:8px 0;cursor:pointer;font:600 12px ui-monospace}.h-setup>h1,.finish h1{margin:64px 0 42px;font-size:clamp(62px,10vw,108px);line-height:.88;letter-spacing:-.08em}.setup-grid{display:grid;grid-template-columns:1.1fr .9fr;border-block:1px solid #cfc5b3}.panel{padding:30px 34px 34px 0}.panel+.panel{padding-left:34px;border-left:1px solid #cfc5b3}.panel header{display:flex;justify-content:space-between}.panel header span{display:grid;place-items:center;width:28px;height:28px;border-radius:50%;background:#a82b34;color:white;font:11px ui-monospace}.names{display:grid;grid-template-columns:1fr 1fr;gap:8px}.names label{display:flex;align-items:center;background:#e8decc;border-bottom:1px solid #cfc5b3}.names small{padding:0 10px;color:#837c70}.names input{min-width:0;width:100%;padding:15px 0;border:0;outline:0;background:none;font-weight:700}.names button,.add{border:0;background:none;cursor:pointer}.names button{padding:12px}.add{padding:18px 0;color:#a82b34;font-weight:800}.mode{display:grid;grid-template-columns:1fr 1fr;border:1px solid #bbb2a3}.mode button{height:50px;border:0;background:#e7dcc9;font-weight:700}.mode button.chosen{background:#191914;color:white}.panel p{margin:18px 0 0;color:#746e62;font-size:12px}.start{float:right;margin-top:28px;min-width:250px;height:58px;border:0;background:#a82b34;color:white;padding:0 24px;display:flex;justify-content:space-between;align-items:center;font-weight:800}
.top{height:72px;display:grid;grid-template-columns:1fr auto 1fr;align-items:center;padding:0 24px;border-bottom:1px solid #c5bbac;background:#e4dac9}.top>button{justify-self:start;border:0;background:none;display:flex;align-items:center;gap:9px}.top>button:last-child{justify-self:end;width:38px;height:38px;display:grid;place-items:center;border:1px solid #aea596;border-radius:50%}.top button span,.handoff>span,.finish>span{display:grid;place-items:center;width:34px;height:34px;border-radius:50%;background:#a82b34;color:white}.top>div{text-align:center}.top small,.top strong{display:block}.top small{font:9px ui-monospace;color:#777064}.h-game{min-height:100vh;background:#ded5c6}.layout{display:grid;grid-template-columns:minmax(0,1fr) 280px;min-height:calc(100vh - 72px)}.felt{position:relative;min-height:690px;margin:24px;border:15px solid #704329;border-radius:42%;background:#235841;box-shadow:inset 0 0 0 4px #b48757;color:white}.players{position:absolute;inset:24px;display:grid;grid-template-columns:1fr 1fr;align-content:space-between;gap:430px 20px}.players article{text-align:center;opacity:.58}.players article.active{opacity:1}.players b,.players span{display:block}.players span{font:9px ui-monospace;color:#e0c990}.trick{position:absolute;left:50%;top:42%;transform:translate(-50%,-50%);display:flex}.table-card,.hand button{width:64px;height:92px;margin-left:-12px;padding:8px;border:1px solid #ded3c1;border-radius:5px;background:#f7efdf;color:#191914;box-shadow:2px 4px 8px #0d302477;text-align:left}.table-card.red,.hand button.red{color:#af2933}.table-card b,.table-card span,.hand b,.hand span{display:block;font:800 20px Georgia}.table-card small{display:block;margin-top:20px;font:7px ui-monospace;color:#756e63}.hand-zone{position:absolute;left:20px;right:20px;bottom:28px;z-index:4;text-align:center}.hand{display:flex;justify-content:center;padding-left:12px}.hand button{cursor:pointer;transition:transform .18s}.hand button.legal:hover,.hand button.legal:focus-visible,.hand button.selected{transform:translateY(-12px);outline:3px solid #e5bd58}.hand button:disabled{opacity:.58;cursor:not-allowed}.reveal,.continue,.add-round{min-width:230px;height:54px;border:0;background:#191914;color:white;font-weight:800}.layout aside{padding:30px 22px;border-left:1px solid #bbb2a3;background:#eee5d5}.layout aside h2{font-size:16px}.layout aside p{padding:12px 0;margin:0;border-top:1px solid #cec3b3;color:#6e675c;font-size:11px;line-height:1.4}
.handoff{min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:30px;text-align:center;background:#eee5d5}.handoff>small{margin-top:18px;color:#a82b34;font:10px ui-monospace;text-transform:uppercase;letter-spacing:.13em}.handoff h1{margin:12px 0;font-size:clamp(44px,8vw,82px);letter-spacing:-.06em}.handoff p{color:#746e63}.handoff .hand{width:min(920px,100%);margin:30px 0}.handoff .continue{margin-top:20px}.quiet,.cash{margin-top:10px;border:0;background:none;padding:14px;font-weight:700}.own{min-height:100vh;background:#eee5d5}.own main{width:min(650px,calc(100% - 32px));margin:70px auto;text-align:center}.own h1{font:500 90px/1 ui-monospace;color:#a82b34}.own h1 small{display:block;font:10px ui-monospace;color:#6e675d}.score-entry{border-top:1px solid #c9bfae}.score-entry label{display:grid;grid-template-columns:1fr 100px;align-items:center;text-align:left;padding:13px;border-bottom:1px solid #c9bfae}.score-entry span small{display:block;color:#847d70;font:9px ui-monospace}.score-entry input{width:100%;padding:12px;border:1px solid #bbb1a0;background:#f7efdf;text-align:center}.add-round{margin-top:24px}.add-round:disabled{opacity:.3}
.finish{display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center}.finish h1{margin:24px 0 8px}.finish>div{width:min(650px,100%);margin:28px 0;border-top:1px solid #cfc5b3}.finish article{display:grid;grid-template-columns:50px 1fr auto;align-items:center;padding:18px;text-align:left;border-bottom:1px solid #cfc5b3}.finish article.winner{background:#191914;color:white}.finish article strong{font:24px ui-monospace}.finish footer{display:flex;gap:8px}.finish footer button{min-width:150px;height:54px;border:1px solid #191914;background:none;font-weight:800}.finish footer button:first-child{background:#191914;color:white}
@media(max-width:760px){.h-setup{width:calc(100% - 28px);padding-top:20px}.h-setup>h1{margin:34px 0 25px;font-size:58px}.setup-grid{grid-template-columns:1fr}.panel{padding:22px 0}.panel+.panel{padding:22px 0;border-left:0;border-top:1px solid #cfc5b3}.names{grid-template-columns:1fr}.start{width:100%}.top{height:64px;padding:0 12px}.top b{display:none}.layout{display:block}.felt{min-height:620px;margin:7px;border-width:9px;border-radius:35%}.players{inset:15px;gap:420px 8px}.players article{font-size:11px}.trick{top:39%}.table-card{width:52px;height:76px}.hand-zone{bottom:20px;left:4px;right:4px;overflow-x:auto;padding-top:16px}.hand{justify-content:flex-start;width:max-content;min-width:100%}.hand button{width:49px;height:75px;margin-left:-17px}.hand button:first-child{margin-left:0}.layout aside{border-left:0;border-top:1px solid #bbb2a3}.handoff{padding:20px}.handoff .hand{overflow-x:auto;justify-content:flex-start}.finish{width:calc(100% - 28px);justify-content:flex-start;padding-top:55px}.finish h1{font-size:54px}.finish footer{width:100%;flex-direction:column}.finish footer button{width:100%}}
@media(prefers-reduced-motion:reduce){*{transition:none!important}}
</style>
