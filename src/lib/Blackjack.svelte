<script lang="ts">
  import { onMount } from 'svelte';
  import Rules from '$lib/Rules.svelte';

  export let onHome: () => void;

  type View = 'setup' | 'play' | 'finish';
  type Mode = 'digital' | 'own';
  type Suit = '♠' | '♥' | '♦' | '♣';
  type Rank = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K';
  type Card = { rank: Rank; suit: Suit; hidden?: boolean };
  type Hand = { cards: Card[]; bet: number; state: 'playing' | 'stand' | 'bust' | 'blackjack'; doubled?: boolean };
  type Player = { id: string; name: string; chips: number; hands: Hand[] };
  type Log = { round: number; text: string };
  type Save = { view: View; names: string[]; mode: Mode; startingChips: number; tableBet: number; players: Player[]; dealer: Card[]; deck: Card[]; activePlayer: number; activeHand: number; round: number; dealerTurn: boolean; roundOver: boolean; log: Log[] };

  const ranks: Rank[] = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
  const suits: Suit[] = ['♠','♥','♦','♣'];
  const saveKey = 'blackjack-match-v1';
  let view: View = 'setup';
  let names = ['Player 1', 'Player 2'];
  let mode: Mode = 'digital';
  let startingChips = 500;
  let tableBet = 25;
  let players: Player[] = [];
  let dealer: Card[] = [];
  let deck: Card[] = [];
  let activePlayer = 0;
  let activeHand = 0;
  let round = 0;
  let dealerTurn = false;
  let roundOver = false;
  let dealing = false;
  let log: Log[] = [];
  let mounted = false;

  $: current = players[activePlayer];
  $: hand = current?.hands[activeHand];
  $: dealerScore = score(dealer);
  $: canAct = view === 'play' && !roundOver && !dealerTurn && !dealing && hand?.state === 'playing' && hand.cards.length >= 2;
  $: sortedPlayers = [...players].sort((a, b) => b.chips - a.chips);
  $: if (mounted) { view; names; mode; startingChips; tableBet; players; dealer; deck; activePlayer; activeHand; round; dealerTurn; roundOver; log; persist(); }

  onMount(() => {
    try {
      const raw = localStorage.getItem(saveKey);
      if (raw) {
        const state = JSON.parse(raw) as Save;
        if (state.view === 'play' && state.players?.length) Object.assign(state, { deck: state.deck ?? [] }), ({ view, names, mode, startingChips, tableBet, players, dealer, deck, activePlayer, activeHand, round, dealerTurn, roundOver, log } = state);
      }
    } catch { /* start fresh */ }
    mounted = true;
  });

  function persist() {
    if (view !== 'play') return;
    localStorage.setItem(saveKey, JSON.stringify({ view, names, mode, startingChips, tableBet, players, dealer, deck, activePlayer, activeHand, round, dealerTurn, roundOver, log } satisfies Save));
  }

  function addPlayer() { if (names.length < 4) names = [...names, `Player ${names.length + 1}`]; }
  function removePlayer(index: number) { if (names.length > 1) names = names.filter((_, i) => i !== index); }
  function rename(index: number, value: string) { names[index] = value; names = [...names]; }

  function freshDeck() {
    const cards = suits.flatMap((suit) => ranks.map((rank) => ({ rank, suit })));
    for (let i = cards.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [cards[i], cards[j]] = [cards[j], cards[i]]; }
    return cards;
  }

  function draw() {
    if (!deck.length) deck = freshDeck();
    const card = deck[deck.length - 1];
    deck = deck.slice(0, -1);
    return card;
  }

  function score(cards: Card[]) {
    let total = cards.filter((card) => !card.hidden).reduce((sum, card) => sum + (card.rank === 'A' ? 11 : ['J','Q','K'].includes(card.rank) ? 10 : Number(card.rank)), 0);
    let aces = cards.filter((card) => !card.hidden && card.rank === 'A').length;
    while (total > 21 && aces--) total -= 10;
    return total;
  }

  function isNatural(value: Hand) { return value.cards.length === 2 && score(value.cards) === 21; }
  const pause = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

  function startGame() {
    players = names.map((name, index) => ({ id: `${Date.now()}-${index}`, name: name.trim() || `Player ${index + 1}`, chips: startingChips, hands: [] }));
    log = [];
    view = 'play';
    beginRound();
  }

  async function beginRound() {
    round += 1; roundOver = false; dealerTurn = false; activePlayer = 0; activeHand = 0; dealer = []; dealing = true;
    if (mode === 'digital') deck = freshDeck();
    players = players.map((player) => player.chips >= tableBet
      ? { ...player, chips: player.chips - tableBet, hands: [{ cards: [], bet: tableBet, state: 'playing' }] }
      : { ...player, hands: [] });
    if (mode === 'digital') {
      for (let pass = 0; pass < 2; pass++) {
        for (let i = 0; i < players.length; i++) if (players[i].hands.length) { players[i].hands[0].cards = [...players[i].hands[0].cards, draw()]; players = [...players]; await pause(115); }
        const dealerCard = draw();
        dealer = [...dealer, pass === 1 ? { ...dealerCard, hidden: true } : dealerCard]; await pause(115);
      }
      players = players.map((player) => ({ ...player, hands: player.hands.map((h) => isNatural(h) ? { ...h, state: 'blackjack' } : h) }));
    }
    dealing = false;
    seekPlayer(0, 0);
  }

  function addOwnCard(rank: Rank) {
    if (mode !== 'own' || dealing || roundOver) return;
    const card: Card = { rank, suit: suits[(dealer.length + players.reduce((sum, p) => sum + p.hands.reduce((n, h) => n + h.cards.length, 0), 0)) % 4] };
    if (dealerTurn) { dealer = [...dealer, card]; return; }
    if (!hand || hand.state !== 'playing') return;
    hand.cards = [...hand.cards, card];
    if (score(hand.cards) > 21) { hand.state = 'bust'; players = [...players]; nextHand(); }
    else if (hand.doubled && hand.cards.length >= 3) { hand.state = 'stand'; players = [...players]; nextHand(); }
    else { players = [...players]; }
  }

  function hit() {
    if (!canAct || mode !== 'digital') return;
    hand.cards = [...hand.cards, draw()];
    const total = score(hand.cards);
    if (total > 21) { hand.state = 'bust'; addLog(`${current.name} busts with ${total}`); players = [...players]; nextHand(); }
    else if (total === 21) { hand.state = 'stand'; players = [...players]; nextHand(); }
    else players = [...players];
  }

  function stand() { if (!canAct) return; hand.state = isNatural(hand) ? 'blackjack' : 'stand'; players = [...players]; nextHand(); }

  function doubleDown() {
    if (!canAct || hand.cards.length !== 2 || hand.doubled || current.chips < hand.bet) return;
    current.chips -= hand.bet; hand.bet *= 2; hand.doubled = true;
    if (mode === 'digital') hand.cards = [...hand.cards, draw()];
    if (score(hand.cards) > 21) hand.state = 'bust'; else if (mode === 'digital') hand.state = 'stand';
    players = [...players];
    if (mode === 'digital') nextHand();
  }

  function split() {
    if (!canAct || hand.cards.length !== 2 || hand.cards[0].rank !== hand.cards[1].rank || current.hands.length > 1 || current.chips < hand.bet) return;
    current.chips -= hand.bet;
    const [first, second] = hand.cards;
    current.hands = [{ cards: [first], bet: hand.bet, state: 'playing' }, { cards: [second], bet: hand.bet, state: 'playing' }];
    if (mode === 'digital') { current.hands[0].cards.push(draw()); current.hands[1].cards.push(draw()); }
    activeHand = 0; players = [...players];
  }

  function seekPlayer(fromPlayer: number, fromHand: number) {
    for (let p = fromPlayer; p < players.length; p++) {
      const start = p === fromPlayer ? fromHand : 0;
      for (let h = start; h < players[p].hands.length; h++) if (players[p].hands[h].state === 'playing') { activePlayer = p; activeHand = h; return; }
    }
    startDealer();
  }

  function nextHand() { seekPlayer(activePlayer, activeHand + 1); }

  async function startDealer() {
    dealerTurn = true;
    if (mode === 'digital') {
      dealing = true;
      await pause(450);
      dealer = dealer.map((card) => ({ ...card, hidden: false }));
      while (score(dealer) < 17) { dealer = [...dealer, draw()]; await pause(500); }
      dealing = false;
      settleRound();
    }
  }

  function settleRound() {
    if (!dealerTurn || (mode === 'own' && dealer.length < 2)) return;
    const house = score(dealer);
    if (mode === 'own' && house < 17) return;
    const outcomes: string[] = [];
    players = players.map((player) => {
      let won = 0;
      const hands = player.hands.map((value) => {
        const total = score(value.cards);
        if (value.state === 'bust' || total > 21) outcomes.push(`${player.name} bust`);
        else if (isNatural(value) && !(dealer.length === 2 && house === 21)) { const payout = Math.floor(value.bet * 2.5); won += payout; outcomes.push(`${player.name} blackjack +${payout - value.bet}`); }
        else if (house > 21 || total > house) { won += value.bet * 2; outcomes.push(`${player.name} wins +${value.bet}`); }
        else if (total === house) { won += value.bet; outcomes.push(`${player.name} pushes`); }
        else outcomes.push(`${player.name} loses`);
        return { ...value, state: value.state === 'bust' ? 'bust' : 'stand' } as Hand;
      });
      return { ...player, chips: player.chips + won, hands };
    });
    addLog(`Dealer ${house}${house > 21 ? ' busts' : ''} · ${outcomes.join(' · ')}`);
    dealerTurn = false; roundOver = true;
  }

  function addLog(text: string) { log = [{ round, text }, ...log].slice(0, 12); }
  function newRound() {
    if (!players.some((player) => player.chips >= tableBet)) { finish(); return; }
    beginRound();
  }
  function finish() { view = 'finish'; localStorage.removeItem(saveKey); window.scrollTo({ top: 0 }); }
  function home() { localStorage.removeItem(saveKey); onHome(); }
  function abandon() { if (confirm('Leave this blackjack table?')) home(); }
