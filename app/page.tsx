"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Search, ArrowRight, ArrowLeft, Save, RotateCcw, Star } from "lucide-react";

/**
 * Minimal, fast, mobile-first “Daily Sales → Daily Loss” input prototype.
 * - Optimized for ~30 wines: search, favorites, compact grid, big tap targets, quick +/-.
 * - Stores drafts in localStorage by date. Replace persistence with your API later.
 */

// --- Types

type Wine = {
  id: string; // Wine ID (e.g., W-001)
  name: string;
  isActive?: boolean;
};

type SaleLine = {
  wineId: string;
  bottleQty: number; // integer
  glassQty: number; // integer
};

type LossType = "none" | "remaining_discard" | "broken";

type LossLine = {
  wineId: string;
  lossType: LossType;
  brokenBottles: number; // integer
  // remaining_discard has no manual ml: in Excel it auto-calculates opened remainder.
  note?: string;
};

type DailyRecord = {
  dateISO: string; // YYYY-MM-DD
  sales: Record<string, SaleLine>;
  losses: Record<string, LossLine>;
  favorites: Record<string, boolean>;
};

// --- Helpers

const pad2 = (n: number) => (n < 10 ? `0${n}` : `${n}`);

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function clampInt(n: number, min = 0, max = 999): number {
  if (Number.isNaN(n)) return min;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

function lsKey(dateISO: string) {
  return `winebar.daily.${dateISO}`;
}

function readRecord(dateISO: string): DailyRecord | null {
  try {
    const raw = localStorage.getItem(lsKey(dateISO));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.dateISO) return null;
    return parsed as DailyRecord;
  } catch {
    return null;
  }
}

function writeRecord(rec: DailyRecord) {
  localStorage.setItem(lsKey(rec.dateISO), JSON.stringify(rec));
}

// --- Demo master (replace with API: GET /api/wines)

const DEMO_WINES: Wine[] = Array.from({ length: 30 }).map((_, i) => {
  const idx = i + 1;
  return {
    id: `W-${String(idx).padStart(3, "0")}`,
    name: `Wine ${String(idx).padStart(2, "0")}`,
    isActive: true,
  };
});

// --- UI components

function TopBar({
  step,
  dateISO,
  onDateISO,
  onBack,
  onNext,
  onSave,
  canBack,
  canNext,
  saveLabel,
}: {
  step: "sales" | "losses";
  dateISO: string;
  onDateISO: (v: string) => void;
  onBack: () => void;
  onNext: () => void;
  onSave: () => void;
  canBack: boolean;
  canNext: boolean;
  saveLabel: string;
}) {
  return (
    <div className="sticky top-0 z-30 bg-background/90 backdrop-blur border-b">
      <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
        <div className="flex items-center gap-2">
          <Badge variant={step === "sales" ? "default" : "secondary"}>日次売上</Badge>
          <Badge variant={step === "losses" ? "default" : "secondary"}>日次ロス</Badge>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-2">
            <Label className="text-sm text-muted-foreground">日付</Label>
            <Input
              type="date"
              value={dateISO}
              onChange={(e) => onDateISO(e.target.value)}
              className="w-[160px]"
            />
          </div>
          <Button variant="ghost" size="sm" onClick={onSave}>
            <Save className="h-4 w-4 mr-2" />
            {saveLabel}
          </Button>
          <Separator orientation="vertical" className="h-7" />
          <Button variant="outline" size="sm" onClick={onBack} disabled={!canBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            戻る
          </Button>
          <Button size="sm" onClick={onNext} disabled={!canNext}>
            次へ
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </div>
      <div className="sm:hidden px-4 pb-3 max-w-5xl mx-auto">
        <div className="flex items-center gap-2">
          <Label className="text-sm text-muted-foreground">日付</Label>
          <Input type="date" value={dateISO} onChange={(e) => onDateISO(e.target.value)} />
        </div>
      </div>
    </div>
  );
}

function QtyCell({
  value,
  onChange,
  ariaLabel,
  autoFocus,
}: {
  value: number;
  onChange: (next: number) => void;
  ariaLabel: string;
  autoFocus?: boolean;
}) {
  const [draft, setDraft] = useState<string>(String(value || ""));
  const lastValueRef = useRef(value);

  useEffect(() => {
    if (lastValueRef.current !== value) {
      lastValueRef.current = value;
      setDraft(value ? String(value) : "");
    }
  }, [value]);

  const commit = () => {
    const next = clampInt(parseInt(draft || "0", 10), 0, 999);
    onChange(next);
    setDraft(next ? String(next) : "");
  };

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="icon"
        className="h-9 w-9 rounded-xl"
        onClick={() => onChange(clampInt(value - 1))}
        aria-label={`${ariaLabel} -1`}
      >
        −
      </Button>
      <Input
        inputMode="numeric"
        pattern="[0-9]*"
        value={draft}
        onChange={(e) => setDraft(e.target.value.replace(/[^0-9]/g, ""))}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            (e.target as HTMLInputElement).blur();
          }
        }}
        autoFocus={autoFocus}
        aria-label={ariaLabel}
        className="w-16 text-center rounded-xl"
        placeholder="0"
      />
      <Button
        variant="outline"
        size="icon"
        className="h-9 w-9 rounded-xl"
        onClick={() => onChange(clampInt(value + 1))}
        aria-label={`${ariaLabel} +1`}
      >
        +
      </Button>
    </div>
  );
}

