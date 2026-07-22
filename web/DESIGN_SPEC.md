# Astryx Redesign — Design Specification

Binding spec for the full migration of `web/` from shadcn/Tailwind to **Astryx**
(`@astryxdesign/core` + `@astryxdesign/theme-neutral`). Every migration agent MUST
read this file AND `web/.claude/CLAUDE.md` (Astryx section) before touching code.

## Product archetype

This is a **tracker / work tool** (multi-tenant project management: workspaces →
projects → tasks). Per `npx astryx docs layout`:

- Frame: **AppShell + SideNav**; inspector **LayoutPanel** patterns for detail surfaces.
- Container policy: **rows, not cards**. Dense data (tasks, members, registrations,
  activity, backlog) renders as edge-to-edge `Table` or `List`/`Item` rows with
  dividers. `Card` is ONLY for dashboard KPI widgets, gallery entries, and settings
  groups. Never wrap list records in Cards. Never nest Cards.
- Status → `StatusDot` / `Token`. `Badge` only for counts and enumerated states.

## Non-negotiable rules

1. **No Tailwind classes, no `cn()`, no `class-variance-authority`, no `style={{}}`,
   no custom CSS files.** The Tailwind pipeline still exists during migration for
   files you don't own — but every file YOU migrate must end up 100% free of
   Tailwind classNames, `@/components/ui/*` imports, and `@/lib/utils` (`cn`).
   **Narrow exception:** a *vars-only* inline `style` (setting ONLY `--*` custom
   properties, no visual CSS like color/padding/margin) on a single wrapper is
   permitted SOLELY to feed CSS variables into a third-party lib that exposes no
   Astryx-stylable surface — e.g. FullCalendar's `--fc-*`, TipTap, Excalidraw.
   This is the token-bridge pattern already used for the calendar. Everywhere
   else, `style={{}}` remains banned. Never use it for layout or Astryx surfaces.
   **Two additional scoped exceptions (orchestrator ruling, supersedes any
   earlier "xstyle last resort" instruction):**
   (a) **dnd-kit draggables**: the `transform`/`transition` values dnd-kit
       computes per-drag MUST be applied as an inline `style` on the draggable
       element (this is dnd-kit's required mechanism). Nothing else may ride
       along in that style object.
   (b) **Runtime-computed geometry**: elements whose position/size is computed
       at runtime from data (timeline/gantt bar `insetInlineStart`/`width`,
       crop-container `position: relative` for react-easy-crop) may set ONLY
       those geometry properties inline. All visual styling (colors, radius,
       borders, typography, shadows) still comes from Astryx components/tokens —
       e.g. a timeline bar is an Astryx component positioned by an inline
       geometry style, never a hand-painted div.
2. Layout = Astryx layout components only: `AppShell`, `Layout`/`LayoutContent`/
   `LayoutPanel`/`LayoutHeader`, `VStack`/`HStack`/`Stack` (gap/padding props),
   `Grid`, `Section`, `FormLayout`, `Center`, `Divider`. No raw `<div>`/`<span>`
   for layout. **`xstyle`/`stylex.create` is NOT available in app code** — the
   build has no StyleX compiler wired, so a `stylex.create()` value passed to any
   `xstyle` prop CRASHES that component at runtime ("Unexpected 'stylex.create'
   call at runtime"). Astryx's own components are unaffected (pre-compiled into
   `astryx.css`). Solve layout with component props; there is no styling escape
   hatch. Sole exception: bridging CSS custom properties into a third-party lib
   (see rule 1) via a vars-only inline `style`.
3. Typography = `Text` component (verify props via `npx astryx component Text`).
   No `<h1>`–`<h6>`/`<p>` with classes.
4. **Discover, don't guess**: before using any component run
   `npx astryx component <Name>`; before building a surface run
   `npx astryx build "<what you're building>"` and consider the suggested
   template/blocks (`npx astryx template <name> --skeleton`).
5. Keep ALL business logic intact: firestore calls, hooks, react-router, zustand,
   react-query, permissions. This is a re-skin at the JSX layer, not a rewrite.
6. Icons: use Astryx `Icon` (`npx astryx docs icons`). Replace `lucide-react`
   usages in your files if the Astryx icon set covers them; where it doesn't,
   keep the lucide icon rendered inside Astryx components (no styling classes).
7. Timestamps → `Timestamp` component where a date is displayed; keep
   `date-utils` helpers for logic.
8. Loading → `Skeleton`/`Spinner`; empty → `EmptyState`; errors → `Banner`.
   Every async surface must handle loading/empty/error consistently.

## Component mapping (shadcn → Astryx)

| shadcn (`components/ui/`) | Astryx |
|---|---|
| button, toggle, toggle-group | `Button`, `IconButton`, `ToggleButton(Group)`, `ButtonGroup`, `SegmentedControl` (view switchers) |
| input, textarea, label, form | `TextInput`, `TextArea`, `NumberInput`, `Field`/`FieldLabel`/`FieldStatus`, `FormLayout` |
| select | `Selector` / `MultiSelector` / `Typeahead` |
| checkbox, radio | `CheckboxInput`/`CheckboxList`, `RadioList` |
| dialog, alert-dialog | `Dialog`/`DialogHeader`, `AlertDialog` (destructive confirms) |
| sheet (side panels) | Inspector pattern: `LayoutPanel` (in-frame) or self-contained overlay panel — see "Detail surfaces" |
| dropdown-menu | `DropdownMenu`/`MoreMenu` (row overflow actions) |
| command (search palette) | `CommandPalette` family |
| popover, tooltip | `Popover`, `Tooltip`, `HoverCard` |
| table | `Table`/`TableRow`/`TableCell` (+ selection/sorting plugins per docs) |
| tabs | `TabList`/`Tab`/`TabMenu` |
| badge | `Badge` (counts/enums only), `Token` (labels, priorities, categories), `StatusDot` |
| avatar | `Avatar`, `AvatarGroup(+Overflow)`, `AvatarStatusDot` (presence) |
| card | `Card` (widgets only), `ClickableCard` (project tiles) |
| skeleton, loader | `Skeleton`, `Spinner`, `ProgressBar` |
| separator | `Divider` |
| scroll-area | `isScrollable` prop on Stack/LayoutContent/LayoutPanel |
| sonner (toasts) | Astryx `Toast` via the shared helper `src/components/system/toast` (created by foundation) — never import sonner |
| collapsible | `Collapsible`/`CollapsibleGroup` |
| slider, progress | `Slider`, `ProgressBar` |
| empty-state | `EmptyState` |
| aceternity (background-beams, shooting-stars, stars-background, hero-highlight, text-generate-effect, motion-page, stagger) | DELETE — replace with clean Astryx surfaces; no decorative substitutes |

## Canonical patterns

### App frame (foundation-owned)
`WorkspaceLayout` renders `AppShell` + `SideNav` (nav 256px budget). Responsive
contract: ≤768px nav collapses to `MobileNav`. All workspace/project pages render
inside `AppShell` content with `contentPadding={0}` and own their internal frame.

### Page scaffold (every page)
The foundation agent appends the exact canonical scaffold snippet below after
building the frame — USE IT VERBATIM as your starting structure:
header row (title `Text`, primary actions) + content region. Do not invent
per-page header styles.

### Detail surfaces (Task detail, Event detail)
Right-side inspector panel. Components keep their existing props interface
(e.g. `TaskDetailSheet` keeps `{open, onOpenChange, task…}`-style API) so hosts
don't change. **CANONICAL (orchestrator ruling): right-flush full-height drawer
via `Dialog` with `position={{top: 0, right: 0, bottom: 0}}`, `width={460}`,
`maxHeight="100vh"`, inner `Layout` with scrollable `LayoutContent`,
`MetadataList` for field rows** — the pattern TaskDetailSheet implements. All
record-detail surfaces (task, event) MUST use it; centered `Dialog` stays
reserved for create/edit forms and confirmations.

### Forms
`FormLayout` + `Field`/`FieldLabel`/`FieldStatus` wrapping `TextInput` etc.
Submit = primary `Button` bottom-end. Destructive = `AlertDialog` confirm.

### Dense lists
- Columnar records (members, registrations, timesheet, backlog): `Table`.
- Single-line scannable records (tasks in list view, activity feed, notifications):
  `List`/`Item` rows, 32–40px height, edge-to-edge.
- Kanban cards are the exception: board columns use compact `ClickableCard` tiles.

### Third-party functional libraries (KEEP, token-bridge)
- `@dnd-kit` (kanban DnD): keep logic; rendered cards/columns are Astryx.
- FullCalendar: keep; theme via its CSS-variable API mapped to Astryx tokens
  (`var(--color-…)`) — configuration in JS/props, not a custom stylesheet.
- TipTap (RichTextEditor): keep engine; toolbar = Astryx `Toolbar`+`IconButton`;
  content area styled via tokens (minimal, through the editor's own API).
- Excalidraw (whiteboard): keep as-is inside the Astryx frame.

### Theming
- `<Theme theme={neutralTheme} mode={mode}>` at root (foundation).
- Mode (`system|light|dark`) lives in `src/store/theme.ts` (zustand, persisted);
  Settings page exposes the toggle.
- NEVER override `--color-*` in `:root`; theme changes only via `astryx theme`.

## File ownership

Each wave-1 agent owns an exclusive file list (given in its task prompt). Never
edit files outside your list. Shared atoms (`PriorityIcon`, `LabelBadge`,
`EpicBadge`, toast helper) are owned as assigned; consumers import them unchanged.

## Definition of done (per agent)

- [ ] No imports from `@/components/ui/*`, `sonner`, `@/lib/utils` (cn) in owned files
- [ ] No Tailwind utility classNames, no `style={{}}`, no raw layout divs/spans
- [ ] Loading / empty / error states present on async surfaces
- [ ] `npx tsc -b --noEmit` (from `web/`) introduces NO new errors in owned files
- [ ] Business logic untouched (firestore/hooks/routing diffs are JSX-only)

---

## Canonical code contracts (foundation output)

The foundation wave is built. The app frame (`AppShell` + `SideNav`), theming,
routing bridge, and toast system are wired. Every page agent MUST conform to the
contracts below. These snippets are derived from the real, verified Astryx APIs
(v0.1.7) already integrated in `main.tsx` / `WorkspaceLayout.tsx` / `Sidebar.tsx`.

### (a) Canonical page scaffold — USE VERBATIM

The frame owns `AppShell` (with `contentPadding={0}`). **Pages must NOT render an
`AppShell`** — they render a `Layout` that owns their internal header + content.
Header row = `Heading` title + right-aligned actions; content = scrollable region.

```tsx
import { Layout, LayoutHeader, LayoutContent } from "@astryxdesign/core/Layout";
import { HStack } from "@astryxdesign/core/HStack";
import { Heading } from "@astryxdesign/core/Heading";
import { Button } from "@astryxdesign/core/Button";

export default function ExamplePage() {
  return (
    <Layout
      header={
        <LayoutHeader hasDivider>
          <HStack justify="between" align="center" paddingInline={4} paddingBlock={3}>
            <Heading level={1}>Page title</Heading>
            <HStack gap={2}>
              {/* primary/secondary actions, view switchers */}
              <Button label="New item" variant="primary" />
            </HStack>
          </HStack>
        </LayoutHeader>
      }
    >
      {/* Dense records: LayoutContent padding={0} + Table/List edge-to-edge.
          Forms/settings/text: padding={4}. isScrollable defaults to true. */}
      <LayoutContent padding={4}>
        {/* loading -> <Skeleton/>/<Spinner/>; empty -> <EmptyState/>;
            error -> <Banner status="error"/>; then the real body */}
      </LayoutContent>
    </Layout>
  );
}
```

Rules that ride on this scaffold:
- Title is `Heading level={1}` (NOT `Text`). Sub-labels/captions use `Text`.
- `Layout` `height` defaults to `fill` — it fills the AppShell content region and
  gives the content its own scroll container. Do not add outer scroll wrappers.
- Never wrap the whole page in a `Card`. `Card` = KPI widgets / settings groups only.
- Detail inspectors: `LayoutPanel` in the `end` slot of `Layout` (width 380–480,
  `resizable`, `hasDivider`, `isScrollable`) — keep the existing sheet prop API.

### (b) Toast helper — replace every `sonner` import

`sonner` is gone. Import the shared helper; the call-site API is identical.

```tsx
import { toast } from "@/components/system/toast";

toast.success("Saved");            // note: renders as an INFO toast (see gotcha)
toast.error("Something went wrong");
toast.info("Heads up");
```

- These are **module-level imperative functions**, safe inside async handlers.
  Do NOT call `useToast` directly — always go through this helper.
- No provider/viewport to mount in pages: `ToastBridge` is already mounted once in
  `main.tsx` inside `<Theme>`, and Astryx's `useToast` self-mounts its viewport.

### (c) Theme mode store

Persisted (`localStorage`), drives the root `<Theme mode=…>`. The Settings page
owns the visible toggle.

```tsx
import { useThemeStore } from "@/store/theme";

const mode = useThemeStore((s) => s.mode);       // 'system' | 'light' | 'dark'
const setMode = useThemeStore((s) => s.setMode);

// Settings toggle example (three explicit choices):
<SegmentedControl
  label="Theme mode"
  value={mode}
  onChange={(v) => setMode(v as "system" | "light" | "dark")}
>
  <SegmentedControlItem value="system" label="System" />
  <SegmentedControlItem value="light" label="Light" />
  <SegmentedControlItem value="dark" label="Dark" />
</SegmentedControl>
```

Never toggle a `.dark` class or override `--color-*` in `:root` — mode flows only
through this store → `<Theme>`.

### (d) AppShell / SideNav / routing gotchas (READ THESE)

1. **Routing is wired via `LinkProvider`.** `main.tsx` wraps the app in
   `<LinkProvider component={RouterLink}>` where `RouterLink` maps Astryx's `href`
   prop → react-router's `to`. Consequences:
   - `SideNavItem`, Astryx `Link`, etc. route client-side automatically. Use the
     `href` prop (a URL string), NOT `to`. Do not import react-router `Link` for
     Astryx components.
   - For plain in-content navigation links, use Astryx `Link` with `href=…`.
2. **Do not mount another `AppShell`.** One AppShell lives in `WorkspaceLayout`.
   Pages start at `Layout` (see scaffold). Nesting AppShell breaks the frame.
3. **Mobile is automatic.** AppShell auto-renders a mobile top-bar hamburger +
   drawer for the sidenav below the `md` (768px) breakpoint. Don't hand-roll a
   `MobileNav`; the responsive contract (>768 rail 256 | ≤768 drawer) is satisfied
   by the frame.
4. **Icons:** `SideNavItem.icon` / `DropdownMenu` item `icon` accept
   `IconType = ComponentType<SVGProps>`, so **lucide-react icons pass directly**
   (that's how the sidebar renders them). Astryx's semantic icon set is small
   (~27 names: `calendar`, `clock`, `wrench`, `search`, `check`, chevrons, …); use
   `npx astryx docs icons`. Where a semantic name is missing, pass the lucide
   component — allowed by DESIGN_SPEC rule 6.
5. **Toast has only `info` and `error` types** — there is no success/warning color.
   `toast.success` maps to `info`. If you need a green success affordance, use a
   `Banner status="success"` in-context, not a toast.
6. **`TooltipProvider` (shadcn) and `sonner`'s `Toaster` were removed from
   `main.tsx`.** Astryx components have built-in tooltips (`tooltip` prop /
   `Tooltip`). Migrated files must not reintroduce `@/components/ui/tooltip`. If an
   un-migrated shadcn surface renders a Radix `Tooltip` and errors about a missing
   provider, that surface should self-wrap or (preferably) be migrated.
7. **`index.css` deleted the shadcn `:root`/`.dark` token blobs.** Legacy shadcn
   color utilities now resolve to Astryx's Tailwind bridge (`tailwind-theme.css`).
   Names overlap but semantics differ — notably `bg-primary` now = Astryx
   `--color-text-primary` (near-black), not the old brand blue. Un-migrated pages
   may show off colors until migrated; this is expected, not a bug. Do not re-add
   shadcn tokens — migrate the surface to Astryx components instead.
8. **`theme.css` is imported once, layered, in `index.css`.** Do not
   `import '@astryxdesign/theme-neutral/theme.css'` in `main.tsx` or components — a
   JS import injects it unlayered and breaks cascade-layer order.
9. **`xstyle` / `stylex.create` is UNAVAILABLE in app code** (no StyleX compiler
   in the Vite build). Passing a `stylex.create()` value to any `xstyle` prop
   throws at runtime. Do not use `xstyle` — solve everything with component props.
   The ONLY sanctioned raw-`style` use is a vars-only inline `style` (custom
   properties only) to bridge tokens into a third-party lib with no Astryx-
   stylable surface (FullCalendar `--fc-*`, TipTap, Excalidraw) — see rules 1 & 2.
   If you think a surface truly needs `xstyle`, stop and flag it rather than
   shipping a crash.
