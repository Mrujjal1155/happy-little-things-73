import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { deliverOrder, listOrders, setOrderStatus } from "@/lib/admin.functions";
import { AdminShell, money } from "@/components/AdminShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/orders")({
  head: () => ({
    meta: [
      { title: "Orders — Shop Bot Admin" },
      { name: "description", content: "Review Telegram shop orders, deliver manual products and update order status." },
      { property: "og:title", content: "Orders — Shop Bot Admin" },
      { property: "og:description", content: "Order management and manual delivery for your Telegram bot store." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: OrdersPage,
});

const FILTERS = ["all", "pending", "completed", "cancelled"] as const;
const SOURCES = [
  { id: "all", label: "All orders" },
  { id: "telegram", label: "Telegram orders" },
  { id: "website", label: "Website orders" },
] as const;

function OrdersPage() {
  const qc = useQueryClient();
  const [status, setStatus] = useState<string>("all");
  const [source, setSource] = useState<string>("all");
  const [deliverFor, setDeliverFor] = useState<string>("");
  const [content, setContent] = useState("");

  const fetchOrders = useServerFn(listOrders);
  const deliver = useServerFn(deliverOrder);
  const changeStatus = useServerFn(setOrderStatus);

  const { data } = useQuery({
    queryKey: ["orders", status, source],
    queryFn: () => fetchOrders({ data: { status, source } }),
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ["orders"] });

  const deliverMut = useMutation({
    mutationFn: () => deliver({ data: { id: deliverFor, content } }),
    onSuccess: () => {
      setDeliverFor("");
      setContent("");
      refresh();
      toast.success("Delivered and sent to the user");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AdminShell title="Orders">
      <div className="mb-3 flex gap-2">
        {SOURCES.map((s) => (
          <Button key={s.id} size="sm" variant={source === s.id ? "default" : "outline"} onClick={() => setSource(s.id)}>
            {s.label}
          </Button>
        ))}
      </div>

      <div className="mb-4 flex gap-2">
        {FILTERS.map((f) => (
          <Button key={f} size="sm" variant={status === f ? "default" : "outline"} onClick={() => setStatus(f)}>
            {f}
          </Button>
        ))}
      </div>

      <Card>
        <CardContent className="overflow-x-auto pt-6">
          <table className="w-full text-sm">
            <thead className="text-left text-muted-foreground">
              <tr>
                <th className="py-2">#</th>
                <th>Source</th>
                <th>Customer</th>
                <th>Product</th>
                <th>Qty</th>
                <th>Total</th>
                <th>Type</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {(data ?? []).map((o: any) => (
                <tr key={o.id} className="border-t border-border align-top">
                  <td className="py-2">{o.order_no}</td>
                  <td>
                    <Badge variant={o.source === "website" ? "default" : "secondary"}>{o.source ?? "telegram"}</Badge>
                  </td>
                  <td>
                    {o.source === "website" ? (
                      <div className="text-xs">
                        <div>{o.customer_name}</div>
                        <div className="text-muted-foreground">{o.customer_email}</div>
                        {o.txid && <div className="text-muted-foreground">TX: {String(o.txid).slice(0, 18)}…</div>}
                      </div>
                    ) : (
                      o.telegram_id
                    )}
                  </td>
                  <td>
                    {o.product_name}
                    {o.delivered_content && (
                      <pre className="mt-1 max-w-xs overflow-x-auto rounded bg-muted p-2 text-xs">
                        {o.delivered_content}
                      </pre>
                    )}
                  </td>
                  <td>{o.quantity}</td>
                  <td>{money(o.total)}</td>
                  <td>{o.delivery_type}</td>
                  <td>
                    <Badge variant={o.status === "completed" ? "default" : "secondary"}>{o.status}</Badge>
                  </td>
                  <td className="space-x-1 text-right">
                    {o.status === "pending" && (
                      <>
                        <Button size="sm" variant="ghost" onClick={() => setDeliverFor(o.id)}>
                          Deliver
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => changeStatus({ data: { id: o.id, status: "cancelled" } }).then(refresh)}
                        >
                          Cancel
                        </Button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {deliverFor && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle>Manual delivery</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea rows={6} value={content} onChange={(e) => setContent(e.target.value)} />
            <div className="flex gap-2">
              <Button onClick={() => deliverMut.mutate()} disabled={!content.trim()}>
                Send to user & complete
              </Button>
              <Button variant="outline" onClick={() => setDeliverFor("")}>
                Close
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </AdminShell>
  );
}
