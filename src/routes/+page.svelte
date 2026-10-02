<script lang="ts">
  import { afterUpdate, onMount } from 'svelte';
  import './+page.svelte.css';
  import ShutTheBox from '$lib/ShutTheBox.svelte';
  import Yahtzee from '$lib/Yahtzee.svelte';
  import Blackjack from '$lib/Blackjack.svelte';
  import Hearts from '$lib/Hearts.svelte';
  import Rules from '$lib/Rules.svelte';
  import LiarsDice from '$lib/LiarsDice.svelte';
  import './papereye-theme.css';

  type Screen = 'home' | 'setup' | 'game' | 'finish' | 'shutbox' | 'yahtzee' | 'blackjack' | 'hearts' | 'liarsdice';
  type CardMode = 'own' | 'digital';
  type CardColor = 'black' | 'red';
  type BustSummary = { playerName: string; points: number; removedCount: number; message: string };
  type Player = { id: string; name: string; score: number };
  type Slot = { id: string; x: number; y: number; rotate: number; basePoints: number; kind: 'centre' | 'cross' | 'ring' };
  type Save = { screen: Screen; players: Player[]; layers: number; cardMode?: CardMode; cardColors?: Record<number, CardColor>; bustSummary?: BustSummary | null; activePlayer: number; cards: number[]; activeCards?: number[]; selected: number; turns: number };

  let screen: Screen = 'home';
  let players: Player[] = [];
  let names = ['Player 1', 'Player 2'];
  let layers = 2;
  let cardMode: CardMode = 'own';
  let activePlayer = 0;
  let cards: number[] = [];
  let activeCards: number[] = [];
  let selected = 0;
  let turns = 0;
  let restored = false;
  let notice = '';
  let cardColors: Record<number, CardColor> = {};
  let revealedColor: CardColor | null = null;
  let revealing = false;
  let bustSummary: BustSummary | null = null;
  let previousScreen: Screen = screen;

  const key = 'spinnenwebben-match-v5';

  $: slots = makeSlots(layers);
  $: current = players[activePlayer];
  $: bustCards = activeCards.includes(selected) ? activeCards : [...activeCards, selected];
  $: bustTotal = bustCards.reduce((total, index) => total + pointsAt(index), 0);
  $: sortedPlayers = [...players].sort((a, b) => a.score - b.score);
  $: winningScore = sortedPlayers[0]?.score;
  $: isFinished = screen === 'game' && cards.length === 0 && !bustSummary;
  $: if (restored) {
    screen; players; layers; cardMode; cardColors; bustSummary; activePlayer; cards; activeCards; selected; turns;
    persist();
  }
  $: if (isFinished) finishGame();

  onMount(() => {
    try {
      const saved = localStorage.getItem(key);
      if (saved) {
        const state = JSON.parse(saved) as Save;
        if (state.players?.length && state.cards?.length && state.screen === 'game') {
          ({ screen, players, layers, activePlayer, cards, selected, turns } = state);
          activeCards = state.activeCards ?? [];
          cardMode = state.cardMode ?? 'own';
          cardColors = state.cardColors ?? {};
          bustSummary = state.bustSummary ?? null;
          names = players.map((player) => player.name);
          notice = 'Match restored';
        }
      }
    } catch { /* begin with a fresh home screen */ }
    restored = true;
  });

  afterUpdate(() => {
    if (screen !== previousScreen) {
      previousScreen = screen;
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
  });

  function makeSlots(ringCount: number): Slot[] {
    const result: Slot[] = [];
    const maxGuide = 42;
    const centreScore = ringCount * 2;
    result.push({ id: 'centre-a', x: 50, y: 50, rotate: 90, basePoints: centreScore, kind: 'centre' });
    result.push({ id: 'centre-b', x: 50, y: 50, rotate: 0, basePoints: centreScore, kind: 'centre' });

    for (let level = 1; level <= ringCount; level++) {
      const distance = maxGuide * level / ringCount;
      const score = ringCount * 2 - level;
      for (let arm = 0; arm < 4; arm++) {
        const angle = arm * Math.PI / 2;
        result.push({
          id: `cross-${level}-${arm}`,
          x: 50 + Math.cos(angle) * distance,
          y: 50 + Math.sin(angle) * distance,
          rotate: arm % 2 ? 0 : 90,
          basePoints: score,
          kind: 'cross'
        });
      }
    }

    for (let ring = 0; ring < ringCount; ring++) {
      const count = 4 + ring * 4;
      const guide = maxGuide * (ring + 1) / ringCount;
      const cardsPerQuadrant = ring + 1;
      const margin = ring === 0 ? 45 : Math.max(12, 22.5 - (ring - 1) * 3);
      const radius = guide / Math.cos(margin * Math.PI / 180);
      const score = ringCount - ring - 1;
      for (let item = 0; item < count; item++) {
        const quadrant = Math.floor(item / cardsPerQuadrant);
        const place = item % cardsPerQuadrant;
        const angleInQuadrant = cardsPerQuadrant === 1
          ? 45
          : margin + place * ((90 - margin * 2) / (cardsPerQuadrant - 1));
        const angle = (-90 + quadrant * 90 + angleInQuadrant) * Math.PI / 180;
        result.push({
          id: `ring-${ring}-${item}`,
          x: 50 + Math.cos(angle) * radius,
          y: 50 + Math.sin(angle) * radius,
          rotate: quadrant % 2 === 0 ? -45 : 45,
          basePoints: score,
          kind: 'ring'
        });
      }
    }
    return result;
  }

  function pointsAt(index: number) {
    return cards[index] === undefined || slots[index] === undefined
      ? 0
      : slots[index].basePoints + 1;
  }

  function persist() {
    if (screen === 'game') {
      const state: Save = { screen, players, layers, cardMode, cardColors, bustSummary, activePlayer, cards, activeCards, selected, turns };
      localStorage.setItem(key, JSON.stringify(state));
    }
  }

  function addPlayer() {
    names = [...names, `Player ${names.length + 1}`];
  }

  function removePlayer(index: number) {
    if (names.length <= 2) return;
    names = names.filter((_, i) => i !== index);
  }

  function updateName(index: number, value: string) {
    names[index] = value;
    names = [...names];
  }

  function startGame() {
    players = names.map((name, index) => ({ id: `${Date.now()}-${index}`, name: name.trim() || `Player ${index + 1}`, score: 0 }));
    cards = makeSlots(layers).map((slot) => slot.basePoints);
    activeCards = [];
    cardColors = {};
    revealedColor = null;
    revealing = false;
    bustSummary = null;
    activePlayer = 0;
    selected = 1;
    turns = 0;
    notice = '';
    screen = 'game';
  }

  function chooseCard(index: number) {
    if (revealing || activeCards.includes(index)) return;
    selected = index;
    notice = '';
  }

  function nextPlayer(message = '', chooseNext = false) {
    if (!players.length) return;
    activePlayer = (activePlayer + 1) % players.length;
    if (chooseNext) {
      const nextInactive = cards.findIndex((_, index) => !activeCards.includes(index));
      if (nextInactive >= 0) selected = nextInactive;
    } else selected = Math.min(selected, Math.max(0, cards.length - 1));
    turns += 1;
    notice = message;
  }

  function safeNext(customMessage = '') {
    if (!cards.length || activeCards.includes(selected)) return;
    const points = pointsAt(selected);
    activeCards = [...activeCards, selected];
    nextPlayer(customMessage || `${points} point card active`, true);
  }

  function bust(prefix = '') {
    if (!current || !cards.length) return;
    const playerName = current.name;
    const indicesToRemove = [...new Set([...activeCards, selected])]
      .filter((index) => index >= 0 && index < cards.length);
    const points = indicesToRemove.reduce((total, index) => total + pointsAt(index), 0);
    const removedCount = indicesToRemove.length;
    players[activePlayer].score += points;
    players = [...players];
    const bustSet = new Set(indicesToRemove);
    cards = cards.filter((_, index) => !bustSet.has(index));
    activeCards = [];
    cardColors = {};
    selected = 0;
    const result = `${removedCount} ${removedCount === 1 ? 'card' : 'cards'} removed · +${points} to ${playerName}`;
    bustSummary = {
      playerName,
      points,
      removedCount,
      message: prefix ? `${prefix} · ${result}` : result
    };
  }

  function continueAfterBust() {
    if (!bustSummary) return;
    const nextNotice = bustSummary.message;
    bustSummary = null;
    if (!cards.length) {
      finishGame();
      return;
    }
    nextPlayer(nextNotice);
  }

  function guessColor(guess: CardColor) {
    if (revealing || !cards.length || activeCards.includes(selected)) return;
    const result: CardColor = Math.random() < 0.5 ? 'black' : 'red';
    revealedColor = result;
    revealing = true;
    notice = `${result === 'black' ? 'Black' : 'Red'}…`;
    window.setTimeout(() => {
      if (result === guess) {
        cardColors = { ...cardColors, [selected]: result };
        safeNext(`${result === 'black' ? 'Black' : 'Red'} · correct`);
      } else {
        bust(`${result === 'black' ? 'Black' : 'Red'} · bust`);
      }
      revealedColor = null;
      revealing = false;
    }, 850);
  }

  function finishGame() {
    screen = 'finish';
    localStorage.removeItem(key);
  }

  function replay() {
    startGame();
  }

  function goHome() {
    localStorage.removeItem(key);
    screen = 'home';
    players = [];
    cards = [];
    activeCards = [];
    cardColors = {};
    bustSummary = null;
    notice = '';
  }

  function abandon() {
    if (confirm('End this match and return home?')) goHome();
  }
</script>

<svelte:head>
  <title>Spellenkast — zes spellen voor aan tafel</title>
  <meta name="description" content="Zes klassieke kaart- en dobbelspellen in één offline spellenkast." />
  <meta name="theme-color" content="#f7f5ef" />
</svelte:head>

<a class="skip-link" href="#app-content">Skip to game content</a>
<main id="app-content" class="papereye-app" class:playing={screen === 'game'} tabindex="-1">
  {#if screen === 'home'}
    <section class="home page-shell">
      <div class="home-marquee" aria-hidden="true"><div><span>◆ Fully offline</span><span>◆ Six tabletop games</span><span>◆ Digital or bring your own</span><span>◆ No account required</span><span>◆ Fully offline</span><span>◆ Six tabletop games</span><span>◆ Digital or bring your own</span><span>◆ No account required</span></div></div>
      <header class="home-brand">
        <span class="home-mark" aria-hidden="true">S</span>
        <span class="home-wordmark"><strong>Spellenkast</strong><small>Tabletop archive</small></span>
        <nav aria-label="Collectie-overzicht">
          <a href="#games"><i>01</i> Kaarten</a>
          <a href="#games"><i>02</i> Dobbelstenen</a>
          <a href="#games"><i>03</i> Zes spellen</a>
        </nav>
        <span class="offline-stamp">Offline klaar</span>
      </header>
      <div class="masthead-rule"><span>VOL. I — NO. 06</span><b>OFFLINE GAME CABINET</b><span>EST. 2026</span></div>
      <div class="hero-copy">
        <p class="home-eyebrow">A pocket-sized game night</p>
        <h1>Play <span>together.</span></h1>
        <p class="home-intro">“Six familiar tables, ready wherever the evening takes you.”</p>
      </div>
      <div class="home-double-rule"></div>
      <div class="collection-heading" id="games"><span>De collectie</span><b>Kies een tafel</b><span>01—06</span></div>
      <div class="game-grid">
        <button class="game-card available" on:click={() => screen = 'setup'}>
          <span class="web-art" aria-hidden="true"><i></i><i></i><i></i><i></i></span>
          <span class="game-number">01</span>
          <span class="game-kind">Cards · Scorekeeper</span>
          <span class="game-title">Spinnenwebben</span>
          <span class="game-meta">2–8 players <b>Open ›</b></span>
        </button>
        <button class="game-card shut-box-card" on:click={() => screen = 'shutbox'}>
          <span class="box-art" aria-hidden="true">{#each Array(9) as _, tile}<i>{tile + 1}</i>{/each}</span>
          <span class="game-number">02</span>
          <span class="game-kind">Dice · Strategy</span>
          <span class="game-title">Shut the Box</span>
          <span class="game-meta">1–4 players <b>Open ›</b></span>
        </button>
        <button class="game-card yahtzee-card" on:click={() => screen = 'yahtzee'}>
          <span class="yahtzee-art" aria-hidden="true"><i>⚄</i><i>⚂</i><i>⚅</i><i>⚀</i><i>⚃</i></span>
          <span class="game-number">03</span>
          <span class="game-kind">Dice · Scorecard</span>
          <span class="game-title">Yahtzee</span>
          <span class="game-meta">1–4 players <b>Open ›</b></span>
        </button>
        <button class="game-card blackjack-card" on:click={() => screen = 'blackjack'}>
          <span class="blackjack-art" aria-hidden="true"><i>♠</i><i>♥</i><i>A</i></span>
          <span class="game-number">04</span>
          <span class="game-kind">Cards · Casino</span>
          <span class="game-title">Blackjack</span>
          <span class="game-meta">1–4 players <b>Open ›</b></span>
        </button>
        <button class="game-card hearts-card" on:click={() => screen = 'hearts'}>
          <span class="hearts-art" aria-hidden="true"><i>Q</i><i>♥</i><i>2</i></span>
          <span class="game-number">05</span><span class="game-kind">Cards · Tricks</span><span class="game-title">Hearts</span>
          <span class="game-meta">1–4 players <b>Open ›</b></span>
        </button>
        <button class="game-card liars-card" on:click={() => screen = 'liarsdice'}>
          <span class="liars-art" aria-hidden="true"><i>⚄</i><i>⚀</i><b></b></span>
          <span class="game-number">06</span><span class="game-kind">Dice · Bluffing</span><span class="game-title">Liar’s Dice</span>
          <span class="game-meta">2–6 players <b>Open ›</b></span>
        </button>
      </div>
      <footer class="home-footer"><span>NO WIFI? NO PROBLEM.</span><b>Pick a table and pass the device.</b><span>ISSUE 01 / 01</span></footer>
    </section>
  {:else if screen === 'setup'}
    <section class="setup page-shell">
      <button class="text-button" on:click={() => screen = 'home'}>‹ All games</button><Rules game="Spinnenwebben" sections={[{title:'Goal',text:'Finish with the lowest score; outer cards are worth fewer points.'},{title:'Turn',text:'Choose a card, then reveal it or guess its colour in digital mode.'},{title:'Safe',text:'A correct guess activates the card and passes play.'},{title:'Bust',text:'Remove the chosen and active cards, adding all their points to that player.'},{title:'Winner',text:'When the web is empty, the lowest score wins.'}]}/>
      <div class="setup-heading">
        <h1>Spinnenwebben</h1>
      </div>
      <div class="setup-grid">
        <div class="panel">
          <div class="panel-title"><h2>Players</h2><span>{names.length}</span></div>
          <div class="player-inputs">
            {#each names as name, index}
              <label><span>{String(index + 1).padStart(2, '0')}</span><input aria-label={`Player ${index + 1} name`} value={name} on:input={(event) => updateName(index, event.currentTarget.value)} /><button aria-label={`Remove ${name}`} disabled={names.length <= 2} on:click={() => removePlayer(index)}>×</button></label>
            {/each}
          </div>
          <button class="add-player" on:click={addPlayer} disabled={names.length >= 8}>＋ Add player</button>
        </div>
        <div class="panel rules-panel">
          <div class="panel-title"><h2>Web layers</h2><span>{layers}</span></div>
          <div class="stepper"><button aria-label="Fewer layers" disabled={layers <= 2} on:click={() => layers--}>−</button><strong>{layers}</strong><button aria-label="More layers" disabled={layers >= 5} on:click={() => layers++}>＋</button></div>
          <p>{makeSlots(layers).length} cards</p>
          <div class="play-mode">
            <button class:chosen={cardMode === 'own'} on:click={() => cardMode = 'own'}>Own cards</button>
            <button class:chosen={cardMode === 'digital'} on:click={() => cardMode = 'digital'}>Digital cards</button>
          </div>
        </div>
      </div>
      <button class="primary start" on:click={startGame}>Start game <span>›</span></button>
    </section>
  {:else if screen === 'game'}
    <section class="game-screen">
      <header class="game-topbar">
        <button class="brand small" on:click={abandon} aria-label="Return home"><span class="brand-mark">S</span><span>Spinnenwebben</span></button>
        <div class="turn-label" aria-live="polite"><span>Turn {turns + 1}</span><strong>{current?.name}</strong></div>
        <button class="round-button" on:click={abandon} aria-label="Close match">×</button>
      </header>

      <div class="score-strip" aria-label="Scores" aria-live="polite">
        {#each players as player, index}
          <div class:active={index === activePlayer}><span>{player.name}</span><strong>{player.score}</strong></div>
        {/each}
      </div>

      <div class="game-body">
        <div class="board-wrap">
          <div
            class="board"
            class:dense={layers >= 4}
            style={`--ring-count:${layers};--card-width:${[0, 0, 60, 44, 32, 26][layers]}px;--card-height:${[0, 0, 84, 62, 45, 36][layers]}px;--card-font:${[0, 0, 22, 18, 14, 13][layers]}px;--selected-scale:${layers === 2 ? 1.12 : 1.04}`}
          >
            {#each slots as slot, index}
              {#if cards[index] !== undefined}
                <button
                  class="card"
                  class:selected={index === selected}
                  class:active={activeCards.includes(index)}
                  class:black-card={cardMode === 'digital' && (cardColors[index] === 'black' || (index === selected && revealedColor === 'black'))}
                  class:red-card={cardMode === 'digital' && (cardColors[index] === 'red' || (index === selected && revealedColor === 'red'))}
                  class:centre-top={slot.id === 'centre-b'}
                  class:shifted={cards[index] !== slot.basePoints}
                  style={`--x:${slot.x}%;--y:${slot.y}%;--r:${slot.rotate}deg;--delay:${Math.min(index, 20) * 8}ms`}
                  aria-label={`${pointsAt(index)} point card${activeCards.includes(index) ? ', active' : ''}${index === selected ? ', selected' : ''}`}
                  on:click={() => chooseCard(index)}
                ><span>{pointsAt(index)}</span></button>
              {/if}
            {/each}
            {#if cards.length === 0}<div class="empty-web">Web cleared</div>{/if}
          </div>
        </div>

        <aside class="turn-panel">
          {#if notice}<p class="notice">{notice}</p>{/if}
          <div class="selected-card"><span>At risk · {bustCards.length} {bustCards.length === 1 ? 'card' : 'cards'}</span><strong>{bustTotal}</strong></div>
          <div class="game-actions">
            {#if cardMode === 'digital'}
              <button class="guess-black" on:click={() => guessColor('black')} disabled={revealing || activeCards.includes(selected)}><span>Black</span><b>♠</b></button>
              <button class="guess-red" on:click={() => guessColor('red')} disabled={revealing || activeCards.includes(selected)}><span>Red</span><b>♥</b></button>
            {:else}
              <button class="next" on:click={() => safeNext()} disabled={activeCards.includes(selected)}><span>Next</span><b>›</b></button>
              <button class="bust" on:click={() => bust()}><span>Bust</span><b>+{bustTotal}</b></button>
            {/if}
          </div>
          <p class="remaining">{cards.length} left</p>
        </aside>
      </div>
      {#if bustSummary}
        <div class="bust-modal-backdrop">
          <dialog class="bust-modal" open aria-labelledby="bust-title">
            <span>Bust</span>
            <h2 id="bust-title">{bustSummary.playerName}</h2>
            <strong>+{bustSummary.points}</strong>
            <p>{bustSummary.removedCount} {bustSummary.removedCount === 1 ? 'card' : 'cards'} removed</p>
            <button on:click={continueAfterBust}>Continue ›</button>
          </dialog>
        </div>
      {/if}
    </section>
  {:else if screen === 'shutbox'}
    <ShutTheBox onHome={goHome} />
  {:else if screen === 'yahtzee'}
    <Yahtzee onHome={goHome} />
  {:else if screen === 'blackjack'}
    <Blackjack onHome={goHome} />
  {:else if screen === 'hearts'}
    <Hearts onHome={goHome} />
  {:else if screen === 'liarsdice'}
    <LiarsDice onHome={goHome} />
  {:else if screen === 'finish'}
    <section class="finish page-shell">
      <div class="finish-mark">✦</div>
      <h1>Final scores</h1><p class="finish-sub">Lowest score wins.</p>
      <div class="scoreboard">
        {#each sortedPlayers as player, index}
          <div class:winner={player.score === winningScore}><span class="rank">{String(index + 1).padStart(2, '0')}</span><strong>{player.name}{player.score === winningScore ? ' — Winner' : ''}</strong><b>{player.score}<small> pts</small></b></div>
        {/each}
      </div>
      <div class="finish-actions"><button class="primary" on:click={replay}>Replay ›</button><button class="secondary" on:click={goHome}>Home</button></div>
    </section>
  {/if}
</main>
