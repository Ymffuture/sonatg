import { createFileRoute } from "@tanstack/react-router";
import SonaChat from "@/components/SonaChat";

export const Route = createFileRoute("/_authenticated/")({
  component: SonaChat,
  head: () => ({
    meta: [
      { title: "Sona — Talk Gold" },
      { name: "description", content: "Real-time chat with friends and Sona AI." },
    ],
  }),
});
