// src/components/SoundSettings.tsx
import { useEffect, useState } from "react";
import { SoundOutlined, CustomerServiceOutlined, PhoneOutlined, PlayCircleOutlined, StopOutlined, SaveOutlined } from "@ant-design/icons";
import { Switch, Slider, Input, Button, Typography, Space, Divider } from "antd";
import { useSounds } from "@/hooks/useSounds";

const { Text } = Typography;

type SourceKey = "send" | "receive" | "ringtone";

const ROWS: { key: SourceKey; label: string; icon: React.ReactNode; placeholder: string }[] = [
  { key: "send", label: "Send sound", icon: <SoundOutlined />, placeholder: "/send.mp3 or URL" },
  { key: "receive", label: "Receive sound", icon: <CustomerServiceOutlined />, placeholder: "/receive.mp3 or URL" },
  { key: "ringtone", label: "Ringtone", icon: <PhoneOutlined />, placeholder: "/ringtone.mp3 or URL" },
];

export default function SoundSettings() {
  const sounds = useSounds();
  const [urls, setUrls] = useState<Record<SourceKey, string>>({ send: "", receive: "", ringtone: "" });

  useEffect(() => {
    try {
      const raw = JSON.parse(localStorage.getItem("sona.sounds.sources") || "{}");
      setUrls({ send: raw.send || "", receive: raw.receive || "", ringtone: raw.ringtone || "" });
    } catch {}
  }, []);

  const testFor = (key: SourceKey) => {
    if (key === "send") sounds.testSend();
    else if (key === "receive") sounds.testReceive();
    else sounds.startRingtone();
  };

  return (
    <div className="space-y-5">
      {/* Enable + Volume */}
      <div className="flex items-center justify-between rounded-2xl bg-[#F5F0E8] dark:bg-[#2A2A2A] p-3.5">
        <Space size={10}>
          <SoundOutlined className="text-[#E07A5F] text-base" />
          <Text className="!text-sm !font-medium !text-[#2D3436] dark:!text-[#E8E8E8]">Enable sounds</Text>
        </Space>
        <Switch
          checked={sounds.enabled}
          onChange={(v) => sounds.setEnabled(v)}
          style={sounds.enabled ? { backgroundColor: "#E07A5F" } : undefined}
        />
      </div>

      <div className="rounded-2xl bg-[#F5F0E8] dark:bg-[#2A2A2A] p-3.5">
        <div className="flex items-center justify-between mb-2">
          <Text className="!text-sm !font-medium !text-[#2D3436] dark:!text-[#E8E8E8]">Volume</Text>
          <Text className="!text-xs !font-semibold !text-[#E07A5F]">{Math.round(sounds.volume * 100)}%</Text>
        </div>
        <Slider
          min={0}
          max={1}
          step={0.01}
          value={sounds.volume}
          onChange={(v) => sounds.setVolume(v as number)}
          tooltip={{ open: false }}
          styles={{ track: { backgroundColor: "#E07A5F" }, handle: { borderColor: "#E07A5F" } }}
        />
      </div>

      <Divider className="!my-1 !border-[#E07A5F]/10" />

      {/* Custom sources */}
      <div className="space-y-3">
        {ROWS.map((row) => (
          <div key={row.key} className="rounded-2xl bg-[#F5F0E8] dark:bg-[#2A2A2A] p-3.5 space-y-2">
            <Space size={8}>
              <span className="text-[#E07A5F]">{row.icon}</span>
              <Text className="!text-xs !font-semibold !uppercase !tracking-wide !text-[#8C8C8C]">{row.label}</Text>
            </Space>
            <div className="flex items-center gap-2">
              <Input
                value={urls[row.key]}
                onChange={(e) => setUrls((prev) => ({ ...prev, [row.key]: e.target.value }))}
                placeholder={row.placeholder}
                size="middle"
                className="!rounded-xl"
              />
              <Button
                icon={<SaveOutlined />}
                onClick={() => sounds.setSource(row.key, urls[row.key] || null)}
                style={{ borderRadius: 999 }}
              />
              <Button
                icon={<PlayCircleOutlined />}
                onClick={() => testFor(row.key)}
                style={{ borderRadius: 999, color: "#E07A5F", borderColor: "#E07A5F55" }}
              />
              {row.key === "ringtone" && (
                <Button
                  icon={<StopOutlined />}
                  onClick={() => sounds.stopRingtone()}
                  danger
                  ghost
                  style={{ borderRadius: 999 }}
                />
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
