import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { deleteHeroItem, listHeroItems, saveHeroItem } from "@/lib/admin.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Row = { id: string; name: string; image_url: string | null; accent: string; sort_order: number; is_active: boolean };

export function HeroItemsCard() {
  const list = useServerFn(listHeroItems);
  const save = useServerFn(saveHeroItem);
  const remove = useServerFn(deleteHeroItem);
  const { data, refetch } = useQuery({ queryKey: ["hero-items"], queryFn: () => list() });
  const rows = (data ?? []) as unknown as Row[];

  const [name, setName] = useState("");
  const [image, setImage] = useState("");
  const [busy, setBusy] = useState(false);

  async function onAdd() {
    if (!name.trim()) return toast.error("Name দিন");
    setBusy(true);
    try {
      await save({ data: { name, image_url: image, sort_order: rows.length + 1 } });
      setName("");
      setImage("");
      await refetch();
      toast.success("Hero item যোগ হয়েছে");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function onUpdate(row: Row, patch: Partial<Row>) {
    try {
      await save({ data: { ...row, ...patch, image_url: (patch.image_url ?? row.image_url) ?? "" } });
      await refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }

  async function onDelete(id: string) {
    try {
      await remove({ data: { id } });
      await refetch();
      toast.success("Removed");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle>Website hero showcase (image + name)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <p className="text-sm text-muted-foreground">
          Home page-এর hero animation-এ যে floating card গুলো দেখা যায়, সেগুলো এখান থেকে কন্ট্রোল করুন। Image URL দিলে সেই
          ছবি দেখাবে, না দিলে ডিফল্ট আইকন দেখাবে।
        </p>

        <div className="grid gap-3 sm:grid-cols-[1fr_1.4fr_auto]">
          <div className="space-y-1">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="ChatGPT Plus" />
          </div>
          <div className="space-y-1">
            <Label>Image URL</Label>
            <Input value={image} onChange={(e) => setImage(e.target.value)} placeholder="https://…/chatgpt.png" />
          </div>
          <div className="flex items-end">
            <Button onClick={onAdd} disabled={busy}>
              <Plus className="h-4 w-4" /> Add
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          {rows.length === 0 && <p className="text-sm text-muted-foreground">কোনো hero item নেই।</p>}
          {rows.map((row) => (
            <div key={row.id} className="grid items-center gap-2 rounded-xl border border-border p-2 sm:grid-cols-[auto_1fr_1.4fr_auto_auto]">
              {row.image_url ? (
                <img src={row.image_url} alt={row.name} className="h-9 w-9 rounded-lg object-cover" />
              ) : (
                <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary/15 text-xs font-bold text-primary">
                  {row.name.slice(0, 1)}
                </span>
              )}
              <Input defaultValue={row.name} onBlur={(e) => onUpdate(row, { name: e.target.value })} />
              <Input
                defaultValue={row.image_url ?? ""}
                placeholder="Image URL"
                onBlur={(e) => onUpdate(row, { image_url: e.target.value })}
              />
              <Button variant="outline" size="sm" onClick={() => onUpdate(row, { is_active: !row.is_active })}>
                {row.is_active ? "Active" : "Hidden"}
              </Button>
              <Button variant="ghost" size="icon" onClick={() => onDelete(row.id)} aria-label="Delete hero item">
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
