<script lang="ts">
  import { onMount } from 'svelte';
  import Rules from '$lib/Rules.svelte';

  export let onHome: () => void;
  type View = 'setup' | 'input' | 'play' | 'result' | 'finish';
  type Mode = 'digital' | 'own';
  type Player = { name: string; diceCount: number; dice: number[] };
  type Bid = { quantity: number; face: number; player: number };
  type Result = { challenger: number; bidder: number; loser: number; actual: number; bid: Bid };
  type Save = { view: View; mode: Mode; names: string[]; wildOnes: boolean; players: Player[]; active: number; starter: number; round: number; bid: Bid | null; bidQuantity: number; bidFace: number; revealed: boolean; inputSeat: number; manualDice: number[]; result: Result | null; log: string[] };

  const faces = ['⚀','⚁','⚂','⚃','⚄','⚅'];
  const saveKey = 'liars-dice-match-v1';
  let view: View = 'setup';
  let mode: Mode = 'digital';
  let names = ['Player 1', 'Player 2'];
  let wildOnes = true;
  let players: Player[] = [];
  let active = 0;
  let starter = 0;
  let round = 0;
  let bid: Bid | null = null;
  let bidQuantity = 1;
  let bidFace = 2;
  let revealed = false;
  let inputSeat = 0;
  let manualDice: number[] = [];
  let result: Result | null = null;
  let log: string[] = [];
  let mounted = false;

  $: current = players[active];
  $: totalDice = players.reduce((sum, player) => sum + player.diceCount, 0);
  $: alive = players.filter((player) => player.diceCount > 0);
  $: validBid = !bid || bidQuantity > bid.quantity || (bidQuantity === bid.quantity && bidFace > bid.face);
  $: winner = players.find((player) => player.diceCount > 0);
  $: if (mounted) { view; mode; names; wildOnes; players; active; starter; round; bid; bidQuantity; bidFace; revealed; inputSeat; manualDice; result; log; persist(); }

  onMount(() => {
    try { const raw = localStorage.getItem(saveKey); if (raw) { const state = JSON.parse(raw) as Save; if (state.players?.length && state.view !== 'setup') ({ view,mode,names,wildOnes,players,active,starter,round,bid,bidQuantity,bidFace,revealed,inputSeat,manualDice,result,log } = state); } } catch { /* fresh table */ }
    mounted = true;
  });
  function persist() { if (view !== 'setup' && view !== 'finish') localStorage.setItem(saveKey, JSON.stringify({ view,mode,names,wildOnes,players,active,starter,round,bid,bidQuantity,bidFace,revealed,inputSeat,manualDice,result,log } satisfies Save)); }
  function addPlayer() { if (names.length < 6) names = [...names, `Player ${names.length + 1}`]; }
  function removePlayer(index:number) { if (names.length > 2) names = names.filter((_,i) => i !== index); }
  function rename(index:number,value:string) { names[index]=value; names=[...names]; }
  function nextAlive(from:number) { for(let step=1;step<=players.length;step++){const index=(from+step)%players.length;if(players[index].diceCount>0)return index;}return from; }
  function randomDice(count:number) { return Array.from({length:count},()=>Math.floor(Math.random()*6)+1); }

  function startGame() {
    players=names.map((name,index)=>({name:name.trim()||`Player ${index+1}`,diceCount:5,dice:[]}));starter=0;round=0;log=[];startRound();
  }
  function startRound() {
    round++;bid=null;result=null;revealed=false;bidQuantity=1;bidFace=2;
    players=players.map((player)=>({...player,dice:mode==='digital'&&player.diceCount?randomDice(player.diceCount):[]}));
    active=starter;
    if(mode==='own'){inputSeat=players.findIndex((player)=>player.diceCount>0);manualDice=[];view='input';}else view='play';
  }
  function addManual(value:number) { if(manualDice.length<players[inputSeat].diceCount)manualDice=[...manualDice,value]; }
  function submitOwnDice() {
    if(manualDice.length!==players[inputSeat].diceCount)return;
    players[inputSeat].dice=[...manualDice];players=[...players];
    let next=-1;for(let i=inputSeat+1;i<players.length;i++)if(players[i].diceCount>0&&players[i].dice.length===0){next=i;break;}
    if(next>=0){inputSeat=next;manualDice=[];}else{active=starter;revealed=false;view='play';}
  }
  function adjustQuantity(change:number){bidQuantity=Math.max(1,Math.min(totalDice,bidQuantity+change));}
  function adjustFace(change:number){bidFace=Math.max(1,Math.min(6,bidFace+change));}
  function placeBid() {
    if(!validBid||bidQuantity>totalDice)return;
    bid={quantity:bidQuantity,face:bidFace,player:active};
    log=[`${players[active].name}: ${bidQuantity} × ${bidFace}`,...log].slice(0,12);
    active=nextAlive(active);revealed=false;
    if(bidFace<6){bidFace++;}else{bidQuantity=Math.min(totalDice,bidQuantity+1);bidFace=1;}
  }
  function challenge() {
    if(!bid)return;
    const actual=players.flatMap((player)=>player.dice).filter((die)=>die===bid!.face||(wildOnes&&bid!.face!==1&&die===1)).length;
    const challenger=active;const loser=actual>=bid.quantity?challenger:bid.player;
    players[loser].diceCount--;players=[...players];
    result={challenger,bidder:bid.player,loser,actual,bid};
    log=[`${players[challenger].name} challenged · ${actual} found · ${players[loser].name} lost a die`,...log].slice(0,12);
    view='result';revealed=true;
  }
  function continueRound() {
    if(alive.length===1){view='finish';localStorage.removeItem(saveKey);return;}
    starter=players[result!.loser].diceCount>0?result!.loser:nextAlive(result!.loser);startRound();
  }
  function home(){localStorage.removeItem(saveKey);onHome();}
  function abandon(){if(confirm('Leave this game of Liar’s Dice?'))home();}
