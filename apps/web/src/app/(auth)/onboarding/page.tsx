"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Stepper, Card, CardHeader, Select, Field } from "@click/ui";

const steps = [
  { id: "calendar", label: "Calendar" },
  { id: "capture", label: "Capture" },
  { id: "providers", label: "Providers" },
  { id: "retention", label: "Retention" },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [calendar, setCalendar] = useState("google");
  const [capture, setCapture] = useState("bot");
  const [asr, setAsr] = useState("local-whisper");
  const [llm, setLlm] = useState("openai");
  const [retention, setRetention] = useState("90");

  const isLast = step === steps.length - 1;

  const advance = () => {
    if (isLast) {
      router.push("/app");
      return;
    }
    setStep((s) => s + 1);
  };

  const stepperSteps = steps.map((s, i) => ({
    ...s,
    state: (i < step ? "done" : i === step ? "active" : "pending") as "done" | "active" | "pending",
  }));

  return (
    <div className="mx-auto max-w-2xl">
      <Card className="p-6">
        <CardHeader
          title="Welcome to Click"
          description="Four quick steps to get your first meeting captured."
        />
        <div className="mt-4">
          <Stepper steps={stepperSteps} />
        </div>

        <div className="mt-6 grid gap-4">
          {step === 0 ? (
            <>
              <p className="text-sm text-text-muted">
                Connect the calendar you use for meetings. We only read events; we never send mail.
              </p>
              <Field label="Calendar provider" htmlFor="calendar">
                <Select id="calendar" value={calendar} onChange={(e) => setCalendar(e.target.value)}>
                  <option value="google">Google Calendar</option>
                  <option value="microsoft">Microsoft 365</option>
                  <option value="none">I'll add meetings manually</option>
                </Select>
              </Field>
            </>
          ) : null}

          {step === 1 ? (
            <>
              <p className="text-sm text-text-muted">
                Choose how Click captures a meeting. You can change this per meeting later.
              </p>
              <Field label="Default capture mode" htmlFor="capture">
                <Select id="capture" value={capture} onChange={(e) => setCapture(e.target.value)}>
                  <option value="bot">Send a bot to the call</option>
                  <option value="desktop">Record from this device (no bot)</option>
                  <option value="extension">Capture the browser tab</option>
                </Select>
              </Field>
            </>
          ) : null}

          {step === 2 ? (
            <>
              <p className="text-sm text-text-muted">
                Bring your own keys. A fresh install works with the local Whisper model and needs no API key.
              </p>
              <Field label="Speech-to-text" htmlFor="asr">
                <Select id="asr" value={asr} onChange={(e) => setAsr(e.target.value)}>
                  <option value="local-whisper">Local Whisper (no key)</option>
                  <option value="deepgram">Deepgram</option>
                  <option value="assemblyai">AssemblyAI</option>
                </Select>
              </Field>
              <Field label="Summarisation model" htmlFor="llm">
                <Select id="llm" value={llm} onChange={(e) => setLlm(e.target.value)}>
                  <option value="openai">OpenAI (gpt-4o-mini)</option>
                  <option value="anthropic">Anthropic (Claude)</option>
                  <option value="ollama">Ollama (local)</option>
                </Select>
              </Field>
            </>
          ) : null}

          {step === 3 ? (
            <>
              <p className="text-sm text-text-muted">
                Set how long transcripts and audio are kept. You can enable transcript-only mode to discard audio right after transcription.
              </p>
              <Field label="Retention" htmlFor="retention">
                <Select id="retention" value={retention} onChange={(e) => setRetention(e.target.value)}>
                  <option value="30">30 days</option>
                  <option value="90">90 days</option>
                  <option value="365">1 year</option>
                  <option value="0">Keep forever</option>
                </Select>
              </Field>
            </>
          ) : null}
        </div>

        <div className="mt-6 flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
          >
            Back
          </Button>
          <Button onClick={advance}>{isLast ? "Finish setup" : "Continue"}</Button>
        </div>
      </Card>
    </div>
  );
}
