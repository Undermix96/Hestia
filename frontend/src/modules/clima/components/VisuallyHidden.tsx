import type { ElementType, ReactNode } from 'react';

/** Content read by assistive technology but not shown (global `.visually-hidden`). */
export function VisuallyHidden({
  as: Tag = 'span',
  id,
  children,
}: {
  as?: ElementType;
  id?: string;
  children: ReactNode;
}) {
  return (
    <Tag className="visually-hidden" id={id}>
      {children}
    </Tag>
  );
}