function WineRowHeader({
  wine,
  isFavorite,
  onToggleFavorite,
}: {
  wine: Wine;
  isFavorite: boolean;
  onToggleFavorite: () => void;
}) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-2">
        <button
          onClick={onToggleFavorite}
          className="shrink-0 rounded-lg p-1.5 hover:bg-muted"
          aria-label={isFavorite ? "お気に入り解除" : "お気に入り"}
        >
          <Star className={`h-4 w-4 ${isFavorite ? "fill-current" : ""}`} />
        </button>
        <div className="min-w-0">
          <div className="truncate font-medium">{wine.name}</div>
          <div className="truncate text-xs text-muted-foreground">{wine.id}</div>
        </div>
      </div>
    </div>
  );
}

// --- Main App

export default function WineBarDailyOpsPrototype() {
  const [dateISO, setDateISO] = useState<string>(todayISO());
  const [step, setStep] = useState<"sales" | "losses">("sales");
  const [query, setQuery] = useState<string>("");
  const [showOnlyTouched, setShowOnlyTouched] = useState<boolean>(false);
  const [showOnlyFavorites, setShowOnlyFavorites] = useState<boolean>(false);

  const wines = useMemo(() => DEMO_WINES.filter((w) => w.isActive !== false), []);

  const [record, setRecord] = useState<DailyRecord>(() => {
    const existing = typeof window !== "undefined" ? readRecord(todayISO()) : null;
    if (existing) return existing;
    return {
      dateISO: todayISO(),
      sales: {},
      losses: {},
      favorites: {},
    };
  });

  // Reload when date changes
  useEffect(() => {
    const existing = readRecord(dateISO);
    if (existing) {
      setRecord(existing);
    } else {
      setRecord({
        dateISO,
        sales: {},
        losses: {},
        favorites: record.favorites ?? {},
      });
    }
    setStep("sales");
    setQuery("");
    setShowOnlyTouched(false);
  }, [dateISO]);

  // Persist draft
  useEffect(() => {
    if (record?.dateISO) writeRecord(record);
  }, [record]);

  const touchedWineIds = useMemo(() => {
    const s = new Set<string>();
    for (const [id, line] of Object.entries(record.sales || {})) {
      if ((line?.bottleQty || 0) > 0 || (line?.glassQty || 0) > 0) s.add(id);
    }
    for (const [id, line] of Object.entries(record.losses || {})) {
      if (line?.lossType && line.lossType !== "none") s.add(id);
      if ((line?.brokenBottles || 0) > 0) s.add(id);
    }
    return s;
  }, [record.sales, record.losses]);

  const filteredWines = useMemo(() => {
    const q = query.trim().toLowerCase();
    return wines
      .filter((w) => {
        if (showOnlyFavorites && !record.favorites?.[w.id]) return false;
        if (showOnlyTouched && !touchedWineIds.has(w.id)) return false;
        if (!q) return true;
        return w.id.toLowerCase().includes(q) || w.name.toLowerCase().includes(q);
      })
      .sort((a, b) => {
        // Favorites first, then name
        const af = record.favorites?.[a.id] ? 1 : 0;
        const bf = record.favorites?.[b.id] ? 1 : 0;
        if (af !== bf) return bf - af;
        return a.name.localeCompare(b.name);
      });
  }, [wines, query, showOnlyTouched, showOnlyFavorites, record.favorites, touchedWineIds]);

  const totalBottle = useMemo(() => {
    let sum = 0;
    for (const l of Object.values(record.sales || {})) sum += l?.bottleQty || 0;
    return sum;
  }, [record.sales]);

  const totalGlass = useMemo(() => {
    let sum = 0;
    for (const l of Object.values(record.sales || {})) sum += l?.glassQty || 0;
    return sum;
  }, [record.sales]);

  const salesComplete = true; // keep permissive: allow next even with zeros
  const lossesComplete = true;

  const saveLabel = step === "sales" ? "下書き保存" : "下書き保存";

  const resetDay = () => {
    setRecord({ dateISO, sales: {}, losses: {}, favorites: record.favorites ?? {} });
    setStep("sales");
  };

  const upsertSale = (wineId: string, patch: Partial<SaleLine>) => {
    setRecord((prev) => {
      const cur = prev.sales?.[wineId] || { wineId, bottleQty: 0, glassQty: 0 };
      const next: SaleLine = {
        wineId,
        bottleQty: clampInt(patch.bottleQty ?? cur.bottleQty),
        glassQty: clampInt(patch.glassQty ?? cur.glassQty),
      };
      const sales = { ...(prev.sales || {}), [wineId]: next };
      return { ...prev, sales };
    });
  };

  const upsertLoss = (wineId: string, patch: Partial<LossLine>) => {
    setRecord((prev) => {
      const cur =
        prev.losses?.[wineId] || ({ wineId, lossType: "none", brokenBottles: 0 } as LossLine);
      const next: LossLine = {
        wineId,
        lossType: (patch.lossType ?? cur.lossType) as LossType,
        brokenBottles: clampInt(patch.brokenBottles ?? cur.brokenBottles),
        note: patch.note ?? cur.note,
      };
      const losses = { ...(prev.losses || {}), [wineId]: next };
      return { ...prev, losses };
    });
  };

  const toggleFavorite = (wineId: string) => {
    setRecord((prev) => {
      const favorites = { ...(prev.favorites || {}) };
      favorites[wineId] = !favorites[wineId];
      return { ...prev, favorites };
    });
  };

  // Loss input should also show the full list (same as Sales).
// Do not auto-enable the "touched only" filter; users can toggle it if needed.
useEffect(() => {
  // no-op
}, [step]);

  return (
    <div className="min-h-screen bg-background">
      <TopBar
        step={step}
        dateISO={dateISO}
        onDateISO={setDateISO}
        onBack={() => setStep("sales")}
        onNext={() => setStep(step === "sales" ? "losses" : "sales")}
        onSave={() => writeRecord(record)}
        canBack={step === "losses"}
        canNext={step === "sales" ? salesComplete : lossesComplete}
        saveLabel={saveLabel}
      />

      <div className="max-w-5xl mx-auto px-4 py-6 space-y-4">
        <Card className="rounded-2xl shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-start gap-3">
              <div className="min-w-0">
                <CardTitle className="text-xl">
                  {step === "sales" ? "日次売上入力" : "日次ロス入力"}
                </CardTitle>
                <div className="text-sm text-muted-foreground mt-1">
                  {step === "sales"
                  ? "各ワインの販売数（ボトル・グラス）を入力。30銘柄でも迷わない導線にしています。"
                  : "ロス入力も売上入力と同じく全銘柄一覧で入力できます。必要なら『入力済みのみ』で絞り込み。"}
                </div>
              </div>

              <div className="ml-auto flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={resetDay}>
                  <RotateCcw className="h-4 w-4 mr-2" />
                  当日入力をリセット
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Controls */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="検索（Wine ID / ワイン名）"
                  className="pl-9 rounded-2xl"
                />
              </div>

              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={showOnlyTouched} onCheckedChange={(v) => setShowOnlyTouched(!!v)} />
                  入力済みのみ
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={showOnlyFavorites}
                    onCheckedChange={(v) => setShowOnlyFavorites(!!v)}
                  />
                  お気に入りのみ
                </label>
              </div>
            </div>

            {/* KPIs */}
            {step === "sales" ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Card className="rounded-2xl">
                  <CardContent className="p-4">
                    <div className="text-xs text-muted-foreground">ボトル合計</div>
                    <div className="text-2xl font-semibold mt-1">{totalBottle}</div>
                  </CardContent>
                </Card>
                <Card className="rounded-2xl">
                  <CardContent className="p-4">
                    <div className="text-xs text-muted-foreground">グラス合計</div>
                    <div className="text-2xl font-semibold mt-1">{totalGlass}</div>
                  </CardContent>
                </Card>
                <Card className="rounded-2xl col-span-2">
                  <CardContent className="p-4">
                    <div className="text-xs text-muted-foreground">入力のコツ</div>
                    <div className="text-sm mt-1">
                      まず検索で当日よく動く銘柄を絞り込み → +/- で数を入れると最速です。
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Card className="rounded-2xl">
                  <CardContent className="p-4">
                    <div className="text-xs text-muted-foreground">対象日</div>
                    <div className="text-lg font-semibold mt-1">{dateISO}</div>
                  </CardContent>
                </Card>
                <Card className="rounded-2xl">
                  <CardContent className="p-4">
                    <div className="text-xs text-muted-foreground">入力対象（絞り込み後）</div>
                    <div className="text-lg font-semibold mt-1">{filteredWines.length}銘柄</div>
                  </CardContent>
                </Card>
                <Card className="rounded-2xl">
                  <CardContent className="p-4">
                    <div className="text-xs text-muted-foreground">推奨</div>
                    <div className="text-sm mt-1">売上入力と同じく全銘柄一覧。必要なら『入力済みのみ』で絞り込み。</div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Table */}
            <div className="overflow-hidden rounded-2xl border">
              <div className="grid grid-cols-1">
                <div className="hidden sm:grid sm:grid-cols-[minmax(280px,1fr)_220px_220px] bg-muted/50 border-b px-4 py-3 text-sm font-medium">
                  <div>ワイン</div>
                  {step === "sales" ? (
                    <>
                      <div className="text-center">ボトル</div>
                      <div className="text-center">グラス</div>
                    </>
                  ) : (
                    <>
                      <div className="text-center">ロス種別</div>
                      <div className="text-center">破損本数</div>
                    </>
                  )}
                </div>

                <div className="divide-y">
                  {filteredWines.map((w, idx) => {
                    const isFav = !!record.favorites?.[w.id];
                    const sale = record.sales?.[w.id] || { wineId: w.id, bottleQty: 0, glassQty: 0 };
                    const loss =
                      record.losses?.[w.id] || ({ wineId: w.id, lossType: "none", brokenBottles: 0 } as LossLine);

                    return (
                      <div
                        key={w.id}
                        className="grid grid-cols-1 sm:grid-cols-[minmax(280px,1fr)_220px_220px] gap-3 sm:gap-0 px-4 py-4 sm:py-3"
                      >
                        <WineRowHeader
                          wine={w}
                          isFavorite={isFav}
                          onToggleFavorite={() => toggleFavorite(w.id)}
                        />

                        {step === "sales" ? (
                          <>
                            <div className="flex sm:justify-center items-center gap-3">
                              <div className="sm:hidden text-xs text-muted-foreground w-14">ボトル</div>
                              <QtyCell
                                value={sale.bottleQty}
                                onChange={(v) => upsertSale(w.id, { bottleQty: v })}
                                ariaLabel={`${w.name} ボトル数`}
                                autoFocus={idx === 0 && !query}
                              />
                            </div>
                            <div className="flex sm:justify-center items-center gap-3">
                              <div className="sm:hidden text-xs text-muted-foreground w-14">グラス</div>
                              <QtyCell
                                value={sale.glassQty}
                                onChange={(v) => upsertSale(w.id, { glassQty: v })}
                                ariaLabel={`${w.name} グラス数`}
                              />
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="flex sm:justify-center items-center gap-3">
                              <div className="sm:hidden text-xs text-muted-foreground w-14">種別</div>
                              <Select
                                value={loss.lossType}
                                onValueChange={(v) => upsertLoss(w.id, { lossType: v as LossType })}
                              >
                                <SelectTrigger className="rounded-2xl w-[220px]">
                                  <SelectValue placeholder="選択" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">なし</SelectItem>
                                  <SelectItem value="remaining_discard">残量廃棄</SelectItem>
                                  <SelectItem value="broken">破損</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="flex sm:justify-center items-center gap-3">
                              <div className="sm:hidden text-xs text-muted-foreground w-14">破損</div>
                              <QtyCell
                                value={loss.brokenBottles}
                                onChange={(v) => upsertLoss(w.id, { brokenBottles: v })}
                                ariaLabel={`${w.name} 破損本数`}
                              />
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}

                  {filteredWines.length === 0 && (
                    <div className="px-4 py-10 text-center text-sm text-muted-foreground">
                      該当するワインがありません。検索条件を見直してください。
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
              <div className="text-xs text-muted-foreground">
                入力は自動で下書き保存されます（localStorage）。本番ではAPIに置き換えます。
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant={step === "sales" ? "default" : "outline"}
                  onClick={() => setStep("sales")}
                >
                  日次売上
                </Button>
                <Button
                  variant={step === "losses" ? "default" : "outline"}
                  onClick={() => setStep("losses")}
                >
                  日次ロス
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Next steps note */}
        <Card className="rounded-2xl shadow-sm">
          <CardContent className="p-5 space-y-2">
            <div className="font-medium">次フェーズ（本番化）に必要な最小事項</div>
            <ul className="text-sm text-muted-foreground list-disc pl-5 space-y-1">
              <li>マスタ（Wine_Master / Supplier_Master）をAPI化（例：Supabase）</li>
              <li>POST /daily-sales → 成功後に /daily-loss へ遷移（本UIは既にフローを再現）</li>
              <li>入力対象を「当日在庫の30銘柄」に固定するロジック（マスタ側で isActive 管理）</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
