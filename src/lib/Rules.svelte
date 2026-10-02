<script lang="ts">
  import { tick } from 'svelte';
  export let game: string;
  export let sections: { title: string; text: string }[];
  let open = false;
  let dialog: HTMLDialogElement;
  let trigger: HTMLButtonElement;

  async function show() {
    open = true;
    await tick();
    dialog.showModal();
    dialog.querySelector<HTMLButtonElement>('.close')?.focus();
  }
  async function close() {
    if (dialog?.open) dialog.close();
    open = false;
    await tick();
    trigger?.focus();
  }
  function cancel(event: Event) { event.preventDefault(); close(); }
  function backdrop(event: MouseEvent) {
    if (event.target !== dialog) return;
    const box = dialog.getBoundingClientRect();
    if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) close();
  }
</script>

<button class="trigger" bind:this={trigger} on:click={show} aria-haspopup="dialog">Rules</button>
{#if open}
  <dialog bind:this={dialog} class="sheet" aria-labelledby="rule-title" on:cancel={cancel} on:click={backdrop}>
    <header><div><small>How to play</small><h2 id="rule-title">{game}</h2></div><button class="close" on:click={close} aria-label="Close rules">×</button></header>
    {#each sections as item, index}<article><span aria-hidden="true">{String(index + 1).padStart(2, '0')}</span><div><h3>{item.title}</h3><p>{item.text}</p></div></article>{/each}
    <button class="done" on:click={close}>Got it</button>
  </dialog>
{/if}

<style>
  .trigger{margin-left:12px;min-height:44px;padding:8px 12px;border:2px solid #1a1a1a;background:#fff;color:#1a1a1a;box-shadow:3px 3px 0 #1a1a1a;font:900 11px ui-monospace;cursor:pointer}.trigger:hover{transform:translate(3px,3px);box-shadow:none}.sheet{inset:0;margin:auto;width:min(610px,calc(100% - 40px));max-height:calc(100dvh - 40px);overflow:auto;padding:30px;background:#fbfbf9;color:#1a1a1a;border:4px solid #1a1a1a;border-radius:0;box-shadow:8px 8px 0 #1a1a1a}.sheet::backdrop{background:#171713cc;backdrop-filter:blur(5px)}header{display:flex;justify-content:space-between;align-items:start;padding-bottom:22px;border-bottom:2px solid #1a1a1a}header small{color:#b91c1c;font:900 10px ui-monospace;text-transform:uppercase;letter-spacing:.15em}h2{margin:6px 0 0;font-size:38px;letter-spacing:-.055em;text-transform:uppercase}.close{width:44px;height:44px;border:2px solid #1a1a1a;background:#fff;color:#1a1a1a;box-shadow:2px 2px 0 #1a1a1a;font-size:20px;cursor:pointer}article{display:grid;grid-template-columns:42px 1fr;padding:18px 0;border-bottom:1px solid #777}article>span{color:#b91c1c;font:900 10px ui-monospace}h3{margin:0 0 7px;font-size:15px;text-transform:uppercase}p{margin:0;color:#444;font-size:13px;line-height:1.55}.done{width:100%;height:52px;margin-top:22px;border:2px solid #1a1a1a;background:#1a1a1a;color:#fff;box-shadow:3px 3px 0 #777;font-weight:900;cursor:pointer}.done:hover{transform:translate(3px,3px);box-shadow:none}@media(max-width:600px){.sheet{inset:auto 0 0;margin:0;width:100%;max-height:88dvh;border-width:4px 0 0;padding:24px 20px calc(20px + env(safe-area-inset-bottom));box-shadow:none}h2{font-size:32px}}
</style>
