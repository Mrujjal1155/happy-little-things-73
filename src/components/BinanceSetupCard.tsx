import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Values = Record<string, string>;

const flag = (v: string | undefined, def = true) =>
  v === undefined || v === "" ? def : v === "1" || v === "true";

export function BinanceSetupCard({
  values,
  setValues,
  onSave,
  apiStatus,
  onSaveKeys,
  savingKeys,
}: {
  values: Values;
  setValues: (v: Values) => void;
  onSave: () => void;
  apiStatus?: { ok: boolean; message: string } | undefined;
  onSaveKeys: (apiKey: string, secretKey: string) => void;
  savingKeys?: boolean;
}) {
  const set = (k: string, v: string) => setValues({ ...values, [k]: v });
  const live = (values["binance_mode"] ?? "live") !== "personal";
  const [apiKey, setApiKey] = useState("");
  const [secretKey, setSecretKey] = useState("");

  return (
    <Card className="mb-4">
      <CardContent className="space-y-6 pt-6">
        <div className="flex items-center gap-3">
          <span className="rounded bg-[#F0B90B] px-2 py-1 text-xs font-bold text-black">BINANCE</span>
          <h2 className="text-2xl font-bold">Binance Setup</h2>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <Label>Status</Label>
            <Select
              value={values["binance_status"] ?? "active"}
              onValueChange={(v) => set("binance_status", v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label>Dollar Rate (1 USD to BDT)</Label>
            <Input
              inputMode="decimal"
              placeholder="130"
              value={values["dollar_rate"] ?? ""}
              onChange={(e) => set("dollar_rate", e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <Label>API KEY (For Auto-Verify)</Label>
            <Input value={apiStatus?.ok ? "•••••••••••••••• (stored securely)" : "Not configured"} readOnly />
          </div>

          <div className="space-y-1">
            <Label>Secret KEY (For Auto-Verify)</Label>
            <Input value={apiStatus?.ok ? "•••••••••••••••• (stored securely)" : "Not configured"} readOnly />
          </div>

          <div className="space-y-1 sm:col-span-2">
            <Label>Binance Pay ID (For Pay ID Auto-Verify)</Label>
            <Input
              value={values["binance_pay"] ?? ""}
              onChange={(e) => set("binance_pay", e.target.value)}
            />
          </div>
        </div>

        {apiStatus && (
          <p className={`text-sm ${apiStatus.ok ? "text-primary" : "text-destructive"}`}>
            {apiStatus.ok ? "✅ " : "⚠️ "}
            {apiStatus.message}
          </p>
        )}

        <div className="space-y-2">
          <Label>Checkout Options</Label>
          <div className="flex flex-wrap gap-6">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={flag(values["binance_enable_payid"])}
                onCheckedChange={(c) => set("binance_enable_payid", c ? "1" : "0")}
              />
              Enable Binance Pay ID Option
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={flag(values["binance_enable_crypto"])}
                onCheckedChange={(c) => set("binance_enable_crypto", c ? "1" : "0")}
              />
              Enable Crypto Option (TRC20, BEP20, etc.)
            </label>
          </div>
        </div>

        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          <b>Note:</b> Deposit addresses for crypto (TRC20, BEP20) are fetched and verified automatically using
          your API keys. You do not need to enter any wallet address here. API keys are stored as encrypted
          secrets (BINANCE_API_KEY / BINANCE_API_SECRET), never in the database.
        </div>

        <div className="space-y-2">
          <Label>Active Payment Type</Label>
          <div className="flex flex-wrap items-center gap-8">
            <div className="flex items-center gap-2 text-sm">
              <Switch
                checked={!live}
                onCheckedChange={(c) => set("binance_mode", c ? "personal" : "live")}
              />
              Personal Mode (Manual)
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Switch
                checked={live}
                onCheckedChange={(c) => set("binance_mode", c ? "live" : "personal")}
              />
              Live Mode (Auto API)
            </div>
          </div>
        </div>

        <Button onClick={onSave}>Save Setting</Button>
      </CardContent>
    </Card>
  );
}
