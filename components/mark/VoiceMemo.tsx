"use client";

import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { Mic, Square, X } from "lucide-react";

// Browser-native live speech recognition. Streams partial transcripts
// while the user speaks. No audio is uploaded — we keep the text only.
// When the user stops, we append the final transcript to whatever's in
// the Moment textarea via the onTranscript callback.
//
// Permission model: the browser prompts the first time the user taps
// record. If they deny, we catch and message the failure quietly.
// Safari requires user-gesture + https; Chrome desktop + mobile OK.

// Minimal type declarations for the vendor-prefixed SpeechRecognition.
/* eslint-disable @typescript-eslint/no-explicit-any */
type SR = any;

function getSRConstructor(): SR | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SR;
    webkitSpeechRecognition?: SR;
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

type Props = {
  onTranscript: (text: string) => void;
};

export function VoiceMemo({ onTranscript }: Props) {
  const [supported, setSupported] = useState(false);
  const [recording, setRecording] = useState(false);
  const [partial, setPartial] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const recRef = useRef<SR | null>(null);
  const startedAt = useRef<number>(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setSupported(!!getSRConstructor());
  }, []);

  function stopTick() {
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
  }

  useEffect(() => {
    return () => {
      stopTick();
      try {
        recRef.current?.stop();
      } catch {}
    };
  }, []);

  async function start() {
    const Ctor = getSRConstructor();
    if (!Ctor) {
      toast.error("voice memo isn't available in this browser");
      return;
    }
    // Safari insists we explicitly request mic permission even for SR on some
    // versions. getUserMedia forces the prompt and then we immediately stop
    // the tracks — we don't upload audio, just use the permission to unlock SR.
    try {
      if (
        navigator.mediaDevices &&
        typeof navigator.mediaDevices.getUserMedia === "function"
      ) {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
        stream.getTracks().forEach((t) => t.stop());
      }
    } catch {
      toast.error("microphone access denied");
      return;
    }

    const rec = new Ctor();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = navigator.language || "en-US";

    let finalText = "";
    rec.onresult = (ev: { resultIndex: number; results: { [k: number]: { [k: number]: { transcript: string }; isFinal: boolean } } & { length: number } }) => {
      let interim = "";
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const r = ev.results[i];
        if (r.isFinal) {
          finalText += r[0].transcript;
        } else {
          interim += r[0].transcript;
        }
      }
      setPartial((finalText + " " + interim).trim());
    };
    rec.onerror = (e: { error?: string }) => {
      // "no-speech" fires on silence; don't treat as an error.
      if (e.error && e.error !== "no-speech" && e.error !== "aborted") {
        toast.error(`voice: ${e.error}`);
      }
    };
    rec.onend = () => {
      setRecording(false);
      stopTick();
      const text = (finalText || partial).trim();
      if (text) onTranscript(text);
      setPartial("");
      setElapsed(0);
    };

    recRef.current = rec;
    startedAt.current = Date.now();
    setElapsed(0);
    tickRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt.current) / 1000));
    }, 500);

    try {
      rec.start();
      setRecording(true);
    } catch {
      toast.error("couldn't start voice memo");
      stopTick();
    }
  }

  function stop() {
    try {
      recRef.current?.stop();
    } catch {}
  }

  function cancel() {
    try {
      recRef.current?.abort();
    } catch {}
    stopTick();
    setRecording(false);
    setPartial("");
    setElapsed(0);
  }

  if (!supported) return null;

  if (!recording) {
    return (
      <button
        type="button"
        onClick={start}
        className="flex items-center gap-1.5 text-xs uppercase tracking-[0.2em] text-earth/60 hover:text-earth"
        aria-label="Start voice memo"
      >
        <Mic className="w-3.5 h-3.5" />
        Voice
      </button>
    );
  }

  return (
    <div className="flex items-center gap-3 px-3 py-2 border border-amber/50 bg-amber/5">
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-amber" />
      </span>
      <span className="font-mono text-xs text-earth/70 tabular-nums">
        {String(Math.floor(elapsed / 60)).padStart(1, "0")}:
        {String(elapsed % 60).padStart(2, "0")}
      </span>
      {partial && (
        <span className="flex-1 text-xs text-earth/60 truncate italic">
          {partial}
        </span>
      )}
      <button
        type="button"
        onClick={stop}
        className="flex items-center gap-1 text-xs uppercase tracking-[0.2em] text-earth hover:text-amber"
      >
        <Square className="w-3 h-3" /> Done
      </button>
      <button
        type="button"
        onClick={cancel}
        className="text-earth/40 hover:text-earth"
        aria-label="Cancel"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
