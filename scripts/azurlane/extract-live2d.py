"""
Tách mô hình Live2D của Azur Lane từ các bundle Unity (đã tải bằng azlassets) ra thư mục model chuẩn của Cubism, dùng được với mọi runtime Cubism:

  public/assets/azurlane/<tên>/
    <tên>.moc3             dữ liệu mô hình (lấy từ CubismMoc)
    texture_00.png ...     texture (thứ tự = chỉ số texture trong moc3)
    <tên>.physics3.json    vật lý
    motions/<clip>.motion3.json   mỗi AnimationClip của Unity (idle, touch_head, login...) chuyển thành motion3
    <tên>.model3.json      khai báo: moc, texture, vật lý, nhóm motion (mỗi clip một nhóm cùng tên), vùng chạm (TouchHead/Body/Special)
    info.json              tóm tắt (số tham số, thời lượng, loop từng motion)

Bundle là prefab "Cubism SDK for Unity": tham số là các GameObject dưới "Parameters/", AnimationClip lưu ở dạng "muscle clip" nén
(streamed + dense + constant) nên phải giải mã rồi đổi đường cong Hermite của Unity sang Bezier của Cubism. Hai loại đường cong được giữ lại:
tham số (Parameters/<id>.Value -> Target "Parameter") và độ mờ của Part (Parts/<id>.Opacity -> Target "PartOpacity"; các skin dạng cảnh dùng nó để
bật/tắt cả nhóm lớp, ví dụ nền đen che khung).

  tools/azl-venv/bin/python scripts/azurlane/extract-live2d.py <thư mục bundle live2d> <thư mục ra> [tên ...] [--png]

Texture ghi dạng WebP (chất lượng 92, alpha không mất mát); thêm --png để giữ PNG gốc.

Chỉ ĐỌC bundle, không chạy mã nào trong đó (UnityPy chỉ phân tích dữ liệu).
"""
import json
import math
import struct
import sys
import zlib
from pathlib import Path

import UnityPy


# ───────── giải mã animation ─────────
def decode_streamed(words):
    """StreamedClip: dãy uint32 -> [(thời gian, [(chỉ số đường cong, (a, b, c, d))])]; giá trị(t) = a t^3 + b t^2 + c t + d tính từ thời điểm khoá."""
    raw = struct.pack(f"<{len(words)}I", *words)
    pos, frames = 0, []
    while pos < len(raw):
        (t,) = struct.unpack_from("<f", raw, pos)
        (n,) = struct.unpack_from("<i", raw, pos + 4)
        pos += 8
        keys = []
        for _ in range(n):
            (idx,) = struct.unpack_from("<i", raw, pos)
            coeff = struct.unpack_from("<4f", raw, pos + 4)
            pos += 20
            keys.append((idx, coeff))
        frames.append((t, keys))
    return frames


def streamed_curves(frames):
    """-> {chỉ số: [khoá]}, khoá = dict(t, v, out, inn, stepped). Độ dốc vào lấy từ đạo hàm của đoạn Hermite ngay trước khoá đó."""
    curves = {}
    for t, keys in frames:
        if not math.isfinite(t):
            continue  # khung cuối là mốc kết thúc
        for idx, (a, b, c, d) in keys:
            prev = curves.setdefault(idx, [])
            k = {"t": t, "v": d, "out": c, "inn": 0.0, "stepped": a == 0 and b == 0 and c == 0, "coef": (a, b, c, d)}
            if prev:
                p = prev[-1]
                dx = max(t - p["t"], 1e-4)
                pa, pb, pc, _ = p["coef"]
                k["inn"] = 3 * pa * dx * dx + 2 * pb * dx + pc
            prev.append(k)
    return curves


def to_segments(keys, duration):
    """Khoá Unity -> mảng Segments của Cubism: [t0, v0, kiểu, ...]; kiểu 0 tuyến tính, 1 Bezier, 2 bậc thang."""
    segs = [keys[0]["t"], keys[0]["v"]]
    npts = 1
    nseg = 0
    for p, k in zip(keys, keys[1:]):
        dt = max(k["t"] - p["t"], 1e-6)
        if p["stepped"]:
            segs += [2, k["t"], k["v"]]
            npts += 1
        else:
            lin = (k["v"] - p["v"]) / dt
            if abs(p["out"] - lin) < 1e-4 and abs(k["inn"] - lin) < 1e-4:
                segs += [0, k["t"], k["v"]]
                npts += 1
            else:
                segs += [1, p["t"] + dt / 3, p["v"] + p["out"] * dt / 3, k["t"] - dt / 3, k["v"] - k["inn"] * dt / 3, k["t"], k["v"]]
                npts += 3
        nseg += 1
    return segs, nseg, npts


