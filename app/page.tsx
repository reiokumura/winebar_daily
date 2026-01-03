"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

type Wine = { id: string; name: string };
type SaleLine = { wineId: string; bottleQty: number; glassQty: number };
type LossType = "none" | "remaining_discard" | "broken";
type LossLine = { wineId: string; lossType: LossType; brokenBottles: number };
type DailyRecord = {
  dateISO: string;
  sales: Record<string, SaleLine>;
  losses: Record<string, LossLine>;
  favorites: Record<string, boolean>;
};

const pad2 = (n: number) => (n < 10 ? `0${n}` : `${n}`);
const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};
const clampInt = (n: number, min = 0, max = 999) => {
  if (Number.isNaN(n)) return min;
  return Math.max(min, Math.min(max, Math.trunc(n)));
};
const lsKey = (dateISO: string) => `winebar.daily.${dateISO}`;
const readRecord = (dateISO: string): DailyRecord | null => {
  try {
    const raw = localStorage.getItem(lsKey(dateISO));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.dateISO) return null;
    return parsed as DailyRecord;
  } catch {
    return null;
  }
};
const writeRecord = (rec: DailyRecord) => {
  localStorage.setItem(lsKey(rec.dateISO), JSON.stringify(rec));
};

// デモ用：30銘柄（本番ではサーバから取得）
const WINES: Wine[] = Array.from({ length: 30 }).map((_, i) => {
  const idx = i + 1;
  return { id: `W-${String(idx).padStart(3, "0")}`, name: `Wine ${String(idx).padStart(2, "0")}` };
});

function QtyCell({
  value,
  onChange,
  label,
}: {
  value: number;
  onChange: (v: number) => void;
  label: string;
}) {
  const [draft, setDraft] = useState<string>(value ? String(value) : "");
  const last = useRef<number>(value);

  useEffect(() => {
    if (last.current !== value) {
      last.current = value;
      setDraft(value ? String(value) : "");
    }
  }, [value]);

  const commit = () => {
    const next = clampInt(parseInt(draft || "0", 10), 0, 999);
    onChange(next);
    setDraft(next ? String(next) : "");
  };

  return (
    <div className="qty">
      <button className="qty-btn" onClick={() => onChange(clampInt(value - 1))} aria-label={`${label} -1`}>
        −
      </button>
      <input
        className="input qty-in"
        inputMode="numeric"
        pattern="[0-9]*"
        value={draft}
        placeholder="0"
        aria-label={label}
        onChange={(e) => setDraft(e.target.value.replace(/[^0-9]/g, ""))}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
      />
      <button className="qty-btn" onClick={() => onChange(clampInt(value + 1))} aria-label={`${label} +1`}>
        +
      </button>
    </div>
  );
}

