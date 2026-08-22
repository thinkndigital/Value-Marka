/**
 * Renders one schema.org JSON-LD block. Values here can include seller-
 * entered text (product names/descriptions) — JSON.stringify already
 * escapes quotes, but `</script>` inside a string would still terminate
 * the tag early, so `<` is escaped to its unicode form (valid inside a
 * JSON string, invisible to the schema.org parser) the same way
 * Next.js's own metadata APIs do.
 */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}
