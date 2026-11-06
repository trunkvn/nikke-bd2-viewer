/**
 * Đọc mẫu {{Skill table}} trên trang nhân vật của wiki NIKKE (Fandom, CC BY-SA): thông số vũ khí, 3 kỹ năng
 * (kỹ năng 1, kỹ năng 2, Burst) với mô tả và giá trị theo cấp 1–10.
 */

/** Vị trí dấu "}}" đóng cho "{{" mở ở `from` (tính cả lồng nhau), hoặc -1. */
function matchingClose(s, from) {
  let depth = 0;
  for (let i = from; i < s.length - 1; i++) {
    if (s[i] === "{" && s[i + 1] === "{") {
      depth++;
      i++;
    } else if (s[i] === "}" && s[i + 1] === "}") {
      depth--;
      i++;
      if (depth === 0) return i - 1;
    }
  }
  return -1;
}

/** Tách tham số của một mẫu theo "|" ở cấp ngoài cùng (bỏ qua "|" trong {{...}} và [[...]] lồng bên trong). */
function splitArgs(inner) {
  const out = [];
  let depth = 0;
  let cur = "";
  for (let i = 0; i < inner.length; i++) {
    const two = inner.slice(i, i + 2);
    if (two === "{{" || two === "[[") {
      depth++;
      cur += two;
      i++;
    } else if (two === "}}" || two === "]]") {
      depth--;
      cur += two;
      i++;
    } else if (inner[i] === "|" && depth === 0) {
      out.push(cur);
      cur = "";
    } else cur += inner[i];
  }
  out.push(cur);
  return out;
}

/** Wikitext → các đoạn chữ có màu; "\n" đánh dấu chỗ xuống dòng. */
function parseRuns(s, color) {
  const runs = [];
  const push = (t, c) => {
    if (!t) return;
    const last = runs[runs.length - 1];
    if (last && last.c === c) last.t += t;
    else runs.push(c ? { t, c } : { t });
  };
  let i = 0;
  let buf = "";
  while (i < s.length) {
    if (s[i] === "{" && s[i + 1] === "{") {
      const end = matchingClose(s, i);
      if (end === -1) {
        buf += s[i++];
        continue;
      }
      push(buf, color);
      buf = "";
      const args = splitArgs(s.slice(i + 2, end));
      const name = args[0].trim().toLowerCase();
      if (name === "color" && args.length >= 3) {
        const text = args.slice(2).join("|");
        for (const r of parseRuns(text, args[1].trim().toLowerCase())) push(r.t, r.c);
      } else if (args.length >= 2) {
        // Mẫu khác (tooltip...): lấy tham số cuối làm chữ hiển thị.
        for (const r of parseRuns(args[args.length - 1], color)) push(r.t, r.c);
      }
      i = end + 2;
    } else {
      buf += s[i++];
    }
  }
  push(buf, color);
  return runs;
}

/** Mô tả kỹ năng → các dòng; mỗi dòng là mảng đoạn chữ. */
export function parseRich(raw) {
  if (!raw) return [];
  const text = raw
    .replace(/<ref[^>]*>[\s\S]*?<\/ref>|<ref[^>]*\/>/gi, "")
    .replace(/<br[^>]*>/gi, "\n") // gồm cả bản viết lệch trên wiki như "<br / >"
    .replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, "$1")
    .replace(/'{2,}/g, "")
    .replace(/<[^>]+>/g, "");
  const lines = [[]];
  for (const run of parseRuns(text)) {
    const parts = run.t.split("\n");
    parts.forEach((part, idx) => {
      if (idx > 0) lines.push([]);
      const t = part.replace(/[ \t]+/g, " ");
      if (t) lines[lines.length - 1].push(run.c ? { t, c: run.c } : { t });
    });
  }
  return lines
    .map((line) => {
      if (line.length) {
        line[0].t = line[0].t.replace(/^\s+/, "");
        line[line.length - 1].t = line[line.length - 1].t.replace(/\s+$/, "");
      }
      return line.filter((r) => r.t);
    })
    .filter((line) => line.length);
}

const plain = (raw) =>
  parseRich(raw)
    .map((l) => l.map((r) => r.t).join(""))
    .join(" ")
    .trim();

const num = (v) => {
  const n = parseFloat(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : undefined;
};

/**
 * @returns {{ weapon: object, list: object[] } | null}
 *   Mỗi kỹ năng có `iconFile`: tên file ảnh trên wiki (File:...), dùng để tải icon; script tải sẽ đổi nó thành `icon`.
 */
export function parseSkillTable(wikitext) {
  const start = wikitext.search(/\{\{\s*Skill table/i);
  if (start === -1) return null;
  const end = matchingClose(wikitext, start);
  if (end === -1) return null;

  // Mỗi tham số trên một dòng "|khoá = giá trị"; giá trị có thể chứa {{...}} nhưng không xuống dòng.
  const f = {};
  for (const line of wikitext.slice(start + 2, end).split("\n")) {
    const m = /^\s*\|\s*(\w+)\s*=\s*(.*)$/.exec(line);
    if (m) f[m[1].toLowerCase()] = m[2].trim();
  }

  const character = f.character ? plain(f.character) : undefined;
  const list = [];
  for (let n = 1; n <= 3; n++) {
    const name = f[`skillname${n}`] ? plain(f[`skillname${n}`]) : "";
    const desc = parseRich(f[`skilldesc${n}`]);
    if (!name && desc.length === 0) continue;
    const kind = n === 3 ? "burst" : /passive/i.test(f[`skilltype${n}`] ?? "") ? "passive" : "active";
    const iconKey = f[`skill${n}`] ? plain(f[`skill${n}`]) : "";
    const levels = [];
    for (let lv = 1; lv <= 10; lv++) {
      const v = f[n === 3 ? `blv${lv}` : `s${n}lv${lv}`];
      levels.push(v ? plain(v) : "");
    }
    list.push({
      name,
      kind,
      cooldown: num(f[`skillcd${n}`]),
      iconFile: iconKey ? (n === 3 && character ? `${character} Skill ${iconKey}.png` : `Skill ${iconKey}.png`) : undefined,
      desc,
      levels: levels.some(Boolean) ? levels : [],
    });
  }
  if (list.length === 0) return null;

  return {
    weapon: {
      name: f.weaponname ? plain(f.weaponname) : undefined,
      type: f.weapontype ? plain(f.weapontype).toUpperCase() : undefined,
      ammo: num(f.capacity),
      reload: num(f.reload),
      control: f.control ? plain(f.control) : undefined,
      desc: parseRich(f.weapondesc),
    },
    list,
  };
}
