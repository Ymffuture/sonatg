// src/components/SoundSettings.tsx
import { useState } from "react";
import {
  SoundOutlined,
  CustomerServiceOutlined,
  PhoneOutlined,
  CheckCircleFilled,
  PlayCircleOutlined,
  StopOutlined,
} from "@ant-design/icons";
import { Switch, Slider, Typography, Space } from "antd";
import { useSounds } from "@/hooks/useSounds";
import { SOUND_PRESETS, type SoundKey, type SoundPreset } from "@/lib/soundPresets";

const { Text } = Typography;

const SECTIONS: { key: SoundKey; label: string; icon: React.ReactNode }[] = [
  { key: "send", label: "Message sound", icon: <SoundOutlined /> },
  { key: "receive", label: "Notification sound", icon: <CustomerServiceOutlined /> },
  { key: "ringtone", label: "Ringtone", icon: <PhoneOutlined /> },
];

function PresetRow({
  preset,
  active,
  onSelect,
  isPlaying,
  onTogglePreview,
}: {
  preset: SoundPreset;
  active: boolean;
  onSelect: () => void;
  isPlaying: boolean;
  onTogglePreview: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${
        active
          ? "bg-[#E07A5F]/12 dark:bg-[#E07A5F]/20"
          : "hover:bg-[#F5F0E8] dark:hover:bg-[#2A2A2A]"
      }`}
    >
      <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${active ? "bg-[#E07A5F]/20" : "bg-white/60 dark:bg-white/5"}`}>
        <preset.icon className="h-4 w-4" style={{ color: active ? "#E07A5F" : "#8C8C8C" }} />
      </span>
      <span className="flex-1 min-w-0">
        <Text
          className={`!text-sm !block !truncate ${
            active
              ? "!font-semibold !text-[#E07A5F]"
              : "!font-medium !text-[#2D3436] dark:!text-[#E8E8E8]"
          }`}
        >
          {preset.name}
        </Text>
      </span>
      <span
        role="button"
        onClick={(e) => {
          e.stopPropagation();
          onTogglePreview();
        }}
        className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-[#E07A5F] hover:bg-[#E07A5F]/10 transition"
      >
        {isPlaying ? <StopOutlined /> : <PlayCircleOutlined />}
      </span>
      {active && <CheckCircleFilled className="shrink-0 text-[#E07A5F]" />}
    </button>
  );
}

export default function SoundSettings() {
  const sounds = useSounds();
  const [previewing, setPreviewing] = useState<string | null>(null); // `${key}:${id}`

  const togglePreview = (key: SoundKey, preset: SoundPreset) => {
    const id = `${key}:${preset.id}`;
    if (key === "ringtone") {
      if (previewing === id) {
        sounds.stopRingtone();
        setPreviewing(null);
      } else {
        sounds.stopRingtone();
        // temporarily select+play so the correct preset (incl. file-backed default) is used
        sounds.selectPreset(key, preset.id);
        sounds.startRingtone();
        setPreviewing(id);
      }
      return;
    }
    preset.play();
    setPreviewing(id);
    window.setTimeout(() => setPreviewing((p) => (p === id ? null : p)), 500);
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

      {/* WhatsApp-style scrollable pickers */}
      {SECTIONS.map((section) => (
        <div key={section.key} className="rounded-2xl bg-[#F5F0E8] dark:bg-[#2A2A2A] p-3.5">
          <Space size={8} className="mb-2 px-0.5">
            <span className="text-[#E07A5F]">{section.icon}</span>
            <Text className="!text-xs !font-semibold !uppercase !tracking-wide !text-[#8C8C8C]">
              {section.label}
            </Text>
          </Space>
          <div className="max-h-48 overflow-y-auto scrollbar-thin space-y-0.5 pr-1">
            {SOUND_PRESETS[section.key].map((preset) => {
              const id = `${section.key}:${preset.id}`;
              return (
                <PresetRow
                  key={preset.id}
                  preset={preset}
                  active={sounds.selected[section.key] === preset.id}
                  isPlaying={previewing === id}
                  onSelect={() => sounds.selectPreset(section.key, preset.id)}
                  onTogglePreview={() => togglePreview(section.key, preset)}
                />
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
