import { Mail, MapPin, MessageCircle, Phone } from "lucide-react";

import type { BuyerContact } from "@/lib/supabase/queries/buyer-contacts";
import { SITE_NAME } from "@/lib/site";
import { Button } from "@/components/ui/button";

/** A wa.me link to the buyer, with a short opener naming the requirement. */
function buyerWhatsappUrl(contact: BuyerContact): string {
  const text = `Hi ${contact.name}, I saw your requirement for ${contact.productText} (qty: ${contact.quantity}) on ${SITE_NAME}.`;
  return `https://wa.me/${contact.phone.replace(/^\+/, "")}?text=${encodeURIComponent(text)}`;
}

/** An unlocked buyer's details with call, WhatsApp and email buttons (spec 0009). Used in the dialog and on My buyer contacts. */
export function BuyerContactDetails({ contact }: { contact: BuyerContact }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 rounded-xl border border-border bg-bg-soft p-4 text-sm">
        <span className="font-heading text-base font-semibold text-green-deep">{contact.name}</span>
        <a href={`tel:${contact.phone}`} className="flex items-center gap-2 text-foreground hover:text-green">
          <Phone className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          {contact.phone}
        </a>
        {contact.email && (
          <a href={`mailto:${contact.email}`} className="flex items-center gap-2 break-all text-foreground hover:text-green">
            <Mail className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            {contact.email}
          </a>
        )}
        {contact.location && (
          <span className="flex items-center gap-2 text-muted-foreground">
            <MapPin className="size-4 shrink-0" aria-hidden="true" />
            {contact.location}
          </span>
        )}
        <span className="text-muted-foreground">
          Needs <strong className="font-semibold text-foreground">{contact.productText}</strong>, qty{" "}
          <strong className="font-semibold text-foreground">{contact.quantity}</strong>
        </span>
        {contact.notes && <p className="whitespace-pre-line text-muted-foreground">{contact.notes}</p>}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Button
          className="rounded-full bg-[#25D366] text-white hover:bg-[#1EBE5A]"
          render={<a href={buyerWhatsappUrl(contact)} target="_blank" rel="noopener noreferrer" />}
          nativeButton={false}
        >
          <MessageCircle className="size-4" aria-hidden="true" />
          WhatsApp
        </Button>
        <Button variant="outline" className="rounded-full" render={<a href={`tel:${contact.phone}`} />} nativeButton={false}>
          <Phone className="size-4" aria-hidden="true" />
          Call
        </Button>
      </div>
    </div>
  );
}
