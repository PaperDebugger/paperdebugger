/**
 * HeaderMenu
 *
 * A "..." dropdown menu for panel headers with built-in Open in New Window action.
 * Pass page-specific menu items as children; they appear above the separator.
 * Optionally includes a "Learn More" link to documentation when helpFeature is provided.
 */

import * as React from 'react'
import { MoreHorizontal } from 'lucide-react'
import { HeaderIconButton } from './HeaderIconButton'
import {
  DropdownMenu,
  DropdownMenuTrigger,
} from './dropdown-menu'
import {
  StyledDropdownMenuContent,
} from './styled-dropdown'

interface HeaderMenuProps {
  children?: React.ReactNode
}

export function HeaderMenu({ children }: HeaderMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <HeaderIconButton icon={<MoreHorizontal className="h-4 w-4" />} />
      </DropdownMenuTrigger>
      <StyledDropdownMenuContent align="end">
        {children}
      </StyledDropdownMenuContent>
    </DropdownMenu>
  )
}