</script>

{#if view === 'setup'}
  <section class="bj-setup">
    <button class="back" on:click={onHome}>‹ All games</button><Rules game="Blackjack" sections={[{title:'Goal',text:'Beat the dealer by getting closer to 21 without going over.'},{title:'Values',text:'Faces count as 10; an ace counts as 1 or 11.'},{title:'Actions',text:'Hit, stand, double for one final card, or split a matching pair.'},{title:'Dealer',text:'The dealer draws until reaching at least 17.'},{title:'Payouts',text:'Wins pay even money, blackjack pays 3 to 2, and ties push.'}]}/>
    <h1>Blackjack</h1>
    <div class="setup-grid">
      <div class="panel"><header><h2>Players</h2><span>{names.length}</span></header><div class="names">{#each names as name, index}<label><small>{String(index + 1).padStart(2,'0')}</small><input value={name} aria-label={`Player ${index + 1} name`} on:input={(e) => rename(index, e.currentTarget.value)} /><button disabled={names.length === 1} on:click={() => removePlayer(index)} aria-label={"Remove " + name}>×</button></label>{/each}</div><button class="add" disabled={names.length >= 4} on:click={addPlayer}>＋ Add player</button></div>
      <div class="panel"><header><h2>Table</h2><span>21</span></header><div class="mode"><button class:chosen={mode === 'digital'} on:click={() => mode = 'digital'}>Digital cards</button><button class:chosen={mode === 'own'} on:click={() => mode = 'own'}>Own cards</button></div><div class="money"><label>Starting chips <select bind:value={startingChips}><option value={250}>250</option><option value={500}>500</option><option value={1000}>1,000</option></select></label><label>Table bet <select bind:value={tableBet}><option value={10}>10</option><option value={25}>25</option><option value={50}>50</option></select></label></div></div>
    </div>
    <button class="primary" on:click={startGame}>Take a seat <span>›</span></button>
  </section>
{:else if view === 'play'}
  <section class="bj-game">
    <header class="topbar"><button class="brand" on:click={abandon}><span>B</span><b>Blackjack</b></button><div aria-live="polite"><small>Round {round} · Bet {tableBet}</small><strong>{dealerTurn ? 'Dealer' : roundOver ? 'Round complete' : current?.name}</strong></div><button class="close" on:click={abandon} aria-label="Close game">×</button></header>
    <div class="bj-layout">
      <div class="table-wrap">
        <div class="casino-table">
          <div class="dealer-area"><span>Dealer</span><div class="cards">{#each dealer as card, index}<div class="playing-card" class:red={card.suit === '♥' || card.suit === '♦'} class:hidden={card.hidden} style={`--i:${index}`}>{card.hidden ? '' : card.rank}<small>{card.hidden ? '' : card.suit}</small></div>{/each}</div><strong>{dealer.length ? dealerScore : '—'}</strong></div>
          <div class="table-mark"><b>BLACKJACK</b><span>PAYS 3 TO 2 · DEALER STANDS ON 17</span></div>
          <div class="seats" style={`--count:${players.length}`}>
            {#each players as player, index}<article class:active={!dealerTurn && !roundOver && index === activePlayer} class:out={!player.hands.length}><header><b>{player.name}</b><span>{player.chips} chips</span></header><div class="hands">{#each player.hands as playerHand, handIndex}<div class="player-hand" class:active-hand={index === activePlayer && handIndex === activeHand}><div class="cards">{#each playerHand.cards as card, cardIndex}<div class="playing-card" class:red={card.suit === '♥' || card.suit === '♦'} style={`--i:${cardIndex}`}>{card.rank}<small>{card.suit}</small></div>{/each}</div><strong>{playerHand.cards.length ? score(playerHand.cards) : 'Enter cards'}</strong><small>{playerHand.state === 'playing' ? `${playerHand.bet} bet` : playerHand.state}</small></div>{/each}{#if !player.hands.length}<em>Sitting out</em>{/if}</div></article>{/each}
          </div>
        </div>
        <div class="controls">
          {#if mode === 'own' && !roundOver}
            <div class="rank-pad" aria-label="Enter card">{#each ranks as rank}<button on:click={() => addOwnCard(rank)}>{rank}</button>{/each}</div>
          {/if}
          {#if dealerTurn}
            <button class="main-action" disabled={dealing || (mode === 'own' && (dealer.length < 2 || dealerScore < 17))} on:click={settleRound}>{mode === 'digital' ? 'Dealer playing…' : dealerScore < 17 ? 'Dealer must hit' : 'Settle table'}</button>
          {:else if roundOver}
            <button class="main-action" on:click={newRound}>Next round ›</button><button on:click={finish}>Cash out</button>
          {:else}
            {#if mode === 'digital'}<button class="main-action" disabled={!canAct} on:click={hit}>Hit</button>{/if}
            <button disabled={!canAct} on:click={stand}>Stand</button>
            <button disabled={!canAct || hand?.cards.length !== 2 || hand?.doubled || current?.chips < hand?.bet} on:click={doubleDown}>Double</button>
            <button disabled={!canAct || hand?.cards.length !== 2 || hand?.cards[0]?.rank !== hand?.cards[1]?.rank || current?.hands.length > 1 || current?.chips < hand?.bet} on:click={split}>Split</button>
          {/if}
        </div>
      </div>
      <aside><h2>Table log</h2>{#if log.length}{#each log as item}<div class="log"><span>R{item.round}</span><p>{item.text}</p></div>{/each}{:else}<p class="empty">Results will appear here.</p>{/if}</aside>
    </div>
  </section>
{:else}
  <section class="bj-finish"><span>♠</span><h1>Cash out</h1><p>Most chips wins.</p><div>{#each sortedPlayers as player, index}<article class:winner={index === 0}><small>{String(index + 1).padStart(2,'0')}</small><b>{player.name}</b><strong>{player.chips}</strong></article>{/each}</div><footer><button on:click={startGame}>Replay ›</button><button on:click={home}>Home</button></footer></section>
{/if}

<style>
  :global(*){box-sizing:border-box}.bj-setup,.bj-finish{min-height:100vh;width:min(1120px,calc(100% - 40px));margin:auto;padding:34px 0;color:#171914}.back{border:0;background:none;padding:8px 0;cursor:pointer;font:600 12px ui-monospace}.bj-setup>h1,.bj-finish h1{font-size:clamp(58px,10vw,104px);letter-spacing:-.075em;line-height:.9;margin:64px 0 42px}.setup-grid{display:grid;grid-template-columns:1.1fr .9fr;border-block:1px solid #cfc5b3}.panel{padding:30px 34px 34px 0}.panel+.panel{padding-left:34px;border-left:1px solid #cfc5b3}.panel header{display:flex;justify-content:space-between}.panel header span{display:grid;place-items:center;width:28px;height:28px;background:#171914;color:#fff;border-radius:50%;font:11px ui-monospace}.names{display:grid;grid-template-columns:1fr 1fr;gap:8px}.names label{display:flex;align-items:center;background:#e8decc;border-bottom:1px solid #cfc5b3}.names small{padding:0 10px;color:#8e877a}.names input{min-width:0;width:100%;border:0;background:none;padding:15px 0;font-weight:700;outline:0}.names label button,.add{border:0;background:none;cursor:pointer}.names label button{padding:12px}.add{color:#ad272d;font-weight:800;padding:18px 0}.mode{display:grid;grid-template-columns:1fr 1fr;border:1px solid #bbb2a3}.mode button{height:50px;border:0;background:#e5dac7;font-weight:700;cursor:pointer}.mode .chosen{background:#171914;color:#fff}.money{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:20px}.money label{font-size:11px;color:#716b60}.money select{display:block;width:100%;margin-top:7px;padding:12px;border:1px solid #c8beae;background:#f5eddf}.bj-setup>.primary{float:right;margin-top:28px;min-width:250px;height:58px;padding:0 24px;border:0;background:#ad272d;color:#fff;display:flex;justify-content:space-between;align-items:center;font-weight:800;cursor:pointer}
  .bj-game{min-height:100vh;background:#ded5c6;color:#171914}.topbar{height:72px;display:grid;grid-template-columns:1fr auto 1fr;align-items:center;padding:0 24px;border-bottom:1px solid #bdb3a4}.topbar .brand{justify-self:start;border:0;background:none;display:flex;align-items:center;gap:9px;cursor:pointer}.brand span{display:grid;place-items:center;width:31px;height:31px;border-radius:50%;background:#ad272d;color:#fff}.topbar>div{text-align:center}.topbar small,.topbar strong{display:block}.topbar small{font:10px ui-monospace;color:#756f65}.close{justify-self:end;width:38px;height:38px;border:1px solid #afa596;border-radius:50%;background:none;cursor:pointer}.bj-layout{display:grid;grid-template-columns:minmax(0,1fr) 290px;min-height:calc(100vh - 72px)}.table-wrap{padding:28px;display:flex;flex-direction:column;align-items:center}.casino-table{position:relative;width:min(920px,100%);min-height:600px;border:18px solid #6b3e25;border-radius:46% 46% 18px 18px;background:#15593f;box-shadow:inset 0 0 0 5px #b78756,0 14px 30px #796f602c;color:#f8f0df;overflow:hidden}.casino-table:after{content:'';position:absolute;inset:28px;border:1px solid #d5bd8266;border-radius:46% 46% 14px 14px;pointer-events:none}.dealer-area{position:absolute;z-index:2;top:30px;left:50%;transform:translateX(-50%);text-align:center}.dealer-area>span{display:block;font:10px ui-monospace;letter-spacing:.15em;text-transform:uppercase;opacity:.7}.dealer-area>strong{display:inline-block;margin-top:7px;padding:5px 10px;border-radius:20px;background:#0d3e2b}.cards{display:flex;justify-content:center;min-height:94px;padding-top:8px}.playing-card{position:relative;width:58px;height:84px;margin-left:-13px;padding:8px;border-radius:5px;background:#f8f0df;color:#171914;border:1px solid #d3c7b4;box-shadow:2px 4px 8px #092d2077;font:800 20px Georgia;transform:rotate(calc((var(--i) - 1) * 3deg));animation:deal .28s both}.playing-card:first-child{margin-left:0}.playing-card small{display:block;font-size:17px}.playing-card.red{color:#b12b31}.playing-card.hidden{border:5px solid #f8f0df;background:repeating-linear-gradient(45deg,#8e2229 0 5px,#6d171d 5px 10px);box-shadow:inset 0 0 0 2px #dfb7a8,2px 4px 8px #092d2077}@keyframes deal{from{opacity:0;transform:translateY(-25px) rotate(8deg)}}.table-mark{position:absolute;top:210px;left:50%;transform:translateX(-50%);text-align:center;color:#e3ca8f99}.table-mark b{display:block;font:700 26px Georgia;letter-spacing:.1em}.table-mark span{font:9px ui-monospace;letter-spacing:.14em}.seats{position:absolute;z-index:3;left:28px;right:28px;bottom:24px;display:grid;grid-template-columns:repeat(var(--count),1fr);gap:10px}.seats article{min-width:0;padding:12px;border:1px solid #e6d39a44;border-radius:12px;background:#0d3d2bd9;text-align:center}.seats article.active{outline:3px solid #e5bd58;background:#174d39}.seats article.out{opacity:.4}.seats article header{display:flex;justify-content:space-between;gap:6px;font-size:11px}.seats article header span{font:9px ui-monospace;color:#e6d39a}.hands{display:flex;justify-content:center;gap:8px;margin-top:6px}.player-hand{position:relative;min-width:72px}.player-hand.active-hand>strong{background:#e5bd58;color:#172018}.player-hand .cards{min-height:86px}.player-hand .playing-card{width:48px;height:70px;font-size:16px}.player-hand>strong{display:inline-block;padding:4px 8px;border-radius:15px;background:#082f20;font:12px ui-monospace}.player-hand>small{display:block;margin-top:4px;font:8px ui-monospace;text-transform:uppercase;color:#dbc486}.hands em{font-size:11px;color:#dbc486}.controls{display:flex;justify-content:center;flex-wrap:wrap;gap:8px;width:min(920px,100%);padding-top:16px}.controls>button{min-width:120px;height:52px;border:1px solid #171914;background:transparent;font-weight:800;cursor:pointer}.controls>button:disabled{opacity:.3}.controls .main-action{background:#171914;color:#fff}.rank-pad{width:100%;display:flex;justify-content:center;flex-wrap:wrap;gap:5px;margin-bottom:6px}.rank-pad button{width:44px;height:44px;border:0;background:#f7efdf;font-weight:800;cursor:pointer}.bj-layout>aside{border-left:1px solid #bdb3a4;background:#eee5d5;padding:30px 24px}.bj-layout>aside h2{font-size:16px;margin:0 0 20px}.log{display:grid;grid-template-columns:32px 1fr;padding:12px 0;border-top:1px solid #cec4b5}.log span{font:10px ui-monospace;color:#ad272d}.log p,.empty{margin:0;color:#6e685e;font-size:11px;line-height:1.5}
  .bj-finish{display:flex;flex-direction:column;align-items:center;text-align:center;justify-content:center}.bj-finish>span{display:grid;place-items:center;width:54px;height:54px;background:#ad272d;color:#fff;border-radius:50%;font-size:24px}.bj-finish h1{margin:24px 0 8px}.bj-finish>p{color:#766f63}.bj-finish>div{width:min(650px,100%);margin:28px 0;border-top:1px solid #cfc5b3}.bj-finish article{display:grid;grid-template-columns:50px 1fr auto;padding:18px;text-align:left;border-bottom:1px solid #cfc5b3;align-items:center}.bj-finish article.winner{background:#171914;color:#fff}.bj-finish article strong{font:500 24px ui-monospace}.bj-finish footer{display:flex;gap:8px}.bj-finish footer button{min-width:150px;height:54px;border:1px solid #171914;background:transparent;font-weight:800}.bj-finish footer button:first-child{background:#171914;color:#fff}
  @media(max-width:760px){.bj-setup{width:calc(100% - 28px);padding-top:20px}.bj-setup>h1{margin:34px 0 25px;font-size:56px}.setup-grid{grid-template-columns:1fr}.panel{padding:22px 0}.panel+.panel{padding:22px 0;border-left:0;border-top:1px solid #cfc5b3}.names{grid-template-columns:1fr}.bj-setup>.primary{width:100%;float:none;margin-bottom:20px}.topbar{height:64px;padding:0 12px}.brand b{display:none}.bj-layout{display:block}.table-wrap{padding:10px 7px}.casino-table{min-height:560px;border-width:10px;border-radius:40% 40% 12px 12px}.dealer-area{top:22px}.table-mark{top:185px}.table-mark b{font-size:18px}.seats{left:10px;right:10px;bottom:12px;grid-template-columns:repeat(2,1fr)}.seats article{padding:8px 4px}.seats article header{display:block}.player-hand .playing-card{width:38px;height:58px;font-size:13px;margin-left:-17px}.player-hand .cards{min-height:68px}.controls{position:sticky;bottom:0;background:#ded5c6;padding:10px 4px calc(10px + env(safe-area-inset-bottom));z-index:10}.controls>button{min-width:calc(25% - 8px);height:48px}.rank-pad{max-height:100px;overflow:auto}.rank-pad button{width:39px;height:39px}.bj-layout>aside{border-left:0;border-top:1px solid #bdb3a4}.bj-finish{width:calc(100% - 28px);justify-content:flex-start;padding-top:60px}.bj-finish h1{font-size:58px}.bj-finish footer{width:100%;flex-direction:column}.bj-finish footer button{width:100%}}
  @media(prefers-reduced-motion:reduce){*{animation:none!important}}
</style>
