/**
 * Renders schema.org structured data. The payload is serialized here, with
 * every "<" escaped, so a product or company name containing "</script>"
 * can never close the tag early.
 */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}
