"use client";

import { MessageCircleMore } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n/provider";

/** veloFIT support WhatsApp number (international format, no "+"). */
const SUPPORT_WHATSAPP = "972500000000";

/** Floating "Chat with us" support launcher — opens a WhatsApp chat with support. */
export function ChatFab() {
  const t = useT();
  const openSupport = () => {
    const text = encodeURIComponent("Hi veloFIT support, I need help with");
    window.open(`https://wa.me/${SUPPORT_WHATSAPP}?text=${text}`, "_blank", "noopener,noreferrer");
  };
  return (
    <Button
      size="lg"
      className="fixed end-6 bottom-6 z-40 rounded-full shadow-lg shadow-primary/30"
      onClick={openSupport}
    >
      <MessageCircleMore className="size-5" />
      {t("Chat with us")}
    </Button>
  );
}
