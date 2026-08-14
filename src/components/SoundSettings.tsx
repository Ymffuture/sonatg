// src/components/SoundSettings.tsx
import React, { useEffect, useState } from "react";
import { useSounds } from "@/hooks/useSounds";

export default function SoundSettings() {
  const sounds = useSounds();
  const [sendUrl, setSendUrl] = useState("");
  const [receiveUrl, setReceiveUrl] = useState("");
  const [ringtoneUrl, setRingtoneUrl] = useState("");

  useEffect(() => {
    try {
      const raw = JSON.parse(localStorage.getItem("sona.sounds.sources") || "{}");
      setSendUrl(raw.send || "");
      setReceiveUrl(raw.receive || "");
      setRingtoneUrl(raw.ringtone || "");
    } catch {}
  }, []);

  return (
    <div className="space-y-4">
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={sounds.enabled} onChange={(e) => sounds.setEnabled(e.target.checked)} />
        Enable Sounds
      </label>

      <label>
        Volume:
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={sounds.volume}
          onChange={(e) => sounds.setVolume(Number(e.target.value))}
        />
        <span className="ml-2">{Math.round(sounds.volume * 100)}%</span>
      </label>

      <div className="grid gap-2">
        <div>
          <div className="font-medium">Send sound</div>
          <input value={sendUrl} onChange={(e) => setSendUrl(e.target.value)} placeholder="/send.mp3 or URL" />
          <button onClick={() => sounds.setSource("send", sendUrl || null)}>Save</button>
          <button onClick={() => sounds.testSend()}>Test</button>
        </div>

        <div>
          <div className="font-medium">Receive sound</div>
          <input value={receiveUrl} onChange={(e) => setReceiveUrl(e.target.value)} placeholder="/receive.mp3 or URL" />
          <button onClick={() => sounds.setSource("receive", receiveUrl || null)}>Save</button>
          <button onClick={() => sounds.testReceive()}>Test</button>
        </div>

        <div>
          <div className="font-medium">Ringtone</div>
          <input value={ringtoneUrl} onChange={(e) => setRingtoneUrl(e.target.value)} placeholder="/ringtone.mp3 or URL" />
          <button onClick={() => sounds.setSource("ringtone", ringtoneUrl || null)}>Save</button>
          <button onClick={() => sounds.startRingtone()}>Start</button>
          <button onClick={() => sounds.stopRingtone()}>Stop</button>
        </div>
      </div>
    </div>
  );
}
