// Small shared behaviours for the public pages: mobile menu, copy buttons, tabs, scroll reveal.
(() => {
  const menu = document.querySelector(".menu-btn");
  const nav = document.querySelector(".nav");
  if (menu && nav) menu.addEventListener("click", () => nav.classList.toggle("open"));

  const toast = document.createElement("div");
  toast.className = "toast";
  document.body.append(toast);
  const say = (msg) => {
    toast.textContent = msg;
    toast.classList.add("show");
    clearTimeout(say.t);
    say.t = setTimeout(() => toast.classList.remove("show"), 1800);
  };

  document.querySelectorAll(".cmd").forEach((box) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = "העתקה";
    btn.addEventListener("click", () => {
      navigator.clipboard.writeText(box.querySelector("span").textContent.trim()).then(() => say("הועתק"), () => say("ההעתקה נכשלה"));
    });
    box.append(btn);
  });

  // Segmented tabs: <div class="seg" data-tabs="group"><button data-tab="x">…</button></div> + [data-pane="x"]
  document.querySelectorAll(".seg[data-tabs]").forEach((seg) => {
    const group = seg.dataset.tabs;
    const panes = document.querySelectorAll(`[data-group="${group}"]`);
    const select = (id, push) => {
      seg.querySelectorAll("button").forEach((b) => b.classList.toggle("on", b.dataset.tab === id));
      panes.forEach((p) => { p.hidden = p.dataset.pane !== id; });
      if (push) history.replaceState(null, "", "#" + id);
    };
    seg.addEventListener("click", (e) => {
      const b = e.target.closest("button[data-tab]");
      if (b) select(b.dataset.tab, true);
    });
    const fromHash = location.hash.slice(1);
    const ids = [...seg.querySelectorAll("button[data-tab]")].map((b) => b.dataset.tab);
    select(ids.includes(fromHash) ? fromHash : ids[0], false);
  });

  const io = "IntersectionObserver" in window && new IntersectionObserver((entries) => {
    entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); } });
  }, { threshold: 0.12 });
  document.querySelectorAll(".reveal").forEach((el) => (io ? io.observe(el) : el.classList.add("in")));
})();
