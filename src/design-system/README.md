# ATHAR GPS Design System

This folder is the additive source of truth for future screen work. Phase 0
does not replace or restyle an existing page; later phases should consume these
tokens and primitives instead of adding one-off visual rules.

## Rules

- Use `--ds-color-primary` only for active, connected, successful,
  current-location, or important-action states.
- Use the fixed `--ds-space-*` and `--ds-radius-*` scales.
- Use `Button`, `Card`, `IconButton`, `Sheet`, `Modal`, and the state primitives
  from `src/design-system`.
- Use the existing `lucide-react` icon set with accessible labels. Do not add
  emoji or a second icon library.
- Keep Arabic RTL correct with logical CSS properties (`margin-inline`,
  `padding-inline`, `inset-inline`). Do not mirror directional icons that
  communicate physical direction.
- Preserve the 44px minimum touch target and safe-area padding on mobile.
- Every async surface needs loading, empty, error, offline, and last-updated
  states where that state can occur.
- Respect `prefers-reduced-motion`; motion must communicate state, never run
  continuously without purpose.

## Import

```jsx
import { Button, Card, Modal, Sheet, Skeleton, StateMessage } from '../../design-system'
```