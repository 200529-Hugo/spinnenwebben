<script lang="ts">
  import { onMount } from 'svelte';
  import Rules from '$lib/Rules.svelte';

  export let onHome: () => void;

  type View = 'setup' | 'play' | 'finish';
  type DiceMode = 'digital' | 'own';
  type CategoryKey = 'ones' | 'twos' | 'threes' | 'fours' | 'fives' | 'sixes' | 'threeKind' | 'fourKind' | 'fullHouse' | 'smallStraight' | 'largeStraight' | 'yahtzee' | 'chance';
  type Scores = Partial<Record<CategoryKey, number>>;
  type Player = { id: string; name: string; scores: Scores };
  type Save = { view: View; names: string[]; diceMode: DiceMode; players: Player[]; activePlayer: number; dice: number[]; held: boolean[]; rollCount: number };

  const categories: { key: CategoryKey; label: string }[] = [
    { key: 'ones', label: 'Ones' }, { key: 'twos', label: 'Twos' }, { key: 'threes', label: 'Threes' },
    { key: 'fours', label: 'Fours' }, { key: 'fives', label: 'Fives' }, { key: 'sixes', label: 'Sixes' },
    { key: 'threeKind', label: 'Three of a kind' }, { key: 'fourKind', label: 'Four of a kind' },
    { key: 'fullHouse', label: 'Full house' }, { key: 'smallStraight', label: 'Small straight' },
    { key: 'largeStraight', label: 'Large straight' }, { key: 'yahtzee', label: 'Yahtzee' }, { key: 'chance', label: 'Chance' }
  ];
  const faces = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
  const saveKey = 'yahtzee-match-v1';

  let view: View = 'setup';
  let names = ['Player 1', 'Player 2'];
  let diceMode: DiceMode = 'digital';
  let players: Player[] = [];
  let activePlayer = 0;
  let dice: number[] = [];
  let held = [false, false, false, false, false];
  let rollCount = 0;
  let rolling = false;
  let manualDice = [0, 0, 0, 0, 0];
  let manualIndex = 0;
  let mounted = false;

  $: current = players[activePlayer];
  $: round = players.length ? Math.min(13, Math.floor(players.reduce((sum, player) => sum + Object.keys(player.scores).length, 0) / players.length) + 1) : 1;
  $: sortedPlayers = [...players].sort((a, b) => totalScore(b) - totalScore(a));
  $: winningScore = sortedPlayers[0] ? totalScore(sortedPlayers[0]) : 0;
  $: if (mounted) {
    view; names; diceMode; players; activePlayer; dice; held; rollCount;
    persist();
  }

  onMount(() => {
    try {
      const raw = localStorage.getItem(saveKey);
      if (raw) {
        const saved = JSON.parse(raw) as Save;
        if (saved.view === 'play' && saved.players?.length) {
          ({ view, names, diceMode, players, activePlayer, dice, held, rollCount } = saved);
        }
      }
    } catch { /* start fresh */ }
    mounted = true;
  });

  function persist() {
    if (view !== 'play') return;
    localStorage.setItem(saveKey, JSON.stringify({ view, names, diceMode, players, activePlayer, dice, held, rollCount } satisfies Save));
  }

  function addPlayer() {
    if (names.length < 4) names = [...names, `Player ${names.length + 1}`];
  }

  function removePlayer(index: number) {
    if (names.length > 1) names = names.filter((_, playerIndex) => playerIndex !== index);
  }

  function updateName(index: number, value: string) {
    names[index] = value;
    names = [...names];
  }

  function startGame() {
    players = names.map((name, index) => ({ id: `${Date.now()}-${index}`, name: name.trim() || `Player ${index + 1}`, scores: {} }));
    activePlayer = 0;
    resetTurn();
    view = 'play';
    window.scrollTo({ top: 0 });
  }

  function resetTurn() {
    dice = [];
    held = [false, false, false, false, false];
    rollCount = 0;
    rolling = false;
    manualDice = [0, 0, 0, 0, 0];
    manualIndex = 0;
  }

  const pause = (milliseconds: number) => new Promise((resolve) => window.setTimeout(resolve, milliseconds));

  async function rollDice() {
    if (rolling || rollCount >= 3) return;
    rolling = true;
    const finalDice = Array.from({ length: 5 }, (_, index) => held[index] && dice[index] ? dice[index] : Math.floor(Math.random() * 6) + 1);
    for (let frame = 0; frame < 8; frame += 1) {
      dice = Array.from({ length: 5 }, (_, index) => held[index] && dice[index] ? dice[index] : Math.floor(Math.random() * 6) + 1);
      await pause(65 + frame * 16);
    }
    dice = finalDice;
    await pause(100);
    rolling = false;
    rollCount += 1;
  }

  function toggleHold(index: number) {
    if (diceMode !== 'digital' || rolling || !dice.length || rollCount >= 3) return;
    held[index] = !held[index];
    held = [...held];
  }

  function setManual(value: number) {
    manualDice[manualIndex] = value;
    manualDice = [...manualDice];
    if (manualIndex < 4) manualIndex += 1;
  }

  function useOwnDice() {
    if (manualDice.some((die) => !die) || rollCount >= 3) return;
    dice = [...manualDice];
    manualDice = [0, 0, 0, 0, 0];
    manualIndex = 0;
    rollCount += 1;
  }

  function scoreDice(category: CategoryKey, values = dice) {
    if (values.length !== 5) return 0;
    const counts = Array.from({ length: 7 }, (_, value) => values.filter((die) => die === value).length);
    const sum = values.reduce((total, die) => total + die, 0);
    const unique = [...new Set(values)].sort((a, b) => a - b).join('');
    if (category === 'ones') return counts[1];
    if (category === 'twos') return counts[2] * 2;
    if (category === 'threes') return counts[3] * 3;
    if (category === 'fours') return counts[4] * 4;
    if (category === 'fives') return counts[5] * 5;
    if (category === 'sixes') return counts[6] * 6;
    if (category === 'threeKind') return counts.some((count) => count >= 3) ? sum : 0;
    if (category === 'fourKind') return counts.some((count) => count >= 4) ? sum : 0;
    if (category === 'fullHouse') return counts.includes(3) && counts.includes(2) ? 25 : 0;
    if (category === 'smallStraight') return ['1234', '2345', '3456'].some((run) => [...run].every((value) => unique.includes(value))) ? 30 : 0;
    if (category === 'largeStraight') return unique === '12345' || unique === '23456' ? 40 : 0;
    if (category === 'yahtzee') return counts.includes(5) ? 50 : 0;
    return sum;
  }

  function upperSubtotal(player: Player) {
    return (['ones', 'twos', 'threes', 'fours', 'fives', 'sixes'] as CategoryKey[]).reduce((sum, key) => sum + (player.scores[key] ?? 0), 0);
  }

  function totalScore(player: Player) {
    const base = categories.reduce((sum, category) => sum + (player.scores[category.key] ?? 0), 0);
    return base + (upperSubtotal(player) >= 63 ? 35 : 0);
  }

  function chooseCategory(key: CategoryKey) {
    if (!current || !dice.length || current.scores[key] !== undefined || rolling) return;
    current.scores = { ...current.scores, [key]: scoreDice(key) };
    players = [...players];
    if (players.every((player) => Object.keys(player.scores).length === categories.length)) {
      view = 'finish';
      localStorage.removeItem(saveKey);
      window.scrollTo({ top: 0 });
      return;
    }
    activePlayer = (activePlayer + 1) % players.length;
    resetTurn();
  }

  function home() {
    localStorage.removeItem(saveKey);
    onHome();
  }

  function abandon() {
    if (confirm('End this game and return home?')) home();
  }
