import type { ReactNode } from "react";
import Image from "next/image";
import { ImageOff } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Tag } from "@/components/ui/Badge";
import { cn } from "@/lib/utils/cn";

export interface ProjectCardProps {
  href: string;
  title: ReactNode;
  client?: ReactNode;
  industry?: ReactNode;
  services: string[];
  summary?: ReactNode;
  /** Real project imagery only; omit to show the explicit placeholder frame. */
  image?: { src: string; alt: string; width: number; height: number };
  placeholderLabel: string;
  className?: string;
}

export function ProjectCard({
  href,
  title,
  client,
  industry,
  services,
  summary,
  image,
  placeholderLabel,
  className,
}: ProjectCardProps) {
  return (
    <article className={cn("group relative flex flex-col gap-5", className)}>
      <div className="relative aspect-[4/3] overflow-hidden rounded-md bg-bg-sunken">
        {image ? (
          <Image
            src={image.src}
            alt={image.alt}
            width={image.width}
            height={image.height}
            sizes="(min-width: 1024px) 40vw, 100vw"
            className="size-full object-cover transition-transform duration-[var(--duration-slower)] ease-[var(--ease-emphasized)] group-hover:scale-[1.04]"
          />
        ) : (
          <div className="flex size-full flex-col items-center justify-center gap-2 border border-dashed border-line-strong text-fg-muted">
            <ImageOff aria-hidden className="size-6" />
            <span className="text-xs">{placeholderLabel}</span>
          </div>
        )}
      </div>
      <div className="flex flex-col gap-2">
        {client || industry ? (
          <p className="eyebrow flex flex-wrap gap-x-2">
            {client ? <span>{client}</span> : null}
            {client && industry ? <span aria-hidden>·</span> : null}
            {industry ? <span>{industry}</span> : null}
          </p>
        ) : null}
        <h3 className="text-h3">
          {/* Stretched link: the whole card is clickable, one tab stop, title as name. */}
          <Link href={href} className="after:absolute after:inset-0 group-hover:text-accent">
            {title}
          </Link>
        </h3>
        {summary ? <p className="text-sm text-fg-muted">{summary}</p> : null}
        {services.length ? (
          <ul className="mt-1 flex flex-wrap gap-2">
            {services.map((s) => (
              <li key={s}>
                <Tag>{s}</Tag>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </article>
  );
}