ATTR_VALUE = zlib.crc32(b"Value")  # CubismParameter.Value
ATTR_OPACITY = zlib.crc32(b"Opacity")  # CubismPart.Opacity


def clip_to_motion3(t, names):
    """AnimationClip (typetree) -> dict motion3.json. `names`: {hash đường dẫn: ("Parameter" | "PartOpacity", id)}."""
    mc = t["m_MuscleClip"]
    clip = mc["m_Clip"]["data"]
    duration = float(mc["m_StopTime"]) - float(mc["m_StartTime"])
    sc, dc, cc = clip["m_StreamedClip"], clip["m_DenseClip"], clip["m_ConstantClip"]
    # Mỗi binding là một đường cong (đều là Parameters/<id>.Value), thứ tự: streamed, dense, constant.
    bindings = t["m_ClipBindingConstant"]["genericBindings"]
    ids = []
    for b in bindings:
        # Chỉ lấy đúng loại: tham số (thuộc tính Value) và độ mờ của Part (thuộc tính Opacity); các loại khác (bật/tắt GameObject...) bỏ qua.
        tgt = names.get(b["path"])
        ok = tgt and ((tgt[0] == "Parameter" and b["attribute"] == ATTR_VALUE) or (tgt[0] == "PartOpacity" and b["attribute"] == ATTR_OPACITY))
        ids.append(tgt if ok else None)
    total = sc["curveCount"] + dc["m_CurveCount"] + len(cc["data"])
    if total != len(bindings):
        raise ValueError(f"số đường cong ({total}) khác số binding ({len(bindings)})")

    curves = []
    # streamed
    sk = streamed_curves(decode_streamed(sc["data"]))
    for idx, keys in sk.items():
        if idx < len(ids) and ids[idx]:
            segs, ns, npts = to_segments(keys, duration)
            curves.append((ids[idx], segs, ns, npts))
    # dense: lấy mẫu đều theo sampleRate, nối bằng đoạn tuyến tính
    nd = dc["m_CurveCount"]
    if nd:
        rate, begin, frames_n, arr = dc["m_SampleRate"], dc["m_BeginTime"], dc["m_FrameCount"], dc["m_SampleArray"]
        for c in range(nd):
            idx = sc["curveCount"] + c
            if not ids[idx]:
                continue
            ks = [{"t": begin + f / rate, "v": arr[f * nd + c], "out": 0, "inn": 0, "stepped": False, "coef": (0, 0, 0, 0)} for f in range(frames_n)]
            segs = [ks[0]["t"], ks[0]["v"]]
            for k in ks[1:]:
                segs += [0, k["t"], k["v"]]
            curves.append((ids[idx], segs, len(ks) - 1, len(ks)))
    # constant: giá trị giữ nguyên suốt clip
    for c, v in enumerate(cc["data"]):
        idx = sc["curveCount"] + nd + c
        if ids[idx]:
            curves.append((ids[idx], [0, v, 0, duration, v], 1, 2))

    out_curves = [{"Target": i[0], "Id": i[1], "Segments": [round(x, 5) if isinstance(x, float) else x for x in s]} for i, s, _, _ in curves]
    return {
        "Version": 3,
        "Meta": {
            "Duration": round(duration, 4),
            "Fps": 30.0,
            "Loop": bool(mc.get("m_LoopTime")),
            "AreBeziersRestricted": False,
            "CurveCount": len(curves),
            "TotalSegmentCount": sum(c[2] for c in curves),
            "TotalPointCount": sum(c[3] for c in curves),
            "UserDataCount": 0,
            "TotalUserDataSize": 0,
        },
        "Curves": out_curves,
    }


