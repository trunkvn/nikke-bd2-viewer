/**
 * Lấy metadata nhân vật từ infobox {{Playable Character}} của wiki NIKKE (MediaWiki API).
 * Mỗi request gộp tối đa 50 trang. Nội dung wiki: CC BY-SA (Fandom).
 */
const API = "https://nikke-goddess-of-victory-international.fandom.com/api.php";
const UA = "interactive-anime-local-fetch (personal fan project)";

const ELEMENTS = { fire: "Fire", water: "Water", wind: "Wind", iron: "Iron", electric: "Electric" };

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();

const clean = (s) =>
  s
    .replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, "$1")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<ref[^>]*>[\s\S]*?<\/ref>|<ref[^>]*\/>/gi, "")
    .replace(/\{\{[^}]*\}\}/g, "")
    .replace(/'{2,}/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();

/** Tên diễn viên từ markup wiki: {{W|Tên}}, {{W|ko:x|Tên}}, [[imdb:nm1|Tên]], [[Tên]], hoặc chữ thường. */
function vaName(raw) {
  if (!raw) return undefined;
  let m = /\{\{W\|(?:[^|}]*\|)?([^|}]+)\}\}/.exec(raw);
  if (m) return m[1].trim();
  m = /\[\[(?:[^\]|]*\|)?([^\]]+)\]\]/.exec(raw);
  if (m) return m[1].trim();
  const plain = raw.replace(/<[^>]+>|\{\{[^}]*\}\}/g, "").trim();
  return plain || undefined;
}

/** @returns metadata đã chuẩn hoá, hoặc null nếu trang không có infobox nhân vật. */
export function parseInfobox(wikitext) {
  const box = /\{\{Playable Character\s*([\s\S]*?)\n\s*\}\}/i.exec(wikitext);
  if (!box) return null;
  const f = {};
  for (const line of box[1].split("\n")) {
    const m = /^\s*\|\s*(\w+)\s*=\s*(.*)$/.exec(line);
    if (m) f[m[1].toLowerCase()] = m[2].trim();
  }
  const rarity = (f.rarity ?? "").toUpperCase();
  const manufacturer = (f.manufacturer ?? "")
    .replace(/\s+os$/i, "") // "elysion os" = bản Over-spec của hãng Elysion
    .split(/\s+/)
    .filter(Boolean)
    .map(cap)
    .join(" ");
  const desc = /\{\{Description\|([\s\S]*?)\}\}\s*\n/.exec(wikitext)?.[1];
  const release = f.releasedate ? Date.parse(f.releasedate) : NaN;
  return {
    nameEn: f.name_en ? clean(f.name_en) : undefined,
    vaEn: vaName(f.va_en),
    vaJp: vaName(f.va_jp),
    rarity: ["R", "SR", "SSR"].includes(rarity) ? rarity : undefined,
    class: f.class ? cap(f.class) : undefined,
    element: f.code ? ELEMENTS[f.code.toLowerCase()] ?? cap(f.code) : undefined,
    weapon: f.weapontype ? f.weapontype.toUpperCase() : undefined,
    manufacturer: manufacturer || undefined,
    squad: f.squad ? clean(f.squad) : undefined,
    description: desc ? clean(desc) : undefined,
    released: Number.isNaN(release) ? undefined : release <= Date.now(),
  };
}

/** @param {string[]} titles  @returns {Promise<Map<string, object|null>>} title gốc → metadata (null = không có infobox/trang) */
export async function fetchWikiMeta(titles) {
  const out = new Map();
  for (let i = 0; i < titles.length; i += 50) {
    const chunk = titles.slice(i, i + 50);
    const url = `${API}?${new URLSearchParams({
      action: "query",
      format: "json",
      redirects: "1",
      prop: "revisions",
      rvprop: "content",
      rvslots: "main",
      titles: chunk.join("|"),
    })}`;
    const res = await fetch(url, { headers: { "User-Agent": UA } });
    if (!res.ok) throw new Error(`wiki ${res.status}`);
    const q = (await res.json()).query ?? {};

    // Ánh xạ tên đã chuẩn hoá / redirect về tên ta đã hỏi.
    const alias = new Map(chunk.map((t) => [t, t]));
    for (const n of q.normalized ?? []) alias.set(n.to, alias.get(n.from) ?? n.from);
    for (const r of q.redirects ?? []) alias.set(r.to, alias.get(r.from) ?? r.from);

    for (const page of Object.values(q.pages ?? {})) {
      const original = alias.get(page.title) ?? page.title;
      const text = page.revisions?.[0]?.slots?.main?.["*"];
      const meta = text ? parseInfobox(text) : null;
      out.set(original, meta && { ...meta, title: page.title }); // title = tên trang thật sau redirect
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  for (const t of titles) if (!out.has(t)) out.set(t, null);
  return out;
}

/**
 * Như fetchWikiMeta nhưng với tên không có trang trùng khớp thì tìm kiếm trên wiki (ví dụ l2d gọi
 * "Asuka", wiki đặt "Asuka Shikinami Langley"). Quy tắc nhận kết quả chặt để không ghép nhầm:
 *  - từ đầu tiên của tên trang phải trùng từ đầu tiên của tên cần tìm ("Mari" ≠ "Marian"),
 *  - phải là trang nhân vật chơi được (có infobox Playable Character; NPC dùng infobox khác),
 *  - tên có dấu ":" (biến thể) thì phần sau ":" phải xuất hiện trong tên trang, ngược lại tên trang không có ":".
 */
export async function fetchWikiMetaSmart(names) {
  const direct = await fetchWikiMeta(names);
  const missing = names.filter((n) => !direct.get(n));
  if (missing.length === 0) return direct;

  const candidatesByName = new Map();
  for (const name of missing) {
    const url = `${API}?${new URLSearchParams({
      action: "query",
      format: "json",
      list: "search",
      srsearch: `${name} playable Nikke`,
      srlimit: "6",
    })}`;
    const res = await fetch(url, { headers: { "User-Agent": UA } });
    const titles = res.ok ? ((await res.json()).query?.search ?? []).map((r) => r.title) : [];
    candidatesByName.set(name, titles.filter((t) => !t.includes("/")));
    await new Promise((r) => setTimeout(r, 200));
  }

  const allCandidates = [...new Set([...candidatesByName.values()].flat())];
  const candidateMeta = allCandidates.length ? await fetchWikiMeta(allCandidates) : new Map();

  const first = (s) => s.toLowerCase().split(/[\s:(]+/)[0];
  for (const name of missing) {
    const suffix = name.includes(":") ? name.split(":").slice(1).join(":").trim().toLowerCase() : null;
    const picks = (candidatesByName.get(name) ?? [])
      .filter((t) => candidateMeta.get(t) && first(t) === first(name))
      .filter((t) => (suffix ? t.toLowerCase().includes(suffix) : !t.includes(":")))
      .sort((a, b) => a.length - b.length);
    if (picks[0]) direct.set(name, candidateMeta.get(picks[0]));
  }
  return direct;
}
