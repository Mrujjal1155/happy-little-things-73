import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import {
  addStock,
  deleteCategory,
  deleteProduct,
  getCatalogue,
  saveCategory,
  saveProduct,
} from "@/lib/admin.functions";
import { AdminShell, money } from "@/components/AdminShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard/products")({
  head: () => ({
    meta: [
      { title: "Products & Stock — Shop Bot Admin" },
      { name: "description", content: "Create categories and products and bulk upload delivery stock for the Telegram shop bot." },
      { property: "og:title", content: "Products & Stock — Shop Bot Admin" },
      { property: "og:description", content: "Manage your digital catalogue and credential stock." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProductsPage,
});

const EMPTY = {
  id: undefined as string | undefined,
  name: "",
  emoji: "📦",
  telegram_custom_emoji_id: "",
  description: "",
  price: 0,
  old_price: "" as string | number,
  image_url: "",
  delivery_time: "",
  badge: "",
  delivery_type: "auto" as "auto" | "manual",
  manual_note: "",
  category_id: "",
  is_active: true,
  sort_order: 0,
};

function ProductsPage() {
  const qc = useQueryClient();
  const fetchCatalogue = useServerFn(getCatalogue);
  const { data } = useQuery({ queryKey: ["catalogue"], queryFn: () => fetchCatalogue() });

  const saveCat = useServerFn(saveCategory);
  const delCat = useServerFn(deleteCategory);
  const saveProd = useServerFn(saveProduct);
  const delProd = useServerFn(deleteProduct);
  const pushStock = useServerFn(addStock);

  const [cat, setCat] = useState({ name: "", emoji: "📁", channel: "both" });
  const [form, setForm] = useState({ ...EMPTY });
  const [stockFor, setStockFor] = useState<string>("");
  const [stockLines, setStockLines] = useState("");

  const refresh = () => qc.invalidateQueries({ queryKey: ["catalogue"] });

  const catMut = useMutation({
    mutationFn: () => saveCat({ data: { name: cat.name, emoji: cat.emoji, channel: cat.channel } }),
    onSuccess: () => {
      setCat({ name: "", emoji: "📁", channel: "both" });
      refresh();
      toast.success("Category saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const prodMut = useMutation({
    mutationFn: () =>
      saveProd({
        data: {
          ...(form.id ? { id: form.id } : {}),
          name: form.name,
          emoji: form.emoji,
          telegram_custom_emoji_id: form.telegram_custom_emoji_id || null,
          description: form.description,
          price: Number(form.price),
          old_price: form.old_price === "" ? null : Number(form.old_price),
          delivery_type: form.delivery_type,
          image_url: form.image_url,
          delivery_time: form.delivery_time,
          badge: form.badge,
          manual_note: form.manual_note,
          category_id: form.category_id || null,
          is_active: form.is_active,
          sort_order: Number(form.sort_order),
        },
      }),
    onSuccess: () => {
      setForm({ ...EMPTY });
      refresh();
      toast.success("Product saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const stockMut = useMutation({
    mutationFn: () => pushStock({ data: { product_id: stockFor, lines: stockLines } }),
    onSuccess: (r) => {
      setStockLines("");
      refresh();
      toast.success(`${r.added} stock items added`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AdminShell title="Products & Stock">
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Categories</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Input
                className="w-16"
                value={cat.emoji}
                onChange={(e) => setCat({ ...cat, emoji: e.target.value })}
              />
              <Input
                placeholder="Category name"
                value={cat.name}
                onChange={(e) => setCat({ ...cat, name: e.target.value })}
              />
            </div>
            <div className="flex gap-2">
              <select
                className="h-9 flex-1 rounded-md border border-input bg-background px-3 text-sm"
                value={cat.channel}
                onChange={(e) => setCat({ ...cat, channel: e.target.value })}
              >
                <option value="both">Both (Telegram + Website)</option>
                <option value="telegram">Telegram only</option>
                <option value="website">Website only</option>
              </select>
              <Button onClick={() => catMut.mutate()} disabled={!cat.name}>
                Add
              </Button>
            </div>
            <ul className="space-y-1 text-sm">
              {(data?.categories ?? []).map((c: any) => (
                <li key={c.id} className="flex items-center justify-between rounded-md bg-muted px-3 py-2">
                  <span>
                    {c.emoji} {c.name}
                    <Badge variant="secondary" className="ml-2">{c.channel ?? "both"}</Badge>
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => delCat({ data: { id: c.id } }).then(refresh)}
                  >
                    Delete
                  </Button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>{form.id ? "Edit product" : "New product"}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>Emoji</Label>
              <Input value={form.emoji} onChange={(e) => setForm({ ...form, emoji: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label>Telegram Premium custom emoji ID (optional)</Label>
              <Input
                inputMode="numeric"
                value={form.telegram_custom_emoji_id}
                onChange={(e) => setForm({ ...form, telegram_custom_emoji_id: e.target.value.trim() })}
                placeholder="Telegram custom emoji ID"
              />
            </div>
            <div className="space-y-1">
              <Label>Price</Label>
              <Input
                type="number"
                step="0.01"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-1">
              <Label>Old price (optional)</Label>
              <Input
                type="number"
                step="0.01"
                value={form.old_price}
                onChange={(e) => setForm({ ...form, old_price: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label>Category</Label>
              <select
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={form.category_id}
                onChange={(e) => setForm({ ...form, category_id: e.target.value })}
              >
                <option value="">— none —</option>
                {(data?.categories ?? []).map((c: any) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label>Delivery type</Label>
              <select
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={form.delivery_type}
                onChange={(e) => setForm({ ...form, delivery_type: e.target.value as "auto" | "manual" })}
              >
                <option value="auto">Auto (from stock)</option>
                <option value="manual">Manual (admin delivers)</option>
              </select>
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label>Website image URL (Telegram keeps using the emoji)</Label>
              <Input
                value={form.image_url}
                onChange={(e) => setForm({ ...form, image_url: e.target.value })}
                placeholder="https://…/product.jpg"
              />
            </div>
            <div className="space-y-1">
              <Label>Delivery time text</Label>
              <Input
                value={form.delivery_time}
                onChange={(e) => setForm({ ...form, delivery_time: e.target.value })}
                placeholder="30 min delivery"
              />
            </div>
            <div className="space-y-1">
              <Label>Badge (optional)</Label>
              <Input value={form.badge} onChange={(e) => setForm({ ...form, badge: e.target.value })} placeholder="HOT" />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label>Description</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <div className="flex gap-2 sm:col-span-2">
              <Button onClick={() => prodMut.mutate()} disabled={!form.name}>
                {form.id ? "Update product" : "Create product"}
              </Button>
              {form.id && (
                <Button variant="outline" onClick={() => setForm({ ...EMPTY })}>
                  Cancel
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Catalogue</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-muted-foreground">
              <tr>
                <th className="py-2">Product</th>
                <th>Price</th>
                <th>Delivery</th>
                <th>Stock</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {(data?.products ?? []).map((p: any) => (
                <tr key={p.id} className="border-t border-border">
                  <td className="py-2">
                    <span className="flex items-center gap-2">
                      {p.image_url ? (
                        <img src={p.image_url} alt="" className="h-8 w-8 rounded object-cover" />
                      ) : (
                        <span>{p.emoji}</span>
                      )}
                      {p.name}
                    </span>
                  </td>
                  <td>
                    {money(p.price)}
                    {p.old_price ? <span className="ml-1 line-through text-muted-foreground">{money(p.old_price)}</span> : null}
                  </td>
                  <td>
                    <Badge variant="secondary">{p.delivery_type}</Badge>
                  </td>
                  <td>{p.delivery_type === "manual" ? "—" : p.stock}</td>
                  <td className="space-x-1 text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        setForm({
                          id: p.id,
                          name: p.name,
                          emoji: p.emoji ?? "📦",
                          telegram_custom_emoji_id: p.telegram_custom_emoji_id ?? "",
                          description: p.description ?? "",
                          price: Number(p.price),
                          old_price: p.old_price ?? "",
                          delivery_type: p.delivery_type,
                          image_url: p.image_url ?? "",
                          delivery_time: p.delivery_time ?? "",
                          badge: p.badge ?? "",
                          manual_note: p.manual_note ?? "",
                          category_id: p.category_id ?? "",
                          is_active: p.is_active,
                          sort_order: p.sort_order,
                        })
                      }
                    >
                      Edit
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setStockFor(p.id)}>
                      Stock
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => delProd({ data: { id: p.id } }).then(refresh)}
                    >
                      Delete
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {stockFor && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle>Bulk stock upload — one credential per line</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              rows={8}
              value={stockLines}
              onChange={(e) => setStockLines(e.target.value)}
              placeholder={"email:pass\nemail2:pass2"}
            />
            <div className="flex gap-2">
              <Button onClick={() => stockMut.mutate()} disabled={!stockLines.trim()}>
                Upload stock
              </Button>
              <Button variant="outline" onClick={() => setStockFor("")}>
                Close
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </AdminShell>
  );
}
