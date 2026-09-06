'use client';
import * as Dropdown from '@radix-ui/react-dropdown-menu';
import type { ReactNode } from 'react';
export function DropdownMenu({
  trigger,
  children,
  label,
}: {
  trigger: ReactNode;
  children: ReactNode;
  label?: string;
}) {
  return (
    <Dropdown.Root>
      <Dropdown.Trigger asChild>{trigger}</Dropdown.Trigger>
      <Dropdown.Portal>
        <Dropdown.Content className="dropdown-content" sideOffset={7} align="end">
          {label && <Dropdown.Label className="dropdown-label">{label}</Dropdown.Label>}
          {children}
        </Dropdown.Content>
      </Dropdown.Portal>
    </Dropdown.Root>
  );
}
export const DropdownItem = Dropdown.Item;
export const DropdownSeparator = Dropdown.Separator;