export default function Page() {
  const [dateISO, setDateISO] = useState<string>(todayISO());
  const [step, setStep] = useState<"sales" | "losses">("sales");
  const [query, setQuery] = useState<string>("");
  const [onlyTouched, setOnlyTouched] = useState<boolean>(false);
  const [onlyFav, setOnlyFav] = useState<boolean>(false);

  const [record, setRecord] = useState<DailyRecord>(() => {
    const d = todayISO();
    const existing = typeof window !== "undefined" ? readRecord(d) : null;
    return (
      existing || {
        dateISO: d,
        sales: {},
        losses: {},
        favorites: {},
      }
    );
  });

  // 日付変更時に読み直し（無ければ新規）
  useEffect(() => {
    const existing = readRecord(dateISO);
    setRecord(
      existing || {
        dateISO,
        sales: {},
        losses: {},
        favorites: record.favorites || {},
      }
    );
    setStep("sales");
    setQuery("");
    setOnlyTouched(false);
    setOnlyFav(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateISO]);

  // 下書き自動保存
  useEffect(() => {
    if (record?.dateISO) writeRecord(record);
  }, [record]);

  // ロス画面に入ったら「入力済みのみ」ON（負担軽減）
  useEffect(() => {
    if (step === "losses") setOnlyTouched(true);
  }, [step]);

  const touchedIds = useMemo(() => {
    const s = new Set<string>();
    Object.entries(record.sales || {}).forEach(([id, l]) => {
      if ((l?.bottleQty || 0) > 0 || (l?.glassQty || 0) > 0) s.add(id);
    });
    Object.entries(record.losses || {}).forEach(([id, l]) => {
      if (l?.lossType && l.lossType !== "none") s.add(id);
      if ((l?.brokenBottles || 0) > 0) s.add(id);
    });
    return s;
  }, [record.sales, record.losses]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return WINES
      .filter((w) => {
        if (onlyFav && !record.favorites?.[w.id]) return false;
        if (onlyTouched && !touchedIds.has(w.id)) return false;
        if (!q) return true;
        return w.id.toLowerCase().includes(q) || w.name.toLowerCase().includes(q);
      })
      .sort((a, b) => {
        const af = record.favorites?.[a.id] ? 1 : 0;
        const bf = record.favorites?.[b.id] ? 1 : 0;
        if (af !== bf) return bf - af;
        return a.name.localeCompare(b.name);
      });
  }, [query, onlyFav, onlyTouched, record.favorites, touchedIds]);

  const totalBottle = useMemo(() => {
    return Object.values(record.sales || {}).reduce((s, l) => s + (l?.bottleQty || 0), 0);
  }, [record.sales]);

  const totalGlass = useMemo(() => {
    return Object.values(record.sales || {}).reduce((s, l) => s + (l?.glassQty || 0), 0);
  }, [record.sales]);

  const upsertSale = (wineId: string, patch: Partial<SaleLine>) => {
    setRecord((prev) => {
      const cur = prev.sales?.[wineId] || { wineId, bottleQty: 0, glassQty: 0 };
      const next: SaleLine = {
        wineId,
        bottleQty: clampInt(patch.bottleQty ?? cur.bottleQty),
        glassQty: clampInt(patch.glassQty ?? cur.glassQty),
      };
      return { ...prev, sales: { ...(prev.sales || {}), [wineId]: next } };
    });
  };

  const upsertLoss = (wineId: string, patch: Partial<LossLine>) => {
    setRecord((prev) => {
      const cur = prev.losses?.[wineId] || { wineId, lossType: "none" as LossType, brokenBottles: 0 };
      const next: LossLine = {
        wineId,
        lossType: (patch.lossType ?? cur.lossType) as LossType,
        brokenBottles: clampInt(patch.brokenBottles ?? cur.brokenBottles),
      };
      return { ...prev, losses: { ...(prev.losses || {}), [wineId]: next } };
    });
  };

  const toggleFav = (wineId: string) => {
    setRecord((prev) => {
      const favorites = { ...(prev.favorites || {}) };
      favorites[wineId] = !favorites[wineId];
      return { ...prev, favorites };
    });
  };

  const resetDay = () => {
    setRecord({ dateISO, sales: {}, losses: {}, favorites: record.favorites || {} });
    setStep("sales");
  };

  const saveNow = () => writeRecord(record);

  return (
    <>
      <div className="topbar">
        <div className="topbar-inner">
          <span className={`badge ${step === "sales" ? "on" : ""}`}>日次売上</span>
          <span className={`badge ${step === "losses" ? "on" : ""}`}>日次ロス</span>

          <div className="spacer" />

          <input className="input" type="date" value={dateISO} onChange={(e) => setDateISO(e.target.value)} />

          <button className="btn" onClick={saveNow}>
            下書き保存
          </button>

          <button className="btn" onClick={() => setStep("sales")} disabled={step === "sales"}>
            戻る
          </button>

          <button className="btn primary" onClick={() => setStep(step === "sales" ? "losses" : "sales")}>
            {step === "sales" ? "次へ（ロス入力）" : "売上へ戻る"}
          </button>
        </div>
      </div>

      <div className="container">
        <div className="card">
          <div className="card-h">
            <h1 className="card-t">{step === "sales" ? "日次売上入力" : "日次ロス入力"}</h1>
            <div className="card-sub">
              {step === "sales"
                ? "30銘柄でも迷わない：検索・お気に入り・±入力で高速に。"
                : "ロスは“売上入力した銘柄だけ”に絞り込むと速い（デフォルトON）。"}
            </div>
          </div>

          <div className="card-c">
            <div className="controls">
              <input
                className="input"
                style={{ minWidth: 240, flex: 1 }}
                placeholder="検索（Wine ID / ワイン名）"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />

              <label className="row" style={{ color: "var(--sub)", fontSize: 13 }}>
                <input type="checkbox" checked={onlyTouched} onChange={(e) => setOnlyTouched(e.target.checked)} />
                入力済みのみ
              </label>

              <label className="row" style={{ color: "var(--sub)", fontSize: 13 }}>
                <input type="checkbox" checked={onlyFav} onChange={(e) => setOnlyFav(e.target.checked)} />
                お気に入りのみ
              </label>

              <button className="btn" onClick={resetDay}>
                当日入力をリセット
              </button>
            </div>

            {step === "sales" ? (
              <div className="kpis">
                <div className="kpi">
                  <div className="k">ボトル合計</div>
                  <div className="v">{totalBottle}</div>
                </div>
                <div className="kpi">
                  <div className="k">グラス合計</div>
                  <div className="v">{totalGlass}</div>
                </div>
                <div className="kpi" style={{ gridColumn: "span 6" }}>
                  <div className="k">コツ</div>
                  <div className="v" style={{ fontSize: 14, fontWeight: 600, color: "var(--sub)" }}>
                    まず検索で当日動いた銘柄を絞る → ±で入力が最速
                  </div>
                </div>
              </div>
            ) : (
              <div className="kpis">
                <div className="kpi">
                  <div className="k">対象日</div>
                  <div className="v" style={{ fontSize: 16 }}>
                    {dateISO}
                  </div>
                </div>
                <div className="kpi">
                  <div className="k">表示中</div>
                  <div className="v">{filtered.length}銘柄</div>
                </div>
                <div className="kpi" style={{ gridColumn: "span 6" }}>
                  <div className="k">推奨</div>
                  <div className="v" style={{ fontSize: 14, fontWeight: 600, color: "var(--sub)" }}>
                    売上入力のある銘柄だけ「残量廃棄」or「破損」を入れる
                  </div>
                </div>
              </div>
            )}

            <div className="table">
              <div className="th">
                <div>ワイン</div>
                {step === "sales" ? (
                  <>
                    <div style={{ textAlign: "center" }}>ボトル</div>
                    <div style={{ textAlign: "center" }}>グラス</div>
                  </>
                ) : (
                  <>
                    <div style={{ textAlign: "center" }}>ロス種別</div>
                    <div style={{ textAlign: "center" }}>破損本数</div>
                  </>
                )}
              </div>

              {filtered.map((w) => {
                const isFav = !!record.favorites?.[w.id];
                const sale = record.sales?.[w.id] || { wineId: w.id, bottleQty: 0, glassQty: 0 };
                const loss = record.losses?.[w.id] || { wineId: w.id, lossType: "none" as LossType, brokenBottles: 0 };

                return (
                  <div key={w.id} className="tr">
                    <div className="wine">
                      <div className={`star ${isFav ? "on" : ""}`} onClick={() => toggleFav(w.id)} title="お気に入り">
                        {isFav ? "★" : "☆"}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div className="name">{w.name}</div>
                        <div className="id">{w.id}</div>
                      </div>
                    </div>

                    {step === "sales" ? (
                      <>
                        <div className="cell">
                          <QtyCell
                            value={sale.bottleQty}
                            onChange={(v) => upsertSale(w.id, { bottleQty: v })}
                            label={`${w.name} ボトル`}
                          />
                        </div>
                        <div className="cell">
                          <QtyCell
                            value={sale.glassQty}
                            onChange={(v) => upsertSale(w.id, { glassQty: v })}
                            label={`${w.name} グラス`}
                          />
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="cell">
                          <select
                            className="select"
                            value={loss.lossType}
                            onChange={(e) => upsertLoss(w.id, { lossType: e.target.value as LossType })}
                          >
                            <option value="none">なし</option>
                            <option value="remaining_discard">残量廃棄</option>
                            <option value="broken">破損</option>
                          </select>
                        </div>
                        <div className="cell">
                          <QtyCell
                            value={loss.brokenBottles}
                            onChange={(v) => upsertLoss(w.id, { brokenBottles: v })}
                            label={`${w.name} 破損本数`}
                          />
                        </div>
                      </>
                    )}
                  </div>
                );
              })}

              {filtered.length === 0 && (
                <div style={{ padding: 18, color: "var(--sub)", textAlign: "center" }}>
                  該当なし。検索条件を変えてください。
                </div>
              )}
            </div>

            <div className="note">
              ※この版は「まず動く」段階のため、入力は各端末内に保存されます（共有は次の工程で対応）。
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