</script>

{#if view === 'setup'}
  <section class="y-setup">
    <button class="back" on:click={onHome}>‹ All games</button><Rules game="Yahtzee" sections={[{title:'Goal',text:'Score every category once and build the highest total.'},{title:'Roll',text:'Roll five dice up to three times, holding any dice between rolls.'},{title:'Score',text:'Choose one unused category; an invalid combination scores zero.'},{title:'Bonus',text:'Reach 63 upper-section points for a 35-point bonus.'},{title:'Winner',text:'After thirteen categories, the highest total wins.'}]}/>
    <h1>Yahtzee</h1>
    <div class="setup-grid">
      <div class="setup-panel">
        <header><h2>Players</h2><span>{names.length}</span></header>
        <div class="names">
          {#each names as name, index}
            <label><small>{String(index + 1).padStart(2, '0')}</small><input aria-label={`Player ${index + 1} name`} value={name} on:input={(event) => updateName(index, event.currentTarget.value)} /><button on:click={() => removePlayer(index)} disabled={names.length === 1} aria-label={`Remove ${name}`}>×</button></label>
          {/each}
        </div>
        <button class="add" on:click={addPlayer} disabled={names.length >= 4}>＋ Add player</button>
      </div>
      <div class="setup-panel">
        <header><h2>Dice</h2><span>5</span></header>
        <div class="mode">
          <button class:chosen={diceMode === 'digital'} on:click={() => diceMode = 'digital'}>Digital dice</button>
          <button class:chosen={diceMode === 'own'} on:click={() => diceMode = 'own'}>Own dice</button>
        </div>
      </div>
    </div>
    <button class="primary start" on:click={startGame}>Start game <span>›</span></button>
  </section>
{:else if view === 'play'}
  <section class="y-game">
    <header class="topbar"><button class="brand" on:click={abandon}><span>Y</span><b>Yahtzee</b></button><div aria-live="polite"><small>Round {round}/13 · Roll {rollCount}/3</small><strong>{current?.name}</strong></div><button class="close" on:click={abandon} aria-label="Close game">×</button></header>
    <div class="layout">
      <div class="table">
        <div class="dice-tray">
          {#if diceMode === 'digital'}
            <div class="five-dice" class:rolling>
              {#each Array(5) as _, index}<button class:held={held[index]} disabled={!dice[index] || rolling} on:click={() => toggleHold(index)}><span>{dice[index] ? faces[dice[index] - 1] : '·'}</span><small>{held[index] ? 'Held' : ''}</small></button>{/each}
            </div>
            <button class="roll" disabled={rolling || rollCount >= 3} on:click={rollDice}>{rolling ? 'Rolling…' : rollCount ? `Roll again · ${3 - rollCount} left` : 'Roll dice'}</button>
          {:else}
            <div class="manual-five">{#each manualDice as die, index}<button class:active={manualIndex === index} on:click={() => manualIndex = index}>{die ? faces[die - 1] : dice[index] ? faces[dice[index] - 1] : '—'}</button>{/each}</div>
            <div class="keypad">{#each [1,2,3,4,5,6] as value}<button on:click={() => setManual(value)}>{value}</button>{/each}</div>
            <button class="roll" disabled={manualDice.some((die) => !die) || rollCount >= 3} on:click={useOwnDice}>Use roll · {3 - rollCount} left</button>
          {/if}
          {#if dice.length && !rolling}<p>Choose a score, or {rollCount < 3 ? 'roll again' : 'score this roll'}.</p>{/if}
        </div>
      </div>
      <aside class="score-sheet" style={`--player-count:${players.length}`}>
        <header><strong>Scorecard</strong>{#each players as player}<span class:active={player.id === current?.id}>{player.name}<b>{totalScore(player)}</b></span>{/each}</header>
        <div class="score-rows">
          {#each categories as category}
            <div class="score-row"><span>{category.label}</span>{#each players as player}<button class:available={player.id === current?.id && player.scores[category.key] === undefined && dice.length === 5} disabled={player.id !== current?.id || player.scores[category.key] !== undefined || dice.length !== 5 || rolling} on:click={() => chooseCategory(category.key)}>{player.scores[category.key] ?? (player.id === current?.id && dice.length === 5 ? scoreDice(category.key) : '—')}</button>{/each}</div>
          {/each}
          <div class="score-row bonus"><span>Upper bonus</span>{#each players as player}<b>{upperSubtotal(player) >= 63 ? 35 : 0}</b>{/each}</div>
        </div>
      </aside>
    </div>
  </section>
{:else}
  <section class="y-finish">
    <span class="finish-mark">Y</span><h1>Final scores</h1>
    <div class="final-list">{#each sortedPlayers as player, index}<div class:winner={totalScore(player) === winningScore}><span>{String(index + 1).padStart(2,'0')}</span><strong>{player.name}{totalScore(player) === winningScore ? ' — Winner' : ''}</strong><b>{totalScore(player)}</b></div>{/each}</div>
    <div class="finish-actions"><button class="primary" on:click={startGame}>Replay ›</button><button on:click={home}>Home</button></div>
  </section>
{/if}

<style>
  :global(*){box-sizing:border-box}.y-setup,.y-finish{width:min(1120px,calc(100% - 48px));min-height:100vh;margin:auto;padding:34px 0}.back{border:0;background:none;padding:12px 0;cursor:pointer;font:11px ui-monospace}.y-setup>h1,.y-finish h1{font-size:clamp(58px,9vw,100px);letter-spacing:-.075em;margin:58px 0 38px}.setup-grid{display:grid;grid-template-columns:1.2fr .8fr;border-block:1px solid #cfc5b3}.setup-panel{padding:28px 34px 30px 0}.setup-panel+.setup-panel{padding-left:34px;border-left:1px solid #cfc5b3}.setup-panel header{display:flex;justify-content:space-between;align-items:center;margin-bottom:18px}.setup-panel h2{font-size:18px;margin:0}.setup-panel header>span{display:grid;place-items:center;width:28px;height:28px;border-radius:50%;background:#1a1b17;color:#fff;font:10px ui-monospace}.names{display:grid;grid-template-columns:1fr 1fr;gap:8px}.names label{display:flex;align-items:center;background:#ece3d3;border-bottom:1px solid #cfc5b3}.names small{padding:0 10px;color:#90887c;font:9px ui-monospace}.names input{min-width:0;width:100%;padding:15px 0;border:0;background:none;outline:0;font-weight:700}.names label button{border:0;background:none;padding:12px;cursor:pointer}.add{border:0;background:none;color:#376f5a;min-height:48px;font-weight:800;cursor:pointer}.mode{display:grid;grid-template-columns:1fr 1fr;border:1px solid #cfc5b3}.mode button{height:58px;border:0;background:#e7decd;font-weight:800;cursor:pointer}.mode button+button{border-left:1px solid #cfc5b3}.mode button.chosen{background:#225a45;color:#fff}.primary,.finish-actions button{height:58px;padding:0 24px;border:1px solid #1a1b17;font-weight:800;cursor:pointer}.primary{background:#1a1b17;color:#fff}.start{float:right;min-width:240px;margin-top:28px;display:flex;align-items:center;justify-content:space-between}
  .y-game{min-height:100vh;background:#e7dfd0}.topbar{height:72px;padding:0 26px;display:grid;grid-template-columns:1fr auto 1fr;align-items:center;border-bottom:1px solid #c7bdad}.topbar .brand{justify-self:start;display:flex;align-items:center;gap:10px;border:0;background:none;cursor:pointer}.brand>span,.finish-mark{display:grid;place-items:center;width:36px;height:36px;border-radius:50%;background:#225a45;color:#fff;font-weight:900}.topbar>div{text-align:center}.topbar small{display:block;color:#81796e;font:9px ui-monospace;text-transform:uppercase;letter-spacing:.1em}.topbar strong{font-size:14px}.close{justify-self:end;width:38px;height:38px;border:1px solid #b8afa0;border-radius:50%;background:none;font-size:18px;cursor:pointer}.layout{display:grid;grid-template-columns:minmax(0,1fr) minmax(430px,36vw);min-height:calc(100vh - 72px)}.table{display:grid;place-items:center;padding:32px}.dice-tray{width:min(760px,100%);min-height:430px;padding:48px;display:flex;flex-direction:column;justify-content:center;align-items:center;border:9px solid #8d5936;border-radius:10px;background:#225a45;box-shadow:inset 0 0 35px rgba(0,0,0,.3),0 14px 28px rgba(39,29,20,.15)}.five-dice{display:grid;grid-template-columns:repeat(5,1fr);gap:14px;width:100%}.five-dice button{aspect-ratio:1;border:3px solid #d8c8ae;border-radius:12px;background:#f6ead7;box-shadow:0 9px 0 #8d6c48;color:#1a1b17;cursor:pointer}.five-dice span{display:block;font:clamp(46px,6vw,78px)/1 Georgia,serif}.five-dice small{display:block;min-height:12px;color:#b34331;font:8px ui-monospace;text-transform:uppercase}.five-dice button.held{transform:translateY(-12px);border-color:#df513a;box-shadow:0 16px 0 #6f4930}.five-dice.rolling button:not(.held){animation:tumble .55s infinite}.roll{min-width:230px;height:54px;margin-top:46px;border:0;background:#f4e7d2;color:#1a1b17;font-weight:900;cursor:pointer;box-shadow:0 6px 0 #8d5936}.roll:disabled{opacity:.4}.dice-tray>p{margin:24px 0 0;color:#d5e4da;font:10px ui-monospace}.manual-five{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;width:min(520px,100%)}.manual-five button{aspect-ratio:1;border:2px solid rgba(255,255,255,.3);border-radius:8px;background:rgba(0,0,0,.15);color:#fff;font:clamp(34px,5vw,60px) Georgia;cursor:pointer}.manual-five button.active{background:#f4e7d2;color:#1a1b17;border-color:#f4e7d2}.keypad{display:grid;grid-template-columns:repeat(6,1fr);gap:5px;width:min(420px,90%);margin-top:24px}.keypad button{aspect-ratio:1;border:1px solid rgba(255,255,255,.35);background:rgba(0,0,0,.18);color:#fff;font:16px ui-monospace;cursor:pointer}
  .score-sheet{min-width:0;background:#f2ead9;border-left:1px solid #c7bdad;padding:24px;overflow:auto}.score-sheet>header{display:grid;grid-template-columns:130px repeat(var(--player-count),minmax(62px,1fr));align-items:stretch;margin-bottom:8px}.score-sheet>header>strong{align-self:end;padding:10px 6px}.score-sheet>header>span{display:block;padding:8px 4px;text-align:center;font-size:9px;overflow:hidden}.score-sheet>header span.active{background:#225a45;color:#fff}.score-sheet>header span b{display:block;margin-top:5px;font:16px ui-monospace}.score-row{display:grid;grid-template-columns:130px repeat(var(--player-count),minmax(62px,1fr));min-height:42px;border-top:1px solid #d4cab9;transition:background .16s}.score-row>span{display:flex;align-items:center;padding:7px 6px;font-size:10px;transition:color .16s,transform .16s}.score-row button,.score-row>b{display:grid;place-items:center;border:0;border-left:1px solid #d4cab9;background:transparent;font:13px ui-monospace}.score-row button.available{position:relative;z-index:1;background:#e1eee6;color:#225a45;font-weight:900;cursor:pointer;transition:transform .16s,background .16s,color .16s,box-shadow .16s}.score-row button.available:hover,.score-row button.available:focus-visible{z-index:3;background:#225a45;color:#fff;transform:translateY(-3px) scale(1.08);box-shadow:0 7px 16px rgba(34,90,69,.28);outline:2px solid #f2ead9;outline-offset:-3px}.score-row:has(button.available:hover),.score-row:has(button.available:focus-visible){background:#e8f0eb}.score-row:has(button.available:hover)>span,.score-row:has(button.available:focus-visible)>span{color:#225a45;transform:translateX(4px);font-weight:800}.score-row button.available:active{transform:translateY(1px) scale(1.02);box-shadow:0 2px 6px rgba(34,90,69,.2)}.score-row button:disabled:not(.available){color:#756e64}.score-row.bonus{border-bottom:1px solid #d4cab9}.score-row.bonus b{font-size:11px}.y-finish{display:flex;flex-direction:column;align-items:center;justify-content:center}.y-finish h1{margin:24px 0 30px}.final-list{width:min(680px,100%)}.final-list>div{display:grid;grid-template-columns:48px 1fr auto;align-items:center;padding:18px;border-block:1px solid #cfc5b3;margin-top:-1px}.final-list>div.winner{background:#225a45;color:#fff}.final-list span{font:9px ui-monospace}.final-list b{font:24px ui-monospace}.finish-actions{display:flex;gap:8px;margin-top:30px}.finish-actions button{min-width:150px;background:transparent}.finish-actions .primary{background:#1a1b17}
  @keyframes tumble{50%{transform:translateY(-13px) rotate(9deg)}}
  @media(max-width:900px){.layout{grid-template-columns:1fr}.table{padding:12px 8px}.dice-tray{min-height:340px;padding:30px 18px;border-width:6px}.score-sheet{border-left:0;border-top:1px solid #c7bdad}.five-dice{gap:7px}.five-dice span{font-size:clamp(36px,12vw,58px)}}
  @media(max-width:620px){.y-setup,.y-finish{width:calc(100% - 28px);padding-top:max(18px,env(safe-area-inset-top))}.y-setup>h1{font-size:58px;margin:32px 0 24px}.setup-grid{grid-template-columns:1fr}.setup-panel{padding:22px 0}.setup-panel+.setup-panel{padding-left:0;border-left:0;border-top:1px solid #cfc5b3}.names{grid-template-columns:1fr}.start{float:none;width:100%;margin-bottom:20px}.topbar{height:calc(62px + env(safe-area-inset-top));padding:env(safe-area-inset-top) 12px 0}.brand b{display:none}.dice-tray{min-height:290px}.five-dice button{border-width:2px;border-radius:7px;box-shadow:0 5px 0 #8d6c48}.five-dice small{display:none}.roll{margin-top:30px;width:100%}.score-sheet{padding:14px 8px}.score-sheet>header,.score-row{grid-template-columns:104px repeat(var(--player-count),minmax(54px,1fr));min-width:320px}.score-sheet>header>span{font-size:8px}.score-row>span{font-size:9px}.manual-five{gap:4px}.keypad{width:100%}.y-finish h1{font-size:50px}.finish-actions{width:100%;flex-direction:column}.finish-actions button{width:100%}}
</style>
