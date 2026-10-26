function pad(value) {
  return value < 10 ? `0${value}` : String(value);
}

export class Hud {
  constructor(doc = document) {
    this.hpEl = doc.getElementById("hp");
    this.stageEl = doc.getElementById("stage");
    this.targetsEl = doc.getElementById("targets");
    this.blocksEl = doc.getElementById("blocks");
    this.bombEl = doc.getElementById("bomb");
    this.pendingEl = doc.getElementById("pending");
    this.hintsEl = doc.getElementById("setting-hints");
    this.swapEl = doc.getElementById("setting-swap");
    this.movesEl = doc.getElementById("moves");
    this.seedEl = doc.getElementById("seed");
    this.keylogEl = doc.getElementById("keylog");
    this.toastEl = doc.getElementById("toast");
    this.liveEl = doc.getElementById("live");
    this.log = [];
    this.hideTimer = null;
  }

  resetLog() {
    this.log = [];
  }

  logKey(key) {
    this.log.push(key);
    if (this.log.length > 12) this.log.shift();
  }

  update(state) {
    const hearts = "♥".repeat(state.hp) + "♡".repeat(state.maxHp - state.hp);
    this.hpEl.textContent = hearts;
    this.hpEl.setAttribute("aria-label", `health ${state.hp} of ${state.maxHp}`);
    this.stageEl.textContent = pad(state.stage);
    this.targetsEl.textContent = state.remaining;
    this.blocksEl.textContent = state.blocks.length;
    this.bombEl.textContent = state.heldBomb ? "1" : "—";
    this.movesEl.textContent = state.moves;
    this.seedEl.textContent = String(state.seed).slice(0, 6);
    this.keylogEl.textContent = this.log.slice(-7).join(" ");
  }

  setPending(text) {
    this.pendingEl.textContent = text;
    this.pendingEl.classList.toggle("show", Boolean(text));
  }

  setHints(enabled) {
    this.hintsEl.checked = enabled;
  }

  setSwap(enabled) {
    this.swapEl.checked = enabled;
  }

  flash(title, subtitle) {
    this.toastEl.innerHTML =
      title + (subtitle ? `<small>${subtitle}</small>` : "");
    this.toastEl.classList.add("show");
    this.toastEl.setAttribute("aria-hidden", "false");
    clearTimeout(this.hideTimer);
    this.hideTimer = setTimeout(() => this.hide(), 900);
  }

  hide() {
    this.toastEl.classList.remove("show");
    this.toastEl.setAttribute("aria-hidden", "true");
  }

  announce(message) {
    this.liveEl.textContent = message;
  }
}