</script>

{#if view==='setup'}
  <section class="ld-setup">
    <div class="setup-nav"><button class="back" on:click={onHome}>‹ All games</button><Rules game="Liar’s Dice" sections={[{title:'Goal',text:'Be the last player with dice remaining.'},{title:'Look',text:'Roll secretly and look only at your own dice.'},{title:'Bid',text:'Claim how many dice of one face exist under every cup combined. Each bid must raise the quantity or face.'},{title:'Challenge',text:'Instead of bidding, call the previous player a liar. Everyone reveals their dice; whoever was wrong loses one die.'},{title:'Wild ones',text:'When enabled, ones count as the bid face, except when the bid itself is for ones.'}]}/></div>
    <h1>Liar’s Dice</h1>
    <div class="setup-grid"><div class="panel"><header><h2>Players</h2><span>{names.length}</span></header><div class="names">{#each names as name,index}<label><small>{String(index+1).padStart(2,'0')}</small><input value={name} aria-label={`Player ${index+1} name`} on:input={(event)=>rename(index,event.currentTarget.value)}/><button disabled={names.length<=2} on:click={()=>removePlayer(index)} aria-label={"Remove " + name}>×</button></label>{/each}</div><button class="add" disabled={names.length>=6} on:click={addPlayer}>＋ Add player</button></div><div class="panel"><header><h2>Dice</h2><span>5</span></header><div class="mode"><button class:chosen={mode==='digital'} on:click={()=>mode='digital'}>Digital dice</button><button class:chosen={mode==='own'} on:click={()=>mode='own'}>Own dice</button></div><label class="toggle"><span><b>Wild ones</b><small>Ones match every other face</small></span><input type="checkbox" bind:checked={wildOnes}/></label></div></div>
    <button class="start" on:click={startGame}>Shake the cups <span>›</span></button>
  </section>
{:else if view==='input'}
  <section class="handoff"><div class="cup-icon">●</div><small>Round {round} · Own dice</small><h1>{players[inputSeat].name}</h1><p>Enter the dice hidden under your cup.</p><div class="entered">{#each Array(players[inputSeat].diceCount) as _,index}<span>{manualDice[index]?faces[manualDice[index]-1]:'·'}</span>{/each}</div><div class="keypad">{#each [1,2,3,4,5,6] as die}<button on:click={()=>addManual(die)} aria-label={"Enter die " + die}>{faces[die-1]}</button>{/each}</div><button class="undo" disabled={!manualDice.length} on:click={()=>manualDice=manualDice.slice(0,-1)}>Undo</button><button class="continue" disabled={manualDice.length!==players[inputSeat].diceCount} on:click={submitOwnDice}>Hide & pass ›</button></section>
{:else if view==='play'}
  <section class="ld-game"><header class="top"><button on:click={abandon}><span>●</span><b>Liar’s Dice</b></button><div aria-live="polite"><small>Round {round} · {totalDice} dice</small><strong>{current.name}</strong></div><button on:click={abandon} aria-label="Close game">×</button></header><div class="layout"><main class="table"><div class="seats" style={`--players:${players.length}`}>{#each players as player,index}<article class:active={index===active} class:out={!player.diceCount}><div class="mini-cup"><i></i></div><b>{player.name}</b><span>{player.diceCount} {player.diceCount===1?'die':'dice'}</span></article>{/each}</div><div class="centre"><small>Current bid</small>{#if bid}<div class="big-bid"><strong>{bid.quantity}</strong><span>×</span><b>{faces[bid.face-1]}</b></div><p>by {players[bid.player].name}</p>{:else}<div class="big-bid empty">Open</div><p>{current.name} begins</p>{/if}</div>{#if revealed}<div class="your-dice"><small>Your dice</small><div>{#each current.dice as die}<span>{faces[die-1]}</span>{/each}</div></div>{:else}<button class="reveal" on:click={()=>revealed=true}>Reveal {current.name}’s dice</button>{/if}</main><aside><h2>Make a bid</h2><div class="bid-control"><span class="control-label">Quantity</span><div><button on:click={()=>adjustQuantity(-1)} aria-label="Decrease bid quantity">−</button><strong>{bidQuantity}</strong><button on:click={()=>adjustQuantity(1)} aria-label="Increase bid quantity">＋</button></div></div><div class="bid-control"><span class="control-label">Face</span><div><button on:click={()=>adjustFace(-1)} aria-label="Decrease bid face">−</button><strong class="die-face">{faces[bidFace-1]}</strong><button on:click={()=>adjustFace(1)} aria-label="Increase bid face">＋</button></div></div><button class="bid" disabled={!revealed||!validBid||bidQuantity>totalDice} on:click={placeBid}>Bid {bidQuantity} × {bidFace}</button><button class="challenge" disabled={!revealed||!bid} on:click={challenge}>Call liar</button><div class="history">{#each log.slice(0,4) as item}<p>{item}</p>{/each}</div></aside></div></section>
{:else if view==='result' && result}
  <section class="result"><small>Challenge</small><h1>{result.actual}</h1><p>{result.bid.face===1?'ones':`${result.bid.face}s${wildOnes?' including wild ones':''}`} found · bid was {result.bid.quantity}</p><div class="reveal-all">{#each players as player}<article><b>{player.name}</b><div>{#each player.dice as die}<span class:match={die===result.bid.face||(wildOnes&&result.bid.face!==1&&die===1)}>{faces[die-1]}</span>{/each}</div></article>{/each}</div><h2>{players[result.loser].name} loses a die</h2><button on:click={continueRound}>{alive.length===1?'See winner':'Next round'} ›</button></section>
{:else}
  <section class="finish"><span>●</span><small>Last cup standing</small><h1>{winner?.name}</h1><p>Wins with {winner?.diceCount} {winner?.diceCount===1?'die':'dice'} left.</p><div><button on:click={startGame}>Replay ›</button><button on:click={home}>Home</button></div></section>
{/if}

<style>
  :global(*){box-sizing:border-box}.ld-setup,.finish{width:min(1120px,calc(100% - 40px));min-height:100vh;margin:auto;padding:34px 0;color:#191914}.setup-nav{display:flex;align-items:center}.back{border:0;background:none;padding:8px 0;cursor:pointer;font:600 12px ui-monospace}.ld-setup>h1{margin:64px 0 42px;font-size:clamp(58px,9vw,104px);line-height:.9;letter-spacing:-.075em}.setup-grid{display:grid;grid-template-columns:1.1fr .9fr;border-block:1px solid #cfc5b3}.panel{padding:30px 34px 34px 0}.panel+.panel{padding-left:34px;border-left:1px solid #cfc5b3}.panel header{display:flex;justify-content:space-between}.panel header span{display:grid;place-items:center;width:28px;height:28px;border-radius:50%;background:#244b64;color:white;font:11px ui-monospace}.names{display:grid;grid-template-columns:1fr 1fr;gap:8px}.names label{display:flex;align-items:center;background:#e8decc;border-bottom:1px solid #cfc5b3}.names small{padding:0 10px;color:#847d71}.names input{min-width:0;width:100%;border:0;background:none;padding:15px 0;font-weight:700;outline:0}.names button,.add{border:0;background:none;cursor:pointer}.names button{padding:12px}.add{padding:18px 0;color:#244b64;font-weight:800}.mode{display:grid;grid-template-columns:1fr 1fr;border:1px solid #bbb2a3}.mode button{height:50px;border:0;background:#e6dbc8;font-weight:700}.mode .chosen{background:#191914;color:white}.toggle{display:flex;justify-content:space-between;align-items:center;margin-top:22px;padding:16px 0;border-block:1px solid #cfc5b3}.toggle span b,.toggle span small{display:block}.toggle span small{margin-top:4px;color:#777064;font-size:10px}.toggle input{width:22px;height:22px;accent-color:#244b64}.start{float:right;margin-top:28px;min-width:250px;height:58px;border:0;background:#244b64;color:white;padding:0 24px;display:flex;justify-content:space-between;align-items:center;font-weight:800;cursor:pointer}
  .top{height:72px;display:grid;grid-template-columns:1fr auto 1fr;align-items:center;padding:0 24px;border-bottom:1px solid #bdb3a4;background:#e4dac9}.top>button{justify-self:start;border:0;background:none;display:flex;gap:9px;align-items:center}.top>button:last-child{justify-self:end;display:grid;place-items:center;width:38px;height:38px;border:1px solid #aea596;border-radius:50%}.top button span,.finish>span{display:grid;place-items:center;width:33px;height:33px;border-radius:50%;background:#244b64;color:#d6e4ed}.top>div{text-align:center}.top small,.top strong{display:block}.top small{font:9px ui-monospace;color:#777064}.ld-game{min-height:100vh;background:#ded5c6}.layout{display:grid;grid-template-columns:minmax(0,1fr) 300px;min-height:calc(100vh - 72px)}.table{position:relative;min-height:680px;margin:24px;border:16px solid #704329;border-radius:45%;background:#274c62;box-shadow:inset 0 0 0 4px #aa7e51;color:white}.seats{position:absolute;inset:25px;display:grid;grid-template-columns:repeat(3,1fr);align-content:space-between;gap:420px 12px}.seats article{text-align:center;opacity:.5}.seats article.active{opacity:1}.seats article.out{opacity:.18}.seats article b,.seats article span{display:block}.seats article span{font:9px ui-monospace;color:#ccdce5}.mini-cup{width:42px;height:32px;margin:auto;position:relative;border-radius:4px 4px 12px 12px;background:#73452c;box-shadow:inset 0 0 0 2px #b68656}.mini-cup i{position:absolute;left:-4px;right:-4px;top:-4px;height:7px;border-radius:50%;background:#b68656}.centre{position:absolute;left:50%;top:43%;transform:translate(-50%,-50%);text-align:center}.centre>small,.your-dice>small{font:9px ui-monospace;text-transform:uppercase;letter-spacing:.14em;color:#bfd1dc}.big-bid{display:flex;align-items:center;justify-content:center;gap:12px;margin-top:7px}.big-bid strong{font:500 72px/1 ui-monospace}.big-bid span{opacity:.45}.big-bid b{font:54px Georgia}.big-bid.empty{font:700 40px/1 Georgia;margin:15px}.centre p{font-size:11px;color:#c6d5dd}.your-dice{position:absolute;left:20px;right:20px;bottom:34px;text-align:center}.your-dice div{display:flex;justify-content:center;gap:7px;margin-top:8px}.your-dice span,.entered span{display:grid;place-items:center;width:58px;height:58px;border-radius:9px;background:#f6eede;color:#191914;font:40px Georgia;box-shadow:0 5px 0 #152e3d}.reveal{position:absolute;left:50%;bottom:42px;transform:translateX(-50%);height:52px;min-width:230px;border:0;background:#f5eddf;color:#191914;font-weight:800}.layout aside{padding:30px 24px;background:#eee5d5;border-left:1px solid #bbb2a3}.layout aside h2{font-size:17px}.bid-control{margin:18px 0}.bid-control .control-label{display:block;margin-bottom:7px;color:#716a60;font-size:10px}.bid-control>div{display:grid;grid-template-columns:48px 1fr 48px;border:1px solid #bdb3a4}.bid-control button{height:50px;border:0;background:#e3d8c5;font-size:19px}.bid-control strong{display:grid;place-items:center;font:22px ui-monospace}.bid-control .die-face{font:33px Georgia}.bid,.challenge{width:100%;height:54px;border:0;font-weight:800;margin-top:8px}.bid{background:#191914;color:white}.challenge{background:#a92b34;color:white}.bid:disabled,.challenge:disabled{opacity:.3}.history{margin-top:24px;border-top:1px solid #cbc0b0}.history p{margin:0;padding:10px 0;border-bottom:1px solid #d4cabb;color:#746d62;font-size:10px;line-height:1.4}
  .handoff,.result,.finish{min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:28px;background:#eee5d5}.cup-icon{display:grid;place-items:center;width:64px;height:52px;border-radius:6px 6px 18px 18px;background:#73452c;color:#1d1712;box-shadow:inset 0 0 0 3px #b68656}.handoff>small,.result>small,.finish>small{margin-top:20px;color:#244b64;font:800 9px ui-monospace;text-transform:uppercase;letter-spacing:.15em}.handoff h1,.finish h1{margin:10px 0;font-size:clamp(48px,8vw,86px);letter-spacing:-.065em}.handoff p,.result p,.finish p{color:#756e62}.entered{display:flex;gap:8px;margin:25px 0}.keypad{display:grid;grid-template-columns:repeat(6,56px);gap:6px}.keypad button{height:56px;border:0;background:#ded3c0;font:35px Georgia}.undo{margin:12px;border:0;background:none;font-weight:700}.continue,.result>button{min-width:240px;height:54px;border:0;background:#191914;color:white;font-weight:800}.continue:disabled{opacity:.3}.result>h1{margin:10px 0 0;color:#244b64;font:500 clamp(80px,15vw,130px)/.9 ui-monospace}.reveal-all{display:grid;grid-template-columns:repeat(2,minmax(230px,1fr));gap:8px;width:min(700px,100%);margin:25px 0}.reveal-all article{padding:13px;background:#e2d7c4;text-align:left}.reveal-all article>b{font-size:11px}.reveal-all article div{display:flex;gap:4px;margin-top:7px}.reveal-all span{font:28px Georgia;opacity:.35}.reveal-all span.match{opacity:1;color:#a92b34}.result h2{font-size:22px}.finish>span{width:58px;height:58px}.finish>div{display:flex;gap:8px;margin-top:24px}.finish>div button{min-width:150px;height:54px;border:1px solid #191914;background:none;font-weight:800}.finish>div button:first-child{background:#191914;color:white}
  @media(max-width:760px){.ld-setup{width:calc(100% - 28px);padding-top:20px}.ld-setup>h1{margin:34px 0 25px;font-size:54px}.setup-grid{grid-template-columns:1fr}.panel{padding:22px 0}.panel+.panel{padding:22px 0;border-left:0;border-top:1px solid #cfc5b3}.names{grid-template-columns:1fr}.start{width:100%;float:none}.top{height:64px;padding:0 12px}.top b{display:none}.layout{display:block}.table{min-height:590px;margin:7px;border-width:9px;border-radius:38%}.seats{inset:15px;grid-template-columns:repeat(3,1fr);gap:390px 4px}.seats article b{font-size:10px}.centre{top:41%}.big-bid strong{font-size:58px}.your-dice{bottom:28px}.your-dice span{width:48px;height:48px;font-size:33px}.layout aside{border-left:0;border-top:1px solid #bbb2a3}.keypad{grid-template-columns:repeat(3,58px)}.reveal-all{grid-template-columns:1fr}.finish{width:100%}.finish>div{width:100%;flex-direction:column}.finish>div button{width:100%}}
  @media(prefers-reduced-motion:reduce){*{transition:none!important}}
  .table{width:min(920px,calc(100% - 48px));justify-self:center;margin-inline:0;transition:width .35s,min-height .35s,border-radius .35s}
  .table:has(.seats>article:first-child:nth-last-child(2)){width:min(600px,calc(100% - 48px));min-height:500px;border-radius:42%}
  .table:has(.seats>article:first-child:nth-last-child(3)){width:min(690px,calc(100% - 48px));min-height:550px;border-radius:43%}
  .table:has(.seats>article:first-child:nth-last-child(4)){width:min(780px,calc(100% - 48px));min-height:600px}
  .table:has(.seats>article:first-child:nth-last-child(5)){width:min(850px,calc(100% - 48px));min-height:640px}
  .table:has(.seats>article:first-child:nth-last-child(2)) .seats{gap:280px 0}
  .table:has(.seats>article:first-child:nth-last-child(2)) .seats article:nth-child(1){grid-column:2;grid-row:2}
  .table:has(.seats>article:first-child:nth-last-child(2)) .seats article:nth-child(2){grid-column:2;grid-row:1}
  .table:has(.seats>article:first-child:nth-last-child(3)) .seats{gap:315px 0}
  .table:has(.seats>article:first-child:nth-last-child(3)) .seats article:nth-child(1){grid-column:1;grid-row:2}
  .table:has(.seats>article:first-child:nth-last-child(3)) .seats article:nth-child(2){grid-column:3;grid-row:2}
  .table:has(.seats>article:first-child:nth-last-child(3)) .seats article:nth-child(3){grid-column:2;grid-row:1}
  .table:has(.seats>article:first-child:nth-last-child(4)) .seats{gap:350px 0}
  .table:has(.seats>article:first-child:nth-last-child(4)) .seats article:nth-child(1){grid-column:1;grid-row:2}
  .table:has(.seats>article:first-child:nth-last-child(4)) .seats article:nth-child(2){grid-column:3;grid-row:2}
  .table:has(.seats>article:first-child:nth-last-child(4)) .seats article:nth-child(3){grid-column:3;grid-row:1}
  .table:has(.seats>article:first-child:nth-last-child(4)) .seats article:nth-child(4){grid-column:1;grid-row:1}
  .table:has(.seats>article:first-child:nth-last-child(5)) .seats article:nth-child(1){grid-column:1;grid-row:1}
  .table:has(.seats>article:first-child:nth-last-child(5)) .seats article:nth-child(2){grid-column:3;grid-row:1}
  .table:has(.seats>article:first-child:nth-last-child(5)) .seats article:nth-child(3){grid-column:1;grid-row:2}
  .table:has(.seats>article:first-child:nth-last-child(5)) .seats article:nth-child(4){grid-column:2;grid-row:2}
  .table:has(.seats>article:first-child:nth-last-child(5)) .seats article:nth-child(5){grid-column:3;grid-row:2}
  @media(max-width:760px){
    .table{width:calc(100% - 14px);margin-inline:7px}
    .table:has(.seats>article:first-child:nth-last-child(2)){width:min(480px,calc(100% - 14px));min-height:450px}
    .table:has(.seats>article:first-child:nth-last-child(3)){width:min(560px,calc(100% - 14px));min-height:500px}
    .table:has(.seats>article:first-child:nth-last-child(4)){width:min(640px,calc(100% - 14px));min-height:540px}
    .table:has(.seats>article:first-child:nth-last-child(5)){width:calc(100% - 14px);min-height:575px}
    .table:has(.seats>article:first-child:nth-last-child(2)) .seats{gap:250px 0}
    .table:has(.seats>article:first-child:nth-last-child(3)) .seats{gap:285px 0}
    .table:has(.seats>article:first-child:nth-last-child(4)) .seats{gap:320px 0}
  }
  @media(prefers-reduced-motion:reduce){.table{transition:none}}
</style>
