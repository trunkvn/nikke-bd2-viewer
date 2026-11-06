"use client";

import Image from "next/image";
import { useState } from "react";
import type { CharacterSkills, RichLine, Skill, WeaponInfo } from "@/data/types";
import { Panel } from "./ui/Panel";

const MAX_LEVEL = 10;

/** Màu đánh dấu trong mô tả wiki: cyan = hiệu ứng, orange = chỉ số quan trọng. */
const RUN_COLOR: Record<string, string> = {
  cyan: "text-sky-300",
  orange: "text-amber-300",
};

const KIND_LABEL = { passive: "Bị động", active: "Chủ động", burst: "Burst" } as const;

/**
 * Kỹ năng của nhân vật: vũ khí + kỹ năng 1, 2 và Burst. Một bộ chọn cấp dùng chung cho cả ba kỹ năng,
 * mô tả ghi chỉ số ở cấp 1 còn dòng "Cấp N" bên dưới hiện giá trị chính ở cấp đang chọn.
 */
export function SkillList({ skills }: { skills: CharacterSkills }) {
  const [level, setLevel] = useState(MAX_LEVEL);
  const hasLevels = skills.list.some((s) => s.levels.length > 0);

  return (
    <div className="space-y-3">
      {skills.weapon && <Weapon weapon={skills.weapon} />}

      {hasLevels && (
        <div role="radiogroup" aria-label="Cấp kỹ năng" className="flex items-center gap-2">
          <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.2em] text-white/40">Cấp</span>
          <div className="grid flex-1 grid-cols-10 gap-1">
            {Array.from({ length: MAX_LEVEL }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={n === level}
                aria-label={`Cấp ${n}`}
                onClick={() => setLevel(n)}
                className={`clip-chamfer-sm h-7 font-mono text-[11px] outline-none transition focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent ${
                  n === level ? "bg-accent text-black" : "bg-white/[0.07] text-white/60 hover:bg-white/[0.14] hover:text-white"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      )}

      {skills.list.map((skill, i) => (
        <SkillCard key={i} skill={skill} level={level} burstStage={skills.burstStage} />
      ))}
    </div>
  );
}

function SkillCard({ skill, level, burstStage }: { skill: Skill; level: number; burstStage?: string }) {
  const value = skill.levels[level - 1];
  const isBurst = skill.kind === "burst";
  return (
    <Panel cut="sm" innerClassName="p-3">
      <div className="flex items-start gap-3">
        {skill.icon ? (
          <Image src={skill.icon} alt="" width={48} height={48} className="h-12 w-12 shrink-0" />
        ) : (
          <span aria-hidden className="h-12 w-12 shrink-0 bg-white/[0.06]" />
        )}
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-base font-semibold leading-tight tracking-wide">{skill.name}</h3>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em]">
            <span
              className={`clip-chamfer-sm px-2 py-0.5 ${isBurst ? "bg-accent text-black" : "bg-white/10 text-white/70"}`}
            >
              {isBurst && burstStage ? `Burst ${burstStage}` : KIND_LABEL[skill.kind]}
            </span>
            {skill.cooldown != null && <span className="text-white/50">Hồi chiêu {skill.cooldown}s</span>}
          </div>
        </div>
      </div>

      <Description lines={skill.desc} className="mt-3" />

      {value && (
        <div className="mt-3 flex items-baseline justify-between gap-3 border-t border-white/10 pt-2.5">
          <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.2em] text-white/40">Cấp {level}</span>
          <span className="text-right font-display text-[15px] font-semibold tabular-nums text-accent">{value}</span>
        </div>
      )}
    </Panel>
  );
}

function Weapon({ weapon }: { weapon: WeaponInfo }) {
  const stats = [
    { label: "Băng đạn", value: weapon.ammo },
    { label: "Nạp đạn", value: weapon.reload != null ? `${weapon.reload}s` : undefined },
    { label: "Kiểm soát", value: weapon.control },
  ].filter((s) => s.value != null && s.value !== "");
  return (
    <Panel cut="sm" innerClassName="p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/40">Vũ khí</div>
          <h3 className="truncate font-display text-base font-semibold tracking-wide">{weapon.name ?? weapon.type}</h3>
        </div>
        {weapon.type && (
          <span className="clip-chamfer-sm shrink-0 bg-white/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-white/70">
            {weapon.type}
          </span>
        )}
      </div>
      {stats.length > 0 && (
        <dl className="mt-2.5 grid grid-cols-3 gap-2">
          {stats.map((s) => (
            <div key={s.label}>
              <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/40">{s.label}</dt>
              <dd className="font-display text-sm font-semibold tabular-nums">{s.value}</dd>
            </div>
          ))}
        </dl>
      )}
      <Description lines={weapon.desc} className="mt-2.5" />
    </Panel>
  );
}

/** Dòng bắt đầu bằng "■" là điều kiện/đối tượng (mờ hơn); các dòng còn lại là hiệu ứng, thụt vào một chút. */
function Description({ lines, className = "" }: { lines: RichLine[]; className?: string }) {
  if (lines.length === 0) return null;
  return (
    <div className={`space-y-1 text-[13px] leading-snug ${className}`}>
      {lines.map((line, i) => {
        const header = line[0]?.t.startsWith("■");
        return (
          <p key={i} className={header ? "mt-2 text-white/60 first:mt-0" : "pl-4 text-white/85"}>
            {line.map((run, j) => (
              <span key={j} className={run.c ? RUN_COLOR[run.c] : undefined}>
                {run.t}
              </span>
            ))}
          </p>
        );
      })}
    </div>
  );
}