# ───────── tách một bundle ─────────
def extract(bundle: Path, out: Path):
    env = UnityPy.load(str(bundle))
    gos, trs, objs = {}, {}, {}
    for o in env.objects:
        objs[o.path_id] = o
        if o.type.name == "GameObject":
            gos[o.path_id] = o.read()
        elif o.type.name == "Transform":
            trs[o.path_id] = o.read()

    def transform_of(g):
        for c in g.m_Components:
            pid = c.m_PathID if hasattr(c, "m_PathID") else c.component.m_PathID
            if pid in trs:
                return trs[pid]

    def rel_path(g):
        parts = [g.m_Name]
        tp = transform_of(g)
        while tp and tp.m_Father.m_PathID in trs:
            tp = trs[tp.m_Father.m_PathID]
            parts.append(gos[tp.m_GameObject.m_PathID].m_Name)
        parts.reverse()
        return "/".join(parts[1:])  # bỏ tên gốc: đường dẫn animation tính từ gốc

    paths = {g.m_Name: rel_path(g) for g in gos.values()}
    hash_to_param = {}
    param_ids = []
    for g in gos.values():
        p = rel_path(g)
        if p.startswith("Parameters/"):
            hash_to_param[zlib.crc32(p.encode())] = ("Parameter", g.m_Name)
            param_ids.append(g.m_Name)
        elif p.startswith("Parts/"):
            hash_to_param[zlib.crc32(p.encode())] = ("PartOpacity", g.m_Name)
    drawable_ids = {g.m_Name for g in gos.values() if rel_path(g).startswith("Drawables/")}

    name = bundle.name
    (out / "motions").mkdir(parents=True, exist_ok=True)

    moc = None
    textures, physics, motions = {}, None, {}
    for o in env.objects:
        tn = o.type.name
        if tn == "MonoBehaviour":
            try:
                if o.read().m_Script.read().m_ClassName == "CubismMoc":
                    moc = bytes(o.read_typetree()["_bytes"])
            except Exception:
                pass
        elif tn == "Texture2D":
            d = o.read()
            textures[d.m_Name] = d.image
        elif tn == "TextAsset":
            d = o.read_typetree()
            if d["m_Name"].endswith(".physics3"):
                physics = d["m_Script"].encode("utf-8", "surrogateescape")
        elif tn == "AnimationClip":
            t = o.read_typetree()
            motions[t["m_Name"]] = clip_to_motion3(t, hash_to_param)
    if not moc or not moc.startswith(b"MOC3"):
        raise ValueError("không có dữ liệu moc3")

    (out / f"{name}.moc3").write_bytes(moc)
    tex_files = []
    for tname in sorted(textures):
        if KEEP_PNG:
            f = f"{tname}.png"
            textures[tname].save(out / f)
        else:
            # WebP chỉ còn khoảng 28% dung lượng PNG; alpha không mất mát và giữ nguyên RGB dưới vùng trong suốt (exact) để mép không bị viền.
            f = f"{tname}.webp"
            textures[tname].convert("RGBA").save(out / f, "WEBP", quality=92, method=4, alpha_quality=100, exact=True)
            (out / f"{tname}.png").unlink(missing_ok=True)
        tex_files.append(f)
    physics_file = None
    if physics:
        json.loads(physics)  # kiểm tra hợp lệ
        physics_file = f"{name}.physics3.json"
        (out / physics_file).write_bytes(physics)
    info_motions = {}
    for mname, m in sorted(motions.items()):
        (out / "motions" / f"{mname}.motion3.json").write_text(json.dumps(m, separators=(",", ":")))
        info_motions[mname] = {"duration": m["Meta"]["Duration"], "loop": m["Meta"]["Loop"], "curves": m["Meta"]["CurveCount"]}

    hit = [{"Id": n, "Name": n} for n in ("TouchHead", "TouchBody", "TouchSpecial") if n in drawable_ids]
    groups = []
    eyes = [i for i in ("ParamEyeLOpen", "ParamEyeROpen") if i in param_ids]
    if eyes:
        groups.append({"Target": "Parameter", "Name": "EyeBlink", "Ids": eyes})
    mouth = [i for i in ("ParamMouthOpenY",) if i in param_ids]
    if mouth:
        groups.append({"Target": "Parameter", "Name": "LipSync", "Ids": mouth})
    model3 = {
        "Version": 3,
        "FileReferences": {
            "Moc": f"{name}.moc3",
            "Textures": tex_files,
            **({"Physics": physics_file} if physics_file else {}),
            "Motions": {m: [{"File": f"motions/{m}.motion3.json"}] for m in sorted(motions)},
        },
        "Groups": groups,
        "HitAreas": hit,
    }
    (out / f"{name}.model3.json").write_text(json.dumps(model3, indent=2))
    (out / "info.json").write_text(
        json.dumps({"name": name, "moc3Version": moc[4], "parameters": len(param_ids), "textures": len(tex_files), "motions": info_motions, "hitAreas": [h["Id"] for h in hit]}, indent=2)
    )
    return info_motions


KEEP_PNG = "--png" in sys.argv

if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if a != "--png"]
    src, dst = Path(args[0]), Path(args[1])
    only = set(args[2:])
    for b in sorted(p for p in src.iterdir() if p.is_file()):
        if only and b.name not in only:
            continue
        try:
            m = extract(b, dst / b.name)
            print(f"OK   {b.name:18s} {len(m)} motion: {', '.join(m)}")
        except Exception as e:  # một bundle lỗi không làm hỏng cả loạt
            print(f"LỖI  {b.name}: {type(e).__name__}: {e}")
