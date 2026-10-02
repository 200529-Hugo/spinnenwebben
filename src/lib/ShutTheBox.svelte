<script lang="ts">
  import { onMount } from 'svelte';
  import Rules from '$lib/Rules.svelte';

  export let onHome: () => void;

  type View = 'setup' | 'play' | 'finish';
  type DiceMode = 'digital' | 'own';
  type BoxPlayer = { id: string; name: string; score: number | null };
  type RollEntry = { id: string; player: string; dice: number[]; total: number; closed: number[]; note: string };
  type Save = {
    view: View;
    names: string[];
    tileCount: 9 | 12;
    doublesBonus: boolean;
    diceMode: DiceMode;
    players: BoxPlayer[];
    playerBoxes: number[][];
    activePlayer: number;
    openTiles: number[];
    dice: number[];
    selected: number[];
    message: string;
    bonusTurnEarned: boolean;
    rollLog: RollEntry[];
  };

  let view: View = 'setup';
  let names = ['Player 1', 'Player 2'];
  let tileCount: 9 | 12 = 9;
  let doublesBonus = false;
  let diceMode: DiceMode = 'digital';
  let players: BoxPlayer[] = [];
  let playerBoxes: number[][] = [];
  let activePlayer = 0;
  let openTiles: number[] = [];
  let dice: number[] = [];
  let selected: number[] = [];
  let message = '';
  let bonusTurnEarned = false;
  let rolling = false;
  let rollLog: RollEntry[] = [];
  let manualDice: number[] = [];
  let mounted = false;

  const saveKey = 'shut-the-box-match-v3';
  const dieFaces = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];

  $: current = players[activePlayer];
  $: rollTotal = dice.reduce((total, die) => total + die, 0);
  $: selectedTotal = selected.reduce((total, tile) => total + tile, 0);
  $: combinations = dice.length && !rolling ? findCombinations(openTiles, rollTotal) : [];
  $: possibleTiles = new Set(combinations.flat());
  $: canClose = !rolling && dice.length > 0 && selected.length > 0 && selectedTotal === rollTotal;
  $: noMoves = !rolling && dice.length > 0 && combinations.length === 0;
  $: oneDie = openTiles.length > 0 && Math.max(...openTiles) <= 6;
  $: sortedPlayers = [...players].sort((a, b) => (a.score ?? Infinity) - (b.score ?? Infinity));
  $: winningScore = sortedPlayers[0]?.score;
  $: recentRolls = [...rollLog].reverse();
  $: if (mounted) {
    view; names; tileCount; doublesBonus; diceMode; players; playerBoxes; activePlayer; openTiles; dice; selected; message; bonusTurnEarned; rollLog;
    persist();
  }

  onMount(() => {
    try {
      const raw = localStorage.getItem(saveKey);
      if (raw) {
        const saved = JSON.parse(raw) as Save;
        if (saved.view === 'play' && saved.players?.length) {
          ({ view, names, tileCount, players, activePlayer, openTiles, dice, selected, message } = saved);
          doublesBonus = saved.doublesBonus ?? false;
          diceMode = saved.diceMode ?? 'digital';
          playerBoxes = saved.playerBoxes ?? saved.players.map((_, index) => index === saved.activePlayer ? saved.openTiles : freshTiles());
          bonusTurnEarned = saved.bonusTurnEarned ?? false;
          rollLog = saved.rollLog ?? [];
        }
      }
    } catch { /* start clean */ }
    mounted = true;
  });

  function persist() {
    if (view !== 'play') return;
    const save: Save = { view, names, tileCount, doublesBonus, diceMode, players, playerBoxes, activePlayer, openTiles, dice, selected, message, bonusTurnEarned, rollLog };
    localStorage.setItem(saveKey, JSON.stringify(save));
  }

  function updateName(index: number, value: string) {
    names[index] = value;
    names = [...names];
  }

  function addPlayer() {
    if (names.length < 4) names = [...names, `Player ${names.length + 1}`];
  }

  function removePlayer(index: number) {
    if (names.length <= 1) return;
    names = names.filter((_, i) => i !== index);
  }

  function freshTiles() {
    return Array.from({ length: tileCount }, (_, index) => index + 1);
  }

  function boardSide(index: number, total: number) {
    if (total === 1) return 'bottom';
    if (total === 2) return index === 0 ? 'bottom' : 'top';
    return ['bottom', 'left', 'top', 'right'][index];
  }

  function startGame() {
    players = names.map((name, index) => ({
      id: `${Date.now()}-${index}`,
      name: name.trim() || `Player ${index + 1}`,
      score: null
    }));
    activePlayer = 0;
    playerBoxes = players.map(() => freshTiles());
    openTiles = [...playerBoxes[0]];
    dice = [];
    selected = [];
    message = '';
    bonusTurnEarned = false;
    rollLog = [];
    manualDice = [];
    view = 'play';
    window.scrollTo({ top: 0 });
  }

  const pause = (milliseconds: number) => new Promise((resolve) => window.setTimeout(resolve, milliseconds));

  async function rollDice() {
    if (dice.length || noMoves || rolling) return;
    const count = oneDie ? 1 : 2;
    const rolled = Array.from({ length: count }, () => Math.floor(Math.random() * 6) + 1);
    rolling = true;
    selected = [];
    message = '';

    for (let frame = 0; frame < 11; frame += 1) {
      dice = Array.from({ length: count }, () => Math.floor(Math.random() * 6) + 1);
      await pause(70 + frame * 18);
    }

    dice = rolled;
    await pause(120);
    resolveRoll(rolled);
  }

  function resolveRoll(rolled: number[]) {
    dice = [...rolled];
    rolling = false;
    if (doublesBonus && rolled.length === 2 && rolled[0] === rolled[1]) bonusTurnEarned = true;

    rollLog = [...rollLog, {
      id: `${Date.now()}-${rollLog.length}`,
      player: current.name,
      dice: [...rolled],
      total: rolled.reduce((total, die) => total + die, 0),
      closed: [],
      note: bonusTurnEarned ? 'Doubles' : ''
    }];

    if (!findCombinations(openTiles, rolled.reduce((total, die) => total + die, 0)).length) {
      message = 'No moves · next player';
      window.setTimeout(() => {
        if (dice === rolled) endTurn();
      }, 900);
    }
  }

  function setManualDie(index: number, value: number) {
    manualDice[index] = value;
    manualDice = [...manualDice];
  }

  function useOwnDice() {
    const count = oneDie ? 1 : 2;
    const entered = manualDice.slice(0, count);
    if (entered.length !== count || entered.some((die) => !die)) return;
    manualDice = [];
    resolveRoll(entered);
  }

  function toggleTile(tile: number) {
    if (rolling || !dice.length || noMoves || !possibleTiles.has(tile)) return;
    if (selected.includes(tile)) {
      selected = selected.filter((value) => value !== tile);
      return;
    }
    if (selectedTotal + tile <= rollTotal) selected = [...selected, tile];
  }

  function closeSelected() {
    if (!canClose) return;
    const closedTiles = [...selected];
    openTiles = openTiles.filter((tile) => !selected.includes(tile));
    playerBoxes[activePlayer] = [...openTiles];
    playerBoxes = [...playerBoxes];
    dice = [];
    selected = [];
    manualDice = [];
    if (!openTiles.length) {
      updateLatestRoll(closedTiles, 'Box shut');
      endTurn(0, true);
      return;
    }

    if (bonusTurnEarned) {
      updateLatestRoll(closedTiles, 'Doubles · rolls again');
      bonusTurnEarned = false;
      message = 'Doubles · roll again';
      return;
    }

    updateLatestRoll(closedTiles, 'Next player');
    advancePlayer();
  }

  function endTurn(forcedScore?: number, shut = false) {
    const score = forcedScore ?? openTiles.reduce((total, tile) => total + tile, 0);
    updateLatestRoll(undefined, shut ? 'Box shut · 0 pts' : `No move · ${score} pts`);
    players[activePlayer].score = score;
    players = [...players];

    playerBoxes[activePlayer] = [...openTiles];
    playerBoxes = [...playerBoxes];
    bonusTurnEarned = false;

    if (players.every((player) => player.score !== null)) {
      view = 'finish';
      localStorage.removeItem(saveKey);
      window.scrollTo({ top: 0 });
      return;
    }

    advancePlayer(shut ? 'Box shut' : '');
  }

  function advancePlayer(nextMessage = '') {
    let next = activePlayer;
    do {
      next = (next + 1) % players.length;
    } while (players[next].score !== null && next !== activePlayer);

    activePlayer = next;
    openTiles = [...playerBoxes[activePlayer]];
    dice = [];
    selected = [];
    manualDice = [];
    message = nextMessage;
    bonusTurnEarned = false;
    window.scrollTo({ top: 0 });
  }

  function updateLatestRoll(closed?: number[], note?: string) {
    if (!rollLog.length) return;
    const lastIndex = rollLog.length - 1;
    rollLog = rollLog.map((entry, index) => index === lastIndex ? {
      ...entry,
      closed: closed ?? entry.closed,
      note: note ?? entry.note
    } : entry);
  }

  function findCombinations(values: number[], target: number) {
    const result: number[][] = [];
    function search(start: number, sum: number, chosen: number[]) {
      if (sum === target) {
        result.push(chosen);
        return;
      }
      if (sum > target) return;
      for (let i = start; i < values.length; i++) search(i + 1, sum + values[i], [...chosen, values[i]]);
    }
    search(0, 0, []);
    return result;
  }

  function replay() {
    startGame();
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
  <section class="box-setup shell">
    <button class="back" on:click={onHome}>‹ All games</button><Rules game="Shut the Box" sections={[{title:'Goal',text:'Close tiles and finish with the lowest open-tile total.'},{title:'Roll',text:'Roll and close any open tiles adding exactly to the dice.'},{title:'Continue',text:'After a valid move, roll again; optional doubles grant another turn.'},{title:'One die',text:'When the remaining tiles allow it, you may continue with one die.'},{title:'No move',text:'Your turn ends and the open tiles become your score.'}]}/>
    <h1>Shut the Box</h1>
    <div class="setup-grid">
      <div class="setup-panel">
        <header><h2>Players</h2><span>{names.length}</span></header>
        <div class="names">
          {#each names as name, index}
            <label><small>{String(index + 1).padStart(2, '0')}</small><input aria-label={`Player ${index + 1} name`} value={name} on:input={(event) => updateName(index, event.currentTarget.value)} /><button aria-label={`Remove ${name}`} disabled={names.length === 1} on:click={() => removePlayer(index)}>×</button></label>
          {/each}
        </div>
        <button class="add" on:click={addPlayer} disabled={names.length >= 4}>＋ Add player</button>
      </div>
      <div class="setup-panel box-size">
        <header><h2>Box</h2><span>{tileCount}</span></header>
        <div class="choice">
          <button class:chosen={tileCount === 9} on:click={() => tileCount = 9}>1–9</button>
          <button class:chosen={tileCount === 12} on:click={() => tileCount = 12}>1–12</button>
        </div>
        <div class="choice mode-choice">
          <button class:chosen={diceMode === 'digital'} on:click={() => diceMode = 'digital'}>Digital dice</button>
          <button class:chosen={diceMode === 'own'} on:click={() => diceMode = 'own'}>Own dice</button>
        </div>
        <button class="rule-toggle" class:chosen={doublesBonus} on:click={() => doublesBonus = !doublesBonus}>
          <span>Doubles bonus turn</span><b>{doublesBonus ? 'On' : 'Off'}</b>
        </button>
      </div>
    </div>
    <button class="primary start" on:click={startGame}>Start game <span>›</span></button>
  </section>
{:else if view === 'play'}
  <section class="box-game">
    <header class="topbar">
      <button class="box-brand" on:click={abandon}><span>Ⅱ</span><b>Shut the Box</b></button>
      <div class="turn" aria-live="polite"><small>Turn {activePlayer + 1}/{players.length}</small><strong>{current?.name}</strong></div>
      <button class="close" on:click={abandon} aria-label="Close game">×</button>
    </header>

    <div class="play-layout">
      <div class="table">
        <div class="box-overview" class:solo={players.length === 1} class:duo={players.length === 2} class:trio={players.length === 3}>
          {#each players as player, playerIndex}
            {@const side = boardSide(playerIndex, players.length)}
            <section class="player-board" style:grid-area={side} class:bottom={side === 'bottom'} class:left={side === 'left'} class:top={side === 'top'} class:right={side === 'right'} class:current={playerIndex === activePlayer} class:done={player.score !== null && playerIndex !== activePlayer}>
              <header>
                <strong>{player.name}</strong>
                <span>{playerIndex === activePlayer ? (player.score === null ? 'Playing' : `Best ${player.score}`) : (player.score ?? 'Ready')}</span>
              </header>
              <div class="tile-rack" class:twelve={tileCount === 12}>
                {#each Array.from({ length: tileCount }, (_, index) => index + 1) as tile}
                  <button
                    class:closed={!playerBoxes[playerIndex]?.includes(tile)}
                    class:selected={playerIndex === activePlayer && selected.includes(tile)}
                    class:possible={playerIndex === activePlayer && dice.length > 0 && possibleTiles.has(tile)}
                    disabled={playerIndex !== activePlayer || !openTiles.includes(tile)}
                    aria-label={`${player.name}, tile ${tile}${playerBoxes[playerIndex]?.includes(tile) ? ' open' : ' closed'}`}
                    on:click={() => playerIndex === activePlayer && toggleTile(tile)}
                  ><span>{tile}</span></button>
                {/each}
              </div>
            </section>
          {/each}
          <div class="dice-area">
            {#if rolling}
              <div class="dice rolling" aria-label="Rolling dice" aria-live="polite">{#each dice as die}<span>{dieFaces[die - 1]}</span>{/each}</div>
              <span class="roll-status">Rolling…</span>
            {:else if dice.length}
              <div class="dice settled" aria-label={`Rolled ${rollTotal}`} aria-live="polite">{#each dice as die}<span>{dieFaces[die - 1]}</span>{/each}</div>
              <strong>{rollTotal}</strong>
            {:else if diceMode === 'own'}
              <div class="manual-roll">
                <b>Enter {oneDie ? 'die' : 'dice'}</b>
                {#each Array(oneDie ? 1 : 2) as _, dieIndex}
                  <div class="die-picker" aria-label={`Die ${dieIndex + 1}`}>
                    {#each [1, 2, 3, 4, 5, 6] as value}
                      <button class:selected={manualDice[dieIndex] === value} on:click={() => setManualDie(dieIndex, value)} aria-label={`Die ${dieIndex + 1}: ${value}`}>{value}</button>
                    {/each}
                  </div>
                {/each}
                <button class="use-roll" disabled={manualDice.slice(0, oneDie ? 1 : 2).some((die) => !die) || manualDice.length < (oneDie ? 1 : 2)} on:click={useOwnDice}>Use roll ›</button>
              </div>
            {:else}
              <button class="center-roll" on:click={rollDice} aria-label={`Roll ${oneDie ? 'die' : 'dice'}`}>
                <span>{oneDie ? '⚄' : '⚄ ⚂'}</span><b>Roll</b>
              </button>
            {/if}
          </div>
        </div>
      </div>

      <aside class="controls">
        {#if message}<p class="message">{message}</p>{/if}
        {#if bonusTurnEarned}<p class="bonus">Doubles · bonus turn earned</p>{/if}
        <section class="roll-log" aria-label="Roll history">
          <header><strong>Roll log</strong><span>{rollLog.length}</span></header>
          {#if recentRolls.length}
            <div class="log-list">
              {#each recentRolls as entry}
                <article>
                  <div><strong>{entry.player}</strong><span>{entry.dice.map((die) => dieFaces[die - 1]).join(' ')}</span><b>{entry.total}</b></div>
                  {#if entry.closed.length}<small>Closed {entry.closed.join(' + ')}</small>{/if}
                  {#if entry.note}<em>{entry.note}</em>{/if}
                </article>
              {/each}
            </div>
          {:else}
            <p>No rolls yet</p>
          {/if}
        </section>
        {#if !rolling && dice.length && !noMoves}
          <div class="sum"><span>Selected</span><strong>{selectedTotal}<small> / {rollTotal}</small></strong></div>
        {/if}
        {#if noMoves}
          <div class="blocked"><span>No moves</span><strong>{openTiles.reduce((total, tile) => total + tile, 0)}</strong><small>score</small></div>
          <button class="bust" on:click={() => endTurn()}>Next player ›</button>
        {:else if dice.length && !rolling}
          <button class="primary" disabled={!canClose} on:click={closeSelected}>Close tiles</button>
        {/if}
        <p class="open-count">{openTiles.length} open</p>
      </aside>
    </div>
  </section>
{:else}
  <section class="box-finish shell">
    <div class="finish-mark">Ⅱ</div>
    <h1>Final scores</h1>
    <div class="scoreboard">
      {#each sortedPlayers as player, index}
        <div class:winner={player.score === winningScore}><span>{String(index + 1).padStart(2, '0')}</span><strong>{player.name}{player.score === winningScore ? ' — Winner' : ''}</strong><b>{player.score}</b></div>
      {/each}
    </div>
    <div class="finish-actions"><button class="primary" on:click={replay}>Replay ›</button><button class="secondary" on:click={home}>Home</button></div>
  </section>
{/if}

<style>
  .shell{width:min(1120px,calc(100% - 48px));margin:auto;min-height:100vh;padding:34px 0;background:#f2ead9}.back{border:0;background:none;min-height:42px;padding:0;font:500 12px ui-monospace;cursor:pointer}.shell h1{font-size:clamp(52px,8vw,92px);letter-spacing:-.075em;line-height:.95;margin:58px 0 36px}.setup-grid{display:grid;grid-template-columns:1.25fr .75fr;border-block:1px solid #cfc5b3}.setup-panel{padding:28px 34px 30px 0}.setup-panel+.setup-panel{border-left:1px solid #cfc5b3;padding-left:34px}.setup-panel header{display:flex;align-items:center;justify-content:space-between;margin-bottom:20px}.setup-panel h2{font-size:18px;margin:0}.setup-panel header span{display:grid;place-items:center;width:28px;height:28px;border-radius:50%;background:#1a1b17;color:#fff;font:11px ui-monospace}.names{display:grid;grid-template-columns:1fr 1fr;gap:8px}.names label{display:flex;align-items:center;background:#ece3d3;border-bottom:1px solid #cfc5b3}.names small{padding:0 12px;color:#918a7e;font:9px ui-monospace}.names input{width:100%;min-width:0;border:0;background:none;padding:15px 0;outline:0;font-weight:700}.names label:focus-within{border-color:#df4c34}.names label button{border:0;background:none;padding:12px;cursor:pointer}.names label button:disabled{opacity:.2}.add{border:0;background:none;color:#df4c34;font-weight:700;min-height:46px;padding:10px 0;cursor:pointer}.choice{display:grid;grid-template-columns:1fr 1fr;border:1px solid #cfc5b3}.choice button{height:58px;border:0;background:#e8decc;font-weight:700;cursor:pointer}.choice button+button{border-left:1px solid #cfc5b3}.choice button.chosen{background:#1a1b17;color:#fff}.primary,.secondary,.bust{height:58px;border:1px solid #1a1b17;padding:0 24px;font-weight:800;cursor:pointer}.primary{background:#1a1b17;color:#fff}.primary:disabled{opacity:.25;cursor:not-allowed}.secondary{background:transparent}.start{float:right;display:flex;align-items:center;justify-content:space-between;min-width:240px;margin-top:28px}
  .box-game{min-height:100vh;background:#e8e0d1;display:flex;flex-direction:column}.topbar{height:72px;display:grid;grid-template-columns:1fr auto 1fr;align-items:center;border-bottom:1px solid #cfc5b3;padding:0 28px}.box-brand{justify-self:start;border:0;background:none;display:flex;align-items:center;gap:10px;padding:0;cursor:pointer}.box-brand>span{display:grid;place-items:center;width:34px;height:34px;background:#1a1b17;color:#fff;border-radius:50%;font-weight:800}.turn{text-align:center}.turn small{display:block;color:#827b70;font:9px ui-monospace;text-transform:uppercase;letter-spacing:.1em}.turn strong{font-size:14px}.close{justify-self:end;width:38px;height:38px;border:1px solid #bdb5a7;border-radius:50%;background:none;font-size:18px;cursor:pointer}.play-layout{display:grid;grid-template-columns:minmax(0,1fr) 320px;flex:1}.table{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:38px}.tile-rack{width:min(780px,100%);display:grid;grid-template-columns:repeat(9,1fr);gap:7px;padding:18px;border:2px solid #1a1b17;border-radius:8px;background:#25251f;box-shadow:0 14px 34px rgba(30,28,23,.13)}.tile-rack.twelve{grid-template-columns:repeat(12,1fr)}.tile-rack button{position:relative;height:clamp(76px,10vw,118px);border:1px solid #181916;border-radius:3px;background:#f6eddd;color:#1a1b17;box-shadow:0 4px 0 #bdb19e;cursor:pointer;transition:.2s transform,.2s background,.2s opacity}.tile-rack button span{font:500 clamp(18px,3vw,30px) ui-monospace}.tile-rack button.possible{background:#fffaf0;box-shadow:0 4px 0 #df513a}.tile-rack button.selected{background:#df513a;color:#fff;transform:translateY(-7px);box-shadow:0 10px 0 #8f3021}.tile-rack button.closed{background:#3c3b34;color:#77736a;box-shadow:none;transform:translateY(12px) scaleY(.3);opacity:.7;cursor:default}.dice-area{min-height:150px;display:flex;align-items:center;justify-content:center;gap:18px}.dice{display:flex;gap:10px}.dice span{font:70px/1 Georgia,serif;color:#1a1b17}.dice-area>strong{display:grid;place-items:center;width:42px;height:42px;border-radius:50%;background:#df513a;color:#fff;font:500 18px ui-monospace}.controls{background:#f2ead9;border-left:1px solid #cfc5b3;padding:48px 30px 24px;display:flex;flex-direction:column}.message{border-left:2px solid #df513a;padding:10px;margin:0 0 18px;color:#6f695f;font-size:11px}.sum,.blocked{display:grid;grid-template-columns:1fr auto;align-items:end;padding:18px 0;border-block:1px solid #cfc5b3}.sum span,.blocked span{font-size:11px}.sum strong,.blocked strong{font:500 44px/1 ui-monospace;color:#df513a}.sum small,.blocked small{font-size:10px;color:#817a6f}.blocked small{grid-column:1}.controls>button{margin-top:auto;width:100%;display:flex;align-items:center;justify-content:space-between}.bust{background:#df513a;color:#fff;border-color:#df513a}.open-count{text-align:center;margin:14px 0 0;color:#817a70;font:9px ui-monospace;text-transform:uppercase;letter-spacing:.08em}.box-finish{display:flex;flex-direction:column;align-items:center;justify-content:center}.box-finish h1{margin:24px 0}.finish-mark{display:grid;place-items:center;width:52px;height:52px;border-radius:50%;background:#df513a;color:#fff;font-weight:800}.scoreboard{width:min(680px,100%);border-top:1px solid #cfc5b3;margin:22px 0 32px}.scoreboard>div{display:grid;grid-template-columns:50px 1fr auto;align-items:center;text-align:left;padding:18px;border-bottom:1px solid #cfc5b3}.scoreboard>div.winner{background:#1a1b17;color:#fff}.scoreboard span{font:10px ui-monospace;opacity:.6}.scoreboard strong{font-size:15px}.scoreboard b{font:500 24px ui-monospace}.finish-actions{display:flex;gap:8px}.finish-actions button{min-width:150px}
  .rule-toggle{width:100%;min-height:52px;margin-top:12px;padding:0 16px;border:1px solid #cfc5b3;background:transparent;display:flex;align-items:center;justify-content:space-between;font-weight:700;cursor:pointer}.rule-toggle b{font:10px ui-monospace;text-transform:uppercase;color:#837c71}.rule-toggle.chosen{border-color:#df513a;background:#f5e4d9}.rule-toggle.chosen b{color:#df4c34}.play-layout{grid-template-columns:minmax(0,1fr) 280px}.table{justify-content:flex-start;padding:24px;overflow:hidden}.box-overview{width:min(980px,100%);margin:auto;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px}.box-overview.solo{grid-template-columns:1fr;max-width:780px}.player-board{min-width:0;padding:10px 11px 13px;border:3px solid #4b2918;border-radius:10px;background:linear-gradient(145deg,#a9683f,#774226);box-shadow:inset 0 0 0 2px rgba(255,220,173,.22),inset 0 -8px 14px rgba(52,24,10,.28),0 7px 14px rgba(47,31,19,.18)}.player-board.current{border-color:#df513a;box-shadow:0 0 0 3px rgba(223,81,58,.18),inset 0 0 0 2px rgba(255,226,185,.28),inset 0 -8px 14px rgba(52,24,10,.28),0 10px 22px rgba(47,31,19,.22)}.player-board.done{filter:saturate(.72);opacity:.82}.player-board>header{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:9px;padding:0 2px;color:#fff7e9;text-shadow:0 1px 1px #3a1c10}.player-board>header strong{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px}.player-board>header span{flex:none;font:9px ui-monospace;text-transform:uppercase;color:#f3d7ba}.player-board.current>header span{color:#fff}.player-board .tile-rack{width:100%;grid-template-columns:repeat(9,minmax(0,1fr));gap:4px;padding:8px;border:2px solid #3d2417;border-radius:5px;background:#2c1c14;box-shadow:inset 0 5px 10px rgba(0,0,0,.45),0 1px 0 rgba(255,230,193,.25)}.player-board .tile-rack.twelve{grid-template-columns:repeat(12,minmax(0,1fr))}.player-board .tile-rack button{height:clamp(45px,5.1vw,70px)}.player-board .tile-rack button span{font-size:clamp(12px,1.6vw,21px)}.player-board .tile-rack button.selected{transform:translateY(-4px);box-shadow:0 7px 0 #8f3021}.player-board .tile-rack button.closed{transform:translateY(6px) scaleY(.32)}.box-overview.solo .tile-rack button{height:clamp(72px,9vw,110px)}.bonus{margin:0 0 14px;padding:11px;border:1px solid #df513a;color:#b13a28;font:700 10px ui-monospace;text-transform:uppercase}.dice-area{min-height:118px}
  .box-overview{position:relative;width:min(760px,calc(100vh - 118px),100%);aspect-ratio:1;margin:auto;padding:14px;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));grid-template-rows:repeat(2,minmax(0,1fr));gap:0;border:5px solid #4b2918;border-radius:12px;background:linear-gradient(145deg,#a9683f,#744025);box-shadow:inset 0 0 0 3px rgba(255,224,182,.22),0 16px 30px rgba(47,31,19,.2)}.box-overview.solo{max-width:none;grid-template-columns:repeat(2,minmax(0,1fr))}.box-overview.solo .player-board{grid-column:1/3;grid-row:1/3}.box-overview.duo .player-board{grid-row:1/3}.box-overview.trio .player-board:nth-child(3){grid-column:1/3}.player-board{min-height:0;padding:12px;border:1px solid rgba(76,43,25,.7);border-radius:0;background:#d9cdb8;box-shadow:inset 0 0 20px rgba(67,43,24,.08);display:flex;flex-direction:column}.player-board:nth-child(n+3){justify-content:flex-end}.player-board.current{padding:11px;border:2px solid #df513a;background:#eee1ca;box-shadow:inset 0 0 0 2px rgba(223,81,58,.12)}.player-board.done{filter:none;opacity:.7}.player-board>header{color:#2b2017;text-shadow:none}.player-board>header span{color:#746252}.player-board.current>header span{color:#c43f2b}.player-board .tile-rack{background:#382217}.dice-area{position:absolute;z-index:10;left:50%;top:50%;transform:translate(-50%,-50%);width:clamp(120px,18%,158px);height:clamp(105px,16%,138px);min-height:0;border:7px solid #754329;border-radius:12px;background:#26372d;box-shadow:0 0 0 3px #4a291a,inset 0 6px 14px rgba(0,0,0,.4),0 8px 18px rgba(40,24,14,.28)}.dice{gap:3px}.dice span{font-size:clamp(45px,5vw,66px);color:#fff4df}.dice-area>strong{position:absolute;right:6px;bottom:6px;width:30px;height:30px;font-size:13px}.box-overview.solo .tile-rack button{height:clamp(72px,9vw,110px)}
  @media(max-width:760px){.shell{width:calc(100% - 28px);padding-top:max(18px,env(safe-area-inset-top))}.shell h1{font-size:48px;margin:30px 0 24px}.setup-grid{grid-template-columns:1fr}.setup-panel{padding:22px 0}.setup-panel+.setup-panel{border-left:0;border-top:1px solid #cfc5b3;padding-left:0}.names{grid-template-columns:1fr}.start{float:none;width:100%;margin-bottom:calc(12px + env(safe-area-inset-bottom))}.topbar{position:sticky;top:0;z-index:40;height:calc(62px + env(safe-area-inset-top));padding:env(safe-area-inset-top) 14px 0;background:#e8e0d1}.box-brand b{display:none}.play-layout{display:flex;flex-direction:column}.table{padding:10px 7px}.box-overview{width:100%;padding:7px;border-width:4px;border-radius:9px}.player-board{padding:6px}.player-board.current{grid-column:auto;order:initial;padding:5px}.box-overview.solo .player-board{grid-column:1/3;grid-row:1/3}.box-overview.duo .player-board{grid-row:1/3}.box-overview.trio .player-board:nth-child(3){grid-column:1/3}.player-board>header{margin-bottom:4px}.player-board>header strong{font-size:9px}.player-board>header span{font-size:7px}.player-board .tile-rack,.player-board:not(.current) .tile-rack,.player-board.current .tile-rack{grid-template-columns:repeat(3,minmax(0,1fr));padding:4px;gap:2px}.player-board .tile-rack.twelve,.player-board:not(.current) .tile-rack.twelve,.player-board.current .tile-rack.twelve{grid-template-columns:repeat(4,minmax(0,1fr));row-gap:4px}.player-board .tile-rack button,.player-board:not(.current) .tile-rack button,.player-board.current .tile-rack button,.box-overview.solo .tile-rack button{height:24px;box-shadow:0 2px 0 #bdb19e}.player-board .tile-rack button span,.player-board:not(.current) .tile-rack button span,.player-board.current .tile-rack button span{font-size:8px}.player-board .tile-rack button.closed,.player-board:not(.current) .tile-rack button.closed{transform:translateY(2px) scaleY(.36)}.dice-area{width:88px;height:76px;border-width:5px}.dice span{font-size:37px}.dice-area>strong{width:23px;height:23px;font-size:10px}.controls{border-left:0;border-top:1px solid #cfc5b3;padding:14px 18px calc(12px + env(safe-area-inset-bottom));min-height:166px}.sum,.blocked{padding:9px 0}.sum strong,.blocked strong{font-size:34px}.controls>button{height:54px;margin-top:auto}.open-count{margin-top:9px}.box-finish{justify-content:flex-start;padding-top:max(54px,calc(32px + env(safe-area-inset-top)))}.box-finish h1{font-size:48px}.scoreboard>div{padding:16px 12px}.finish-actions{width:100%;flex-direction:column}.finish-actions button{width:100%;min-height:54px}}
  /* Four-sided, top-down box */
  .box-overview,.box-overview.solo{width:min(760px,calc(100vh - 116px),100%);max-width:none;aspect-ratio:1;padding:12px;display:grid;grid-template-columns:92px minmax(0,1fr) 92px;grid-template-rows:92px minmax(0,1fr) 92px;grid-template-areas:"top top top" "left center right" "bottom bottom bottom";gap:8px;border:7px solid #81502f;border-radius:8px;background:linear-gradient(135deg,#c28a59,#986039);box-shadow:inset 0 0 0 3px #e3b783,0 16px 30px rgba(47,31,19,.2)}
  .box-overview.solo .player-board,.box-overview.duo .player-board,.box-overview.trio .player-board:nth-child(3){grid-column:auto;grid-row:auto}
  .player-board,.player-board.current{min-width:0;min-height:0;padding:5px;border:2px solid #744729;border-radius:3px;background:#b87847;box-shadow:inset 0 0 0 2px rgba(255,224,180,.25);display:flex;justify-content:stretch;filter:none}
  .player-board.current{border-color:#df513a;box-shadow:0 0 0 3px rgba(223,81,58,.25),inset 0 0 0 2px rgba(255,224,180,.3)}
  .player-board.done{opacity:.72}
  .player-board.bottom{grid-area:bottom}.player-board.top{grid-area:top}.player-board.left{grid-area:left}.player-board.right{grid-area:right}
  .player-board>header{height:18px;margin:0 3px 3px;padding:0;color:#fff8e8;text-shadow:0 1px 1px #4a2816}.player-board>header strong{font-size:9px}.player-board>header span{font-size:7px;color:#f6dec3}.player-board.current>header span{color:#fff}
  .player-board.bottom,.player-board.top{flex-direction:column;justify-content:stretch}.player-board.left,.player-board.right{flex-direction:row;justify-content:stretch}
  .player-board.left>header,.player-board.right>header{width:18px;height:auto;margin:3px;writing-mode:vertical-rl;justify-content:space-between}.player-board.left>header{transform:rotate(180deg)}
  .player-board .tile-rack,.player-board:not(.current) .tile-rack,.player-board.current .tile-rack{width:100%;height:100%;padding:3px;gap:3px;border:1px solid #5d3822;border-radius:2px;background:#7a4a2d;box-shadow:inset 0 3px 7px rgba(46,24,12,.35);grid-template-columns:repeat(9,minmax(0,1fr))}
  .player-board .tile-rack.twelve,.player-board:not(.current) .tile-rack.twelve,.player-board.current .tile-rack.twelve{grid-template-columns:repeat(12,minmax(0,1fr))}
  .player-board.left .tile-rack,.player-board.right .tile-rack{grid-template-columns:1fr;grid-template-rows:repeat(9,minmax(0,1fr))}.player-board.left .tile-rack.twelve,.player-board.right .tile-rack.twelve{grid-template-columns:1fr;grid-template-rows:repeat(12,minmax(0,1fr))}
  .player-board .tile-rack button,.player-board:not(.current) .tile-rack button,.player-board.current .tile-rack button,.box-overview.solo .tile-rack button{width:100%;height:100%;min-width:0;min-height:0;border-radius:2px;box-shadow:0 2px 0 #bea079}.player-board .tile-rack button span{font-size:clamp(9px,1.4vw,17px)}
  .player-board.top .tile-rack button span{display:block;transform:rotate(180deg)}.player-board.left .tile-rack button span{display:block;transform:rotate(90deg)}.player-board.right .tile-rack button span{display:block;transform:rotate(-90deg)}
  .player-board.left .tile-rack button.closed,.player-board.right .tile-rack button.closed{transform:scaleX(.32)}.player-board.top .tile-rack button.closed,.player-board.bottom .tile-rack button.closed{transform:scaleY(.32)}
  .dice-area{position:relative;left:auto;top:auto;grid-area:center;transform:none;width:auto;height:auto;min-height:0;border:7px solid #99633d;border-radius:3px;background:#17613f;box-shadow:inset 0 0 28px rgba(0,0,0,.28),0 0 0 2px #6f4227}.dice{gap:18px}.dice span{font-size:clamp(58px,8vw,94px);color:#fff2db;text-shadow:0 5px 6px rgba(0,0,0,.3);transform-origin:center}.dice-area>strong{position:static;width:40px;height:40px;font-size:16px}.center-roll{width:clamp(118px,25%,150px);aspect-ratio:1;border:3px solid #5e3922;border-radius:50%;background:#f4e6cf;color:#281d15;display:grid;place-content:center;gap:3px;box-shadow:0 10px 0 #71442a,0 16px 26px rgba(0,0,0,.25);cursor:pointer;transition:transform .15s,box-shadow .15s}.center-roll:hover{transform:translateY(-3px);box-shadow:0 13px 0 #71442a,0 19px 28px rgba(0,0,0,.25)}.center-roll:active{transform:translateY(7px);box-shadow:0 3px 0 #71442a,0 7px 12px rgba(0,0,0,.2)}.center-roll span{font:34px/1 Georgia,serif;letter-spacing:-5px}.center-roll b{font:800 12px ui-monospace;text-transform:uppercase;letter-spacing:.12em}.dice.rolling span{animation:tumble .72s cubic-bezier(.38,.02,.25,1) infinite}.dice.rolling span:nth-child(2){animation-name:tumble-alt;animation-delay:-.24s}.dice.settled span{animation:settle .52s cubic-bezier(.16,.9,.25,1)}.dice.settled span:nth-child(2){animation-delay:.07s}.roll-status{position:absolute;left:50%;bottom:12%;transform:translateX(-50%);color:#dcebdc;font:700 9px ui-monospace;text-transform:uppercase;letter-spacing:.16em}@keyframes tumble{0%{transform:translate(-20px,4px) rotate(-12deg) scale(.94)}30%{transform:translate(-5px,-28px) rotate(88deg) scale(1.04)}62%{transform:translate(18px,-8px) rotate(196deg) scale(.98)}82%{transform:translate(7px,-17px) rotate(278deg) scale(1.02)}100%{transform:translate(-20px,4px) rotate(348deg) scale(.94)}}@keyframes tumble-alt{0%{transform:translate(18px,-2px) rotate(14deg) scale(.96)}28%{transform:translate(5px,-24px) rotate(-82deg) scale(1.03)}60%{transform:translate(-17px,-6px) rotate(-188deg) scale(.97)}84%{transform:translate(-5px,-15px) rotate(-274deg) scale(1.02)}100%{transform:translate(18px,-2px) rotate(-346deg) scale(.96)}}@keyframes settle{0%{transform:translateY(-24px) rotate(-10deg) scale(.9)}58%{transform:translateY(6px) rotate(3deg) scale(1.06)}78%{transform:translateY(-3px) rotate(-1deg) scale(.99)}100%{transform:none}}
  @media(max-width:760px){.table{padding:8px 5px}.box-overview,.box-overview.solo{width:100%;padding:6px;grid-template-columns:58px minmax(0,1fr) 58px;grid-template-rows:58px minmax(0,1fr) 58px;gap:4px;border-width:5px}.player-board,.player-board.current{padding:2px;border-width:1px}.player-board>header{height:12px;margin:0 1px 1px}.player-board>header strong{font-size:7px}.player-board>header span{display:none}.player-board.left>header,.player-board.right>header{width:11px;height:auto;margin:1px}.player-board .tile-rack,.player-board:not(.current) .tile-rack,.player-board.current .tile-rack{padding:2px;gap:1px}.player-board .tile-rack button,.player-board:not(.current) .tile-rack button,.player-board.current .tile-rack button,.box-overview.solo .tile-rack button{width:100%;height:100%;box-shadow:0 1px 0 #bea079}.player-board .tile-rack button span,.player-board:not(.current) .tile-rack button span,.player-board.current .tile-rack button span{font-size:7px}.dice-area{width:auto;height:auto;border-width:4px}.dice{gap:3px}.dice span{font-size:48px}.dice-area>strong{width:27px;height:27px;font-size:11px}.controls{border-left:0;border-top:1px solid #cfc5b3;padding:14px 18px calc(12px + env(safe-area-inset-bottom));min-height:166px}.sum,.blocked{padding:9px 0}.sum strong,.blocked strong{font-size:34px}.controls>button{height:54px;margin-top:auto}.open-count{margin-top:9px}.box-finish{justify-content:flex-start;padding-top:max(54px,calc(32px + env(safe-area-inset-top)))}.box-finish h1{font-size:48px}.scoreboard>div{padding:16px 12px}.finish-actions{width:100%;flex-direction:column}.finish-actions button{width:100%;min-height:54px}}
  @media(max-width:760px){.center-roll{width:92px;border-width:2px;box-shadow:0 7px 0 #71442a,0 11px 18px rgba(0,0,0,.24)}.center-roll span{font-size:25px}.center-roll b{font-size:9px}.roll-status{bottom:8%;font-size:7px}}
  .roll-log{min-height:0;flex:1;display:flex;flex-direction:column;margin-bottom:18px}.roll-log>header{display:flex;align-items:center;justify-content:space-between;padding-bottom:10px;border-bottom:1px solid #cfc5b3}.roll-log>header strong{font-size:12px}.roll-log>header span{font:9px ui-monospace;color:#847c70}.roll-log>p{margin:auto;color:#9a9285;text-align:center;font:9px ui-monospace;text-transform:uppercase;letter-spacing:.1em}.log-list{min-height:0;overflow-y:auto;scrollbar-width:thin}.log-list article{padding:12px 2px;border-bottom:1px solid #d8cebd}.log-list article>div{display:grid;grid-template-columns:minmax(0,1fr) auto 28px;align-items:center;gap:8px}.log-list article strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px}.log-list article span{font:21px/1 Georgia,serif;white-space:nowrap}.log-list article b{display:grid;place-items:center;width:26px;height:26px;border-radius:50%;background:#1a1b17;color:#fff;font:11px ui-monospace}.log-list article small,.log-list article em{display:block;margin-top:6px;font:8px ui-monospace;text-transform:uppercase;letter-spacing:.05em}.log-list article small{color:#71695e}.log-list article em{color:#d94b35;font-style:normal}
  .mode-choice{margin-top:12px}.manual-roll{width:min(360px,82%);display:grid;gap:10px;text-align:center}.manual-roll>b{color:#e8dfce;font:700 9px ui-monospace;text-transform:uppercase;letter-spacing:.12em}.die-picker{display:grid;grid-template-columns:repeat(6,1fr);gap:4px}.die-picker button{aspect-ratio:1;border:1px solid rgba(255,255,255,.3);border-radius:4px;background:rgba(0,0,0,.18);color:#fff;font:14px ui-monospace;cursor:pointer}.die-picker button.selected{background:#f5e8d2;color:#1a1b17;border-color:#f5e8d2;box-shadow:0 3px 0 #9f7952}.use-roll{height:42px;border:0;background:#df513a;color:#fff;font-weight:800;cursor:pointer}.use-roll:disabled{opacity:.35;cursor:not-allowed}
  @media(max-width:760px){.roll-log{flex:none;max-height:190px;margin-bottom:12px}.roll-log>p{padding:24px 0}.log-list article{padding:9px 2px}.log-list article span{font-size:18px}}
  @media(max-width:760px){.manual-roll{width:88%;gap:7px}.die-picker{gap:3px}.die-picker button{font-size:11px}.use-roll{height:36px}}
</style>
