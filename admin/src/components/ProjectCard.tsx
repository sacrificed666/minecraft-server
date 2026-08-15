import Image from "next/image";
import type { ReactNode } from "react";

/**
 * One Modrinth project: icon, title, blurb, and whatever the page needs in the
 * footer. Shared so the Mods and Looks grids stay the same object.
 */
export function ProjectCard({
  title,
  description,
  iconUrl,
  href,
  badge,
  footer,
}: {
  title: string;
  description: string;
  iconUrl: string | null;
  href: string;
  badge?: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <li className="glass glass-hover flex flex-col gap-3 rounded-xl p-3">
      <div className="flex min-w-0 items-start gap-3">
        {iconUrl ? (
          <Image
            src={iconUrl}
            alt=""
            width={48}
            height={48}
            className="size-12 shrink-0 rounded-lg object-cover"
            unoptimized
          />
        ) : (
          <div className="size-12 shrink-0 rounded-lg bg-(--glass-inset)" aria-hidden="true" />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2">
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className="min-w-0 flex-1 truncate text-sm font-medium hover:text-(--series-tps)"
              title={title}
            >
              {title}
            </a>
            {badge}
          </div>
          <p className="line-clamp-2 text-xs text-ink-muted">{description}</p>
        </div>
      </div>
      {footer && (
        <div className="mt-auto flex items-center justify-between gap-2 text-[11px] text-ink-muted">
          {footer}
        </div>
      )}
    </li>
  );
}
