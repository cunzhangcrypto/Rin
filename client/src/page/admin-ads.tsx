import { AD_SLOTS, getAdSlotLabel, type AdminAdMaterial, type AdminAdSlot, type AdMaterialInput, type AdMaterialType, type AdSlotKey } from "@rin/api";
import { SettingsCard, SettingsCardBody, SettingsCardHeader } from "@rin/ui";
import { useEffect, useMemo, useRef, useState } from "react";
import { Helmet } from "react-helmet";
import { client } from "../app/runtime";
import { Button } from "../components/button";
import { useAlert, useConfirm } from "../components/dialog";
import { useSiteConfig } from "../hooks/useSiteConfig";

type Draft = {
  id?: number;
  name: string;
  type: AdMaterialType;
  html: string;
  image: string;
  url: string;
  enabled: boolean;
  weight: number;
  startAt: string;
  endAt: string;
  slots: AdSlotKey[];
};

const EMPTY_DRAFT: Draft = {
  name: "",
  type: "html",
  html: "",
  image: "",
  url: "",
  enabled: true,
  weight: 10,
  startAt: "",
  endAt: "",
  slots: [],
};

const inputClass =
  "w-full rounded-xl border border-black/10 bg-w px-3 py-2 text-sm t-primary transition-colors placeholder:text-neutral-400 focus:border-black/20 focus:outline-none focus:ring-2 focus:ring-theme/10 dark:border-white/10 dark:placeholder:text-neutral-500";

function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const shifted = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return shifted.toISOString().slice(0, 16);
}

function fromLocalInput(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function toDraft(material: AdminAdMaterial): Draft {
  return {
    id: material.id,
    name: material.name,
    type: material.type,
    html: material.html,
    image: material.image,
    url: material.url,
    enabled: material.enabled,
    weight: material.weight,
    startAt: toLocalInput(material.startAt),
    endAt: toLocalInput(material.endAt),
    slots: material.slots,
  };
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function imagePreviewHtml(draft: Draft): string {
  if (!draft.image) return "";
  const inner = `<img src="${escapeHtml(draft.image)}" alt="${escapeHtml(draft.name)}" style="display:block;width:100%;max-width:100%;height:auto;border-radius:12px;object-fit:cover;" />`;
  if (!draft.url) return inner;
  return `<a href="${escapeHtml(draft.url)}" target="_blank" rel="nofollow sponsored noopener noreferrer" style="display:block;">${inner}</a>`;
}

function buildPreviewDoc(html: string): string {
  return `<!doctype html><html><head><meta charset="utf-8" /><style>html,body{margin:0;padding:0;}body{padding:12px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;font-size:14px;color:#1f2937;box-sizing:border-box;}img{max-width:100%;height:auto;}a{text-decoration:none;}</style></head><body>${html}</body></html>`;
}

export function AdminAdsPage() {
  const siteConfig = useSiteConfig();
  const { showAlert, AlertUI } = useAlert();
  const { showConfirm, ConfirmUI } = useConfirm();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [materials, setMaterials] = useState<AdminAdMaterial[]>([]);
  const [slots, setSlots] = useState<AdminAdSlot[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [previewHtml, setPreviewHtml] = useState("");
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "mobile">("desktop");
  const [previewLoading, setPreviewLoading] = useState(false);
  const previewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const materialById = useMemo(() => new Map(materials.map((item) => [item.id, item])), [materials]);

  const load = async () => {
    setLoading(true);
    try {
      const { data, error } = await client.ads.adminList();
      if (error) {
        showAlert(error.value);
        return;
      }
      if (data) {
        setMaterials(data.materials);
        setSlots(data.slots);
      }
    } catch (err) {
      showAlert(err instanceof Error ? err.message : "加载失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 预览：HTML 类型走后端净化，图片类型直接生成卡片预览
  useEffect(() => {
    if (!draft) {
      setPreviewHtml("");
      return;
    }
    if (draft.type === "image") {
      setPreviewHtml(imagePreviewHtml(draft));
      setPreviewLoading(false);
      return;
    }
    if (previewTimer.current) clearTimeout(previewTimer.current);
    setPreviewLoading(true);
    previewTimer.current = setTimeout(() => {
      client.ads
        .adminPreview({ html: draft.html })
        .then(({ data, error }) => {
          setPreviewHtml(error ? "" : data?.html ?? "");
        })
        .catch(() => setPreviewHtml(""))
        .finally(() => setPreviewLoading(false));
    }, 450);
    return () => {
      if (previewTimer.current) clearTimeout(previewTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft?.type, draft?.html, draft?.image, draft?.url, draft?.name]);

  const openCreate = () => setDraft({ ...EMPTY_DRAFT });

  const openEdit = (material: AdminAdMaterial) => setDraft(toDraft(material));

  const saveDraft = async () => {
    if (!draft) return;
    if (!draft.name.trim()) {
      showAlert("请填写广告名称");
      return;
    }
    if (draft.type === "html" && !draft.html.trim()) {
      showAlert("请粘贴广告 HTML 代码");
      return;
    }
    if (draft.type === "image" && !draft.image.trim()) {
      showAlert("请填写图片地址");
      return;
    }

    const payload: AdMaterialInput = {
      name: draft.name.trim(),
      type: draft.type,
      html: draft.type === "html" ? draft.html : "",
      image: draft.type === "image" ? draft.image.trim() : "",
      url: draft.url.trim(),
      enabled: draft.enabled,
      weight: draft.weight,
      startAt: fromLocalInput(draft.startAt),
      endAt: fromLocalInput(draft.endAt),
      slots: draft.slots,
    };

    setSaving(true);
    try {
      const { data, error } = draft.id
        ? await client.ads.adminUpdate(draft.id, payload)
        : await client.ads.adminCreate(payload);
      if (error) {
        showAlert(error.value);
        return;
      }
      setDraft(null);
      await load();
      showAlert(draft.id ? "广告已更新" : "广告已创建");
      void data;
    } catch (err) {
      showAlert(err instanceof Error ? err.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  const removeMaterial = (material: AdminAdMaterial) => {
    showConfirm("删除广告", `确定删除「${material.name}」吗？该广告会同时从所有广告位移除。`, async () => {
      const { error } = await client.ads.adminDelete(material.id);
      if (error) {
        showAlert(error.value);
        return;
      }
      await load();
      showAlert("已删除");
    });
  };

  const duplicateMaterial = async (material: AdminAdMaterial) => {
    const { data, error } = await client.ads.adminDuplicate(material.id);
    if (error) {
      showAlert(error.value);
      return;
    }
    await load();
    showAlert("已复制（默认停用），请编辑后启用");
    if (data?.id) {
      const created = await client.ads.adminList();
      const copy = created.data?.materials.find((item) => item.id === data.id);
      if (copy) setDraft(toDraft(copy));
    }
  };

  const toggleMaterial = async (material: AdminAdMaterial) => {
    const { error } = await client.ads.adminUpdate(material.id, {
      name: material.name,
      type: material.type,
      html: material.html,
      image: material.image,
      url: material.url,
      enabled: !material.enabled,
      weight: material.weight,
      startAt: material.startAt,
      endAt: material.endAt,
      slots: material.slots,
    });
    if (error) {
      showAlert(error.value);
      return;
    }
    await load();
  };

  const updateSlotConfig = async (slot: AdminAdSlot, patch: Partial<AdminAdSlot>) => {
    setSlots((prev) => prev.map((item) => (item.slot === slot.slot ? { ...item, ...patch } : item)));
    const { error } = await client.ads.adminUpdateSlot(slot.slot, patch);
    if (error) {
      showAlert(error.value);
      await load();
    }
  };

  const saveSlotAds = async (slot: AdminAdSlot, adIds: number[]) => {
    setSlots((prev) => prev.map((item) => (item.slot === slot.slot ? { ...item, adIds } : item)));
    const { error } = await client.ads.adminSetSlotAds(slot.slot, adIds);
    if (error) {
      showAlert(error.value);
      await load();
    }
  };

  const moveSlotAd = (slot: AdminAdSlot, index: number, dir: -1 | 1) => {
    const next = [...slot.adIds];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    saveSlotAds(slot, next);
  };

  const removeSlotAd = (slot: AdminAdSlot, adId: number) => {
    saveSlotAds(slot, slot.adIds.filter((id) => id !== adId));
  };

  const addSlotAd = (slot: AdminAdSlot, adId: number) => {
    if (!adId || slot.adIds.includes(adId)) return;
    saveSlotAds(slot, [...slot.adIds, adId]);
  };

  const toggleDraftSlot = (slot: AdSlotKey) => {
    setDraft((prev) => {
      if (!prev) return prev;
      const exists = prev.slots.includes(slot);
      return {
        ...prev,
        slots: exists ? prev.slots.filter((item) => item !== slot) : [...prev.slots, slot],
      };
    });
  };

  return (
    <>
      <Helmet>
        <title>{`广告管理 - ${siteConfig.name}`}</title>
      </Helmet>

      <div className="flex flex-col gap-5 t-primary">
        <SettingsCard>
          <SettingsCardHeader title="广告素材" description="粘贴 HTML 卡片代码或填写图片链接，保存后前台立即生效，无需重新部署。" />
          <SettingsCardBody>
            <div className="mb-4 flex items-center justify-between">
              <span className="text-sm text-neutral-500 dark:text-neutral-400">共 {materials.length} 条素材</span>
              <Button title="新增广告" onClick={openCreate} />
            </div>

            {loading ? (
              <p className="py-8 text-center text-sm text-neutral-400">加载中…</p>
            ) : materials.length === 0 ? (
              <p className="py-8 text-center text-sm text-neutral-400">还没有广告素材</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[680px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-black/5 text-xs uppercase tracking-wider text-neutral-400 dark:border-white/5">
                      <th className="py-2 pr-3">名称</th>
                      <th className="py-2 pr-3">类型</th>
                      <th className="py-2 pr-3">广告位</th>
                      <th className="py-2 pr-3">权重</th>
                      <th className="py-2 pr-3">状态</th>
                      <th className="py-2 text-right">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {materials.map((material) => (
                      <tr key={material.id} className="border-b border-black/5 align-middle dark:border-white/5">
                        <td className="py-2.5 pr-3">
                          <p className="max-w-[220px] truncate font-medium t-primary">{material.name}</p>
                          <p className="text-xs text-neutral-400">{material.updatedAt ? new Date(material.updatedAt).toLocaleString() : ""}</p>
                        </td>
                        <td className="py-2.5 pr-3 text-neutral-500">{material.type === "html" ? "HTML" : "图片"}</td>
                        <td className="py-2.5 pr-3">
                          <div className="flex flex-wrap gap-1">
                            {material.slots.length === 0 ? (
                              <span className="text-xs text-neutral-400">未投放</span>
                            ) : material.slots.map((slot) => (
                              <span key={slot} className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] text-neutral-600 dark:bg-white/10 dark:text-neutral-300">
                                {getAdSlotLabel(slot)}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="py-2.5 pr-3 text-neutral-500">{material.weight}</td>
                        <td className="py-2.5 pr-3">
                          <button
                            type="button"
                            onClick={() => toggleMaterial(material)}
                            className={`rounded-full px-2.5 py-1 text-xs font-medium ${material.enabled ? "bg-emerald-100 text-emerald-700" : "bg-neutral-100 text-neutral-500"}`}
                          >
                            {material.enabled ? "启用" : "停用"}
                          </button>
                        </td>
                        <td className="py-2.5">
                          <div className="flex justify-end gap-1.5">
                            <button type="button" onClick={() => openEdit(material)} className="rounded-lg px-2 py-1 text-xs text-theme hover:bg-theme/10">编辑</button>
                            <button type="button" onClick={() => duplicateMaterial(material)} className="rounded-lg px-2 py-1 text-xs text-neutral-500 hover:bg-neutral-100 dark:hover:bg-white/5">复制</button>
                            <button type="button" onClick={() => removeMaterial(material)} className="rounded-lg px-2 py-1 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10">删除</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SettingsCardBody>
        </SettingsCard>

        {draft && (
          <SettingsCard>
            <SettingsCardHeader
              title={draft.id ? "编辑广告" : "新增广告"}
              description="HTML 会经过服务端白名单净化，仅保留安全标签与行内样式。"
            />
            <SettingsCardBody>
              <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
                <div className="flex flex-col gap-3">
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-medium text-neutral-500">广告名称</span>
                    <input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} className={inputClass} placeholder="后台识别用，例如 Geonix 左侧卡片" />
                  </label>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block">
                      <span className="mb-1.5 block text-xs font-medium text-neutral-500">广告类型</span>
                      <select value={draft.type} onChange={(event) => setDraft({ ...draft, type: event.target.value as AdMaterialType })} className={inputClass}>
                        <option value="html">HTML 卡片代码</option>
                        <option value="image">图片 + 跳转链接</option>
                      </select>
                    </label>
                    <label className="block">
                      <span className="mb-1.5 block text-xs font-medium text-neutral-500">权重（加权随机时生效）</span>
                      <input type="number" min={0} max={1000} value={draft.weight} onChange={(event) => setDraft({ ...draft, weight: Number(event.target.value) || 0 })} className={inputClass} />
                    </label>
                  </div>

                  {draft.type === "html" ? (
                    <label className="block">
                      <span className="mb-1.5 block text-xs font-medium text-neutral-500">广告 HTML 代码</span>
                      <textarea
                        value={draft.html}
                        onChange={(event) => setDraft({ ...draft, html: event.target.value })}
                        rows={14}
                        spellCheck={false}
                        placeholder="<div style=&quot;...&quot;>...</div>"
                        className={`${inputClass} font-mono text-xs leading-5`}
                      />
                    </label>
                  ) : (
                    <div className="grid gap-3">
                      <label className="block">
                        <span className="mb-1.5 block text-xs font-medium text-neutral-500">图片地址</span>
                        <input value={draft.image} onChange={(event) => setDraft({ ...draft, image: event.target.value })} className={inputClass} placeholder="/ad.webp 或 https://..." />
                      </label>
                      <label className="block">
                        <span className="mb-1.5 block text-xs font-medium text-neutral-500">跳转链接（AFF）</span>
                        <input value={draft.url} onChange={(event) => setDraft({ ...draft, url: event.target.value })} className={inputClass} placeholder="https://go.czlab.dev/..." />
                      </label>
                    </div>
                  )}

                  {draft.type === "html" && (
                    <label className="block">
                      <span className="mb-1.5 block text-xs font-medium text-neutral-500">跳转链接（可选，仅用于记录）</span>
                      <input value={draft.url} onChange={(event) => setDraft({ ...draft, url: event.target.value })} className={inputClass} placeholder="https://..." />
                    </label>
                  )}

                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block">
                      <span className="mb-1.5 block text-xs font-medium text-neutral-500">开始时间（可选）</span>
                      <input type="datetime-local" value={draft.startAt} onChange={(event) => setDraft({ ...draft, startAt: event.target.value })} className={inputClass} />
                    </label>
                    <label className="block">
                      <span className="mb-1.5 block text-xs font-medium text-neutral-500">结束时间（可选）</span>
                      <input type="datetime-local" value={draft.endAt} onChange={(event) => setDraft({ ...draft, endAt: event.target.value })} className={inputClass} />
                    </label>
                  </div>

                  <div>
                    <span className="mb-1.5 block text-xs font-medium text-neutral-500">投放广告位（可多选）</span>
                    <div className="flex flex-wrap gap-2">
                      {AD_SLOTS.map((slot) => {
                        const active = draft.slots.includes(slot.key);
                        return (
                          <button
                            key={slot.key}
                            type="button"
                            onClick={() => toggleDraftSlot(slot.key)}
                            className={`rounded-full px-3 py-1.5 text-xs font-medium border transition-colors ${active ? "border-theme bg-theme/10 text-theme" : "border-black/10 text-neutral-500 hover:border-black/20 dark:border-white/10"}`}
                          >
                            {slot.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={draft.enabled} onChange={(event) => setDraft({ ...draft, enabled: event.target.checked })} />
                    启用该广告
                  </label>

                  <div className="flex items-center gap-2 border-t border-black/5 pt-4 dark:border-white/5">
                    <Button title={saving ? "保存中…" : "保存广告"} onClick={saveDraft} disabled={saving} />
                    <button type="button" onClick={() => setDraft(null)} className="rounded-full px-4 py-2 text-sm text-neutral-500 hover:bg-neutral-100 dark:hover:bg-white/5">
                      取消
                    </button>
                  </div>
                </div>

                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-neutral-500">实时预览</span>
                    <div className="flex gap-1">
                      {(["desktop", "mobile"] as const).map((device) => (
                        <button
                          key={device}
                          type="button"
                          onClick={() => setPreviewDevice(device)}
                          className={`rounded-lg px-2.5 py-1 text-xs ${previewDevice === device ? "bg-theme text-white" : "bg-neutral-100 text-neutral-500 dark:bg-white/10 dark:text-neutral-300"}`}
                        >
                          {device === "desktop" ? "桌面端" : "手机端"}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-xl border border-black/10 bg-neutral-100 p-3 dark:border-white/10 dark:bg-neutral-900">
                    <div className={`mx-auto bg-white transition-all ${previewDevice === "mobile" ? "w-[320px] max-w-full" : "w-full"}`}>
                      {previewLoading ? (
                        <div className="flex h-[160px] items-center justify-center text-xs text-neutral-400">正在净化 HTML…</div>
                      ) : previewHtml ? (
                        <iframe
                          title="广告预览"
                          sandbox=""
                          srcDoc={buildPreviewDoc(previewHtml)}
                          className="w-full border-0"
                          style={{ height: previewDevice === "mobile" ? 240 : 220 }}
                        />
                      ) : (
                        <div className="flex h-[160px] items-center justify-center px-4 text-center text-xs text-neutral-400">
                          暂无可预览内容，或 HTML 被安全规则拦截。
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="rounded-xl border border-black/5 bg-neutral-50 p-3 text-xs leading-5 text-neutral-500 dark:border-white/10 dark:bg-white/5">
                    <p>预览与前台使用同一套净化规则：</p>
                    <p className="mt-1">· 仅保留 div/span/a/ul/li/img 等安全标签</p>
                    <p>· 禁止 script、事件属性、javascript: 链接</p>
                    <p>· 禁止 position:fixed/absolute、z-index 等覆盖样式</p>
                  </div>
                </div>
              </div>
            </SettingsCardBody>
          </SettingsCard>
        )}

        <SettingsCard>
          <SettingsCardHeader title="广告位管理" description="每个广告位独立配置展示模式与关联素材；文章正文还可设置每篇最大展示数量与最小段落间隔。" />
          <SettingsCardBody>
            <div className="flex flex-col gap-4">
              {slots.map((slot) => {
                const candidates = materials.filter((material) => !slot.adIds.includes(material.id));
                return (
                  <div key={slot.slot} className="rounded-xl border border-black/5 p-4 dark:border-white/10">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold t-primary">{getAdSlotLabel(slot.slot)}</p>
                        <button
                          type="button"
                          onClick={() => updateSlotConfig(slot, { enabled: !slot.enabled })}
                          className={`rounded-full px-2.5 py-1 text-xs font-medium ${slot.enabled ? "bg-emerald-100 text-emerald-700" : "bg-neutral-100 text-neutral-500"}`}
                        >
                          {slot.enabled ? "启用" : "停用"}
                        </button>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <label className="flex items-center gap-1.5">
                          <span className="text-neutral-500">展示模式</span>
                          <select
                            value={slot.mode}
                            onChange={(event) => updateSlotConfig(slot, { mode: event.target.value as AdminAdSlot["mode"] })}
                            className="rounded-lg border border-black/10 bg-w px-2 py-1 text-xs dark:border-white/10"
                          >
                            <option value="fixed">固定展示</option>
                            <option value="random">随机展示</option>
                            <option value="weighted">加权随机</option>
                          </select>
                        </label>
                        {slot.slot === "inline" && (
                          <>
                            <label className="flex items-center gap-1.5">
                              <span className="text-neutral-500">每篇最多</span>
                              <input
                                type="number"
                                min={1}
                                max={5}
                                value={slot.maxCount}
                                onChange={(event) => updateSlotConfig(slot, { maxCount: Number(event.target.value) || 1 })}
                                className="w-14 rounded-lg border border-black/10 bg-w px-2 py-1 text-xs dark:border-white/10"
                              />
                            </label>
                            <label className="flex items-center gap-1.5">
                              <span className="text-neutral-500">最小段落间隔</span>
                              <input
                                type="number"
                                min={1}
                                max={20}
                                value={slot.minGap}
                                onChange={(event) => updateSlotConfig(slot, { minGap: Number(event.target.value) || 1 })}
                                className="w-14 rounded-lg border border-black/10 bg-w px-2 py-1 text-xs dark:border-white/10"
                              />
                            </label>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="mt-3 flex flex-col gap-1.5">
                      {slot.adIds.length === 0 ? (
                        <p className="text-xs text-neutral-400">该广告位暂无素材，前台不会显示占位。</p>
                      ) : slot.adIds.map((adId, index) => {
                        const material = materialById.get(adId);
                        if (!material) return null;
                        return (
                          <div key={adId} className="flex items-center gap-2 rounded-lg bg-neutral-50 px-3 py-2 text-sm dark:bg-white/5">
                            <span className="w-5 text-center text-xs text-neutral-400">{index + 1}</span>
                            <span className="min-w-0 flex-1 truncate t-primary">{material.name}</span>
                            <span className="text-xs text-neutral-400">{material.type === "html" ? "HTML" : "图片"}</span>
                            <span className={`text-xs ${material.enabled ? "text-emerald-600" : "text-neutral-400"}`}>{material.enabled ? "启用" : "停用"}</span>
                            <button type="button" onClick={() => moveSlotAd(slot, index, -1)} disabled={index === 0} className="rounded px-1.5 py-0.5 text-xs text-neutral-500 disabled:opacity-30">↑</button>
                            <button type="button" onClick={() => moveSlotAd(slot, index, 1)} disabled={index === slot.adIds.length - 1} className="rounded px-1.5 py-0.5 text-xs text-neutral-500 disabled:opacity-30">↓</button>
                            <button type="button" onClick={() => removeSlotAd(slot, adId)} className="rounded px-1.5 py-0.5 text-xs text-red-500">移除</button>
                          </div>
                        );
                      })}
                    </div>

                    {candidates.length > 0 && (
                      <select
                        value=""
                        onChange={(event) => addSlotAd(slot, Number(event.target.value))}
                        className="mt-2 rounded-lg border border-black/10 bg-w px-2 py-1.5 text-xs text-neutral-500 dark:border-white/10"
                      >
                        <option value="">+ 添加素材到该广告位</option>
                        {candidates.map((material) => (
                          <option key={material.id} value={material.id}>{material.name}</option>
                        ))}
                      </select>
                    )}
                  </div>
                );
              })}
            </div>
          </SettingsCardBody>
        </SettingsCard>
      </div>

      <AlertUI />
      <ConfirmUI />
    </>
  );
}
